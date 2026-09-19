import { afterEach, describe, expect, it } from 'vitest'
import { generate } from './generator'
import { createUniquenessChecker, setSolverBackend, solverBackend } from './solverBackend'
import { exitDirsAt, indexOf } from './model'
import type { Puzzle } from './types'

afterEach(() => setSolverBackend('csp'))

/** Cell indices of the puzzle's non-exit clues (the strip-loop candidates). */
function candidateCells(puzzle: Puzzle): number[] {
    const cells: number[] = []
    for (const clue of puzzle.clues) {
        if (exitDirsAt(puzzle, clue.row, clue.col).length === 0) {
            cells.push(indexOf(clue.row, clue.col, puzzle.cols))
        }
    }
    return cells
}

describe('solver backend', () => {
    it('defaults to the CSP backend', () => {
        expect(solverBackend()).toBe('csp')
    })

    it('accepts a runtime switch', () => {
        setSolverBackend('sat')
        expect(solverBackend()).toBe('sat')
        setSolverBackend('csp')
        expect(solverBackend()).toBe('csp')
    })
})

describe('createUniquenessChecker', () => {
    it('reports the generated puzzle as unique on both backends', () => {
        const { puzzle, solution } = generate({ rows: 6, cols: 6, seed: 7 })
        const clues = candidateCells(puzzle)
        for (const kind of ['csp', 'sat'] as const) {
            setSolverBackend(kind)
            const checker = createUniquenessChecker(puzzle, solution)
            expect(checker.isUnique(clues), `backend=${kind}`).toBe(true)
        }
    })

    it('agrees between backends when the interior clues are dropped', () => {
        const { puzzle, solution } = generate({ rows: 6, cols: 6, seed: 7 })
        setSolverBackend('csp')
        const csp = createUniquenessChecker(puzzle, solution).isUnique([])
        setSolverBackend('sat')
        const sat = createUniquenessChecker(puzzle, solution).isUnique([])
        expect(csp).toBe(sat)
    })
})
