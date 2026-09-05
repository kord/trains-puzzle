// Puzzle generation: build a random single path between two boundary exits,
// derive the row/column counts, then greedily add the smallest practical set
// of clue cells that makes the puzzle uniquely solvable.

import {
    DIRS,
    DIR_DELTA,
    DIR_TO_PORT,
    type Board,
    type Clue,
    type Dir,
    type PieceId,
    type Puzzle,
} from './types'
import {
    EMPTY,
    colOf,
    indexOf,
    offGridDirs,
    pieceForMask,
    pieceMask,
    rowOf,
} from './model'
import { makeRng, pick, shuffle, type Rng } from './rng'
import { createUniquenessChecker } from './solverBackend'

export interface GenerateSpec {
    rows: number
    cols: number
    seed: number
    /** When true, collect per-phase timings into the returned `timing`. */
    debug?: boolean
}

/** One named phase of generation, with aggregate and worst-case stats. */
export interface PhaseStat {
    name: string
    ms: number
    calls: number
    maxMs: number
}

/** Counters for the rejection/diagnostic behaviour of one generation. */
export interface GenerationCounts {
    /** Random paths attempted before one was accepted. */
    pathAttempts: number
    /** Attempts rejected: findPath found nothing, or the board had bad line counts. */
    pathsRejected: number
    /** True when the deterministic snake fallback was used. */
    usedFallback: boolean
    /** Clue candidates considered for stripping (track cells minus exits). */
    clueCandidates: number
    /** Clues that survived stripping — each removal here was rejected (non-unique). */
    cluesKept: number
    /** Clues successfully removed while keeping the puzzle unique. */
    cluesRemoved: number
}

/** Per-phase timing breakdown for a `debug` generation. */
export interface GenerationTiming {
    totalMs: number
    phases: PhaseStat[]
    counts: GenerationCounts
}

export interface GeneratedPuzzle {
    puzzle: Puzzle
    solution: Board
    /** Present only when the spec requested debug timing. */
    timing?: GenerationTiming
}

/** Accumulates named wall-clock timings (calls, total, worst single call). */
class PhaseTimer {
    private stats = new Map<string, { ms: number; calls: number; maxMs: number }>()

    time<T>(name: string, fn: () => T): T {
        const start = performance.now()
        try {
            return fn()
        } finally {
            const ms = performance.now() - start
            const entry = this.stats.get(name) ?? { ms: 0, calls: 0, maxMs: 0 }
            entry.ms += ms
            entry.calls += 1
            entry.maxMs = Math.max(entry.maxMs, ms)
            this.stats.set(name, entry)
        }
    }

    entries(): PhaseStat[] {
        return [...this.stats.entries()]
            .map(([name, s]) => ({ name, ms: s.ms, calls: s.calls, maxMs: s.maxMs }))
            .sort((a, b) => b.ms - a.ms)
    }
}

/** Time `fn` under `timer` when present, otherwise just run it. */
function time<T>(timer: PhaseTimer | undefined, name: string, fn: () => T): T {
    return timer ? timer.time(name, fn) : fn()
}

