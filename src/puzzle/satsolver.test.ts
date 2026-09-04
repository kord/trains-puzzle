import { describe, expect, it } from 'vitest'
import type { Puzzle } from './types'
import { classify } from './satsolver'

describe('classify', () => {
    it('reports the unique 2x2 puzzle', () => {
        const puzzle: Puzzle = {
            rows: 2,
            cols: 2,
            rowCounts: [2, 0],
            colCounts: [1, 1],
            clues: [
                { row: 0, col: 0, piece: 1 }, // H: west exit
                { row: 0, col: 1, piece: 1 }, // H: east exit
            ],
        }
        const result = classify(puzzle)
        expect(result.count).toBe(1)
        expect(result.solution).toEqual([1, 1, 0, 0])
    })

    it('reports unsolvable when a row count is impossible', () => {
        const puzzle: Puzzle = {
            rows: 2,
            cols: 2,
            rowCounts: [3, 0],
            colCounts: [1, 1],
            clues: [],
        }
        expect(classify(puzzle).count).toBe(0)
    })

    it('reports unsolvable when adjacent clues conflict', () => {
        const puzzle: Puzzle = {
            rows: 2,
            cols: 2,
            rowCounts: [1, 1],
            colCounts: [1, 1],
            clues: [
                { row: 0, col: 0, piece: 2 }, // V points south into (1,0)
                { row: 1, col: 0, piece: 1 }, // H has no north port to connect
            ],
        }
        expect(classify(puzzle).count).toBe(0)
    })

    it('reports multiple when more than one valid path exists', () => {
        const puzzle: Puzzle = {
            rows: 3,
            cols: 3,
            rowCounts: [2, 2, 0],
            colCounts: [2, 2, 0],
            clues: [{ row: 1, col: 1, piece: 6 }], // WN corner fixes the middle bend
        }
        expect(classify(puzzle).count).toBe(2)
    })
})
