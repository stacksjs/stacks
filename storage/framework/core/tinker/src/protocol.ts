import type { TinkerFrame, TinkerSession, TinkerSessionInfo, TinkerSessionOptions } from './session'
import { writeSync } from 'node:fs'
import { createTinkerSession } from './session'

/**
 * The wire format a tinker session speaks over a pipe.
 *
 * One process, one session, driven by whoever holds its stdin: a desktop app
 * on the same machine, or the far end of `ssh -T`, `docker exec -i` or
 * `kubectl exec -i`. Requests come in as one JSON object per line. Frames go
 * out as one JSON object per line, each line starting with the record
 * separator (0x1E).
 *
 * The marker is what keeps the stream readable when something writes to file
 * descriptor 1 behind the session's back (a native addon, a child process that
 * inherited stdio). A reader treats a line that starts with the marker as a
 * frame and anything else as stray output, instead of failing to parse it.
 */

export const FRAME_MARKER = '\x1E'

export type TinkerRequest =
  | { op: 'eval', id?: string, code: string }
  | { op: 'ping', id?: string }
  | { op: 'exit' }

export type TinkerWireFrame =
  | TinkerFrame
  | { type: 'ready', session: TinkerSessionInfo, protocol: number }
  | { type: 'pong', id?: string }
  | { type: 'protocol-error', message: string }

/** Bumped when a frame changes shape in a way an older reader would misread. */
export const PROTOCOL_VERSION = 1

export function encodeFrame(frame: TinkerWireFrame): string {
  return `${FRAME_MARKER}${JSON.stringify(frame)}\n`
}

/**
 * Split a chunk of a session's output into frames and stray text.
 *
 * Feed it chunks as they arrive. A trailing partial line is held until the
 * rest of it comes.
 */
export function createFrameReader(): {
  push: (chunk: string) => Array<{ frame: TinkerWireFrame } | { stray: string }>
  flush: () => Array<{ stray: string }>
} {
  let pending = ''
  const read = (line: string): { frame: TinkerWireFrame } | { stray: string } => {
    if (line.startsWith(FRAME_MARKER)) {
      try {
        return { frame: JSON.parse(line.slice(FRAME_MARKER.length)) as TinkerWireFrame }
      }
      catch {
        return { stray: line }
      }
    }
    return { stray: line }
  }
  return {
    push(chunk) {
      pending += chunk
      const lines = pending.split('\n')
      pending = lines.pop() ?? ''
      return lines.map(read)
    },
    flush() {
      if (!pending)
        return []
      const rest = pending
      pending = ''
      return [{ stray: rest }]
    },
  }
}

export interface ServeOptions extends Omit<TinkerSessionOptions, 'onFrame'> {
  /** Where requests come from. Default: this process's stdin. */
  input?: AsyncIterable<Uint8Array | string>
  /** Where frames go. Default: file descriptor 1, written directly. */
  write?: (text: string) => void
  /**
   * Evaluate this and exit, instead of reading requests. The one-shot form a
   * remote transport uses when it does not keep the pipe open.
   */
  once?: string
}

/**
 * Run a session that answers requests until its input closes or it is told to
 * exit. Resolves with whether every evaluation succeeded.
 */
export async function serveTinker(options: ServeOptions = {}): Promise<{ ok: boolean, session: TinkerSession }> {
  // Frames bypass process.stdout, which the session patches to capture the
  // snippet's own output. Writing through it would feed frames back into
  // the capture.
  const write = options.write ?? ((text: string) => {
    writeSync(1, text)
  })
  const send = (frame: TinkerWireFrame): void => write(encodeFrame(frame))

  const { input, write: _write, once, ...sessionOptions } = options
  const session = await createTinkerSession({ ...sessionOptions, onFrame: send })
  send({ type: 'ready', session: session.info, protocol: PROTOCOL_VERSION })

  let ok = true
  let stopped = false

  if (once !== undefined) {
    const evaluation = await session.evaluate(once)
    return { ok: evaluation.ok, session }
  }

  const decoder = new TextDecoder()
  let buffered = ''
  const source = input ?? (Bun.stdin.stream() as unknown as AsyncIterable<Uint8Array>)

  const handle = async (line: string): Promise<boolean> => {
    if (!line.trim())
      return true
    let request: TinkerRequest
    try {
      request = JSON.parse(line) as TinkerRequest
    }
    catch {
      send({ type: 'protocol-error', message: 'request is not valid JSON' })
      return true
    }
    if (request.op === 'exit')
      return false
    if (request.op === 'ping') {
      send({ type: 'pong', ...(request.id ? { id: request.id } : {}) })
      return true
    }
    if (request.op === 'eval' && typeof request.code === 'string') {
      const evaluation = await session.evaluate(request.code, { id: request.id })
      if (!evaluation.ok)
        ok = false
      return true
    }
    send({ type: 'protocol-error', message: `unknown request: ${String((request as { op?: unknown }).op)}` })
    return true
  }

  outer: for await (const chunk of source) {
    buffered += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true })
    let newline = buffered.indexOf('\n')
    while (newline !== -1) {
      const line = buffered.slice(0, newline)
      buffered = buffered.slice(newline + 1)
      if (!(await handle(line))) {
        stopped = true
        break outer
      }
      newline = buffered.indexOf('\n')
    }
  }
  if (!stopped && buffered.trim())
    await handle(buffered)

  return { ok, session }
}
