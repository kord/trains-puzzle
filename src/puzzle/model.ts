// Shared model helpers: indexing, validity checking, and the shared
// "valid pieces for a cell" logic used by both the solver and the UI.

import {
    DIRS,
    DIR_DELTA,
    DIR_TO_PORT,
    OPPOSITE_PORT,
    PIECES,
    PIECE_BY_MASK,
    PORT_TO_DIR,
    type Board,
    type Dir,
    type PieceId,
    type Port,
    type Puzzle,
} from './types'

export const EMPTY = 0

export function indexOf(row: number, col: number, cols: number): number {
    return row * cols + col
}

export function rowOf(index: number, cols: number): number {
    return Math.floor(index / cols)
}

export function colOf(index: number, cols: number): number {
    return index % cols
}

export function pieceMask(piece: PieceId): number {
    return PIECES[piece - 1].mask
}

export function pieceForMask(mask: number): PieceId {
    const piece = PIECE_BY_MASK[mask]
    if (piece === undefined) {
        throw new Error(`No piece for mask ${mask}`)
    }
    return piece
}

export function hasPort(mask: number, port: Port): boolean {
    return (mask & port) !== 0
}

/** Directions pointing off the grid from a given cell. */
export function offGridDirs(rows: number, cols: number, row: number, col: number): Dir[] {
    const dirs: Dir[] = []
    if (row === 0) dirs.push('N')
    if (row === rows - 1) dirs.push('S')
    if (col === 0) dirs.push('W')
    if (col === cols - 1) dirs.push('E')
    return dirs
}

/** Off-grid directions allowed at a cell, from its given (clue) piece. */
export function exitDirsAt(puzzle: Puzzle, row: number, col: number): Dir[] {
    for (const clue of puzzle.clues) {
        if (clue.row !== row || clue.col !== col) continue
        const dirs: Dir[] = []
        for (const port of PIECES[clue.piece - 1].ports) {
            const dir = PORT_TO_DIR[port]
            const [dr, dc] = DIR_DELTA[dir]
            const nr = row + dr
            const nc = col + dc
            if (nr < 0 || nr >= puzzle.rows || nc < 0 || nc >= puzzle.cols) dirs.push(dir)
        }
        return dirs
    }
    return []
}

export interface CellView {
    kind: 'blank' | 'dot' | 'x' | 'piece'
    piece: PieceId
}

/**
 * All piece ids that can legally be placed at (row, col) given what is
 * already known about neighbouring cells.
 *
 * `view` returns the current knowledge about a cell (blank/dot/x/piece).
 * A piece is invalid when:
 *  - it points off the grid somewhere other than this cell's given exit,
 *  - it points into a neighbour marked x,
 *  - it disagrees with a neighbour that already holds a specific piece
 *    (either pointing into it when the neighbour has no reciprocal port,
 *    or failing to point into it when the neighbour points into us).
 */
export function validPiecesFor(
    puzzle: Puzzle,
    row: number,
    col: number,
    view: (r: number, c: number) => CellView,
): PieceId[] {
    const exitDirs = exitDirsAt(puzzle, row, col)
    const result: PieceId[] = []

    for (const piece of PIECES) {
        const mask = piece.mask
        let ok = true

        for (const port of piece.ports) {
            const dir = PORT_TO_DIR[port]
            const [dr, dc] = DIR_DELTA[dir]
            const nr = row + dr
            const nc = col + dc

            if (nr < 0 || nr >= puzzle.rows || nc < 0 || nc >= puzzle.cols) {
                // Pointing off-grid: only allowed through this cell's own exit.
                if (!exitDirs.includes(dir)) {
                    ok = false
                    break
                }
                continue
            }

            const nv = view(nr, nc)
            if (nv.kind === 'x') {
                ok = false
                break
            }
            if (nv.kind === 'piece' && !hasPort(pieceMask(nv.piece), OPPOSITE_PORT[port])) {
                ok = false
                break
            }
        }
        if (!ok) continue

        // Check neighbours that already hold a piece and point into this cell.
        for (const dir of DIRS) {
            const [dr, dc] = DIR_DELTA[dir]
            const nr = row + dr
            const nc = col + dc
            if (nr < 0 || nr >= puzzle.rows || nc < 0 || nc >= puzzle.cols) continue
            const nv = view(nr, nc)
            if (nv.kind !== 'piece') continue
            const port = DIR_TO_PORT[dir]
            if (hasPort(pieceMask(nv.piece), OPPOSITE_PORT[port]) && !hasPort(mask, port)) {
                ok = false
                break
            }
        }
        if (ok) result.push(piece.id)
    }

    return result
}

