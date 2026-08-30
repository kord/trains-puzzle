import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import './App.css'
import { Board, type PointerAction } from './components/Board'
import { Calendar } from './components/Calendar'
import { Palette } from './components/Palette'
import { WinOverlay } from './components/WinOverlay'
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
} from './game/helpers'
import { dailyPuzzleFor } from './puzzle/daily'
import { generate } from './puzzle/generator'
import {
  getSolvedDates,
  loadDay,
  saveDay,
  type DayRecord,
  type StorageLike,
} from './puzzle/storage'
import type { UserCell } from './puzzle/types'
import {
  DAILY_SIZES,
  DAILY_SIZE_LABELS,
  EASY_SIZE,
  HARD_SIZE,
  MEDIUM_SIZE,
  PRACTICE_HARD_SIZE,
  PRACTICE_SIZES,
  PRACTICE_SIZE_LABELS,
  type DailySize,
  type PracticeSize,
} from './puzzle/sizes'

type Mode = 'daily' | 'practice'

function noopStorage(): StorageLike {
  return {
    getItem: () => null,
    setItem: () => { },
  }
}

function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0
}

function loadOrCreateDaily(storage: StorageLike, size: DailySize, date: string): DayRecord {
  const existing = loadDay(storage, size, date)
  if (existing) return existing
  const { puzzle, solution } = dailyPuzzleFor(date, size)
  const record: DayRecord = {
    puzzle,
    solution,
    userCells: initialUserCells(puzzle),
    solved: false,
  }
  saveDay(storage, size, date, record)
  return record
}

function makePractice(size: PracticeSize): DayRecord {
  const { puzzle, solution } = generate({ rows: size, cols: size, seed: randomSeed() })
  return { puzzle, solution, userCells: initialUserCells(puzzle), solved: false }
}

export default function App() {
  const storage = useMemo<StorageLike>(() => {
    try {
      return window.localStorage
    } catch {
      return noopStorage()
    }
  }, [])

  const today = todayKey()
  const [mode, setMode] = useState<Mode>('daily')
  const [practiceSize, setPracticeSize] = useState<PracticeSize>(PRACTICE_HARD_SIZE)
  const [tool, setTool] = useState<Tool>('dot')

  const [dailySize, setDailySize] = useState<DailySize>(EASY_SIZE)
  const [dailyDate, setDailyDate] = useState<string>(today)
  const [daily, setDaily] = useState<DayRecord>(() => loadOrCreateDaily(storage, EASY_SIZE, today))
  const [practice, setPractice] = useState<DayRecord | null>(null)
  const [showWin, setShowWin] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const record = mode === 'daily' ? daily : practice
  const solved = record?.solved ?? false

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
      setDaily(loadOrCreateDaily(storage, dailySize, date))
      setCalendarOpen(false)
    },
    [storage, dailySize],
  )

  const selectDailySize = useCallback(
    (size: DailySize) => {
      setDailySize(size)
      setDaily(loadOrCreateDaily(storage, size, dailyDate))
    },
    [storage, dailyDate],
  )

  const newPractice = useCallback(() => {
    setPractice(makePractice(practiceSize))
  }, [practiceSize])

  const enterPractice = useCallback(() => {
    setMode('practice')
    setCalendarOpen(false)
    setPractice((prev) => prev ?? makePractice(practiceSize))
  }, [practiceSize])

  const changeSize = useCallback((size: PracticeSize) => {
    setPracticeSize(size)
    setPractice(makePractice(size))
  }, [])

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

  return (
    <div className="app">
      <header className="app-header">
        <h1>Train Tracks</h1>
        <div className="mode-switch">
          <button
            type="button"
            className={mode === 'daily' ? 'active' : ''}
            onClick={() => {
              setMode('daily')
              setCalendarOpen(false)
            }}
          >
            Daily
          </button>
          {mode === 'daily' && (
            <div className="date-wrap" ref={calendarWrapRef}>
              <button
                type="button"
                className="date-toggle"
                aria-expanded={calendarOpen}
                onClick={() => setCalendarOpen((open) => !open)}
              >
                {dateLabel} ▾
              </button>
              {calendarOpen && (
                <div className="date-popover">
                  <Calendar
                    selected={dailyDate}
                    today={today}
                    solvedEasy={solvedEasy}
                    solvedMedium={solvedMedium}
                    solvedHard={solvedHard}
                    onSelect={selectDate}
                  />
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            className={mode === 'practice' ? 'active' : ''}
            onClick={enterPractice}
          >
            Practice
          </button>
        </div>
      </header>

      {mode === 'daily' ? (
        <div className="size-controls">
          <span className="control-label">Size</span>
          {DAILY_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              className={dailySize === size ? 'active' : ''}
              onClick={() => selectDailySize(size)}
            >
              {DAILY_SIZE_LABELS[size]}
            </button>
          ))}
          <button type="button" onClick={restart}>
            Restart
          </button>
        </div>
      ) : (
        <div className="size-controls">
          <span className="control-label">Size</span>
          {PRACTICE_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              className={practiceSize === size ? 'active' : ''}
              onClick={() => changeSize(size)}
            >
              {PRACTICE_SIZE_LABELS[size]}
            </button>
          ))}
          <button type="button" onClick={newPractice}>
            New puzzle
          </button>
          <button type="button" onClick={restart}>
            Restart
          </button>
        </div>
      )}

      <Palette tool={tool} onSelect={setTool} onUndo={undo} />

      {record ? (
        <Board
          puzzle={record.puzzle}
          cells={record.userCells}
          onCellClick={handleCellClick}
          onCellPaint={handleCellPaint}
          onStrokeStart={pushUndoSnapshot}
          onStrokeEnd={finishStroke}
        />
      ) : (
        <p className="hint">Generating puzzle…</p>
      )}

      <p className="hint">
        Left-click cycles dots through pieces · Drag to paint · Right-click marks empty (X) ·
        Right-drag from an X erases
      </p>

      {showWin && (
        <WinOverlay
          onDismiss={() => setShowWin(false)}
          onNew={mode === 'practice' ? newPractice : undefined}
        />
      )}
    </div>
  )
}
