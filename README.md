# Train Tracks Puzzle

A Tracks logic-puzzle game: draw a single continuous railway that satisfies the
row/column track counts, using the six track-piece types, so exactly two
segments lead off the grid.

## Tech stack

- Vite 8 + React 19 + TypeScript 6
- `canvas-confetti` for the win animation
- `vitest` for puzzle-core unit tests
- `oxlint` for linting

## Puzzle rules

- A square grid, mostly blank at the start.
- Numbers above each column and beside each row count how many cells contain track.
- Six track types: straight horizontal, straight vertical, and four turns (each
  connects two adjacent sides of a cell).
- Exactly two track segments lead off the grid; the full pieces at these two
  entry/exit points are given (locked, like other clue cells).
- Additional track segments may be shown (as locked clue cells) so the puzzle
  has a unique solution.
- The solution is a single continuous path: every track cell has 2 connections,
  no loops, no branches, with its two ends exiting the grid.

## How to play

- Use the palette to mark a cell with a **dot** (believes track) or an **X**
  (believes empty).
- Clicking a dot cycles it through only the track pieces that are still valid
  given the known empty sides and neighboring clues/pieces. Two known-empty
  adjacent sides determine exactly one of the six pieces.
- Click and drag with either tool to paint dots or crosses across the cells the
  mouse passes over (placed pieces are left untouched).
- Row/column number hints turn green when a count is met, red when it's
  exceeded, and yellow when the X-marks leave exactly enough room for the
  remaining tracks.
- Right-click marks a cell as empty (or clears it).
- When the correct set of tracks is laid down, a happy confetti explosion fires.

## Features

- **Daily puzzle** in three sizes — 6×6 Easy, 7×7 Medium, 9×9 Hard — each
  seeded deterministically by date (everyone gets the same puzzle).
- **Calendar** to revisit past days' puzzles; solved days are marked per size.
- **Practice mode** with selectable grid size: 6×6 Easy, 8×8 Hard.
- Progress and solved state persist in `localStorage`.

## Architecture

- `src/puzzle/types.ts` — port masks (N/E/S/W = 1/2/4/8), `Piece` union
  (`H|V|NE|ES|SW|WN`), `Clue`, `Puzzle`, `Board`, `UserCell`.
- `src/puzzle/model.ts` — piece↔portmask mapping, `isValidSolution()`, and
  `validPiecesFor()` (shared by the solver and smart cycling).
- `src/puzzle/solver.ts` — CSP backtracker (MRV ordering, forward checking,
  count pruning, connectivity/cycle pruning); `classify()` → unsolvable /
  unique / multiple plus a first solution; `countSolutions(puzzle, limit)`.
- `src/puzzle/rng.ts` — seeded PRNG (FNV-1a + mulberry32), `dateToSeed()`.
- `src/puzzle/generator.ts` — random self-avoiding path between two boundary
  exits (≈35–70% coverage), derive counts, give the two exit pieces as clues,
  then a greedy clue-stripping loop: start with every track cell as a clue and
  remove clues (in random order) while the puzzle stays uniquely solvable.
- `src/puzzle/daily.ts` + `src/puzzle/storage.ts` — daily puzzle per size,
  keyed by `trains.day.<size>.<date>` = puzzle + solution + user state +
  solved flag, plus a solved-date index per size.
- `src/game/helpers.ts` — the player's cell interaction rules (dot/X/piece
  tools, smart cycling) and win detection.
- `src/components/` — `Board`, `Cell`, `PieceGlyph`, `Palette`, `Calendar`,
  `WinOverlay`.
- `src/*.test.ts` — unit tests for model, solver, generator, rng, storage, and
  interaction helpers.

## Commands

- `npm run dev` — start the dev server
- `npm run build` — type-check and build
- `npm run lint` — lint with oxlint
- `npm run test` — run unit tests
