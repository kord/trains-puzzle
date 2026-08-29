import type { PieceId } from '../puzzle/types'
import trackEW from '../assets/track-EW.svg'
import trackNE from '../assets/track-NE.svg'

export type GlyphKind = 'blank' | 'dot' | 'x' | 'piece'

type Rotation = 0 | 90 | 180 | 270

// The straight asset is East-West; the turn asset is North-East. The other
// orientations are derived by rotating these two images.
const PIECE_IMAGE: Record<PieceId, { src: string; rotate: Rotation }> = {
    1: { src: trackEW, rotate: 0 }, // H  (W|E)
    2: { src: trackEW, rotate: 90 }, // V  (N|S)
    3: { src: trackNE, rotate: 0 }, // NE (N|E)
    4: { src: trackNE, rotate: 90 }, // ES (E|S)
    5: { src: trackNE, rotate: 180 }, // SW (S|W)
    6: { src: trackNE, rotate: 270 }, // WN (W|N)
}

interface GlyphProps {
    kind: GlyphKind
    piece?: PieceId
    className?: string
}

export function Glyph({ kind, piece, className }: GlyphProps) {
    if (kind === 'piece' && piece !== undefined) {
        const asset = PIECE_IMAGE[piece]
        return (
            <img
                className={`glyph glyph-piece rot-${asset.rotate} ${className ?? ''}`}
                src={asset.src}
                alt=""
                draggable={false}
            />
        )
    }

    return (
        <svg className={`glyph ${className ?? ''}`} viewBox="0 0 48 48" aria-hidden="true">
            {kind === 'dot' && <circle className="glyph-dot" cx="24" cy="24" r="5.5" />}
            {kind === 'x' && (
                <g className="glyph-x">
                    <line x1="15" y1="15" x2="33" y2="33" />
                    <line x1="33" y1="15" x2="15" y2="33" />
                </g>
            )}
        </svg>
    )
}
