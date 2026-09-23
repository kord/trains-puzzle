// Constraint-satisfaction solver for the Tracks puzzle. It determines
// whether a puzzle is unsolvable, uniquely solvable, or multiply solvable,
// and can enumerate solutions (used by the generator to select clues).

import {
    DIRS,
    DIR_DELTA,
    OPPOSITE_PORT,
    DIR_TO_PORT,
    type Board,
    type Dir,
    type PieceId,
    type Puzzle,
} from './types'
import {
    EMPTY,
    hasPort,
    indexOf,
    isValidSolution,
    pieceMask,
    validPiecesFor,
    type CellView,
} from './model'

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

/** Classify a puzzle: 0 = unsolvable, 1 = unique, 2 = multiple. */
export function classify(puzzle: Puzzle, hint?: Board): ClassifyResult {
    const result = countSolutions(puzzle, 2, hint)
    const count = Math.min(result.count, 2) as 0 | 1 | 2
    return { count, solution: result.solutions[0] ?? null }
}

/**
 * One value excluded at one cell: the counterexample constraint "this cell is
 * not this value". Used to ask "does a solution exist that differs from the
 * known one at this cell?"
 */
export interface ValueExclusion {
    index: number
    exclude: number
}

/**
 * Count solutions up to `limit` (stop early once the limit is reached). A
 * known solution can be passed as `hint` to value-order the search: each cell
 * tries the hint's value first, so the solver finds that solution immediately
 * and spends the rest of its time looking for another. `exclude` removes a
 * single value at a single cell from the search.
 */
export function countSolutions(
    puzzle: Puzzle,
    limit: number,
    hint?: Board,
    exclude?: ValueExclusion,
): CountResult {
    const solver = new Solver(puzzle, hint, exclude)
    const solutions: Board[] = []
    solver.run(solutions, limit)
    return { count: solutions.length, solutions }
}

/**
 * Whether `puzzle` has a solution that differs from `solution` at `cell` —
 * that is, whether the clue at `cell` is load-bearing.
 *
 * This is the exact test for "can this clue be dropped?" whenever the clue set
 * still *including* that clue determines `solution` uniquely (which the strip
 * loop maintains): any other solution of the reduced set must agree with every
 * clue that remains, so the only cell where it can differ from `solution` is
 * `cell` itself. Asking for that one counterexample is equivalent to asking
 * whether the reduced puzzle is non-unique, but the search skips the entire
 * `cell = solution[cell]` subtree instead of exploring it and rejecting it.
 */
export function hasAlternativeSolution(puzzle: Puzzle, solution: Board, cell: number): boolean {
    // The known solution is still the best value ordering for the other cells:
    // it steers the search at the assignments closest to a real solution, where
    // the count and connectivity checks reject the fastest.
    return countSolutions(puzzle, 1, solution, { index: cell, exclude: solution[cell] }).count > 0
}

const EMPTY_MARK = -1

/** Undoable union-find over track cells, with union-by-size (no path
 * compression) so operations can be rolled back in LIFO order. */
class Dsu {
    private parent: number[]
    private size: number[]
    private stack: Array<[number, number, number]>

    constructor(n: number) {
        this.parent = new Array<number>(n).fill(-1)
        this.size = new Array<number>(n).fill(0)
        this.stack = []
    }

    add(cell: number): void {
        if (this.parent[cell] === -1) {
            this.parent[cell] = cell
            this.size[cell] = 1
            this.stack.push([0, cell, 0])
        }
    }

    private find(x: number): number {
        while (this.parent[x] !== x) x = this.parent[x]
        return x
    }

    /** Merge a and b; returns false when they are already connected (cycle). */
    union(a: number, b: number): boolean {
        let ra = this.find(a)
        let rb = this.find(b)
        if (ra === rb) return false
        if (this.size[ra] < this.size[rb]) {
            const t = ra
            ra = rb
            rb = t
        }
        this.parent[rb] = ra
        this.size[ra] += this.size[rb]
        this.stack.push([1, rb, ra])
        return true
    }

    snapshot(): number {
        return this.stack.length
    }

    rollback(to: number): void {
        while (this.stack.length > to) {
            const entry = this.stack.pop()
            if (entry === undefined) break
            const [op, x, y] = entry
            if (op === 0) {
                this.parent[x] = -1
                this.size[x] = 0
            } else {
                this.parent[x] = x
                this.size[y] -= this.size[x]
            }
        }
    }
}

class Solver {
    private readonly puzzle: Puzzle
    private readonly hint: Board | null
    private readonly exclude: ValueExclusion | null
    private readonly n: number
    private readonly rows: number
    private readonly cols: number

