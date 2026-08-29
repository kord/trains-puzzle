import type { Tool } from '../game/helpers'
import { Glyph } from './PieceGlyph'

interface PaletteProps {
    tool: Tool
    onSelect: (tool: Tool) => void
}

export function Palette({ tool, onSelect }: PaletteProps) {
    return (
        <div className="palette" role="toolbar" aria-label="Track marking tools">
            <button
                type="button"
                className={tool === 'dot' ? 'selected' : ''}
                onClick={() => onSelect('dot')}
                title="Dot — believes track (D)"
            >
                <Glyph kind="dot" />
            </button>
            <button
                type="button"
                className={tool === 'x' ? 'selected' : ''}
                onClick={() => onSelect('x')}
                title="Cross — believes empty (X)"
            >
                <Glyph kind="x" />
            </button>
        </div>
    )
}