export function generate(spec: GenerateSpec): GeneratedPuzzle {
    const timer = spec.debug ? new PhaseTimer() : undefined
    const start = performance.now()
    const rng = makeRng(spec.seed)
    const counts: GenerationCounts = {
        pathAttempts: 0,
        pathsRejected: 0,
        usedFallback: false,
        clueCandidates: 0,
        cluesKept: 0,
        cluesRemoved: 0,
    }
    const solution = time(timer, 'randomPathSolution', () => randomPathSolution(spec.rows, spec.cols, rng, timer, counts))

    const rowCounts: number[] = []
    for (let r = 0; r < spec.rows; r++) {
        let count = 0
        for (let c = 0; c < spec.cols; c++) {
            if (solution[indexOf(r, c, spec.cols)] !== EMPTY) count++
        }
        rowCounts.push(count)
    }

    const colCounts: number[] = []
    for (let c = 0; c < spec.cols; c++) {
        let count = 0
        for (let r = 0; r < spec.rows; r++) {
            if (solution[indexOf(r, c, spec.cols)] !== EMPTY) count++
        }
        colCounts.push(count)
    }

    const exits = findExitClues(solution, spec.rows, spec.cols)
    const puzzle: Puzzle = {
        rows: spec.rows,
        cols: spec.cols,
        rowCounts,
        colCounts,
        clues: [...exits],
    }

    // Start from a fully-specified puzzle (every track cell is a clue) and
    // greedily strip clues while the puzzle remains uniquely solvable. This
    // keeps every solver call on a near-unique board, which is far cheaper
    // than building clues up from an under-constrained board.
    const clueCells = new Set<number>(exits.map((c) => indexOf(c.row, c.col, spec.cols)))
    const candidates: number[] = []
    for (let i = 0; i < solution.length; i++) {
        if (solution[i] === EMPTY || clueCells.has(i)) continue
        puzzle.clues.push({
            row: rowOf(i, spec.cols),
            col: colOf(i, spec.cols),
            piece: solution[i] as PieceId,
        })
        candidates.push(i)
    }

    const checker = time(timer, 'buildChecker', () => createUniquenessChecker(puzzle, solution))

    counts.clueCandidates = candidates.length
    time(timer, 'stripClues', () => {
        const active = new Set<number>(candidates)
        for (const cell of shuffle(rng, candidates)) {
            active.delete(cell)
            const unique = time(timer, 'uniquenessCheck', () => checker.isUnique(active))
            if (!unique) active.add(cell)
        }
        counts.cluesKept = active.size
        counts.cluesRemoved = candidates.length - active.size
        // Keep only the exit clues and the clues that survived stripping.
        puzzle.clues = puzzle.clues.filter((c) => {
            const i = indexOf(c.row, c.col, spec.cols)
            return clueCells.has(i) || active.has(i)
        })
    })

    const result: GeneratedPuzzle = { puzzle, solution }
    if (timer) result.timing = { totalMs: performance.now() - start, phases: timer.entries(), counts }
    return result
}

function randomPathSolution(
    rows: number,
    cols: number,
    rng: Rng,
    timer?: PhaseTimer,
    counts?: GenerationCounts,
): Board {
    const total = rows * cols
    const minLen = Math.max(3, Math.floor(total * (0.35 + 0.35 * rng())))

    const MAX_RANDOM_PATH_ATTEMPTS = 50
    for (let attempt = 0; attempt < MAX_RANDOM_PATH_ATTEMPTS; attempt++) {
        if (counts) counts.pathAttempts++
        const path = time(timer, 'findPath', () => findPath(rows, cols, rng, minLen))
        if (path && path.length >= 2) {
            const board = time(timer, 'stampPath', () => stampPath(rows, cols, path, rng))
            // Reject layouts with an empty line or too many single-cell lines,
            // so we restart early instead of paying for a full clue-stripping solve.
            const bad = time(timer, 'hasBadLineCounts', () => hasBadLineCounts(board, rows, cols))
            if (!bad) return board
        }
        if (counts) counts.pathsRejected++
    }

    // Fallback: full snake path covering every cell (no empty or single-cell lines).
    if (counts) counts.usedFallback = true
    const path: number[] = []
    for (let r = 0; r < rows; r++) {
        if (r % 2 === 0) {
            for (let c = 0; c < cols; c++) path.push(indexOf(r, c, cols))
        } else {
            for (let c = cols - 1; c >= 0; c--) path.push(indexOf(r, c, cols))
        }
    }
    return time(timer, 'stampPath', () => stampPath(rows, cols, path, rng))
}

/** True when the board's line counts are unacceptable: any empty row or
 * column, or more than one row/column with exactly one track cell. */
function hasBadLineCounts(board: Board, rows: number, cols: number): boolean {
    const rowCounts = new Array<number>(rows).fill(0)
    const colCounts = new Array<number>(cols).fill(0)
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (board[indexOf(r, c, cols)] !== EMPTY) {
                rowCounts[r]++
                colCounts[c]++
            }
        }
    }

    const bad = (counts: number[]): boolean =>
        counts.some((n) => n === 0) || counts.filter((n) => n === 1).length > 1

    return bad(rowCounts) || bad(colCounts)
}