    private board: number[]
    private rowPlaced: number[]
    private colPlaced: number[]
    private rowOpen: number[]
    private colOpen: number[]
    private staticCandidates: PieceId[][]
    private dsu: Dsu
    private decided: number
    private valid: boolean

    constructor(puzzle: Puzzle, hint?: Board, exclude?: ValueExclusion) {
        this.puzzle = puzzle
        this.hint = hint ?? null
        this.exclude = exclude ?? null
        this.rows = puzzle.rows
        this.cols = puzzle.cols
        this.n = puzzle.rows * puzzle.cols
        this.board = new Array<number>(this.n).fill(0)
        this.rowPlaced = new Array<number>(this.rows).fill(0)
        this.colPlaced = new Array<number>(this.cols).fill(0)
        this.rowOpen = new Array<number>(this.rows).fill(this.cols)
        this.colOpen = new Array<number>(this.cols).fill(this.rows)
        this.staticCandidates = []
        for (let i = 0; i < this.n; i++) this.staticCandidates.push([])
        this.dsu = new Dsu(this.n)
        this.decided = 0
        this.valid = true

        this.setupClues()
        if (this.valid) this.setupStaticCandidates()
    }

    private clueAt(r: number, c: number): number {
        return this.board[indexOf(r, c, this.cols)]
    }

    private setupClues(): void {
        for (const clue of this.puzzle.clues) {
            const i = indexOf(clue.row, clue.col, this.cols)
            if (this.board[i] !== 0) {
                this.valid = false
                return
            }
            this.board[i] = clue.piece
            this.rowPlaced[clue.row]++
            this.colPlaced[clue.col]++
            this.rowOpen[clue.row]--
            this.colOpen[clue.col]--
            this.dsu.add(i)
            this.decided++
        }

        // Union connected adjacent clues; a cycle among clues means no single
        // path exists. Each pair is considered once (j > i).
        for (const clue of this.puzzle.clues) {
            const i = indexOf(clue.row, clue.col, this.cols)
            const mask = pieceMask(clue.piece)
            for (const dir of DIRS) {
                const [dr, dc] = DIR_DELTA[dir]
                const nr = clue.row + dr
                const nc = clue.col + dc
                if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue
                const j = indexOf(nr, nc, this.cols)
                if (j <= i) continue
                if (this.board[j] >= 1 && hasPort(mask, DIR_TO_PORT[dir])) {
                    if (!this.dsu.union(i, j)) {
                        this.valid = false
                        return
                    }
                }
            }
        }

        // Every clue piece must itself be consistent with boundary/exits and
        // adjacent clues.
        const view = (r: number, c: number): CellView => {
            const p = this.clueAt(r, c)
            return p >= 1
                ? { kind: 'piece', piece: p as PieceId }
                : { kind: 'blank', piece: 1 as PieceId }
        }
        for (const clue of this.puzzle.clues) {
            const allowed = validPiecesFor(this.puzzle, clue.row, clue.col, view)
            if (!allowed.includes(clue.piece)) {
                this.valid = false
                return
            }
        }
    }

