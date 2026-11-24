/**
 * Sends a file in parts to an application's upload-session routes
 * (`createUploadSessions` in `@stacksjs/storage`), so a large upload survives
 * a dropped connection and fits under any gateway's body limit.
 *
 * Each part is its own request, retried on its own with a growing pause; a
 * part that arrived is never sent again. With `resumeKey`, the session's id
 * is remembered in the browser, so the same file picked again after a reload
 * or a crash continues where it stopped.
 *
 * The routes it speaks to, all under `endpoint`:
 *
 * - `POST   {endpoint}`                    `{ name, size, type, meta }` → the session
 * - `GET    {endpoint}/{id}`               → the session, with the parts received
 * - `PUT    {endpoint}/{id}/parts/{index}` the part's bytes
 * - `DELETE {endpoint}/{id}`               when cancelled
 *
 * It answers the session's id. Asking the server to join the parts and attach
 * the file to something is the application's own request, with that id.
 *
 * No dependencies and no globals beyond `fetch`: the transport is passed in,
 * so an application's authenticated fetch (cookies, a bearer token, a native
 * bridge) is the one used.
 */

export interface UploadSession {
  id: string
  size: number
  partBytes: number
  parts: number
  received: number[]
  complete?: boolean
}

export interface UploadProgress {
  /** Bytes the server has, plus what is on its way. */
  loaded: number
  total: number
}

export type UploadTransport = (path: string, init: RequestInit & { onUploadProgress?: (progress: UploadProgress) => void }) => Promise<Response>

export interface UploadInPartsOptions {
  /** The application's fetch. Default: `fetch` with the page's cookies. */
  transport?: UploadTransport
  /** Where the session routes live, such as `/uploads`. */
  endpoint: string
  /** The file's name, when `file` is a Blob without one. */
  name?: string
  /** Sent with `begin` and handed back to the application on completion. */
  meta?: Record<string, string>
  /** Parts on their way at once. Default 3. */
  concurrency?: number
  /** Tries per part after the first. Default 5. */
  retries?: number
  signal?: AbortSignal
  onProgress?: (progress: UploadProgress) => void
  /** Whether the transport reports `onUploadProgress` within a request, for progress smoother than one step a part. */
  transportReportsProgress?: boolean
  /**
   * Remember the session under this key and continue it next time: the
   * file's own identity (`uploadResumeKey(file)`), prefixed with what it is
   * for. Leave it out to always start afresh.
   */
  resumeKey?: string
  /** Where session ids are remembered. Default `localStorage`. */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  /** Milliseconds before the first retry; doubled each time, up to 15 s. Default 500. */
  retryDelay?: number
}

/** A refusal the server gave that sending again would not change. */
export class UploadRefused extends Error {
  constructor(message: string, readonly status: number, readonly body: unknown) {
    super(message)
    this.name = 'UploadRefused'
  }
}

/** A name for "this very file" that survives a reload: its name, size and last change. */
export function uploadResumeKey(file: Blob & { name?: string, lastModified?: number }, purpose = ''): string {
  return `upload:${purpose}:${file.name ?? ''}:${file.size}:${file.lastModified ?? ''}`
}

const defaultTransport: UploadTransport = (path, init) => fetch(path, { credentials: 'include', ...init })

function storageOf(options: UploadInPartsOptions): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  if (options.storage !== undefined)
    return options.storage
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  }
  catch {
    // Private browsing, or a frame without storage: no resuming, nothing else lost.
    return null
  }
}

const aborted = (signal?: AbortSignal): void => {
  if (signal?.aborted)
    throw signal.reason ?? new DOMException('The upload was cancelled.', 'AbortError')
}

const isAbort = (error: unknown): boolean => (error as { name?: string } | null)?.name === 'AbortError'

function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (): void => {
      signal?.removeEventListener('abort', stop)
      resolve()
    }
    const timer = setTimeout(done, ms)
    const stop = (): void => {
      clearTimeout(timer)
      reject(signal!.reason ?? new DOMException('The upload was cancelled.', 'AbortError'))
    }
    signal?.addEventListener('abort', stop, { once: true })
  })
}

/** Whether a response is worth asking for again: the server or the line, not the request. */
const transient = (status: number): boolean => status === 408 || status === 425 || status === 429 || status >= 500

async function refusal(response: Response, fallback: string): Promise<UploadRefused> {
  const body = await response.json().catch(() => null) as { error?: unknown } | null
  return new UploadRefused(typeof body?.error === 'string' && body.error ? body.error : fallback, response.status, body)
}

/** How long a 429 or 503 asks to be left alone, in milliseconds, or 0. */
function retryAfter(response: Response): number {
  const seconds = Number(response.headers.get('retry-after'))
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 60) * 1000 : 0
}

/**
 * Uploads `file` in parts and answers its session id once every part is in.
 * Throws `UploadRefused` when the server will not take it, an `AbortError`
 * when cancelled (the session is then removed), and the last network error
 * when a part keeps failing; called again with the same `resumeKey`, it
 * carries on from the parts that made it.
 */