/** True when `board` is a complete, valid solution of `puzzle`. */
export function isValidSolution(puzzle: Puzzle, board: Board): boolean {
    if (board.length !== puzzle.rows * puzzle.cols) return false

    // Clues.
    for (const clue of puzzle.clues) {
        if (board[indexOf(clue.row, clue.col, puzzle.cols)] !== clue.piece) return false
    }

    // Row/column counts.
    for (let r = 0; r < puzzle.rows; r++) {
        let count = 0
        for (let c = 0; c < puzzle.cols; c++) {
            if (board[indexOf(r, c, puzzle.cols)] !== EMPTY) count++
        }
        if (count !== puzzle.rowCounts[r]) return false
    }
    for (let c = 0; c < puzzle.cols; c++) {
        let count = 0
        for (let r = 0; r < puzzle.rows; r++) {
            if (board[indexOf(r, c, puzzle.cols)] !== EMPTY) count++
        }
        if (count !== puzzle.colCounts[c]) return false
    }

    // Exactly two off-grid ports are allowed in total (the two exit points).
    let offGridPorts = 0
    for (let r = 0; r < puzzle.rows; r++) {
        for (let c = 0; c < puzzle.cols; c++) {
            const piece = board[indexOf(r, c, puzzle.cols)]
            if (piece === EMPTY) continue
            for (const port of PIECES[piece - 1].ports) {
                const dir = PORT_TO_DIR[port]
                const [dr, dc] = DIR_DELTA[dir]
                const nr = r + dr
                const nc = c + dc
                if (nr < 0 || nr >= puzzle.rows || nc < 0 || nc >= puzzle.cols) {
                    offGridPorts++
                } else {
                    const nPiece = board[indexOf(nr, nc, puzzle.cols)]
                    if (nPiece === EMPTY) return false
                    if (!hasPort(pieceMask(nPiece as PieceId), OPPOSITE_PORT[port])) return false
                }
            }
        }
    }
    if (offGridPorts !== 2) return false

    // Single connected, acyclic path: every track cell has in-grid degree
    // 1 (exits) or 2 (interior), so a connected component is a simple path
    // iff its edge count is (vertexCount - 1); a cycle has vertexCount edges.
    const n = puzzle.rows * puzzle.cols
    const visited = new Array<boolean>(n).fill(false)
    let trackCount = 0
    let edgeCount = 0
    let start = -1

    for (let i = 0; i < n; i++) {
        if (board[i] !== EMPTY) {
            trackCount++
            if (start === -1) start = i
            const r = rowOf(i, puzzle.cols)
            const c = colOf(i, puzzle.cols)
            for (const port of PIECES[board[i] - 1].ports) {
                const dir = PORT_TO_DIR[port]
                const [dr, dc] = DIR_DELTA[dir]
                const nr = r + dr
                const nc = c + dc
                if (nr < 0 || nr >= puzzle.rows || nc < 0 || nc >= puzzle.cols) continue
                const j = indexOf(nr, nc, puzzle.cols)
                if (j > i) edgeCount++
            }
        }
    }

    if (trackCount === 0) return false

    // Connectivity: all track cells reachable from one starting cell.
    const stack: number[] = [start]
    visited[start] = true
    let visitedCount = 0
    while (stack.length > 0) {
        const i = stack.pop()!
        visitedCount++
        const r = rowOf(i, puzzle.cols)
        const c = colOf(i, puzzle.cols)
        for (const port of PIECES[board[i] - 1].ports) {
            const dir = PORT_TO_DIR[port]
            const [dr, dc] = DIR_DELTA[dir]
            const nr = r + dr
            const nc = c + dc
            if (nr < 0 || nr >= puzzle.rows || nc < 0 || nc >= puzzle.cols) continue
            const j = indexOf(nr, nc, puzzle.cols)
            if (!visited[j]) {
                visited[j] = true
                stack.push(j)
            }
        }
    }

    if (visitedCount !== trackCount) return false
    if (edgeCount !== trackCount - 1) return false

    return true
}
