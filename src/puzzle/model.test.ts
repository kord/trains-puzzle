import { describe, expect, it } from 'vitest'
import { PIECES, type PieceId, type Puzzle } from './types'
import {
    exitDirsAt,
    indexOf,
    isValidSolution,
    pieceMask,
    validPiecesFor,
    type CellView,
} from './model'

function blankPuzzle(rows: number, cols: number, clues: Puzzle['clues'] = []): Puzzle {
    return {
        rows,
        cols,
        rowCounts: new Array<number>(rows).fill(0),
        colCounts: new Array<number>(cols).fill(0),
        clues,
    }
}

function view(overrides: Record<number, CellView> = {}): (r: number, c: number) => CellView {
    return (r: number, c: number) => {
        const key = r * 100 + c
        return overrides[key] ?? { kind: 'blank', piece: 1 as PieceId }
    }
}

describe('piece definitions', () => {
    it('has six distinct pieces, each with exactly two ports', () => {
        expect(PIECES).toHaveLength(6)
        const masks = new Set<number>()
        for (const p of PIECES) {
            expect(p.ports).toHaveLength(2)
            masks.add(p.mask)
            expect(pieceMask(p.id)).toBe(p.mask)
        }
        expect(masks.size).toBe(6)
    })
})

describe('validPiecesFor', () => {
    it('allows all six pieces in an interior cell with blank neighbours', () => {
        const puzzle = blankPuzzle(3, 3)
        expect(validPiecesFor(puzzle, 1, 1, view())).toHaveLength(6)
    })

    it('allows only H when both vertical neighbours are marked empty', () => {
        const puzzle = blankPuzzle(3, 3)
        const result = validPiecesFor(
            puzzle,
            1,
            1,
            view({ [1]: { kind: 'x', piece: 1 as PieceId }, [201]: { kind: 'x', piece: 1 as PieceId } }),
        )
        expect(result).toEqual([1]) // H
    })

    it('allows only SW when north and east neighbours are marked empty', () => {
        const puzzle = blankPuzzle(3, 3)
        const result = validPiecesFor(
            puzzle,
            1,
            1,
            view({ [1]: { kind: 'x', piece: 1 as PieceId }, [102]: { kind: 'x', piece: 1 as PieceId } }),
        )
        expect(result).toEqual([5]) // SW
    })

    it('disallows off-grid ports on a non-exit boundary cell', () => {
        const puzzle = blankPuzzle(3, 3)
        // Top edge (0,1): pieces with a north port leave the grid and are invalid.
        const result = validPiecesFor(puzzle, 0, 1, view())
        expect(result.sort()).toEqual([1, 4, 5]) // H, ES, SW
    })

    it('allows a given exit piece and rejects pieces exiting elsewhere', () => {
        const puzzle = blankPuzzle(3, 3, [{ row: 0, col: 0, piece: 2 }]) // V exits north
        const result = validPiecesFor(puzzle, 0, 0, view())
        expect(result).toContain(2) // V is allowed
        expect(result).not.toContain(1) // H would exit west, which is not given
        expect(result).not.toContain(6) // WN would exit west, which is not given
    })

    it('matches a neighbour that already holds a specific piece', () => {
        const puzzle = blankPuzzle(3, 3)
        // East neighbour (1,2) is H (W|E): our piece must include an E port.
        const result = validPiecesFor(
            puzzle,
            1,
            1,
            view({ [102]: { kind: 'piece', piece: 1 as PieceId } }),
        )
        expect(result.sort()).toEqual([1, 3, 4]) // H, NE, ES
    })
})

describe('exitDirsAt', () => {
    it('reports the off-grid directions of a clue piece', () => {
        const puzzle = blankPuzzle(3, 3, [{ row: 0, col: 0, piece: 6 }]) // WN at the corner
        expect(exitDirsAt(puzzle, 0, 0).sort()).toEqual(['N', 'W'])
        expect(exitDirsAt(puzzle, 1, 1)).toEqual([])
    })
})

describe('isValidSolution', () => {
    it('accepts a valid single path with given exit pieces', () => {
        // 2x2 with the path (0,0)-(0,1)-(1,1)-(1,0), exits W at (0,0) and W at (1,0).
        const puzzle: Puzzle = {
            rows: 2,
            cols: 2,
            rowCounts: [2, 2],
            colCounts: [2, 2],
            clues: [
                { row: 0, col: 0, piece: 1 }, // H: west exit, east to (0,1)
                { row: 1, col: 0, piece: 1 }, // H: west exit, east to (1,1)
            ],
        }
        // (0,0)=H, (0,1)=SW, (1,0)=H, (1,1)=WN
        const board = [1, 5, 1, 6]
        expect(isValidSolution(puzzle, board)).toBe(true)
    })

    it('rejects a solution with a loop', () => {
        const puzzle: Puzzle = {
            rows: 2,
            cols: 2,
            rowCounts: [2, 2],
            colCounts: [2, 2],
            clues: [],
        }
        // A full 2x2 loop: NE, ES, SW, WN (each corner turn) has no exit ports.
        const board = [3, 4, 5, 6]
        expect(isValidSolution(puzzle, board)).toBe(false)
    })

    it('rejects a solution with a dangling track end', () => {
        const puzzle: Puzzle = {
            rows: 2,
            cols: 2,
            rowCounts: [1, 1],
            colCounts: [1, 1],
            clues: [],
        }
        // (0,0)=H and (1,1)=V are not connected and have no second exit.
        const board = [1, 0, 0, 2]
        expect(isValidSolution(puzzle, board)).toBe(false)
    })

    it('checks clue cells', () => {
        const puzzle: Puzzle = {
            rows: 2,
            cols: 2,
            rowCounts: [2, 0],
            colCounts: [1, 1],
            clues: [{ row: 0, col: 0, piece: 2 }], // V, but the board has H there
        }
        const board = [1, 1, 0, 0]
        expect(isValidSolution(puzzle, board)).toBe(false)
    })
})

describe('indexOf', () => {
    it('flattens row-major', () => {
        expect(indexOf(1, 2, 3)).toBe(5)
    })
})
