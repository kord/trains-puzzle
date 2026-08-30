import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react'
import { clueMapOf, colStatuses, isCellInvalid, rowStatuses } from '../game/helpers'
import type { Puzzle, UserCell } from '../puzzle/types'
import { Cell } from './Cell'

export type PointerAction = 'left' | 'right' | 'erase'

interface BoardProps {
    puzzle: Puzzle
    cells: UserCell[]
    onCellClick: (index: number, baseCells: UserCell[], action: PointerAction) => void
    onCellPaint: (index: number, action: PointerAction) => void
    onStrokeStart: () => void
    onStrokeEnd: () => void
}

export function Board({
    puzzle,
    cells,
    onCellClick,
    onCellPaint,
    onStrokeStart,
    onStrokeEnd,
}: BoardProps) {
    const clickRef = useRef(onCellClick)
    clickRef.current = onCellClick
    const paintRef = useRef(onCellPaint)
    paintRef.current = onCellPaint
    const strokeStartRef = useRef(onStrokeStart)
    strokeStartRef.current = onStrokeStart
    const strokeEndRef = useRef(onStrokeEnd)
    strokeEndRef.current = onStrokeEnd

    const mouseDownRef = useRef(false)
    const startCellRef = useRef(-1)
    const didDragRef = useRef(false)
    const actionRef = useRef<PointerAction>('left')
    const downCellsRef = useRef<UserCell[]>(cells)

    useEffect(() => {
        const onUp = () => {
            if (!mouseDownRef.current) return
            const start = startCellRef.current
            if (start >= 0 && !didDragRef.current) {
                clickRef.current(start, downCellsRef.current, actionRef.current)
            }
            mouseDownRef.current = false
            startCellRef.current = -1
            didDragRef.current = false
            strokeEndRef.current()
        }
        window.addEventListener('mouseup', onUp)
        return () => window.removeEventListener('mouseup', onUp)
    }, [])

    const handleMouseDown = (index: number, e: MouseEvent<HTMLButtonElement>) => {
        if (e.button !== 0 && e.button !== 2) return
        // Right-clicking an already-marked empty cell starts an eraser drag.
        actionRef.current = e.button === 2 ? (cells[index] === 'x' ? 'erase' : 'right') : 'left'
        mouseDownRef.current = true
        startCellRef.current = index
        didDragRef.current = false
        downCellsRef.current = cells
        strokeStartRef.current()
        paintRef.current(index, actionRef.current)
    }

    const handleMouseEnter = (index: number) => {
        if (!mouseDownRef.current) return
        if (index !== startCellRef.current) didDragRef.current = true
        paintRef.current(index, actionRef.current)
    }

    const clueMap = clueMapOf(puzzle)
    const rowStatus = rowStatuses(puzzle, cells)
    const colStatus = colStatuses(puzzle, cells)

    // Current track counts per row/column, for the tooltip hints.
    const rowCurrent = new Array<number>(puzzle.rows).fill(0)
    const colCurrent = new Array<number>(puzzle.cols).fill(0)
    for (let i = 0; i < cells.length; i++) {
        const u = cells[i]
        if (u === 'dot' || typeof u === 'number') {
            rowCurrent[Math.floor(i / puzzle.cols)]++
            colCurrent[i % puzzle.cols]++
        }
    }

    const children: ReactNode[] = []

    children.push(<div key="corner" className="corner" />)
    for (let c = 0; c < puzzle.cols; c++) {
        children.push(
            <div
                key={`col-${c}`}
                className={`count-hint ${colStatus[c]}`}
                title={`${colCurrent[c]} / ${puzzle.colCounts[c]} tracks`}
            >
                {puzzle.colCounts[c]}
            </div>,
        )
    }

    for (let r = 0; r < puzzle.rows; r++) {
        children.push(
            <div
                key={`row-${r}`}
                className={`count-hint ${rowStatus[r]}`}
                title={`${rowCurrent[r]} / ${puzzle.rowCounts[r]} tracks`}
            >
                {puzzle.rowCounts[r]}
            </div>,
        )
        for (let c = 0; c < puzzle.cols; c++) {
            const i = r * puzzle.cols + c
            children.push(
                <Cell
                    key={`cell-${i}`}
                    cell={cells[i]}
                    isClue={clueMap.has(i)}
                    cluePiece={clueMap.get(i)}
                    invalid={isCellInvalid(puzzle, cells, i)}
                    onMouseDown={(e) => handleMouseDown(i, e)}
                    onMouseEnter={() => handleMouseEnter(i)}
                />,
            )
        }
    }

    return (
        <div className="board-scroll">
            <div
                className="board"
                style={{ gridTemplateColumns: `var(--hdr) repeat(${puzzle.cols}, var(--cell))` }}
            >
                {children}
            </div>
        </div>
    )
}
