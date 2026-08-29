import { describe, expect, it } from 'vitest'
import { dateToSeed, mulberry32, shuffle } from './rng'

describe('rng', () => {
    it('hashes dates deterministically', () => {
        expect(dateToSeed('2026-08-29')).toBe(dateToSeed('2026-08-29'))
        expect(dateToSeed('2026-08-29')).not.toBe(dateToSeed('2026-08-30'))
    })

    it('produces a deterministic sequence', () => {
        const a = mulberry32(1234)
        const b = mulberry32(1234)
        expect(a()).toBe(b())
        expect(a()).toBe(b())
    })

    it('shuffles deterministically for the same seed', () => {
        const base = [1, 2, 3, 4, 5, 6, 7, 8]
        const x = shuffle(mulberry32(5), base.slice())
        const y = shuffle(mulberry32(5), base.slice())
        expect(x).toEqual(y)
        expect([...x].sort()).toEqual(base)
    })
})
