// Worker entry point for puzzle generation. Runs the (CPU-bound) generator off
// the main thread so the UI never hangs. See `puzzleWorker.ts` for the client.
import { generate } from '../puzzle/generator'
import type { Board, Puzzle } from '../puzzle/types'

interface GenRequest {
    id: number
    size: number
    seed: number
}

interface GenResponse {
    id: number
    puzzle?: Puzzle
    solution?: Board
    error?: string
}

interface WorkerContext {
    onmessage: ((event: MessageEvent<GenRequest>) => void) | null
    postMessage(message: GenResponse): void
}

const ctx = self as unknown as WorkerContext

ctx.onmessage = (event) => {
    const { id, size, seed } = event.data
    try {
        const { puzzle, solution } = generate({ rows: size, cols: size, seed })
        ctx.postMessage({ id, puzzle, solution })
    } catch (err) {
        ctx.postMessage({ id, error: err instanceof Error ? err.message : String(err) })
    }
}
