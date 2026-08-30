// Difficulty tiers. To change a tier's grid size, edit the single constant
// below — it is used everywhere (daily and practice generation, labels, and
// solved tracking).

export const EASY_SIZE = 6
export const MEDIUM_SIZE = 7
export const HARD_SIZE = 9

export type DailySize = typeof EASY_SIZE | typeof MEDIUM_SIZE | typeof HARD_SIZE

export const DAILY_SIZES: readonly DailySize[] = [EASY_SIZE, MEDIUM_SIZE, HARD_SIZE]

export const DAILY_SIZE_LABELS: Record<DailySize, string> = {
    [EASY_SIZE]: `Easy (${EASY_SIZE}×${EASY_SIZE})`,
    [MEDIUM_SIZE]: `Medium (${MEDIUM_SIZE}×${MEDIUM_SIZE})`,
    [HARD_SIZE]: `Hard (${HARD_SIZE}×${HARD_SIZE})`,
}

// Practice mode offers the same three sizes as the daily tiers.
export type PracticeSize = DailySize
export const PRACTICE_SIZES: readonly PracticeSize[] = DAILY_SIZES
export const PRACTICE_SIZE_LABELS: Record<PracticeSize, string> = DAILY_SIZE_LABELS
