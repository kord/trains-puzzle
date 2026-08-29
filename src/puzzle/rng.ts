// Deterministic pseudo-random number generation, used so the daily puzzle
// is the same for everyone on a given date.

export type Rng = () => number

/** FNV-1a 32-bit string hash, used to derive a seed from a date string. */
export function dateToSeed(str: string): number {
    let h = 0x811c9dc5
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i)
        h = Math.imul(h, 0x01000193)
    }
    return h >>> 0
}

/** Mulberry32 PRNG; returns floats in [0, 1). */
export function mulberry32(seed: number): Rng {
    let a = seed >>> 0
    return function () {
        a |= 0
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

export function makeRng(seed: number): Rng {
    return mulberry32(seed)
}

/** Uniform integer in [min, max] inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
    return min + Math.floor(rng() * (max - min + 1))
}

/** Pick a random element. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
    return items[Math.floor(rng() * items.length)]
}

/** In-place Fisher-Yates shuffle; returns the same array. */
export function shuffle<T>(rng: Rng, items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
            ;[items[i], items[j]] = [items[j], items[i]]
    }
    return items
}
