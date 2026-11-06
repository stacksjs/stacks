import { config } from '@stacksjs/config/runtime'
import process from 'node:process'

export interface CapturedRequest {
  method: string
  path: string
  status_code: number
  duration_ms: number
  memory_usage: number
  ip_address: string
  user_agent: string
  error_message: string
  occurredAt: Date
}

/** Only metadata: never read a body, credentials, headers, or query parameters. */
export function capturedRequestPath(url: string): string {
  let redact = false
  return new URL(url).pathname.split('/').map((part) => {
    if (redact || part.length > 64) return '[redacted]'
    let label = part
    try { label = decodeURIComponent(part) }
    catch {}
    if (/^(?:tokens?|reset|verify|verification|magic-link|password|invitations?)$/i.test(label)) redact = true
    return part
  }).join('/').slice(0, 255)
}

export function requestCaptureEnabled(): boolean {
  const setting = config.server?.captureRequests
  return process.env.STACKS_DASHBOARD_WORKER !== '1'
    && (setting === true || (typeof setting === 'object' && setting !== null && setting.enabled !== false))
}

function capturePathAllowed(path: string): boolean {
  if (/^\/(?:api\/dashboard(?:\/|$)|_stx(?:\/|$)|__deps(?:\/|$)|__hmr(?:\/|$)|favicon\.)/.test(path)) return false
  const setting = config.server?.captureRequests
  const exclusions = typeof setting === 'object' && setting !== null ? setting.exclude ?? [] : []
  return !exclusions.some(pattern => pattern.endsWith('/*')
    ? path === pattern.slice(0, -2) || path.startsWith(pattern.slice(0, -1))
    : path === pattern)
}

export interface RequestCapture {
  begin: (request: Request) => boolean
  finish: (request: Request, response: Pick<Response, 'status'>) => void
  skip: (request: Request) => void
  observe: <T>(request: Request, run: () => T) => T
  flush: () => Promise<void>
  stats: () => { pending: number, dropped: number }
}

export function createRequestCapture(options: {
  enabled: () => boolean
  allowed?: (path: string) => boolean
  store: (row: CapturedRequest) => Promise<void>
  maxPending?: number
  warn?: () => void
}): RequestCapture {
  const starts = new WeakMap<Request, { time: number, path: string }>()
  const ignored = new WeakSet<Request>()
  let pending = 0
  let dropped = 0
  let warned = false
  let writing = Promise.resolve()
  const warn = () => {
    if (warned) return
    warned = true
    try { options.warn?.() }
    catch { /* diagnostics cannot replace a response */ }
  }

  function begin(request: Request): boolean {
    if (!options.enabled() || starts.has(request) || ignored.has(request)) return false
    const path = capturedRequestPath(request.url)
    if (options.allowed && !options.allowed(path)) return false
    starts.set(request, { time: performance.now(), path })
    return true
  }

  function finish(request: Request, response: Pick<Response, 'status'>): void {
    const start = starts.get(request)
    if (!start) return
    starts.delete(request)
    if (pending >= (options.maxPending ?? 100)) { dropped++; warn(); return }
    const row: CapturedRequest = {
      method: request.method.slice(0, 255), path: start.path,
      status_code: response.status,
      duration_ms: Math.min(2147483647, Math.max(0, Math.round(performance.now() - start.time))),
      memory_usage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      ip_address: '', user_agent: '',
      error_message: response.status >= 500 ? `HTTP ${response.status}` : '',
      occurredAt: new Date(),
    }
    pending++
    writing = writing.then(() => options.store(row)).catch(() => { dropped++; warn() }).finally(() => { pending-- })
  }

  return {
    begin, finish,
    /** A views proxy delegates recording to the API process, avoiding double counts. */
    skip(request: Request) { if (starts.delete(request)) ignored.add(request) },
    observe<T>(request: Request, run: () => T): T {
      if (!begin(request)) return run()
      try {
        const result = run()
        if (result instanceof Promise) {
          return result.then((response) => {
            if (response instanceof Response) finish(request, response)
            return response
          }, (error) => { finish(request, { status: 500 }); throw error }) as T
        }
        if (result instanceof Response) finish(request, result)
        return result
      }
      catch (error) { finish(request, { status: 500 }); throw error }
    },
    async flush() { while (pending > 0) await writing },
    stats() { return { pending, dropped } },
  }
}

const capture = createRequestCapture({
  enabled: requestCaptureEnabled,
  allowed: capturePathAllowed,
  async store({ occurredAt, ...row }) {
    const { db, sqlDateTime } = await import('@stacksjs/database/runtime')
    const timestamp = sqlDateTime(occurredAt)
    await db.insertInto('requests').values({ ...row, created_at: timestamp, updated_at: timestamp }).execute()
  },
  warn() { process.stderr.write('[http-capture] Request metadata storage unavailable or buffer full; some observations were dropped.\n') },
})

export const beginRequestCapture = capture.begin
export const finishRequestCapture = capture.finish
export const skipRequestCapture = capture.skip
export const observeHttpRequest = capture.observe
export const flushRequestCaptures = capture.flush
