import { describe, it } from 'vitest'
import { generate } from '../src/puzzle/generator'
import { setSolverBackend, solverBackend } from '../src/puzzle/solverBackend'

// Choose the backend via the SOLVER env var (csp | sat); defaults to csp.
setSolverBackend(process.env.SOLVER === 'sat' ? 'sat' : 'csp')

// Deterministic cases; sizes 9 and 10 are where generation is slowest.
const CASES: Array<[number, number]> = [
    [9, 1],
    [9, 2],
    [9, 3],
    [10, 1],
    [10, 2],
    [10, 3],
]

describe('generation profile', () => {
    it('prints per-phase timing breakdown', () => {
        // eslint-disable-next-line no-console
        console.log(`\nSolver backend: ${solverBackend()}\n`)
        for (const [size, seed] of CASES) {
            try {
                const { timing } = generate({ rows: size, cols: size, seed, debug: true })
                if (!timing) continue
                // eslint-disable-next-line no-console
                console.log(`\n=== ${size}x${size} seed ${seed} — total ${Math.round(timing.totalMs)}ms ===`)
                // eslint-disable-next-line no-console
                console.log('phase            total(ms)  calls    max(ms)   share')
                for (const p of timing.phases) {
                    const share = `${((p.ms / timing.totalMs) * 100).toFixed(1)}%`
                    // eslint-disable-next-line no-console
                    console.log(
                        `${p.name.padEnd(15)}  ${String(Math.round(p.ms)).padStart(8)}  ${String(p.calls).padStart(5)}  ${String(Math.round(p.maxMs)).padStart(7)}  ${share.padStart(6)}`,
                    )
                }
            } catch (err) {
                // eslint-disable-next-line no-console
                console.log(`\n=== ${size}x${size} seed ${seed} — FAILED: ${String(err).split('\n')[0]} ===`)
            }
        }
    }, 600000)
})
