import type { Tool } from '../game/helpers'
import { Glyph } from './PieceGlyph'

interface PaletteProps {
    tool: Tool
    onSelect: (tool: Tool) => void
    onUndo: () => void
}

export function Palette({ tool, onSelect, onUndo }: PaletteProps) {
    return (
        <div className="toolbar-group tools" role="toolbar" aria-label="Track marking tools">
            <button
                type="button"
                className={`tool ${tool === 'dot' ? 'selected' : ''}`}
                onClick={() => onSelect('dot')}
                title="Dot — believes track (D)"
            >
                <Glyph kind="dot" />
            </button>
            <button
                type="button"
                className={`tool ${tool === 'x' ? 'selected' : ''}`}
                onClick={() => onSelect('x')}
                title="Cross — believes empty (X)"
            >
                <Glyph kind="x" />
            </button>
            <button
                type="button"
                className="undo"
                onClick={onUndo}
                title="Undo last stroke (Z)"
                aria-label="Undo"
            >
                <svg className="undo-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        d="M9 14 4 9l5-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </button>
        </div>
    )
}