export async function uploadInParts(file: Blob, options: UploadInPartsOptions): Promise<UploadSession> {
  const transport = options.transport ?? defaultTransport
  const endpoint = options.endpoint.replace(/\/+$/, '')
  const retries = Math.max(0, options.retries ?? 5)
  const delay = Math.max(1, options.retryDelay ?? 500)
  const store = options.resumeKey ? storageOf(options) : null
  const signal = options.signal
  aborted(signal)

  /** One request, tried again while the failure is the line's or the server's. */
  async function attempt(send: () => Promise<Response>): Promise<Response> {
    let last: unknown
    for (let tried = 0; tried <= retries; tried++) {
      aborted(signal)
      let wait = Math.min(15_000, delay * 2 ** tried)
      try {
        const response = await send()
        if (!transient(response.status))
          return response
        last = await refusal(response, 'The upload could not be sent. Try again.')
        wait = Math.max(wait, retryAfter(response))
      }
      catch (error) {
        if (isAbort(error) || signal?.aborted)
          throw error
        last = error
      }
      if (tried < retries)
        await pause(wait + Math.random() * wait * 0.25, signal)
    }
    throw last
  }

  // Continue the session this file had, when the server still has it and it is this file's.
  let session: UploadSession | null = null
  const remembered = store?.getItem(options.resumeKey!) || null
  if (remembered && /^[a-f0-9]{32}$/.test(remembered)) {
    const response = await attempt(() => transport(`${endpoint}/${remembered}`, { method: 'GET', signal })).catch(() => null)
    const found = response?.ok ? await response.json().catch(() => null) as { upload?: UploadSession } | null : null
    if (found?.upload?.id === remembered && found.upload.size === file.size)
      session = found.upload
    else
      store?.removeItem(options.resumeKey!)
  }

  if (!session) {
    const name = options.name ?? (file as { name?: string }).name ?? 'upload'
    const response = await attempt(() => transport(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ name, size: file.size, type: file.type || 'application/octet-stream', meta: options.meta ?? {} }),
      signal,
    }))
    if (!response.ok)
      throw await refusal(response, 'The upload could not be started.')
    session = ((await response.json().catch(() => null)) as { upload?: UploadSession } | null)?.upload ?? null
    if (!session?.id || !(session.partBytes > 0) || !(session.parts > 0))
      throw new UploadRefused('The upload could not be started.', response.status, null)
    if (options.resumeKey)
      store?.setItem(options.resumeKey, session.id)
  }

  const { id, partBytes, parts } = session
  const have = new Set(session.received)
  const sizeOf = (index: number): number => Math.min(partBytes, file.size - index * partBytes)
  const flying = new Map<number, number>()
  let settled = 0
  for (const index of have) settled += sizeOf(index)
  let reported = 0
  const report = (): void => {
    let loaded = settled
    for (const bytes of flying.values()) loaded += bytes
    // Never backwards: a part sent again starts from nothing, and a bar that retreats reads as a failure.
    reported = Math.max(reported, Math.min(loaded, file.size))
    options.onProgress?.({ loaded: reported, total: file.size })
  }
  report()

  const queue: number[] = []
  for (let index = 0; index < parts; index++) {
    if (!have.has(index))
      queue.push(index)
  }

  async function sendPart(index: number): Promise<void> {
    const body = file.slice(index * partBytes, index * partBytes + sizeOf(index))
    const response = await attempt(() => {
      flying.set(index, 0)
      return transport(`${endpoint}/${id}/parts/${index}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body,
        signal,
        ...(options.transportReportsProgress
          ? { onUploadProgress: (progress: UploadProgress) => { flying.set(index, Math.min(progress.loaded, sizeOf(index))); report() } }
          : {}),
      })
    }).catch((error) => {
      flying.delete(index)
      throw error
    })
    // Counted as arrived in the same step it stops being counted as on its way.
    flying.delete(index)
    if (!response.ok) {
      // The session is gone (expired, or removed): the next call starts a new one.
      if (response.status === 404 && options.resumeKey)
        store?.removeItem(options.resumeKey)
      throw await refusal(response, 'The upload could not be sent. Try again.')
    }
    settled += sizeOf(index)
    report()
  }

  const workers = Array.from({ length: Math.max(1, Math.min(options.concurrency ?? 3, queue.length)) }, async () => {
    for (let index = queue.shift(); index !== undefined; index = queue.shift())
      await sendPart(index)
  })
  try {
    await Promise.all(workers)
  }
  catch (error) {
    // Stop the other parts before answering; they would only fail one by one.
    queue.length = 0
    await Promise.allSettled(workers)
    if (isAbort(error) || signal?.aborted) {
      // Cancelled on purpose: the server need not keep the parts, and the next pick starts clean.
      if (options.resumeKey)
        store?.removeItem(options.resumeKey)
      void transport(`${endpoint}/${id}`, { method: 'DELETE', keepalive: true }).catch(() => {})
    }
    throw error
  }

  return { ...session, received: Array.from({ length: parts }, (_, index) => index), complete: false }
}

/** Forgets a remembered session once the application has taken the upload, so the same file can be sent anew. */
export function forgetUpload(resumeKey: string, storage?: Pick<Storage, 'removeItem'> | null): void {
  try {
    (storage ?? (typeof localStorage === 'undefined' ? null : localStorage))?.removeItem(resumeKey)
  }
  catch {}
}
