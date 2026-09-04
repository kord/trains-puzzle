// SAT-based solver built on the `logic-solver` package. Used as one of the
// generator's backends (see `solverBackend.ts`); `solver.ts` retains the
// original CSP backtracker as a reference implementation.
//
// The SAT solver enforces the local constraints (cell values, clues,
// row/column counts, port reciprocity) and also the global one: a position
// ordering that forces every track cell onto a single acyclic path between the
// two exits. That keeps MiniSat from enumerating thousands of disconnected
// candidates, which is what exhausted its fixed heap on 7x7+ boards.
// `isValidSolution` is still applied to results as a safety net.

import Logic from 'logic-solver'
import type { Board, PieceId, Port, Puzzle } from './types'
import { DIR_DELTA, DIRS, DIR_TO_PORT, OPPOSITE_PORT } from './types'
import { EMPTY, exitDirsAt, hasPort, indexOf, isValidSolution, pieceMask } from './model'
export const UNIQUE = 1
export const MULTIPLE = 2
export const UNSOLVABLE = 0

export interface CountResult {
    count: number
    solutions: Board[]
}

export interface ClassifyResult {
    count: 0 | 1 | 2
    solution: Board | null
}

const PIECES: readonly PieceId[] = [1, 2, 3, 4, 5, 6]
const VALUES: readonly number[] = [0, ...PIECES]

/** Name of the boolean variable "cell `i` holds value `v`" (`v` 0 = empty). */
function cellVar(i: number, v: number): string {
    return `c${i}_v${v}`
}

/** The formula "cell `i` is not empty". */
function nonEmpty(i: number): Logic.Term {
    return Logic.or(...PIECES.map((p) => cellVar(i, p)))
}

/** Fix a single cell to a specific value (0 = empty, 1..6 = piece). */
function fixClue(solver: Logic.Solver, i: number, value: number): void {
    for (const v of VALUES) {
        if (v === value) solver.require(cellVar(i, v))
        else solver.forbid(cellVar(i, v))
    }
}

/**
 * Build a `logic-solver` instance holding the structural constraints: exactly
 * one value per cell, row/column counts, port reciprocity, and the global
 * single-path ordering. Clue cells are NOT fixed — callers either fix them
 * with `fixClue` or toggle them with assumption literals.
 */
export function buildBaseSolver(puzzle: Puzzle): Logic.Solver {
    const { rows, cols } = puzzle
    const n = rows * cols
    const solver = new Logic.Solver()

    // Exactly one value per cell.
    for (let i = 0; i < n; i++) {
        solver.require(Logic.exactlyOne(...VALUES.map((v) => cellVar(i, v))))
    }

    // "The weighted sum of `terms` equals `total`".
    const sumExactly = (terms: Logic.Term[], total: number): Logic.Term =>
        Logic.equalBits(Logic.weightedSum(terms, 1), Logic.constantBits(total))

    // Row/column track counts.
    for (let r = 0; r < rows; r++) {
        const terms: Logic.Term[] = []
        for (let c = 0; c < cols; c++) terms.push(nonEmpty(indexOf(r, c, cols)))
        solver.require(sumExactly(terms, puzzle.rowCounts[r]))
    }
    for (let c = 0; c < cols; c++) {
        const terms: Logic.Term[] = []
        for (let r = 0; r < rows; r++) terms.push(nonEmpty(indexOf(r, c, cols)))
        solver.require(sumExactly(terms, puzzle.colCounts[c]))
    }

    // Port reciprocity: a cell that points at an in-grid neighbor forces that
    // neighbor to point back. Off-grid ports are fixed by the exit clues.
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const i = indexOf(r, c, cols)
            for (const dir of DIRS) {
                const [dr, dc] = DIR_DELTA[dir]
                const nr = r + dr
                const nc = c + dc
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
                const j = indexOf(nr, nc, cols)
                const port = DIR_TO_PORT[dir]
                const back = OPPOSITE_PORT[port]
                const backPieces = PIECES.filter((q) => hasPort(pieceMask(q), back))
                for (const p of PIECES) {
                    if (!hasPort(pieceMask(p), port)) continue
                    solver.require(
                        Logic.implies(
                            cellVar(i, p),
                            Logic.or(...backPieces.map((q) => cellVar(j, q))),
                        ),
                    )
                }
            }
        }
    }

    addConnectivity(solver, puzzle, n)

    return solver
}

/**
 * Build a `logic-solver` instance holding every constraint, with all clue
 * cells fixed. A satisfying assignment is a fully valid board;
 * `isValidSolution` is still checked as a safety net.
 */
export function buildSolver(puzzle: Puzzle): Logic.Solver {
    const solver = buildBaseSolver(puzzle)
    for (const clue of puzzle.clues) {
        fixClue(solver, indexOf(clue.row, clue.col, puzzle.cols), clue.piece)
    }
    return solver
}

export interface IncrementalUniqueness {
    /** True when the puzzle is uniquely solvable with only `activeCells` clues. */
    isUnique(activeCells: Iterable<number>): boolean
}

/**
 * Incremental uniqueness checker for the strip loop. The structural formula
 * is built once, exit clues stay permanent, and the other clues are toggled
 * via assumption literals, so MiniSat reuses learned clauses (row/column
 * counts, reciprocity, connectivity) across every check. The known solution
 * is permanently forbidden, so a satisfying assignment under the active clues
 * is exactly "some other solution" — one `solveAssuming` per check decides
 * uniqueness.
 */
