import { AsyncResource } from 'node:async_hooks'
import { getServer } from './server-instance'

export interface BroadcastStreamMetadata {
  readonly channel: string
  readonly event: string
  readonly data: unknown
}

export interface BroadcastStreamOptions {
  /** Server-selected channel names. Never take these directly from a query. */
  channels: readonly string[]
  /** Checked in the subscriber's async context before subscription, events and heartbeats. */
  authorize: () => boolean | Promise<boolean>
  signal?: AbortSignal
  heartbeatMs?: number
  maxPending?: number
  /** Synchronous local observation after enqueue, not remote receipt. Never mutate the chunk. */
  onEnqueue?: (chunk: Uint8Array, broadcast: BroadcastStreamMetadata | null) => void
  /** Called once after native subscription cleanup. */
  onClose?: () => void
}

/** Authenticated SSE transport for the same engine used by emit(), channels and model broadcasts. */
export async function createBroadcastResponse(options: BroadcastStreamOptions): Promise<Response> {
  if (!options.channels.length || typeof options.authorize !== 'function') throw new Error('Broadcast streams require channels and authorization')
  // Broadcast hooks run in the emitter's scope; authorization belongs to the subscriber.
  const authorize = AsyncResource.bind(options.authorize, undefined, options)
  const enqueueObserver = options.onEnqueue ? AsyncResource.bind(options.onEnqueue, undefined, options) : undefined
  const closeObserver = options.onClose ? AsyncResource.bind(options.onClose, undefined, options) : undefined
  if (!await authorize()) return new Response('Unauthorized', { status: 401 })
  const server = getServer()
  if (!server) throw new Error('Broadcast server not initialized')
  const channels = new Set(options.channels)
  const encoder = new TextEncoder()
  const maxPending = options.maxPending ?? 64
  if (!Number.isSafeInteger(maxPending) || maxPending < 1 || maxPending > 1024 || (options.heartbeatMs !== undefined && (!Number.isFinite(options.heartbeatMs) || options.heartbeatMs < 1))) throw new Error('Invalid broadcast stream configuration')
  let cleanup = () => {}
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false, pending = 0
      let chain = Promise.resolve()
      let timer: ReturnType<typeof setInterval> | undefined
      let remove = () => {}
      function close() {
        if (closed) return
        closed = true; remove(); clearInterval(timer)
        options.signal?.removeEventListener('abort', close)
        try { controller.close() } catch { /* already cancelled */ }
        try {
          const result: unknown = closeObserver?.()
          if (result !== undefined) void Promise.resolve(result).catch(() => {})
        }
        catch { /* observer failure must not interrupt cleanup */ }
      }
      function enqueue(frame: string, broadcast: BroadcastStreamMetadata | null = null) {
        if (closed) return
        if ((controller.desiredSize ?? 0) <= 0) { close(); return }
        const chunk = encoder.encode(frame)
        controller.enqueue(chunk)
        try {
          const result: unknown = enqueueObserver?.(chunk, broadcast)
          if (result !== undefined) void Promise.resolve(result).catch(close)
        }
        catch { close() }
      }
      function deliver(frame: string, broadcast: BroadcastStreamMetadata | null = null) {
        if (closed) return
        if (++pending > maxPending) { close(); return }
        chain = chain.then(async () => {
          if (closed) return
          if (!await authorize()) { close(); return }
          enqueue(frame, broadcast)
        }).catch(close).finally(() => { pending-- })
      }
      cleanup = close
      remove = server!.addBroadcastHook(({ channel, event, data }) => {
        if (channels.has(channel)) deliver(`data: ${JSON.stringify({ channel, event, data })}\n\n`, { channel, event, data })
      })
      enqueue(': connected\n\n')
      if (!closed) {
        timer = setInterval(() => deliver(': heartbeat\n\n'), options.heartbeatMs ?? 15000)
        options.signal?.addEventListener('abort', close, { once: true })
        if (options.signal?.aborted) close()
      }
    },
    cancel() { cleanup() },
  }, { highWaterMark: maxPending })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } })
}
