// Deterministic generation bench: fixed (size, seed) pairs, so runs can be
// compared before and after a change to the generator. Prints timings per size
// plus a fingerprint of every puzzle produced — identical fingerprints mean the
// change did not alter which puzzles come out.
//
//   npx vitest run --config bench.config.ts bench/strip-ab.test.ts
//   $env:SOLVER='sat'   # to fingerprint/bench the SAT backend instead
import { describe, it } from 'vitest'
import { generate, type GeneratedPuzzle } from '../src/puzzle/generator'
import { setSolverBackend, solverBackend } from '../src/puzzle/solverBackend'

setSolverBackend(process.env.SOLVER === 'sat' ? 'sat' : 'csp')

const SIZES = [6, 7, 8, 9, 10]
const SEEDS = [1, 2, 3, 4, 5, 6]

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
        console.log(`\nbackend: ${solverBackend()}`)
        for (const size of SIZES) {
            const times: number[] = []
            const digests: string[] = []
            for (const seed of SEEDS) {
                const start = performance.now()
                const generated = generate({ rows: size, cols: size, seed })
                times.push(performance.now() - start)
                digests.push(digest(generated))
            }
            const mean = times.reduce((a, b) => a + b, 0) / times.length
            // eslint-disable-next-line no-console
            console.log(
                `${String(size).padStart(2)}x${size}  min ${Math.round(Math.min(...times)).toString().padStart(4)}  mean ${Math.round(mean)
                    .toString()
                    .padStart(4)}  max ${Math.round(Math.max(...times)).toString().padStart(5)}  total ${Math.round(
                        times.reduce((a, b) => a + b, 0),
                    )
                        .toString()
                        .padStart(5)}`,
            )
            // eslint-disable-next-line no-console
            console.log(`      ${digests.join(' ')}`)
        }
    }, 900000)
})
