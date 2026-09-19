import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import type { PointerAction } from '../components/Board'
import { dateToSeed } from '../puzzle/rng'
import { requestGenerate, type GeneratedResult } from './puzzleWorker'
import {
    getSolvedDates,
    loadDay,
    saveDay,
    type DayRecord,
    type StorageLike,
} from '../puzzle/storage'
import type { Board, Puzzle, UserCell } from '../puzzle/types'
import {
    DAILY_SIZES,
    EASY_SIZE,
    HARD_SIZE,
    MEDIUM_SIZE,
    type DailySize,
    type PracticeSize,
} from '../puzzle/sizes'
import {
    applyTool,
    clearCell,
    initialUserCells,
    isSolved,
    markX,
    paintTool,
    parseDateKey,
    todayKey,
    type Tool,
} from './helpers'

export type Mode = 'daily' | 'practice'

function noopStorage(): StorageLike {
    return {
        getItem: () => null,
        setItem: () => { },
    }
}

function randomSeed(): number {
    return (Math.random() * 0xffffffff) >>> 0
}

/** Deterministic per-day seed: same size + date gives the same puzzle. */
function dailySeed(size: number, date: string): number {
    return dateToSeed(`${size}:${date}`)
}

function makeRecord(puzzle: Puzzle, solution: Board): DayRecord {
    return { puzzle, solution, userCells: initialUserCells(puzzle), solved: false }
}

/**
 * All state and actions for a puzzle session (daily or practice), including
 * cell editing, undo history, and the win/calendar side effects.
 */
