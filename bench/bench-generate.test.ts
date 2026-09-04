import { describe, it } from 'vitest'
import { generate } from '../src/puzzle/generator'
import { setSolverBackend, solverBackend } from '../src/puzzle/solverBackend'

setSolverBackend(process.env.SOLVER === 'sat' ? 'sat' : 'csp')

interface SizeResult {
    size: number
    min: number
    mean: number
    max: number
    failed: number
}

const SEEDS_PER_SIZE = 10

function runSize(size: number): SizeResult {
    const times: number[] = []
    let failed = 0
    for (let i = 0; i < SEEDS_PER_SIZE; i++) {
        const seed = Math.floor(Math.random() * 0x7fffffff)
        const start = performance.now()
        try {
            generate({ rows: size, cols: size, seed })
            times.push(performance.now() - start)
        } catch {
            failed++
        }
    }
    if (times.length === 0) return { size, min: NaN, mean: NaN, max: NaN, failed }
    return {
        size,
        min: Math.min(...times),
        mean: times.reduce((a, b) => a + b, 0) / times.length,
        max: Math.max(...times),
        failed,
    }
}

const fmt = (n: number): string =>
    Number.isNaN(n) ? '       -' : String(Math.round(n)).padStart(8)

describe('generation benchmark', () => {
    it('reports min/mean/max across 10 random seeds per size', () => {
        const results: SizeResult[] = []
        for (const size of [6, 7, 8, 9, 10]) results.push(runSize(size))

        // eslint-disable-next-line no-console
        console.log(`\nGeneration benchmark — 10 random seeds per size (${solverBackend()})\n`)
        // eslint-disable-next-line no-console
        console.log('Size    Min(ms)  Mean(ms)   Max(ms)   Failed')
        for (const r of results) {
            // eslint-disable-next-line no-console
            console.log(
                `${String(r.size).padStart(4)}  ${fmt(r.min)}  ${fmt(r.mean)}  ${fmt(r.max)}  ${String(r.failed).padStart(6)}`,
            )
        }
        // eslint-disable-next-line no-console
        console.log('')
    }, 600000)
})
