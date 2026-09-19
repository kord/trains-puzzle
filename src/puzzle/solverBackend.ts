// Single switch point for the solver used during generation. The generator
// calls `createUniquenessChecker` from here, so swapping between the
// backtracking (CSP) solver and the incremental SAT solver is a one-line
// change: flip `DEFAULT_BACKEND` below, call `setSolverBackend()` at startup,
// or set the `SOLVER` env var in Node (the bench scripts do this).

import { countSolutions as countCsp } from './solver'
import { createIncrementalUniqueness } from './satsolver'
import { exitDirsAt, indexOf } from './model'
import type { Board, Clue, Puzzle } from './types'

/** The solver used for generation: the CSP backtracker or the SAT solver. */
export type SolverKind = 'csp' | 'sat'

/** Flip this to change which solver generation uses by default. */
const DEFAULT_BACKEND: SolverKind = 'csp'

let current: SolverKind = DEFAULT_BACKEND

/** Override the backend at runtime (used by the bench scripts via SOLVER env). */
export function setSolverBackend(kind: SolverKind): void {
    current = kind
}

export function solverBackend(): SolverKind {
    return current
}

/** A uniqueness oracle used by the generator's strip loop. */
export interface UniquenessChecker {
    /** True when the puzzle is unique with only the given clue cells active. */
    isUnique(activeCells: Iterable<number>): boolean
}

/** CSP checker: rebuilds the clue set from the active cells on each call. */
function cspChecker(puzzle: Puzzle, solution: Board): UniquenessChecker {
    const { cols } = puzzle
    const exits: Clue[] = []
    const candidates = new Map<number, Clue>()
    for (const clue of puzzle.clues) {
        if (exitDirsAt(puzzle, clue.row, clue.col).length > 0) exits.push(clue)
        else candidates.set(indexOf(clue.row, clue.col, cols), clue)
    }
    return {
        isUnique(activeCells: Iterable<number>): boolean {
            const clues = exits.slice()
            for (const i of activeCells) {
                const clue = candidates.get(i)
                if (clue) clues.push(clue)
            }
            // Value-order the search with the known solution.
            return countCsp({ ...puzzle, clues }, 2, solution).count === 1
        },
    }
}

/**
 * Create the uniqueness checker for the generator's strip loop using the
 * current backend: incremental SAT (one solver, assumption toggling) or a
 * per-call CSP check.
 */
export function createUniquenessChecker(puzzle: Puzzle, solution: Board): UniquenessChecker {
    if (current === 'sat') return createIncrementalUniqueness(puzzle, solution)
    return cspChecker(puzzle, solution)
}
