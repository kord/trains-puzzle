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

  const record = mode === 'daily' ? daily : practice
  const solved = record?.solved ?? false

  // Celebrate and pop the overlay only when the player's own move completes
  // the puzzle — never merely because a loaded or switched puzzle is solved.
  const solutionRef = useRef(record?.solution)
  const prevSolved = useRef(solved)
  useEffect(() => {
    if (solutionRef.current !== record?.solution) {
      solutionRef.current = record?.solution
      prevSolved.current = solved
      setShowWin(false)
      return
    }
    if (solved && !prevSolved.current) {
      confetti({ particleCount: 120, spread: 75, origin: { y: 0.6 } })
      confetti({ particleCount: 60, spread: 110, origin: { y: 0.5 } })
      setShowWin(true)
    }
    if (!solved) setShowWin(false)
    prevSolved.current = solved
  }, [solved, record])

  const solvedEasy = new Set(getSolvedDates(storage, EASY_SIZE))
  const solvedMedium = new Set(getSolvedDates(storage, MEDIUM_SIZE))
  const solvedHard = new Set(getSolvedDates(storage, HARD_SIZE))

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

  const handleCellClick = useCallback(
    (index: number, baseCells: UserCell[], action: PointerAction) => {
      if (!record || record.solved) return
      const next =
        action === 'erase'
          ? clearCell(record.puzzle, baseCells, index)
          : action === 'right'
            ? markX(record.puzzle, baseCells, index)
            : applyTool(record.puzzle, baseCells, index, tool)
      if (next) updateCells(next)
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
      if (next) updateCells(next)
    },
    [record, tool, updateCells],
  )

  const selectDate = useCallback(
    (date: string) => {
      setDailyDate(date)
      setDaily(loadOrCreateDaily(storage, dailySize, date))
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
    setPractice((prev) => prev ?? makePractice(practiceSize))
  }, [practiceSize])

  const changeSize = useCallback((size: PracticeSize) => {
    setPracticeSize(size)
    setPractice(makePractice(size))
  }, [])

  const restart = useCallback(() => {
    if (!record) return
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
            }}
          >
            Daily
          </button>
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
        <>
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
          <Calendar
            selected={dailyDate}
            today={today}
            solvedEasy={solvedEasy}
            solvedMedium={solvedMedium}
            solvedHard={solvedHard}
            onSelect={selectDate}
          />
        </>
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

      <Palette tool={tool} onSelect={setTool} />

      {record ? (
        <Board
          puzzle={record.puzzle}
          cells={record.userCells}
          onCellClick={handleCellClick}
          onCellPaint={handleCellPaint}
        />
      ) : (
        <p className="hint">Generating puzzle…</p>
      )}

      <p className="hint">
        Left-click cycles dots through pieces · drag to paint · right-click marks empty (X) ·
        right-drag from an X erases · D / X switch the left tool.
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
