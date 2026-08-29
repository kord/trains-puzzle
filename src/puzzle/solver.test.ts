import { describe, expect, it } from 'vitest'
import type { Puzzle } from './types'
import { classify, countSolutions } from './solver'
import { generate } from './generator'

describe('classify', () => {
    it('reports a unique 2x2 puzzle', () => {
        const puzzle: Puzzle = {
            rows: 2,
            cols: 2,
            rowCounts: [2, 0],
            colCounts: [1, 1],
            clues: [
                { row: 0, col: 0, piece: 1 }, // H: west exit, east to (0,1)
                { row: 0, col: 1, piece: 1 }, // H: east exit, west to (0,0)
            ],
        }
        const result = classify(puzzle)
        expect(result.count).toBe(1)
        expect(result.solution).toEqual([1, 1, 0, 0])
    })

    it('reports a multiply-solvable puzzle', () => {
        const puzzle: Puzzle = {
            rows: 6,
            cols: 6,
            rowCounts: [3, 4, 5, 5, 5, 3],
            colCounts: [4, 5, 5, 4, 4, 3],
            clues: [
                { row: 0, col: 0, piece: 1 }, // H: west exit
                { row: 1, col: 5, piece: 1 }, // H: east exit
            ],
        }
        const result = classify(puzzle)
        expect(result.count).toBe(2)

        const all = countSolutions(puzzle, 100)
        expect(all.solutions.length).toBeGreaterThanOrEqual(2)
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

    it('finds generated puzzles uniquely solvable', () => {
        for (const size of [6, 8]) {
            const { puzzle } = generate({ rows: size, cols: size, seed: 1234 + size })
            expect(classify(puzzle).count).toBe(1)
        }
    })
})
