/** A single monotonic budget shared by every request in one lifecycle operation. */
export interface LibraryNetworkOptions {
  fetch?: (url: string, init?: RequestInit) => Promise<Response>
  deadlineMs?: number
  requestTimeoutMs?: number
  retryDelayMs?: number
  signal?: AbortSignal
}
export class LibraryReadFailure extends Error {
  constructor(message: string, readonly status?: number) { super(message) }
}
export interface LibraryReader {
  read: (url: string, options?: { maxBytes?: number, processing?: boolean, missing?: boolean, headers?: Record<string, string> }) => Promise<Uint8Array | undefined>
  remaining: () => number
}

/** Retry transport/propagation failures only; callers validate schema and identity once. */
export function createLibraryReleaseReader(options: LibraryNetworkOptions = {}): LibraryReader {
  const duration = options.deadlineMs ?? 300_000
  const timeout = options.requestTimeoutMs ?? 15_000
  const delay = options.retryDelayMs ?? 1000
  if (![duration, timeout, delay].every(value => Number.isSafeInteger(value) && value > 0))
    throw new Error('Library readback requires positive finite time budgets')
  const deadline = performance.now() + duration
  const remaining = () => Math.max(0, deadline - performance.now())
  const request = options.fetch ?? fetch
  const read: LibraryReader['read'] = async (url, policy = {}) => {
    const maxBytes = policy.maxBytes ?? 2 * 1024 * 1024
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error('Invalid response byte budget')
    while (remaining() > 0) {
      options.signal?.throwIfAborted()
      const controller = new AbortController()
      const abort = () => controller.abort(options.signal?.reason)
      options.signal?.addEventListener('abort', abort, { once: true })
      let timer: ReturnType<typeof setTimeout> | undefined
      let response: Response | undefined
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
      try {
        const interrupted = new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            void reader?.cancel().catch(() => {})
            reject(controller.signal.reason ?? new DOMException('Request timed out', 'TimeoutError'))
          }, { once: true })
        })
        timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), Math.max(1, Math.min(timeout, remaining())))
        const work = (async () => {
          response = await request(url, { signal: controller.signal, redirect: 'manual', headers: policy.headers })
          if (controller.signal.aborted) { void response.body?.cancel().catch(() => {}); controller.signal.throwIfAborted() }
          if (!response.ok) {
            void response.body?.cancel().catch(() => {})
            return undefined
          }
          const size = response.headers.get('content-length')
          if (size !== null && (!/^\d+$/.test(size) || Number(size) > maxBytes))
            throw new LibraryReadFailure('Library response exceeds its byte budget')
          if (!response.body) throw new LibraryReadFailure('Library response has no body')
          reader = response.body.getReader()
          const chunks: Uint8Array[] = []
          let length = 0
          while (true) {
            controller.signal.throwIfAborted()
            const chunk = await reader.read()
            if (chunk.done) break
            length += chunk.value.length
            if (length > maxBytes) throw new LibraryReadFailure('Library response exceeds its byte budget')
            chunks.push(chunk.value)
          }
          return new Uint8Array(Buffer.concat(chunks, length))
        })()
        const bytes = await Promise.race([work, interrupted])
        if (remaining() <= 0) break
        if (response!.ok) return bytes!
        if (response!.status === 404 && policy.missing) return undefined
        if (!(response!.status === 429 || response!.status >= 500 && response!.status < 600 || response!.status === 404 && policy.processing))
          throw new LibraryReadFailure(`Library registry read failed: HTTP ${response!.status}`, response!.status)
      }
      catch (error) {
        options.signal?.throwIfAborted()
        if (!(error instanceof TypeError || error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name))) throw error
      }
      finally {
        clearTimeout(timer)
        options.signal?.removeEventListener('abort', abort)
        controller.abort()
        if (reader) void reader.cancel().catch(() => {})
        else void response?.body?.cancel().catch(() => {})
      }
      const retryAfter = response?.headers.get('retry-after')
      const requested = retryAfter && /^\d+(?:\.\d+)?$/.test(retryAfter)
        ? Number(retryAfter) * 1000
        : retryAfter && Number.isFinite(Date.parse(retryAfter)) ? Math.max(0, Date.parse(retryAfter) - Date.now()) : delay
      const wait = Math.max(delay, requested)
      const wake = performance.now() + Math.min(wait, remaining())
      while (performance.now() < wake) {
        options.signal?.throwIfAborted()
        await Bun.sleep(Math.min(50, Math.max(1, Math.ceil(wake - performance.now()))))
      }
    }
    throw new LibraryReadFailure('Library registry readback deadline exceeded; upload acceptance does not establish public bytes')
  }
  return { read, remaining }
}
