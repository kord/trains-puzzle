import type { RefObject } from 'react'
import type { Tool } from '../game/helpers'
import type { Mode } from '../game/useGameSession'
import {
    DAILY_SIZES,
    DAILY_SIZE_LABELS,
    PRACTICE_SIZES,
    PRACTICE_SIZE_LABELS,
    type DailySize,
    type PracticeSize,
} from '../puzzle/sizes'
import { Calendar } from './Calendar'
import { Palette } from './Palette'

interface ToolbarProps {
    mode: Mode
    tool: Tool
    dailySize: DailySize
    practiceSize: PracticeSize
    dateLabel: string
    today: string
    dailyDate: string
    calendarOpen: boolean
    calendarWrapRef: RefObject<HTMLDivElement | null>
    solvedEasy: Set<string>
    solvedMedium: Set<string>
    solvedHard: Set<string>
    onEnterDaily: () => void
    onEnterPractice: () => void
    onToggleCalendar: () => void
    onSelectDate: (date: string) => void
    onSelectDailySize: (size: DailySize) => void
    onChangeSize: (size: PracticeSize) => void
    onNewPractice: () => void
    onRestart: () => void
    onSelectTool: (tool: Tool) => void
    onUndo: () => void
}

export function Toolbar({
    mode,
    tool,
    dailySize,
    practiceSize,
    dateLabel,
    today,
    dailyDate,
    calendarOpen,
    calendarWrapRef,
    solvedEasy,
    solvedMedium,
    solvedHard,
    onEnterDaily,
    onEnterPractice,
    onToggleCalendar,
    onSelectDate,
    onSelectDailySize,
    onChangeSize,
    onNewPractice,
    onRestart,
    onSelectTool,
    onUndo,
}: ToolbarProps) {
    return (
        <div className="toolbar">
            <div className="toolbar-group">
                <button
                    type="button"
                    className={mode === 'daily' ? 'active' : ''}
                    onClick={onEnterDaily}
                >
                    Daily
                </button>
                {mode === 'daily' && (
                    <div className="date-wrap" ref={calendarWrapRef}>
                        <button
                            type="button"
                            className="date-toggle"
                            aria-expanded={calendarOpen}
                            onClick={onToggleCalendar}
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
                                    onSelect={onSelectDate}
                                />
                            </div>
                        )}
                    </div>
                )}
                <button
                    type="button"
                    className={mode === 'practice' ? 'active' : ''}
                    onClick={onEnterPractice}
                >
                    Practice
                </button>
            </div>

            <div className="toolbar-group">
                {mode === 'daily' ? (
                    DAILY_SIZES.map((size) => (
                        <button
                            key={size}
                            type="button"
                            className={dailySize === size ? 'active' : ''}
                            onClick={() => onSelectDailySize(size)}
                        >
                            {DAILY_SIZE_LABELS[size]}
                        </button>
                    ))
                ) : (
                    PRACTICE_SIZES.map((size) => (
                        <button
                            key={size}
                            type="button"
                            className={practiceSize === size ? 'active' : ''}
                            onClick={() => onChangeSize(size)}
                        >
                            {PRACTICE_SIZE_LABELS[size]}
                        </button>
                    ))
                )}
            </div>

            <div className="toolbar-group">
                {mode === 'practice' && (
                    <button type="button" onClick={onNewPractice}>
                        New puzzle
                    </button>
                )}
                <button type="button" onClick={onRestart}>
                    Restart
                </button>
            </div>

            <Palette tool={tool} onSelect={onSelectTool} onUndo={onUndo} />
        </div>
    )
}
