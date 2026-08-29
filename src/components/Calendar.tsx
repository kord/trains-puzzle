import { useState } from 'react'
import { parseDateKey, toDateKey } from '../game/helpers'

interface CalendarProps {
    selected: string
    today: string
    solvedEasy: Set<string>
    solvedMedium: Set<string>
    solvedHard: Set<string>
    onSelect: (date: string) => void
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function Calendar({
    selected,
    today,
    solvedEasy,
    solvedMedium,
    solvedHard,
    onSelect,
}: CalendarProps) {
    const sel = parseDateKey(selected)
    const [year, setYear] = useState(sel.getFullYear())
    const [month, setMonth] = useState(sel.getMonth())

    const firstWeekday = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    const cells: Array<string | null> = []
    for (let i = 0; i < firstWeekday; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(toDateKey(new Date(year, month, d)))

    const prev = () => {
        if (month === 0) {
            setMonth(11)
            setYear((y) => y - 1)
        } else {
            setMonth((m) => m - 1)
        }
    }

    const next = () => {
        if (month === 11) {
            setMonth(0)
            setYear((y) => y + 1)
        } else {
            setMonth((m) => m + 1)
        }
    }

    const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
    })

    return (
        <div className="calendar">
            <div className="cal-head">
                <button type="button" onClick={prev} aria-label="Previous month">
                    ‹
                </button>
                <span>{monthLabel}</span>
                <button type="button" onClick={next} aria-label="Next month">
                    ›
                </button>
            </div>
            <div className="cal-grid">
                {WEEKDAYS.map((w, i) => (
                    <div key={`w-${i}`} className="cal-weekday">
                        {w}
                    </div>
                ))}
                {cells.map((key, i) => {
                    if (key === null) return <div key={`empty-${i}`} className="cal-empty" />
                    const isFuture = key > today
                    const isToday = key === today
                    const solvedAny =
                        solvedEasy.has(key) || solvedMedium.has(key) || solvedHard.has(key)
                    const classes = [
                        'cal-day',
                        key === selected ? 'selected' : '',
                        solvedAny ? 'solved' : '',
                        isToday ? 'today' : '',
                    ]
                        .filter(Boolean)
                        .join(' ')
                    return (
                        <button
                            key={key}
                            type="button"
                            disabled={isFuture}
                            className={classes}
                            onClick={() => onSelect(key)}
                        >
                            {parseDateKey(key).getDate()}
                            {solvedEasy.has(key) && (
                                <span className="cal-check cal-check-easy" title="Easy solved">
                                    ✓
                                </span>
                            )}
                            {solvedMedium.has(key) && (
                                <span className="cal-check cal-check-medium" title="Medium solved">
                                    ✓
                                </span>
                            )}
                            {solvedHard.has(key) && (
                                <span className="cal-check cal-check-hard" title="Hard solved">
                                    ✓
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
