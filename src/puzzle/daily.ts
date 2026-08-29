// Daily puzzle selection: a fixed-size puzzle seeded deterministically by
// the calendar date and the grid size, so everyone gets the same puzzle on
// the same day for each difficulty tier.

import { generate, type GeneratedPuzzle } from './generator'
import { dateToSeed } from './rng'

export function dailyPuzzleFor(date: string, size: number): GeneratedPuzzle {
    return generate({
        rows: size,
        cols: size,
        seed: dateToSeed(`${size}:${date}`),
    })
}
