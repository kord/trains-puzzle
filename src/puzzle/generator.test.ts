import { describe, expect, it } from 'vitest'
import { generate } from './generator'
import { classify } from './solver'
import { exitDirsAt, isValidSolution } from './model'
import { EMPTY } from './model'

describe('generate', () => {
    it('is deterministic for a given seed', () => {
        const a = generate({ rows: 6, cols: 6, seed: 42 })
        const b = generate({ rows: 6, cols: 6, seed: 42 })
        expect(a.puzzle).toEqual(b.puzzle)
        expect(a.solution).toEqual(b.solution)
    })

    it('produces a valid solution with exactly two exit pieces', () => {
        const { puzzle, solution } = generate({ rows: 8, cols: 8, seed: 7 })
        expect(isValidSolution(puzzle, solution)).toBe(true)
        const exitClues = puzzle.clues.filter((c) => exitDirsAt(puzzle, c.row, c.col).length > 0)
        expect(exitClues).toHaveLength(2)
    })

    it('produces a uniquely solvable puzzle', () => {
        const { puzzle } = generate({ rows: 8, cols: 8, seed: 99 })
        expect(classify(puzzle).count).toBe(1)
    })

    it('marks every clue with a track cell of the solution', () => {
        const { puzzle, solution } = generate({ rows: 8, cols: 8, seed: 3 })
        for (const clue of puzzle.clues) {
            const value = solution[clue.row * puzzle.cols + clue.col]
            expect(value).not.toBe(EMPTY)
            expect(value).toBe(clue.piece)
        }
    })
})
