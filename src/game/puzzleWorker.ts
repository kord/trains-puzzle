// Main-thread client for the generation worker. Two independent workers keep
// foreground requests (the puzzle the player is waiting on) from queueing
// behind background prefetch jobs.
import type { Board, Puzzle } from '../puzzle/types'

export interface GeneratedResult {
    puzzle: Puzzle
    solution: Board
}

export type GenerationKind = 'foreground' | 'background'

interface ResponseMessage {
    id: number
    puzzle?: Puzzle
    solution?: Board
    error?: string
}

interface Pending {
    resolve: (value: GeneratedResult) => void
    reject: (reason: unknown) => void
}

const workers = new Map<GenerationKind, Worker>()
const pending = new Map<GenerationKind, Map<number, Pending>>()
let nextId = 1

function ensureKind(kind: GenerationKind): { worker: Worker; map: Map<number, Pending> } {
    let map = pending.get(kind)
    if (!map) {
        map = new Map()
        pending.set(kind, map)
    }
    let worker = workers.get(kind)
    if (!worker) {
        worker = new Worker(new URL('./genWorker.ts', import.meta.url), { type: 'module' })
        worker.onmessage = (event: MessageEvent<ResponseMessage>) => {
            const { id, puzzle, solution, error } = event.data
            const entry = map.get(id)
            if (!entry) return
            map.delete(id)
            if (error || !puzzle || !solution) entry.reject(new Error(error ?? 'Generation failed'))
            else entry.resolve({ puzzle, solution })
        }
        worker.onerror = (event) => {
            for (const entry of map.values()) entry.reject(event.error ?? new Error('Worker error'))
            map.clear()
            workers.delete(kind)
        }
        workers.set(kind, worker)
    }
    return { worker, map }
}

/** Generate a puzzle off the main thread. Never throws synchronously. */
export function requestGenerate(
    kind: GenerationKind,
    size: number,
    seed: number,
): Promise<GeneratedResult> {
    const id = nextId++
    return new Promise((resolve, reject) => {
        try {
            const { worker, map } = ensureKind(kind)
            map.set(id, { resolve, reject })
            worker.postMessage({ id, size, seed })
        } catch (err) {
            reject(err)
        }
    })
}