export function useGameSession() {
    const storage = useMemo<StorageLike>(() => {
        try {
            return window.localStorage
        } catch {
            return noopStorage()
        }
    }, [])

    const today = todayKey()
    const [mode, setMode] = useState<Mode>('daily')
    const [practiceSize, setPracticeSize] = useState<PracticeSize>(HARD_SIZE)
    const [tool, setTool] = useState<Tool>('dot')

    const [dailySize, setDailySize] = useState<DailySize>(EASY_SIZE)
    const [dailyDate, setDailyDate] = useState<string>(today)
    const [daily, setDaily] = useState<DayRecord | null>(() => loadDay(storage, EASY_SIZE, today))
    const [practice, setPractice] = useState<DayRecord | null>(null)
    const [loading, setLoading] = useState(false)
    const [loadError, setLoadError] = useState(false)
    const [showWin, setShowWin] = useState(false)
    const [calendarOpen, setCalendarOpen] = useState(false)

    const record = mode === 'daily' ? daily : practice
    const solved = record?.solved ?? false

    // Foreground generation token: only the latest request may update state.
    const loadTokenRef = useRef(0)
    // In-flight daily generations, deduped by `${size}:${date}`.
    const dailyGenRef = useRef(new Map<string, Promise<GeneratedResult>>())

    const generateDailyResult = useCallback(
        (size: DailySize, date: string, kind: 'foreground' | 'background') => {
            const key = `${size}:${date}`
            const existing = dailyGenRef.current.get(key)
            if (existing) return existing
            const promise = requestGenerate(kind, size, dailySeed(size, date))
            dailyGenRef.current.set(key, promise)
            void promise.finally(() => dailyGenRef.current.delete(key))
            return promise
        },
        [],
    )

    const showDaily = useCallback(
        async (size: DailySize, date: string) => {
            const token = ++loadTokenRef.current
            setLoading(true)
            setLoadError(false)
            const cached = loadDay(storage, size, date)
            if (cached) {
                if (token === loadTokenRef.current) {
                    setDaily(cached)
                    setLoading(false)
                }
                return
            }
            // Clear the board while generating so a stale day isn't shown.
            if (token === loadTokenRef.current) setDaily(null)
            try {
                const { puzzle, solution } = await generateDailyResult(size, date, 'foreground')
                if (token !== loadTokenRef.current) return
                const record = makeRecord(puzzle, solution)
                saveDay(storage, size, date, record)
                setDaily(record)
            } catch {
                if (token === loadTokenRef.current) setLoadError(true)
            } finally {
                if (token === loadTokenRef.current) setLoading(false)
            }
        },
        [storage, generateDailyResult],
    )

    const prefetchDaily = useCallback(
        (date: string) => {
            for (const size of DAILY_SIZES) {
                if (size === EASY_SIZE || loadDay(storage, size, date)) continue
                void generateDailyResult(size, date, 'background')
                    .then(({ puzzle, solution }) => {
                        saveDay(storage, size, date, makeRecord(puzzle, solution))
                    })
                    .catch(() => {
                        // Background generation is best-effort.
                    })
            }
        },
        [storage, generateDailyResult],
    )

    const loadPractice = useCallback((size: PracticeSize) => {
        const token = ++loadTokenRef.current
        setLoading(true)
        setLoadError(false)
        setPractice(null)
        void requestGenerate('foreground', size, randomSeed())
            .then(({ puzzle, solution }) => {
                if (token !== loadTokenRef.current) return
                setPractice(makeRecord(puzzle, solution))
            })
            .catch(() => {
                if (token === loadTokenRef.current) setLoadError(true)
            })
            .finally(() => {
                if (token === loadTokenRef.current) setLoading(false)
            })
    }, [])

    // Undo history: one snapshot per mouse stroke (a whole click or drag).
    const undoStackRef = useRef<UserCell[][]>([])
    const strokeChangedRef = useRef(false)
    const strokeActiveRef = useRef(false)

    // Celebrate and pop the overlay only when the player's own move completes
    // the puzzle — never merely because a loaded or switched puzzle is solved.
    const solutionRef = useRef(record?.solution)
    const prevSolved = useRef(solved)
    useEffect(() => {
        if (solutionRef.current !== record?.solution) {
            solutionRef.current = record?.solution
            prevSolved.current = solved
            setShowWin(false)
            undoStackRef.current = []
            strokeActiveRef.current = false
            return
        }
        if (solved && !prevSolved.current) {
            confetti({ particleCount: 120, spread: 75, origin: { y: 0.6 } })
            confetti({ particleCount: 60, spread: 110, origin: { y: 0.5 } })
            confetti({ particleCount: 180, spread: 130, origin: { y: 0.4 } })
            setShowWin(true)
        }
        if (!solved) setShowWin(false)
        prevSolved.current = solved
    }, [solved, record])

    const solvedEasy = new Set(getSolvedDates(storage, EASY_SIZE))
    const solvedMedium = new Set(getSolvedDates(storage, MEDIUM_SIZE))
    const solvedHard = new Set(getSolvedDates(storage, HARD_SIZE))

    const dateLabel = useMemo(
        () =>
            parseDateKey(dailyDate).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            }),
        [dailyDate],
    )

    const updateDaily = useCallback(
        (cells: UserCell[]) => {
            setDaily((prev) => {
                if (!prev) return prev
                const next: DayRecord = {
                    ...prev,
                    userCells: cells,
                    solved: isSolved(prev.solution, cells),
                }
                saveDay(storage, dailySize, dailyDate, next)
                return next
            })
        },
        [storage, dailySize, dailyDate],
    )

    const updatePractice = useCallback((cells: UserCell[]) => {
        setPractice((prev) =>
            prev ? { ...prev, userCells: cells, solved: isSolved(prev.solution, cells) } : prev,
        )
    }, [])

    const updateCells = useCallback(
        (cells: UserCell[]) => {
            if (mode === 'daily') updateDaily(cells)
            else updatePractice(cells)
        },
        [mode, updateDaily, updatePractice],
    )

    const pushUndoSnapshot = useCallback(() => {
        if (!record || record.solved) {
            strokeActiveRef.current = false
            return
        }
        undoStackRef.current.push(record.userCells)
        strokeChangedRef.current = false
        strokeActiveRef.current = true
    }, [record])

    const finishStroke = useCallback(() => {
        if (!strokeActiveRef.current) return
        strokeActiveRef.current = false
        // Discard the snapshot when the whole stroke changed nothing.
        if (!strokeChangedRef.current) {
            undoStackRef.current.pop()
        }
    }, [])

    const undo = useCallback(() => {
        if (!record || record.solved) return
        const prev = undoStackRef.current.pop()
        if (prev) updateCells(prev)
    }, [record, updateCells])

    const undoRef = useRef(undo)
    undoRef.current = undo

    const handleCellClick = useCallback(
        (index: number, baseCells: UserCell[], action: PointerAction) => {
            if (!record || record.solved) return
            const next =
                action === 'erase'
                    ? clearCell(record.puzzle, baseCells, index)
                    : action === 'right'
                        ? markX(record.puzzle, baseCells, index)
                        : applyTool(record.puzzle, baseCells, index, tool)
            if (next) {
                strokeChangedRef.current = true
                updateCells(next)
            }
        },
        [record, tool, updateCells],
    )

    const handleCellPaint = useCallback(
        (index: number, action: PointerAction) => {
            if (!record || record.solved) return
            const next =
                action === 'erase'
                    ? clearCell(record.puzzle, record.userCells, index)
                    : action === 'right'
                        ? markX(record.puzzle, record.userCells, index)
                        : paintTool(record.puzzle, record.userCells, index, tool)
            if (next) {
                strokeChangedRef.current = true
                updateCells(next)
            }
        },
        [record, tool, updateCells],
    )

    const selectDate = useCallback(
        (date: string) => {
            setDailyDate(date)
            setDailySize(EASY_SIZE)
            setCalendarOpen(false)
            void showDaily(EASY_SIZE, date)
            prefetchDaily(date)
        },
        [showDaily, prefetchDaily],
    )

    const selectDailySize = useCallback(
        (size: DailySize) => {
            setDailySize(size)
            void showDaily(size, dailyDate)
        },
        [showDaily, dailyDate],
    )

    const newPractice = useCallback(() => {
        loadPractice(practiceSize)
    }, [loadPractice, practiceSize])

    const enterDaily = useCallback(() => {
        setMode('daily')
        setCalendarOpen(false)
    }, [])

    const enterPractice = useCallback(() => {
        setMode('practice')
        setCalendarOpen(false)
        if (!practice) loadPractice(practiceSize)
    }, [practice, loadPractice, practiceSize])

    const toggleCalendar = useCallback(() => {
        setCalendarOpen((open) => !open)
    }, [])

    const dismissWin = useCallback(() => {
        setShowWin(false)
    }, [])

    const changeSize = useCallback(
        (size: PracticeSize) => {
            setPracticeSize(size)
            loadPractice(size)
        },
        [loadPractice],
    )

    const restart = useCallback(() => {
        if (!record) return
        undoStackRef.current = []
        strokeActiveRef.current = false
        const next: DayRecord = {
            ...record,
            userCells: initialUserCells(record.puzzle),
            solved: false,
            solvedAt: undefined,
        }
        if (mode === 'daily') {
            setDaily(next)
            saveDay(storage, dailySize, dailyDate, next)
        } else {
            setPractice(next)
        }
    }, [record, mode, storage, dailySize, dailyDate])

    // Load the initial daily (easy) and prefetch the other sizes in background.
    const initializedRef = useRef(false)
    useEffect(() => {
        if (initializedRef.current) return
        initializedRef.current = true
        void showDaily(EASY_SIZE, today)
        prefetchDaily(today)
    }, [showDaily, prefetchDaily, today])

    // Show a busy cursor while the player waits on a foreground puzzle.
    useEffect(() => {
        document.body.style.cursor = loading ? 'progress' : ''
        return () => {
            document.body.style.cursor = ''
        }
    }, [loading])

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'd' || e.key === 'D') {
                setTool('dot')
            } else if (e.key === 'x' || e.key === 'X') {
                setTool('x')
            } else if (e.key === 'z' || e.key === 'Z') {
                undoRef.current()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    // Right-click is a game action, never a browser context menu.
    useEffect(() => {
        const onContextMenu = (e: MouseEvent) => e.preventDefault()
        document.addEventListener('contextmenu', onContextMenu)
        return () => document.removeEventListener('contextmenu', onContextMenu)
    }, [])

    // Close the calendar dropdown when clicking anywhere outside it.
    const calendarWrapRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (calendarWrapRef.current && !calendarWrapRef.current.contains(e.target as Node)) {
                setCalendarOpen(false)
            }
        }
        document.addEventListener('mousedown', onDown)
        return () => document.removeEventListener('mousedown', onDown)
    }, [])

    return {
        mode,
        tool,
        record,
        loading,
        loadError,
        showWin,
        today,
        dailyDate,
        dateLabel,
        calendarOpen,
        dailySize,
        practiceSize,
        solvedEasy,
        solvedMedium,
        solvedHard,
        calendarWrapRef,
        setTool,
        enterDaily,
        enterPractice,
        toggleCalendar,
        dismissWin,
        selectDate,
        selectDailySize,
        changeSize,
        newPractice,
        restart,
        undo,
        handleCellClick,
        handleCellPaint,
        pushUndoSnapshot,
        finishStroke,
    }
}