export function createIncrementalUniqueness(
    puzzle: Puzzle,
    solution: Board,
): IncrementalUniqueness {
    const { cols } = puzzle
    const n = puzzle.rows * puzzle.cols
    const solver = buildBaseSolver(puzzle)

    const clueLit = new Map<number, string>()
    for (const clue of puzzle.clues) {
        const i = indexOf(clue.row, clue.col, cols)
        if (exitDirsAt(puzzle, clue.row, clue.col).length > 0) {
            fixClue(solver, i, clue.piece)
        } else {
            const lit = `k${i}`
            clueLit.set(i, lit)
            solver.require(Logic.implies(lit, cellVar(i, clue.piece)))
            for (const p of PIECES) {
                if (p !== clue.piece) solver.require(Logic.implies(lit, Logic.not(cellVar(i, p))))
            }
        }
    }

    // Permanently block the known solution: any other model means non-unique.
    const block: Logic.Term[] = []
    for (let i = 0; i < n; i++) block.push(cellVar(i, solution[i]))
    solver.forbid(Logic.and(...block))

    return {
        isUnique(activeCells: Iterable<number>): boolean {
            const lits: Logic.Term[] = []
            for (const i of activeCells) {
                const lit = clueLit.get(i)
                if (lit) lits.push(lit)
            }
            return solver.solveAssuming(Logic.and(...lits)) === null
        },
    }
}

/**
 * Encode the global "single connected, acyclic path" property directly into
 * the formula, so the SAT solver enumerates only fully valid solutions instead
 * of thousands of disconnected candidates. Each cell is assigned a
 * non-negative integer position; the source exit sits at 0, and every other
 * track cell must have a connected neighbour (pieces pointing at each other)
 * with a strictly smaller position. Following those edges strictly decreases
 * the position, so every track cell must reach the source through one acyclic
 * chain — and since each piece has exactly two ports, that chain is a single
 * path with exactly two exits.
 */
function addConnectivity(solver: Logic.Solver, puzzle: Puzzle, n: number): void {
    const { rows, cols } = puzzle
    const total = puzzle.rowCounts.reduce((sum, count) => sum + count, 0)
    if (total < 2) return

    // Pick a source: any clue cell with an off-grid port (a path exit).
    let source = -1
    for (const clue of puzzle.clues) {
        if (exitDirsAt(puzzle, clue.row, clue.col).length > 0) {
            source = indexOf(clue.row, clue.col, cols)
            break
        }
    }
    if (source < 0) return

    // Integer positions, `bits` wide (enough to number every track cell).
    const bits = Math.max(1, Math.ceil(Math.log2(total)))
    const pos: Logic.Bits[] = []
    for (let i = 0; i < n; i++) pos[i] = Logic.variableBits(`p${i}_`, bits)

    solver.require(Logic.equalBits(pos[source], Logic.constantBits(0)))

    const pointsTo = (from: number, port: Port): Logic.Term =>
        Logic.or(...PIECES.filter((p) => hasPort(pieceMask(p), port)).map((p) => cellVar(from, p)))

    // Every non-source track cell needs a connected neighbour with a smaller
    // position.
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const i = indexOf(r, c, cols)
            if (i === source) continue
            const preds: Logic.Term[] = []
            for (const dir of DIRS) {
                const [dr, dc] = DIR_DELTA[dir]
                const nr = r + dr
                const nc = c + dc
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
                const j = indexOf(nr, nc, cols)
                const port = DIR_TO_PORT[dir]
                const back = OPPOSITE_PORT[port]
                const edge = Logic.and(pointsTo(i, port), pointsTo(j, back))
                preds.push(Logic.and(edge, Logic.lessThan(pos[j], pos[i])))
            }
            solver.require(Logic.or(Logic.not(nonEmpty(i)), ...preds))
        }
    }
}

/** Decode a SAT solution into a `Board` (0 = empty, 1..6 = piece id). */
function decode(solution: Logic.Solution, n: number): Board {
    const board: Board = new Array<number>(n).fill(EMPTY)
    for (const name of solution.getTrueVars()) {
        const m = /^c(\d+)_v(\d+)$/.exec(name)
        if (m) board[Number(m[1])] = Number(m[2])
    }
    return board
}

/** Count up to `limit` valid (globally connected) solutions. */
export function countSolutions(puzzle: Puzzle, limit: number): CountResult {
    const solver = buildSolver(puzzle)
    const n = puzzle.rows * puzzle.cols
    const solutions: Board[] = []

    let solution = solver.solve()
    while (solution && solutions.length < limit) {
        const board = decode(solution, n)
        if (isValidSolution(puzzle, board)) solutions.push(board)
        // Block only the cell assignment: the position/edge variables must be
        // free to vary, otherwise the same board is counted once per labeling.
        const block: Logic.Term[] = []
        for (let i = 0; i < n; i++) block.push(cellVar(i, board[i]))
        solver.forbid(Logic.and(...block))
        solution = solver.solve()
    }

    return { count: solutions.length, solutions }
}

/** Classify a puzzle: 0 unsolvable, 1 unique, 2 multiple. */
export function classify(puzzle: Puzzle): ClassifyResult {
    const result = countSolutions(puzzle, 2)
    const count = Math.min(result.count, 2) as 0 | 1 | 2
    return { count, solution: result.solutions[0] ?? null }
}
