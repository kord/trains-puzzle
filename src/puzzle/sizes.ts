// Difficulty tiers and practice sizes. To change a tier's grid size, edit the
// single constant below — it is used everywhere (daily generation, labels,
// solved tracking, and the calendar checkmarks).

export const EASY_SIZE = 6
export const MEDIUM_SIZE = 7
export const HARD_SIZE = 9

export const PRACTICE_EASY_SIZE = 6
export const PRACTICE_HARD_SIZE = 8

export type DailySize = typeof EASY_SIZE | typeof MEDIUM_SIZE | typeof HARD_SIZE
export type PracticeSize = typeof PRACTICE_EASY_SIZE | typeof PRACTICE_HARD_SIZE

export const DAILY_SIZES: readonly DailySize[] = [EASY_SIZE, MEDIUM_SIZE, HARD_SIZE]
export const PRACTICE_SIZES: readonly PracticeSize[] = [PRACTICE_EASY_SIZE, PRACTICE_HARD_SIZE]

export const DAILY_SIZE_LABELS: Record<DailySize, string> = {
    [EASY_SIZE]: `Easy (${EASY_SIZE}×${EASY_SIZE})`,
    [MEDIUM_SIZE]: `Medium (${MEDIUM_SIZE}×${MEDIUM_SIZE})`,
    [HARD_SIZE]: `Hard (${HARD_SIZE}×${HARD_SIZE})`,
}

export const PRACTICE_SIZE_LABELS: Record<PracticeSize, string> = {
    [PRACTICE_EASY_SIZE]: `${PRACTICE_EASY_SIZE}×${PRACTICE_EASY_SIZE} Easy`,
    [PRACTICE_HARD_SIZE]: `${PRACTICE_HARD_SIZE}×${PRACTICE_HARD_SIZE} Hard`,
}
