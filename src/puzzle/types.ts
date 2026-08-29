// Core domain types for the Tracks puzzle. No enums are used because the
// project compiles with `erasableSyntaxOnly`; use const maps + string unions.

// Ports (bit flags) representing the four sides of a cell.
export const N = 1 as const
export const E = 2 as const
export const S = 4 as const
export const W = 8 as const

export type Port = 1 | 2 | 4 | 8
export type Dir = 'N' | 'E' | 'S' | 'W'

export const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'] as const

export const DIR_TO_PORT: Readonly<Record<Dir, Port>> = {
    N,
    E,
    S,
    W,
}

export const PORT_TO_DIR: Readonly<Record<Port, Dir>> = {
    [N]: 'N',
    [E]: 'E',
    [S]: 'S',
    [W]: 'W',
}

// Opposite side across the cell: N<->S, E<->W.
export const OPPOSITE_PORT: Readonly<Record<Port, Port>> = {
    [N]: S,
    [E]: W,
    [S]: N,
    [W]: E,
}

// (row, col) delta for a direction.
export const DIR_DELTA: Readonly<Record<Dir, readonly [number, number]>> = {
    N: [-1, 0],
    E: [0, 1],
    S: [1, 0],
    W: [0, -1],
}

// Six track pieces, each connecting exactly two ports.
export type PieceId = 1 | 2 | 3 | 4 | 5 | 6
export type PieceName = 'H' | 'V' | 'NE' | 'ES' | 'SW' | 'WN'

export interface PieceDef {
    id: PieceId
    name: PieceName
    mask: number
    ports: readonly [Port, Port]
}

export const PIECES: readonly PieceDef[] = [
    { id: 1, name: 'H', mask: W | E, ports: [W, E] },
    { id: 2, name: 'V', mask: N | S, ports: [N, S] },
    { id: 3, name: 'NE', mask: N | E, ports: [N, E] },
    { id: 4, name: 'ES', mask: E | S, ports: [E, S] },
    { id: 5, name: 'SW', mask: S | W, ports: [S, W] },
    { id: 6, name: 'WN', mask: W | N, ports: [W, N] },
] as const

export const PIECE_BY_ID: Readonly<Record<number, PieceDef>> = Object.fromEntries(
    PIECES.map((p) => [p.id, p]),
) as Readonly<Record<number, PieceDef>>

export const PIECE_BY_MASK: Readonly<Record<number, PieceId>> = Object.fromEntries(
    PIECES.map((p) => [p.mask, p.id]),
) as Readonly<Record<number, PieceId>>

// A puzzle definition: the grid, the row/column track counts, and the set of
// pre-given (locked) clue cells. The two off-grid exit points are given as
// clues with their full pieces.
export interface Clue {
    row: number
    col: number
    piece: PieceId
}

export interface Puzzle {
    rows: number
    cols: number
    rowCounts: number[]
    colCounts: number[]
    clues: Clue[]
}

// A concrete board: length rows*cols, 0 = empty, otherwise a PieceId.
export type Board = number[]

// A player's marking of a cell: blank, dot (believes track), x (believes
// empty), or a specific piece.
export type UserCell = 'blank' | 'dot' | 'x' | PieceId
