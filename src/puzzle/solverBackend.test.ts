import { afterEach, describe, expect, it } from 'vitest'
import { generate } from './generator'
import { createUniquenessChecker, setSolverBackend, solverBackend } from './solverBackend'
import { EMPTY, colOf, exitDirsAt, indexOf, rowOf } from './model'
import type { Board, PieceId, Puzzle } from './types'

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

/**
 * Rebuild the generator's *starting* clue set: every track cell of the
 * solution is a clue, so the strip loop can be replayed from the top.
 */
function fullClueSet(puzzle: Puzzle, solution: Board): { puzzle: Puzzle; cells: number[] } {
    const { cols } = puzzle
    const clueCells = new Set(puzzle.clues.map((c) => indexOf(c.row, c.col, cols)))
    const clues = [...puzzle.clues]
    const cells: number[] = []
    for (let i = 0; i < solution.length; i++) {
        const piece = solution[i]
        if (piece === EMPTY || clueCells.has(i)) continue
        clues.push({ row: rowOf(i, cols), col: colOf(i, cols), piece: piece as PieceId })
        cells.push(i)
    }
    return { puzzle: { ...puzzle, clues }, cells }
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

    // canRemoveClue answers a narrower question than isUnique ("is there a
    // solution differing at this one cell?"), which is only equivalent while
    // the clue set *including* that clue is unique. Replaying the strip loop
    // checks the shortcut against the full oracle at every step.
    it('matches the full uniqueness oracle at every step of a strip', () => {
        const generated = generate({ rows: 6, cols: 6, seed: 7 })
        const { puzzle: full, cells } = fullClueSet(generated.puzzle, generated.solution)
        expect(cells.length).toBeGreaterThan(10)

        for (const kind of ['csp', 'sat'] as const) {
            setSolverBackend(kind)
            const checker = createUniquenessChecker(full, generated.solution)
            const active = new Set<number>(cells)
            // Every track cell is a clue to begin with, which is unique.
            expect(checker.isUnique(active), `backend=${kind} start`).toBe(true)

            for (const cell of cells) {
                const reduced = new Set(active)
                reduced.delete(cell)
                const verdict = checker.canRemoveClue(reduced, cell)
                const expected = checker.isUnique(reduced) ? 'unique' : 'multiple'
                expect(verdict, `backend=${kind} cell=${cell}`).toBe(expected)
                if (verdict === 'unique') active.delete(cell)
            }

            // A full strip must still leave a uniquely solvable puzzle.
            expect(checker.isUnique(active), `backend=${kind} end`).toBe(true)
        }
    })
})
