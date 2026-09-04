// Single switch point for the solver used during generation. The generator
// calls `countSolutions`/`classify` from here so swapping between the
// backtracking (CSP) solver and the SAT solver is a one-line change: flip
// `DEFAULT_BACKEND` below, call `setSolverBackend()` at startup, or set the
// `SOLVER` env var in Node (the bench scripts do this).

import {
    classify as classifyCsp,
    countSolutions as countCsp,
    type ClassifyResult,
    type CountResult,
} from './solver'
import { classify as classifySat, countSolutions as countSat } from './satsolver'
import type { Puzzle } from './types'

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

export function countSolutions(puzzle: Puzzle, limit: number): CountResult {
    return current === 'sat' ? countSat(puzzle, limit) : countCsp(puzzle, limit)
}

export function classify(puzzle: Puzzle): ClassifyResult {
    return current === 'sat' ? classifySat(puzzle) : classifyCsp(puzzle)
}
