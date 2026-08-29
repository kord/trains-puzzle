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
import { countSolutions } from './solver'
import { makeRng, pick, shuffle, type Rng } from './rng'

export interface GenerateSpec {
    rows: number
    cols: number
    seed: number
}

export interface GeneratedPuzzle {
    puzzle: Puzzle
    solution: Board
}

export function generate(spec: GenerateSpec): GeneratedPuzzle {
    const rng = makeRng(spec.seed)
    const solution = randomPathSolution(spec.rows, spec.cols, rng)

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

    for (const cell of shuffle(rng, candidates)) {
        const clueIndex = puzzle.clues.findIndex(
            (c) => indexOf(c.row, c.col, spec.cols) === cell,
        )
        if (clueIndex === -1) continue
        const removed = puzzle.clues.splice(clueIndex, 1)[0]
        if (countSolutions(puzzle, 2).count === 1) {
            // Keep the clue removed: the puzzle is still uniquely solvable.
        } else {
            puzzle.clues.push(removed)
        }
    }

    return { puzzle, solution }
}

function randomPathSolution(rows: number, cols: number, rng: Rng): Board {
    const total = rows * cols
    const minLen = Math.max(3, Math.floor(total * (0.35 + 0.35 * rng())))

    for (let attempt = 0; attempt < 30; attempt++) {
        const path = findPath(rows, cols, rng, minLen)
        if (path && path.length >= 2) {
            return stampPath(rows, cols, path, rng)
        }
    }

    // Fallback: full snake path covering every cell.
    const path: number[] = []
    for (let r = 0; r < rows; r++) {
        if (r % 2 === 0) {
            for (let c = 0; c < cols; c++) path.push(indexOf(r, c, cols))
        } else {
            for (let c = cols - 1; c >= 0; c--) path.push(indexOf(r, c, cols))
        }
    }
    return stampPath(rows, cols, path, rng)
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
