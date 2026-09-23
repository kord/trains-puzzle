// Deterministic generation bench: fixed (size, seed) pairs, so runs can be
// compared before and after a change to the generator. Prints timings per size
// plus a fingerprint of every puzzle produced — identical fingerprints mean the
// change did not alter which puzzles come out.
//
//   npx vitest run --config bench.config.ts bench/strip-ab.test.ts
//   $env:SIZES='10,11'; $env:SEEDS='1,2,3'   # pick the boards to measure
//   $env:SOLVER='sat'                        # SAT backend instead of CSP
import { describe, it } from 'vitest'
import { generate, type GeneratedPuzzle } from '../src/puzzle/generator'
import { setSolverBackend, solverBackend } from '../src/puzzle/solverBackend'

setSolverBackend(process.env.SOLVER === 'sat' ? 'sat' : 'csp')

/** Read `NAME=1,2,3` from the environment, else use the fallback. */
function envList(name: string, fallback: number[]): number[] {
    const raw = process.env[name]
    if (!raw) return fallback
    const values = raw
        .split(',')
        .map((part) => Number(part.trim()))
        .filter((n) => Number.isInteger(n) && n > 0)
    return values.length > 0 ? values : fallback
}

const SIZES = envList('SIZES', [6, 7, 8, 9, 10])
const SEEDS = envList('SEEDS', [1, 2, 3, 4, 5, 6])

function fnv1a(text: string): string {
    let h = 0x811c9dc5
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i)
        h = Math.imul(h, 0x01000193) >>> 0
    }
    return h.toString(16).padStart(8, '0')
}

/** Fingerprint of everything the generator produces for one (size, seed). */
function digest({ puzzle, solution }: GeneratedPuzzle): string {
    const clues = puzzle.clues
        .map((c) => `${c.row},${c.col},${c.piece}`)
        .join(';')
    const body = [
        puzzle.rows,
        puzzle.cols,
        puzzle.rowCounts.join(','),
        puzzle.colCounts.join(','),
        clues,
        solution.join(','),
    ].join('|')
    return `${fnv1a(body)}/${puzzle.clues.length}`
}

describe('strip-loop A/B', () => {
    it('prints per-size timings and puzzle digests', () => {
        // eslint-disable-next-line no-console
        console.log(`\nbackend: ${solverBackend()}  sizes: ${SIZES.join(',')}  seeds: ${SEEDS.join(',')}`)
        for (const size of SIZES) {
            const times: number[] = []
            const digests: string[] = []
            let failed = 0
            for (const seed of SEEDS) {
                const start = performance.now()
                try {
                    const generated = generate({ rows: size, cols: size, seed })
                    times.push(performance.now() - start)
                    digests.push(digest(generated))
                } catch (err) {
                    // e.g. MiniSat's fixed heap aborting on the SAT backend.
                    failed++
                    times.push(performance.now() - start)
                    digests.push(`FAILED:${String(err).split('\n')[0].slice(0, 50)}`)
                }
            }
            const total = times.reduce((a, b) => a + b, 0)
            const mean = total / times.length
            // eslint-disable-next-line no-console
            console.log(
                `${String(size).padStart(2)}x${size}  min ${Math.round(Math.min(...times)).toString().padStart(5)}  mean ${Math.round(mean)
                    .toString()
                    .padStart(5)}  max ${Math.round(Math.max(...times)).toString().padStart(6)}  total ${Math.round(total)
                        .toString()
                        .padStart(6)}  failed ${failed}`,
            )
            // eslint-disable-next-line no-console
            console.log(`      per seed: ${times.map((ms) => Math.round(ms)).join(', ')}`)
            // eslint-disable-next-line no-console
            console.log(`      ${digests.join(' ')}`)
        }
    }, 900000)
})
