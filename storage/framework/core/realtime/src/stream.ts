import { getServer } from './server-instance'

export interface BroadcastStreamOptions {
  /** Server-selected channel names. Never take these directly from a query. */
  channels: readonly string[]
  /** Checked before subscribing and before every event and heartbeat. */
  authorize: () => boolean | Promise<boolean>
  signal?: AbortSignal
  heartbeatMs?: number
  maxPending?: number
}

/** Authenticated SSE transport for the same engine used by emit(), channels and model broadcasts. */
export async function createBroadcastResponse(options: BroadcastStreamOptions): Promise<Response> {
  if (!options.channels.length || typeof options.authorize !== 'function') throw new Error('Broadcast streams require channels and authorization')
  if (!await options.authorize()) return new Response('Unauthorized', { status: 401 })
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
      let timer: ReturnType<typeof setInterval>
      let remove = () => {}
      function close() {
        if (closed) return
        closed = true; remove(); clearInterval(timer)
        options.signal?.removeEventListener('abort', close)
        try { controller.close() } catch { /* already cancelled */ }
      }
      function enqueue(frame: string) {
        if (closed) return
        if ((controller.desiredSize ?? 0) <= 0) { close(); return }
        controller.enqueue(encoder.encode(frame))
      }
      function deliver(frame: string) {
        if (closed) return
        if (++pending > maxPending) { close(); return }
        chain = chain.then(async () => {
          if (closed) return
          if (!await options.authorize()) { close(); return }
          enqueue(frame)
        }).catch(close).finally(() => { pending-- })
      }
      cleanup = close
      remove = server!.addBroadcastHook(({ channel, event, data }) => {
        if (channels.has(channel)) deliver(`data: ${JSON.stringify({ channel, event, data })}\n\n`)
      })
      enqueue(': connected\n\n')
      timer = setInterval(() => deliver(': heartbeat\n\n'), options.heartbeatMs ?? 15000)
      options.signal?.addEventListener('abort', close, { once: true })
      if (options.signal?.aborted) close()
    },
    cancel() { cleanup() },
  }, { highWaterMark: maxPending })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } })
}