    private setupStaticCandidates(): void {
        const view = (r: number, c: number): CellView => {
            const p = this.clueAt(r, c)
            return p >= 1
                ? { kind: 'piece', piece: p as PieceId }
                : { kind: 'blank', piece: 1 as PieceId }
        }
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const i = indexOf(r, c, this.cols)
                if (this.board[i] !== 0) continue
                this.staticCandidates[i] = validPiecesFor(this.puzzle, r, c, view)
            }
        }
    }

    run(solutions: Board[], limit: number): void {
        if (!this.valid) return
        if (limit <= 0) return
        this.search(solutions, limit)
    }

    private feasible(): boolean {
        for (let r = 0; r < this.rows; r++) {
            const need = this.puzzle.rowCounts[r] - this.rowPlaced[r]
            if (need < 0 || need > this.rowOpen[r]) return false
        }
        for (let c = 0; c < this.cols; c++) {
            const need = this.puzzle.colCounts[c] - this.colPlaced[c]
            if (need < 0 || need > this.colOpen[c]) return false
        }
        return true
    }

    private search(solutions: Board[], limit: number): void {
        if (solutions.length >= limit) return

        if (!this.feasible()) return

        if (this.decided === this.n) {
            if (isValidSolution(this.puzzle, this.toBoard())) {
                solutions.push(this.toBoard())
            }
            return
        }

        // Most-constrained variable: undecided cell with fewest legal options.
        let bestCell = -1
        let bestOptions: number[] | null = null
        for (let i = 0; i < this.n; i++) {
            if (this.board[i] !== 0) continue
            const opts = this.options(i)
            if (bestOptions === null || opts.length < bestOptions.length) {
                bestCell = i
                bestOptions = opts
                if (opts.length === 0) break
            }
        }
        if (bestCell === -1 || bestOptions === null) return

        for (const opt of bestOptions) {
            const snapshot = this.dsu.snapshot()
            if (this.apply(bestCell, opt)) {
                this.search(solutions, limit)
                this.undo(bestCell, opt)
            }
            this.dsu.rollback(snapshot)
        }
    }

    private options(i: number): number[] {
        const r = Math.floor(i / this.cols)
        const c = i % this.cols
        const rowNeed = this.puzzle.rowCounts[r] - this.rowPlaced[r]
        const colNeed = this.puzzle.colCounts[c] - this.colPlaced[c]
        const rowLeft = this.rowOpen[r]
        const colLeft = this.colOpen[c]

        const opts: number[] = []

        // Decide the cell is empty. Only allowed when no already-placed
        // neighbour points into this cell, and the counts still work out.
        if (rowNeed <= rowLeft - 1 && colNeed <= colLeft - 1) {
            let stranded = false
            for (const dir of DIRS) {
                const [dr, dc] = DIR_DELTA[dir]
                const nr = r + dr
                const nc = c + dc
                if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue
                const ni = indexOf(nr, nc, this.cols)
                if (this.board[ni] >= 1) {
                    const port = DIR_TO_PORT[dir]
                    if (hasPort(pieceMask(this.board[ni] as PieceId), OPPOSITE_PORT[port])) {
                        stranded = true
                        break
                    }
                }
            }
            if (!stranded) opts.push(EMPTY)
        }

        // Decide the cell holds a specific piece.
        if (rowNeed >= 1 && colNeed >= 1 && rowNeed <= rowLeft && colNeed <= colLeft) {
            for (const pid of this.dynamicCandidates(i)) {
                opts.push(pid)
            }
        }

        // Value ordering: try the known solution's value for this cell first.
        if (this.hint && opts.length > 1) {
            const preferred = this.hint[i]
            const at = opts.indexOf(preferred)
            if (at > 0) {
                opts.splice(at, 1)
                opts.unshift(preferred)
            }
        }

        // Counterexample constraint: this cell may not take the excluded value.
        if (this.exclude && this.exclude.index === i) {
            const at = opts.indexOf(this.exclude.exclude)
            if (at !== -1) opts.splice(at, 1)
        }

        return opts
    }

    private dynamicCandidates(i: number): PieceId[] {
        const r = Math.floor(i / this.cols)
        const c = i % this.cols
        const result: PieceId[] = []

        for (const pid of this.staticCandidates[i]) {
            const mask = pieceMask(pid)
            let ok = true
            for (const dir of DIRS) {
                const port = DIR_TO_PORT[dir as Dir]
                const [dr, dc] = DIR_DELTA[dir]
                const nr = r + dr
                const nc = c + dc
                if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue
                const ni = indexOf(nr, nc, this.cols)
                const nb = this.board[ni]
                if (nb === EMPTY_MARK) {
                    if (hasPort(mask, port)) {
                        ok = false
                        break
                    }
                } else if (nb >= 1) {
                    const nbPointsIn = hasPort(pieceMask(nb as PieceId), OPPOSITE_PORT[port])
                    const wePointOut = hasPort(mask, port)
                    if (nbPointsIn !== wePointOut) {
                        ok = false
                        break
                    }
                }
            }
            if (ok) result.push(pid)
        }

        return result
    }

    private apply(i: number, opt: number): boolean {
        const r = Math.floor(i / this.cols)
        const c = i % this.cols

        if (opt === EMPTY) {
            this.board[i] = EMPTY_MARK
            this.rowOpen[r]--
            this.colOpen[c]--
            this.decided++
            return true
        }

        this.dsu.add(i)
        for (const dir of DIRS) {
            const [dr, dc] = DIR_DELTA[dir]
            const nr = r + dr
            const nc = c + dc
            if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) continue
            const ni = indexOf(nr, nc, this.cols)
            if (this.board[ni] >= 1) {
                const port = DIR_TO_PORT[dir]
                if (hasPort(pieceMask(opt as PieceId), port)) {
                    if (!this.dsu.union(i, ni)) return false
                }
            }
        }

        this.board[i] = opt
        this.rowOpen[r]--
        this.colOpen[c]--
        this.rowPlaced[r]++
        this.colPlaced[c]++
        this.decided++
        return true
    }

    private undo(i: number, opt: number): void {
        const r = Math.floor(i / this.cols)
        const c = i % this.cols

        this.board[i] = 0
        this.rowOpen[r]++
        this.colOpen[c]++
        if (opt !== EMPTY) {
            this.rowPlaced[r]--
            this.colPlaced[c]--
        }
        this.decided--
    }

    private toBoard(): Board {
        return this.board.map((v) => (v === EMPTY_MARK ? 0 : v))
    }
}
