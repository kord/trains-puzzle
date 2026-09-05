import { describe, it } from 'vitest'
import { generate } from '../src/puzzle/generator'

const SIZES = [6, 7, 8, 9, 10]
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

describe('generation rejections', () => {
    it('reports path and clue rejection stats per size', () => {
        // eslint-disable-next-line no-console
        console.log('\nGeneration rejection stats — 10 seeds per size (averages)\n')
        // eslint-disable-next-line no-console
        console.log(
            'Size  attempts  pathRej  fallbacks  candidates  cluesKept  cluesRemoved',
        )
        for (const size of SIZES) {
            let attempts = 0
            let pathRej = 0
            let fallbacks = 0
            let candidates = 0
            let kept = 0
            let removed = 0
            for (const seed of SEEDS) {
                const { timing } = generate({ rows: size, cols: size, seed, debug: true })
                if (!timing) continue
                attempts += timing.counts.pathAttempts
                pathRej += timing.counts.pathsRejected
                if (timing.counts.usedFallback) fallbacks++
                candidates += timing.counts.clueCandidates
                kept += timing.counts.cluesKept
                removed += timing.counts.cluesRemoved
            }
            const n = SEEDS.length
            const avg = (x: number) => (x / n).toFixed(1)
            // eslint-disable-next-line no-console
            console.log(
                `${String(size).padStart(4)}  ${String(avg(attempts)).padStart(8)}  ${String(avg(pathRej)).padStart(7)}  ${String(fallbacks).padStart(9)}  ${String(avg(candidates)).padStart(10)}  ${String(avg(kept)).padStart(9)}  ${String(avg(removed)).padStart(12)}`,
            )
        }
        // eslint-disable-next-line no-console
        console.log('')
    }, 600000)
})
