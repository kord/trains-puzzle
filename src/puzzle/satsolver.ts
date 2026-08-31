// Alternative solver built on a SAT encoding via the `logic-solver` package.
//
// The SAT solver enforces the *local* constraints: each cell holds exactly one
// value (empty or one of the six pieces), clue cells are fixed, the row/column
// track counts hold, and a cell's port pointing at a neighbor forces that
// neighbor to point back. The *global* property — the track forms one
// connected, acyclic path with exactly two exits — is verified in TypeScript
// with `isValidSolution`, reusing the battle-tested model code. This split
// keeps the SAT encoding small and straightforward while remaining correct.

import Logic from 'logic-solver'
import type { Board, PieceId, Puzzle } from './types'
import { DIR_DELTA, DIRS, DIR_TO_PORT, OPPOSITE_PORT } from './types'
import { EMPTY, hasPort, indexOf, isValidSolution, pieceMask } from './model'
import type { ClassifyResult, CountResult } from './solver'

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

/**
 * Build a `logic-solver` instance holding all local constraints. A satisfying
 * assignment is a candidate board; callers must still pass it through
 * `isValidSolution` for the global path check.
 */
export function buildSolver(puzzle: Puzzle): Logic.Solver {
    const { rows, cols } = puzzle
    const n = rows * cols
    const solver = new Logic.Solver()

    // Exactly one value per cell.
    for (let i = 0; i < n; i++) {
        solver.require(Logic.exactlyOne(...VALUES.map((v) => cellVar(i, v))))
    }

    // Clue cells are fixed to their given piece.
    for (const clue of puzzle.clues) {
        const i = indexOf(clue.row, clue.col, cols)
        for (const v of VALUES) {
            if (v === clue.piece) solver.require(cellVar(i, v))
            else solver.forbid(cellVar(i, v))
        }
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

    return solver
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
export function countSolutionsSat(puzzle: Puzzle, limit: number): CountResult {
    const solver = buildSolver(puzzle)
    const n = puzzle.rows * puzzle.cols
    const solutions: Board[] = []

    let solution = solver.solve()
    while (solution && solutions.length < limit) {
        const board = decode(solution, n)
        if (isValidSolution(puzzle, board)) solutions.push(board)
        solver.forbid(solution.getFormula())
        solution = solver.solve()
    }

    return { count: solutions.length, solutions }
}

/** Classify a puzzle with the SAT solver: 0 unsolvable, 1 unique, 2 multiple. */
export function classifySat(puzzle: Puzzle): ClassifyResult {
    const result = countSolutionsSat(puzzle, 2)
    const count = Math.min(result.count, 2) as 0 | 1 | 2
    return { count, solution: result.solutions[0] ?? null }
}
