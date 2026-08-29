// UI-layer helpers shared by the board and the app: date keys, the player's
// cell interaction rules (including smart cycling), and win detection.

import type { CellView } from '../puzzle/model'
import { validPiecesFor } from '../puzzle/model'
import type { Board, PieceId, Puzzle, UserCell } from '../puzzle/types'

export type Tool = 'dot' | 'x'

export function toDateKey(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

export function todayKey(): string {
    return toDateKey(new Date())
}

export function parseDateKey(key: string): Date {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(y, m - 1, d)
}

export function clueMapOf(puzzle: Puzzle): Map<number, PieceId> {
    return new Map(puzzle.clues.map((c) => [c.row * puzzle.cols + c.col, c.piece]))
}

export function isClueCell(puzzle: Puzzle, index: number): boolean {
    return clueMapOf(puzzle).has(index)
}

/** Initial player markings: the given (clue) pieces are locked in. */
export function initialUserCells(puzzle: Puzzle): UserCell[] {
    const cells: UserCell[] = new Array<UserCell>(puzzle.rows * puzzle.cols).fill('blank')
    for (const clue of puzzle.clues) {
        cells[clue.row * puzzle.cols + clue.col] = clue.piece
    }
    return cells
}

function makeView(puzzle: Puzzle, cells: UserCell[], clueMap: Map<number, PieceId>) {
    return (r: number, c: number): CellView => {
        const i = r * puzzle.cols + c
        const clue = clueMap.get(i)
        if (clue !== undefined) return { kind: 'piece', piece: clue }
        const u = cells[i]
        if (u === 'x') return { kind: 'x', piece: 1 as PieceId }
        if (typeof u === 'number') return { kind: 'piece', piece: u }
        return { kind: 'blank', piece: 1 as PieceId }
    }
}

/** Pieces that are still legal at a cell given the player's current markings. */
export function validPiecesAt(puzzle: Puzzle, cells: UserCell[], index: number): PieceId[] {
    const r = Math.floor(index / puzzle.cols)
    const c = index % puzzle.cols
    return validPiecesFor(puzzle, r, c, makeView(puzzle, cells, clueMapOf(puzzle)))
}

/** True when a placed piece is inconsistent with neighbours/clues/exits. */
export function isCellInvalid(puzzle: Puzzle, cells: UserCell[], index: number): boolean {
    const u = cells[index]
    if (typeof u !== 'number') return false
    if (isClueCell(puzzle, index)) return false
    return !validPiecesAt(puzzle, cells, index).includes(u)
}

/**
 * Apply the selected tool to a cell for a single click, returning the updated
 * board (or null when nothing changed). The x tool toggles the empty mark; the
 * dot tool marks the cell, then cycles a dot through only the still-valid
 * pieces (never pointing into a cell marked x).
 */
export function applyTool(
    puzzle: Puzzle,
    cells: UserCell[],
    index: number,
    tool: Tool,
): UserCell[] | null {
    if (isClueCell(puzzle, index)) return null
    const current = cells[index]
    let next: UserCell | null = null

    if (tool === 'x') {
        next = current === 'x' ? 'blank' : 'x'
    } else {
        if (current === 'dot') {
            const valid = validPiecesAt(puzzle, cells, index)
            next = valid[0] ?? 'dot'
        } else if (typeof current === 'number') {
            const valid = validPiecesAt(puzzle, cells, index)
            const idx = valid.indexOf(current)
            next = idx === -1 ? (valid[0] ?? 'dot') : (valid[idx + 1] ?? 'dot')
        } else {
            next = 'dot'
        }
    }

    if (next === null || next === current) return null
    const copy = cells.slice()
    copy[index] = next
    return copy
}

/**
 * Paint a cell with the selected mark during a click-drag. Idempotent: cells
 * already holding that mark (or a concrete piece) are left unchanged.
 */
export function paintTool(
    puzzle: Puzzle,
    cells: UserCell[],
    index: number,
    tool: Tool,
): UserCell[] | null {
    if (isClueCell(puzzle, index)) return null
    const current = cells[index]
    if (typeof current === 'number') return null
    const target: 'dot' | 'x' = tool === 'x' ? 'x' : 'dot'
    if (current === target) return null
    const copy = cells.slice()
    copy[index] = target
    return copy
}

/**
 * Force a cell to the x mark regardless of its current state (right-click /
 * right-drag). Unlike paintTool this also overwrites a placed piece, so the
 * right button always means "this cell is empty". Clue cells stay locked.
 */
export function markX(puzzle: Puzzle, cells: UserCell[], index: number): UserCell[] | null {
    if (isClueCell(puzzle, index)) return null
    if (cells[index] === 'x') return null
    const copy = cells.slice()
    copy[index] = 'x'
    return copy
}

/**
 * Clear a cell back to blank (the right-button eraser, started by
 * right-clicking an x). Removes dots, crosses, and placed pieces. Clue cells
 * stay locked.
 */
export function clearCell(puzzle: Puzzle, cells: UserCell[], index: number): UserCell[] | null {
    if (isClueCell(puzzle, index)) return null
    if (cells[index] === 'blank') return null
    const copy = cells.slice()
    copy[index] = 'blank'
    return copy
}

/** Win condition: no dots remain and every cell matches the solution. */
export function isSolved(solution: Board, cells: UserCell[]): boolean {
    if (cells.length !== solution.length) return false
    for (let i = 0; i < solution.length; i++) {
        const u = cells[i]
        if (u === 'dot') return false
        const userPiece = typeof u === 'number' ? u : 0
        if (userPiece !== solution[i]) return false
    }
    return true
}

export type CountStatus = 'ok' | 'few' | 'many' | 'tight'

export function rowStatuses(puzzle: Puzzle, cells: UserCell[]): CountStatus[] {
    const statuses: CountStatus[] = []
    for (let r = 0; r < puzzle.rows; r++) {
        let count = 0
        let nonX = 0
        for (let c = 0; c < puzzle.cols; c++) {
            const u = cells[r * puzzle.cols + c]
            if (u === 'dot' || typeof u === 'number') count++
            if (u !== 'x') nonX++
        }
        statuses.push(statusFor(count, nonX, puzzle.rowCounts[r]))
    }
    return statuses
}

export function colStatuses(puzzle: Puzzle, cells: UserCell[]): CountStatus[] {
    const statuses: CountStatus[] = []
    for (let c = 0; c < puzzle.cols; c++) {
        let count = 0
        let nonX = 0
        for (let r = 0; r < puzzle.rows; r++) {
            const u = cells[r * puzzle.cols + c]
            if (u === 'dot' || typeof u === 'number') count++
            if (u !== 'x') nonX++
        }
        statuses.push(statusFor(count, nonX, puzzle.colCounts[c]))
    }
    return statuses
}

function statusFor(current: number, nonX: number, target: number): CountStatus {
    if (current > target) return 'many'
    if (current === target) return 'ok'
    // Exactly as many un-marked cells remain as tracks are needed: no room to spare.
    return nonX === target ? 'tight' : 'few'
}