function findPath(rows: number, cols: number, rng: Rng, minLen: number): number[] | null {
    const start = randomBoundaryCell(rows, cols, rng)
    const used = new Set<number>([start])
    let visited = 0
    const NODE_LIMIT = 100_000

    function dfs(cur: number, path: number[]): number[] | null {
        visited++
        if (visited > NODE_LIMIT) return null

        if (path.length >= minLen) {
            const dirs = offGridDirs(rows, cols, rowOf(cur, cols), colOf(cur, cols))
            if (dirs.length > 0) return path.slice()
        }

        const neighbors = shuffle(rng, inGridNeighbors(rows, cols, cur))
        for (const nb of neighbors) {
            if (used.has(nb)) continue
            used.add(nb)
            path.push(nb)
            const result = dfs(nb, path)
            if (result) return result
            path.pop()
            used.delete(nb)
        }
        return null
    }

    return dfs(start, [start])
}

function stampPath(rows: number, cols: number, path: number[], rng: Rng): Board {
    const board = new Array<number>(rows * cols).fill(EMPTY)
    const start = path[0]
    const end = path[path.length - 1]

    const startDir = pick(rng, offGridDirs(rows, cols, rowOf(start, cols), colOf(start, cols)))
    const endDir = pick(rng, offGridDirs(rows, cols, rowOf(end, cols), colOf(end, cols)))

    board[start] = pieceForMask(
        DIR_TO_PORT[startDir] | DIR_TO_PORT[dirBetween(cols, start, path[1])],
    )
    for (let k = 1; k < path.length - 1; k++) {
        board[path[k]] = pieceForMask(
            DIR_TO_PORT[dirBetween(cols, path[k], path[k - 1])] |
            DIR_TO_PORT[dirBetween(cols, path[k], path[k + 1])],
        )
    }
    board[end] = pieceForMask(
        DIR_TO_PORT[dirBetween(cols, end, path[path.length - 2])] | DIR_TO_PORT[endDir],
    )

    return board
}

function dirBetween(cols: number, a: number, b: number): Dir {
    const ar = rowOf(a, cols)
    const ac = colOf(a, cols)
    const br = rowOf(b, cols)
    const bc = colOf(b, cols)
    if (br === ar - 1 && bc === ac) return 'N'
    if (br === ar + 1 && bc === ac) return 'S'
    if (bc === ac + 1 && br === ar) return 'E'
    if (bc === ac - 1 && br === ar) return 'W'
    throw new Error(`Cells not adjacent: ${a}, ${b}`)
}

function inGridNeighbors(rows: number, cols: number, cur: number): number[] {
    const r = rowOf(cur, cols)
    const c = colOf(cur, cols)
    const out: number[] = []
    for (const dir of DIRS) {
        const [dr, dc] = DIR_DELTA[dir]
        const nr = r + dr
        const nc = c + dc
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            out.push(indexOf(nr, nc, cols))
        }
    }
    return out
}

function randomBoundaryCell(rows: number, cols: number, rng: Rng): number {
    const cells: number[] = []
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
                cells.push(indexOf(r, c, cols))
            }
        }
    }
    return pick(rng, cells)
}

function findExitClues(board: Board, rows: number, cols: number): [Clue, Clue] {
    const clues: Clue[] = []
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const idx = indexOf(r, c, cols)
            const piece = board[idx]
            if (piece === EMPTY) continue
            const mask = pieceMask(piece as PieceId)
            for (const dir of DIRS) {
                const [dr, dc] = DIR_DELTA[dir]
                const nr = r + dr
                const nc = c + dc
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
                    if ((mask & DIR_TO_PORT[dir]) !== 0) {
                        clues.push({ row: r, col: c, piece: piece as PieceId })
                    }
                }
            }
        }
    }
    if (clues.length !== 2) {
        throw new Error(`Expected exactly 2 exit pieces, found ${clues.length}`)
    }
    return [clues[0], clues[1]]
}
