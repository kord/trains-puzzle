import { describe, it } from 'vitest'
import { generate } from '../src/puzzle/generator'
import { setSolverBackend } from '../src/puzzle/solverBackend'

const SIZES = [6, 7, 8, 9, 10]
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

interface Stats {
    min: number
    mean: number
    max: number
    failed: number
}

function runBackend(kind: 'csp' | 'sat', size: number): Stats {
    setSolverBackend(kind)
    const times: number[] = []
    let failed = 0
    for (const seed of SEEDS) {
        const start = performance.now()
        try {
            generate({ rows: size, cols: size, seed })
            times.push(performance.now() - start)
        } catch {
            failed++
        }
    }
    if (times.length === 0) return { min: NaN, mean: NaN, max: NaN, failed }
    return {
        min: Math.min(...times),
        mean: times.reduce((a, b) => a + b, 0) / times.length,
        max: Math.max(...times),
        failed,
    }
}

const fmt = (n: number): string => (Number.isNaN(n) ? '     -' : String(Math.round(n)).padStart(6))

describe('CSP vs SAT benchmark', () => {
    it('compares both backends on identical seeds', () => {
        // eslint-disable-next-line no-console
        console.log('\nGeneration benchmark — CSP vs incremental SAT (10 fixed seeds per size)\n')
        // eslint-disable-next-line no-console
        console.log('Size   CSP min/mean/max   SAT min/mean/max   CSP failed  SAT failed')
        for (const size of SIZES) {
            const csp = runBackend('csp', size)
            const sat = runBackend('sat', size)
            // eslint-disable-next-line no-console
            console.log(
                `${String(size).padStart(4)}   ${fmt(csp.min)}/${fmt(csp.mean)}/${fmt(csp.max)}   ` +
                    `${fmt(sat.min)}/${fmt(sat.mean)}/${fmt(sat.max)}   ` +
                    `${String(csp.failed).padStart(10)}  ${String(sat.failed).padStart(10)}`,
            )
        }
        // eslint-disable-next-line no-console
        console.log('')
    }, 600000)
})
