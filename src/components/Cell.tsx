import type { MouseEvent } from 'react'
import type { PieceId, UserCell } from '../puzzle/types'
import { Glyph, type GlyphKind } from './PieceGlyph'

interface CellProps {
    cell: UserCell
    isClue: boolean
    cluePiece?: PieceId
    invalid: boolean
    onMouseDown: (e: MouseEvent<HTMLButtonElement>) => void
    onMouseEnter: () => void
}

export function Cell({
    cell,
    isClue,
    cluePiece,
    invalid,
    onMouseDown,
    onMouseEnter,
}: CellProps) {
    let kind: GlyphKind = 'blank'
    let piece: PieceId | undefined

    if (isClue) {
        kind = 'piece'
        piece = cluePiece
    } else if (cell === 'x') {
        kind = 'x'
    } else if (cell === 'dot') {
        kind = 'dot'
    } else if (typeof cell === 'number') {
        kind = 'piece'
        piece = cell
    }

    const classes = ['cell']
    if (isClue) classes.push('clue')
    if (invalid) classes.push('invalid')

    return (
        <button
            type="button"
            className={classes.join(' ')}
            onMouseDown={onMouseDown}
            onMouseEnter={onMouseEnter}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="board cell"
        >
            <Glyph kind={kind} piece={piece} />
        </button>
    )
}
