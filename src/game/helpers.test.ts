import { describe, expect, it } from 'vitest'
import type { Board, Puzzle, UserCell } from '../puzzle/types'
import { applyTool, clearCell, colStatuses, initialUserCells, isSolved, markX, paintTool, rowStatuses } from './helpers'

const puzzle: Puzzle = {
    rows: 3,
    cols: 3,
    rowCounts: [0, 1, 0],
    colCounts: [0, 1, 0],
    clues: [],
}

describe('isSolved', () => {
    it('accepts an exact match with no dots', () => {
        const solution: Board = [1, 1, 0, 0]
        const cells: UserCell[] = [1, 1, 'x', 'blank']
        expect(isSolved(solution, cells)).toBe(true)
    })

    it('rejects when a dot remains', () => {
        const solution: Board = [1, 1, 0, 0]
        const cells: UserCell[] = ['dot', 1, 'x', 'blank']
        expect(isSolved(solution, cells)).toBe(false)
    })

    it('rejects a wrong piece', () => {
        const solution: Board = [1, 1, 0, 0]
        const cells: UserCell[] = [2, 1, 'x', 'blank']
        expect(isSolved(solution, cells)).toBe(false)
    })
})

describe('applyTool', () => {
    it('marks a blank cell with a dot', () => {
        const cells: UserCell[] = new Array<UserCell>(9).fill('blank')
        const next = applyTool(puzzle, cells, 4, 'dot')
        expect(next?.[4]).toBe('dot')
    })

    it('cycles a dot to the only valid piece between two x cells', () => {
        const cells: UserCell[] = new Array<UserCell>(9).fill('blank')
        cells[1] = 'x' // (0,1) north of (1,1)
        cells[7] = 'x' // (2,1) south of (1,1)
        cells[4] = 'dot'
        const next = applyTool(puzzle, cells, 4, 'dot')
        expect(next?.[4]).toBe(1) // only H (W|E) is valid
    })

    it('toggles an x with the x tool', () => {
        const cells: UserCell[] = new Array<UserCell>(9).fill('blank')
        const marked = applyTool(puzzle, cells, 4, 'x')
        expect(marked?.[4]).toBe('x')
        const cleared = applyTool(puzzle, marked!, 4, 'x')
        expect(cleared?.[4]).toBe('blank')
    })

    it('does not change a clue cell', () => {
        const withClue: Puzzle = {
            ...puzzle,
            clues: [{ row: 1, col: 1, piece: 1 }],
        }
        const cells = initialUserCells(withClue)
        expect(applyTool(withClue, cells, 4, 'dot')).toBeNull()
        expect(cells[4]).toBe(1)
    })
})

describe('paintTool', () => {
    it('paints a blank cell with the selected mark', () => {
        const cells: UserCell[] = new Array<UserCell>(9).fill('blank')
        expect(paintTool(puzzle, cells, 4, 'dot')?.[4]).toBe('dot')
        expect(paintTool(puzzle, cells, 4, 'x')?.[4]).toBe('x')
    })

    it('overwrites dot/x but leaves placed pieces alone', () => {
        const cells: UserCell[] = new Array<UserCell>(9).fill('blank')
        cells[4] = 'dot'
        cells[5] = 1 // a placed piece
        const xPaint = paintTool(puzzle, cells, 4, 'x')
        expect(xPaint?.[4]).toBe('x')
        const piecePaint = paintTool(puzzle, cells, 5, 'dot')
        expect(piecePaint).toBeNull()
        expect(cells[5]).toBe(1)
    })
})

describe('markX', () => {
    it('forces a blank, dot, or placed piece to x', () => {
        const cells: UserCell[] = new Array<UserCell>(9).fill('blank')
        expect(markX(puzzle, cells, 0)?.[0]).toBe('x')
        cells[1] = 'dot'
        expect(markX(puzzle, cells, 1)?.[1]).toBe('x')
        cells[2] = 3
        expect(markX(puzzle, cells, 2)?.[2]).toBe('x')
    })

    it('is a no-op on an already-x cell', () => {
        const cells: UserCell[] = new Array<UserCell>(9).fill('blank')
        cells[4] = 'x'
        expect(markX(puzzle, cells, 4)).toBeNull()
    })

    it('does not change a clue cell', () => {
        const withClue: Puzzle = {
            ...puzzle,
            clues: [{ row: 1, col: 1, piece: 1 }],
        }
        const cells = initialUserCells(withClue)
        expect(markX(withClue, cells, 4)).toBeNull()
    })
})

describe('clearCell', () => {
    it('clears x, dot, and a placed piece back to blank', () => {
        const cells: UserCell[] = new Array<UserCell>(9).fill('blank')
        cells[0] = 'x'
        cells[1] = 'dot'
        cells[2] = 3
        expect(clearCell(puzzle, cells, 0)?.[0]).toBe('blank')
        expect(clearCell(puzzle, cells, 1)?.[1]).toBe('blank')
        expect(clearCell(puzzle, cells, 2)?.[2]).toBe('blank')
    })

    it('is a no-op on a blank cell', () => {
        const cells: UserCell[] = new Array<UserCell>(9).fill('blank')
        expect(clearCell(puzzle, cells, 4)).toBeNull()
    })

    it('does not change a clue cell', () => {
        const withClue: Puzzle = {
            ...puzzle,
            clues: [{ row: 1, col: 1, piece: 1 }],
        }
        const cells = initialUserCells(withClue)
        expect(clearCell(withClue, cells, 4)).toBeNull()
    })
})

describe('row/col statuses', () => {
    const row: Puzzle = { rows: 1, cols: 3, rowCounts: [2], colCounts: [0, 0, 0], clues: [] }
    const col: Puzzle = { rows: 3, cols: 1, rowCounts: [0, 0, 0], colCounts: [2], clues: [] }

    it('reports tight when x-marks leave exactly enough room', () => {
        expect(rowStatuses(row, ['x', 'blank', 'blank'])).toEqual(['tight'])
        expect(colStatuses(col, ['x', 'blank', 'blank'])).toEqual(['tight'])
    })

    it('reports few when there is still spare room', () => {
        expect(rowStatuses(row, ['blank', 'blank', 'blank'])).toEqual(['few'])
    })

    it('reports ok when the count is met', () => {
        expect(rowStatuses(row, ['dot', 1, 'x'])).toEqual(['ok'])
    })

    it('reports many when the count is exceeded', () => {
        expect(rowStatuses({ ...row, rowCounts: [1] }, ['dot', 1, 'blank'])).toEqual(['many'])
    })

    it('reports blocked when x-marks leave too few cells', () => {
        expect(rowStatuses(row, ['x', 'x', 'blank'])).toEqual(['blocked'])
        expect(colStatuses(col, ['x', 'x', 'blank'])).toEqual(['blocked'])
    })
})
