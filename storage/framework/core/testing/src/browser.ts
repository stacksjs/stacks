/**
 * Headless Chrome over the DevTools Protocol, for browser tests and audits.
 *
 * No browser package: the Chrome already on the machine and Bun's own
 * WebSocket client. `launch()` returns a `Cdp` session on a page in its own
 * browser context of a headless Chrome the process shares; `auditPage()` loads one URL and reports the
 * duplicate API requests, failed same-origin requests and console errors it
 * cost.
 *
 * ```ts
 * import { auditPage, launch, settle } from '@stacksjs/testing/browser'
 *
 * const { cdp, close } = await launch()
 * try {
 *   await cdp.send('Page.navigate', { url: 'http://localhost:3000/' })
 *   await settle(cdp)
 *   expect(await cdp.evaluate('document.title')).toBe('Home')
 *   expect(cdp.errors).toEqual([])
 * }
 * finally { await close() }
 * ```
 *
 * ## The installed Chrome on macOS quits itself
 *
 * Google Chrome's updater (GoogleUpdater) sends SIGTERM to every running
 * process with Chrome's bundle id when it wakes, about 30 seconds into a run
 * while an update is pending. To a test that looks like a hung page: CDP
 * commands time out, even `Debugger.pause`. Renaming or copying the app does
 * not help, because the updater finds it by bundle id. What works is a private
 * clone with the updater's keys removed and its own bundle id, re-signed
 * ad hoc:
 *
 * ```sh
 * /bin/cp -cR "/Applications/Google Chrome.app" /tmp/chrome/Chrome.app
 * for key in KSProductID KSUpdateURL KSChannelID KSVersion; do
 *   /usr/libexec/PlistBuddy -c "Delete :$key" /tmp/chrome/Chrome.app/Contents/Info.plist
 * done
 * /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier dev.stacks.testing.chrome" /tmp/chrome/Chrome.app/Contents/Info.plist
 * codesign --force --deep --sign - /tmp/chrome/Chrome.app
 * CHROME_PATH="/tmp/chrome/Chrome.app/Contents/MacOS/Google Chrome" bun tests/browser/journeys.ts
 * ```
 *
 * Launch it with `--use-mock-keychain` (`launch()` always does): to the
 * Keychain the clone is a new app, so its first cookie read raises a "Chrome
 * Safe Storage" prompt nobody sees, and every http page hangs behind it.
 *
 * `cp -c` clones on APFS, so it takes no space and a second. `launch()` does
 * this itself (`prepareMacChrome()`, cached per Chrome version in the temp
 * directory) when `CHROME_PATH` is not set and the Chrome it found carries
 * the updater's keys. `Cdp.closed` is still set if Chrome goes away for
 * another reason, and every pending command fails at once.
 */
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readSync, renameSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

// ---------------------------------------------------------------------------
// Waiting
// ---------------------------------------------------------------------------

/**
 * Poll `read` until it returns something truthy, and return that. Throws
 * after `timeoutMs` (default 12 s) with `label` in the message.
 */
export async function waitFor<T>(read: () => Promise<T> | T, timeoutMs: number = 12_000, options: { intervalMs?: number, label?: string } = {}): Promise<NonNullable<T>> {
  const started = Date.now()
  let value = await read()
  while (!value && Date.now() - started < timeoutMs) {
    await Bun.sleep(options.intervalMs ?? 100)
    value = await read()
  }
  if (!value) throw new Error(`Timed out after ${timeoutMs}ms${options.label ? ` waiting for ${options.label}` : ''}`)
  return value as NonNullable<T>
}

// ---------------------------------------------------------------------------
// The protocol session
// ---------------------------------------------------------------------------

type Listener = (params: any) => void

interface Pending {
  resolve: (value: any) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export interface CdpOptions {
  /** How long one command may take. Default 30 s: on a loaded machine `Page.navigate` alone has taken over 15. */
  commandTimeoutMs?: number
  /** How long the DevTools WebSocket may take to open. Default 30 s. */
  connectTimeoutMs?: number
}

/** One `Fetch.enable` pattern, as the protocol spells it. */
export interface FetchPattern {
  /** Wildcards: `*` is any run of characters, `?` exactly one, `\` escapes. Default `*`. */
  urlPattern?: string
  /** `Document`, `XHR`, `Fetch`, `EventSource`, ... Default any. */
  resourceType?: string
  /** Pause before the request is sent, or when its response headers arrive. Default `'Request'`. */
  requestStage?: 'Request' | 'Response'
}

/** The parts of a `Fetch.requestPaused` event a handler usually reads. */
export interface PausedRequest {
  requestId: string
  request: { url: string, method: string, headers: Record<string, string>, postData?: string }
  resourceType?: string
  /** Set (with `responseHeaders`) when paused at the response stage. */
  responseStatusCode?: number
  responseErrorReason?: string
  networkId?: string
  [key: string]: any
}

/** Answers a paused request with `cdp.send('Fetch.continueRequest' | 'Fetch.fulfillRequest' | ...)`. */
export type FetchHandler = (request: PausedRequest, cdp: Cdp) => void | Promise<void>

interface Interceptor {
  patterns: FetchPattern[]
  handler: FetchHandler
}

/** The commands that answer a paused request. */
const FETCH_ANSWERS = new Set(['Fetch.continueRequest', 'Fetch.fulfillRequest', 'Fetch.failRequest', 'Fetch.continueResponse'])

/**
 * Whether `url` matches a `Fetch.enable` URL pattern the way Chrome matches
 * it: the whole URL, `*` any run of characters (none included), `?` exactly
 * one, a backslash makes the next character literal.
 */
export function matchesUrlPattern(pattern: string, url: string): boolean {
  let source = ''
  for (let index = 0; index < pattern.length; index++) {
    const char = pattern[index]!
    if (char === '\\' && index + 1 < pattern.length) source += escapeRegExp(pattern[++index]!)
    else if (char === '*') source += '[\\s\\S]*'
    else if (char === '?') source += '[\\s\\S]'
    else source += escapeRegExp(char)
  }
  return new RegExp(`^${source}$`).test(url)
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
}

/** Whether a `Fetch.requestPaused` event is one `pattern` would have paused. */
export function pausedRequestMatches(pattern: FetchPattern, paused: Pick<PausedRequest, 'request' | 'resourceType' | 'responseStatusCode' | 'responseErrorReason'>): boolean {
  const stage = paused.responseStatusCode != null || paused.responseErrorReason != null ? 'Response' : 'Request'
  if ((pattern.requestStage ?? 'Request') !== stage) return false
  if (pattern.resourceType && pattern.resourceType !== paused.resourceType) return false
  return matchesUrlPattern(pattern.urlPattern ?? '*', paused.request?.url ?? '')
}

/**
 * One DevTools Protocol session.
 *
 * Besides commands and events it keeps two things a test usually wants:
 *
 * - `errors`: uncaught exceptions, `console.error` calls, error log entries
 *   (favicon misses excluded) and failed requests (cancellations excluded);
 * - `inFlight`: the requests still loading, so a stalled page can say what it
 *   is waiting on. An event stream (`text/event-stream`: messages,
 *   notifications, live reload) stays open for the life of the page, so it
 *   leaves `inFlight` as soon as its response starts; counting it would keep
 *   every wait for a quiet network running to its timeout.
 *   A committed frame navigation also retires that frame's previous document
 *   requests, whose terminal events Chrome may omit. Requests of the incoming
 *   document, other frames and workers continue to count.
 *
 * Enable the `Page`, `Network`, `Runtime` and `Log` domains for those to fill;
 * `launch()` does.
 *
 * ## Several Fetch handlers on one session
 *
 * Chrome keeps one set of `Fetch.enable` patterns per session: a second
 * `Fetch.enable` replaces the first, `Fetch.disable` drops them all, and every
 * paused request goes to every `Fetch.requestPaused` listener. So the session
 * layers them:
 *
 * - `intercept(patterns, handler)` registers a handler that is given only the
 *   paused requests its own patterns match (`launch()` quiets live reload
 *   this way);
 * - `send('Fetch.enable', { patterns })` and `send('Fetch.disable')` set and
 *   clear one more layer, for code that drives Fetch itself, and the session
 *   enables the union of every layer. `on('Fetch.requestPaused')` listeners
 *   are given the requests that layer's patterns match, and not those only an
 *   `intercept()` handler asked for;
 * - the first answer to a paused request wins: a second
 *   `Fetch.continueRequest` / `fulfillRequest` / `failRequest` /
 *   `continueResponse` for it resolves without reaching Chrome (which would
 *   reject it), until the same request pauses again at its response stage;
 * - a paused request nothing would answer is continued.
 */
export class Cdp {
  private id = 0
  private pending = new Map<number, Pending>()
  private listeners = new Map<string, Set<Listener>>()
  private readonly commandTimeoutMs: number
  private interceptors: Interceptor[] = []
  /** What the caller last passed to `Fetch.enable` through `send`, or null after `Fetch.disable`. */
  private ownFetch: { patterns: FetchPattern[], params: Record<string, unknown> } | null = null
  /** Paused request ids: true once answered, false while waiting for an answer. */
  private answered = new Map<string, boolean>()
  private frameLoaders = new Map<string, string>()
  private requestLoaders = new Map<string, { frameId: string, loaderId: string }>()

  /** What went wrong on the page, in order. */
  errors: string[] = []
  /** Requests still loading: request id to `METHOD url`. */
  inFlight: Map<string, string> = new Map()
  /** Chrome went away; every later command fails at once. */
  closed: boolean = false

  constructor(private socket: WebSocket, options: CdpOptions = {}) {
    this.commandTimeoutMs = options.commandTimeoutMs ?? 30_000
    // Fail what is waiting at once rather than after each command's timeout.
    socket.addEventListener('close', () => this.markClosed())
    socket.addEventListener('message', event => this.receive(String(event.data)))
  }

  private markClosed(): void {
    this.closed = true
    this.frameLoaders.clear()
    this.requestLoaders.clear()
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(new Error('Chrome closed the connection'))
      this.pending.delete(id)
    }
  }

  private receive(raw: string): void {
    let message: any
    try {
      message = JSON.parse(raw)
    }
    catch {
      return
    }
    if (message.id) {
      const pending = this.pending.get(message.id)
      if (!pending) return
      this.pending.delete(message.id)
      clearTimeout(pending.timer)
      if (message.error) pending.reject(new Error(message.error.message))
      else pending.resolve(message.result)
      return
    }
    this.track(message.method, message.params ?? {})
    if (message.method === 'Fetch.requestPaused' && !this.routePaused(message.params ?? {})) return
    this.dispatch(message.method, message.params ?? {})
  }

  private dispatch(method: string, params: any): void {
    for (const listener of [...(this.listeners.get(method) ?? [])]) {
      try {
        listener(params)
      }
      catch (error) {
        this.errors.push(`Listener for ${method} threw: ${(error as Error)?.message ?? String(error)}`)
      }
    }
  }

  /**
   * Give a paused request to the `intercept()` handlers whose patterns match
   * it. Returns whether the `Fetch.requestPaused` listeners should see it too.
   */
  private routePaused(paused: PausedRequest): boolean {
    this.remember(paused.requestId, false)
    const claimed = this.interceptors.filter(interceptor => interceptor.patterns.some(pattern => pausedRequestMatches(pattern, paused)))
    for (const interceptor of claimed) {
      try {
        const result = interceptor.handler(paused, this)
        if (result && typeof (result as Promise<void>).catch === 'function')
          (result as Promise<void>).catch(error => this.errors.push(`Fetch handler threw: ${(error as Error)?.message ?? String(error)}`))
      }
      catch (error) {
        this.errors.push(`Fetch handler threw: ${(error as Error)?.message ?? String(error)}`)
      }
    }
    const listening = (this.listeners.get('Fetch.requestPaused')?.size ?? 0) > 0
    // Patterns this matcher reads differently from Chrome still reach the
    // listeners: only a request an interceptor claimed is kept from them.
    const own = this.ownFetch ? this.ownFetch.patterns.some(pattern => pausedRequestMatches(pattern, paused)) : false
    // Nobody asked for this one (a pattern was removed while it was paused):
    // let it go. A request the caller's own patterns hold with no listener is
    // left held, which is how a test keeps a request hanging on purpose.
    if (!claimed.length && !own && !listening)
      this.send('Fetch.continueRequest', { requestId: paused.requestId }).catch(() => {})
    return listening && (own || !claimed.length)
  }

  private remember(requestId: string, answered: boolean): void {
    this.answered.delete(requestId)
    this.answered.set(requestId, answered)
    // Answered ids only matter until a stray second answer arrives.
    if (this.answered.size > 2000) {
      for (const [id] of this.answered) {
        this.answered.delete(id)
        if (this.answered.size <= 1000) break
      }
    }
  }

  /** The patterns Chrome should pause on: every `intercept()` layer and the caller's own. */
  private async applyFetch(): Promise<any> {
    const patterns = [...this.interceptors.flatMap(interceptor => interceptor.patterns), ...(this.ownFetch?.patterns ?? [])]
    if (!patterns.length) return await this.command('Fetch.disable')
    return await this.command('Fetch.enable', { ...this.ownFetch?.params, patterns })
  }

  /**
   * Pause requests matching `patterns` and hand each to `handler`, which must
   * answer it (`Fetch.continueRequest`, `fulfillRequest`, `failRequest`).
   * Other handlers and the caller's own `Fetch.enable` keep working (see the
   * class docs). Resolves, once Chrome is pausing them, with a function that
   * removes this handler.
   *
   * @example
   * const stop = await cdp.intercept([{ urlPattern: '*\/api/slow*' }], (paused, cdp) => {
   *   setTimeout(() => cdp.send('Fetch.continueRequest', { requestId: paused.requestId }), 2000)
   * })
   */
  async intercept(patterns: FetchPattern[], handler: FetchHandler): Promise<() => Promise<void>> {
    if (!patterns.length) throw new TypeError('intercept needs at least one pattern')
    const interceptor: Interceptor = { patterns: patterns.map(pattern => ({ ...pattern })), handler }
    this.interceptors.push(interceptor)
    try {
      await this.applyFetch()
    }
    catch (error) {
      this.interceptors = this.interceptors.filter(item => item !== interceptor)
      throw error
    }
    let removed = false
    return async () => {
      if (removed) return
      removed = true
      this.interceptors = this.interceptors.filter(item => item !== interceptor)
      if (!this.closed) await this.applyFetch()
    }
  }

  private finishRequest(requestId: string): void {
    this.inFlight.delete(requestId)
    this.requestLoaders.delete(requestId)
  }

  private retireFrameRequests(frameId: string, previousLoader?: string): void {
    for (const [requestId, document] of this.requestLoaders) {
      if (document.frameId === frameId && (previousLoader === undefined || document.loaderId === previousLoader)) {
        this.finishRequest(requestId)
      }
    }
  }

  private track(method: string, params: any): void {
    if (method === 'Network.requestWillBeSent') {
      const { requestId, frameId, loaderId } = params
      // Chrome can omit terminal events for requests of a replaced document.
      // A started navigation is insufficient: retire only on a frame commit.
      this.requestLoaders.delete(requestId)
      if (frameId && loaderId) this.requestLoaders.set(requestId, { frameId, loaderId })
      this.inFlight.set(params.requestId, `${params.request?.method} ${params.request?.url}`)
    }
    else if (method === 'Network.loadingFinished' || method === 'Network.loadingFailed')
      this.finishRequest(params.requestId)
    else if (method === 'Network.responseReceived' && params.response?.mimeType === 'text/event-stream')
      this.finishRequest(params.requestId)
    else if (method === 'Page.frameNavigated' && params.frame?.id && params.frame?.loaderId) {
      const { id, loaderId } = params.frame
      const previous = this.frameLoaders.get(id)
      if (previous && previous !== loaderId) this.retireFrameRequests(id, previous)
      this.frameLoaders.set(id, loaderId)
    }
    else if (method === 'Page.frameDetached' && params.reason === 'remove') {
      this.frameLoaders.delete(params.frameId)
      this.retireFrameRequests(params.frameId)
    }

    if (method === 'Runtime.exceptionThrown')
      this.errors.push(params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || 'Runtime exception')
    else if (method === 'Runtime.consoleAPICalled' && params.type === 'error')
      this.errors.push((params.args || []).map((item: any) => item.value ?? item.description ?? '').join(' '))
    else if (method === 'Log.entryAdded' && params.entry?.level === 'error' && !String(params.entry.text).includes('favicon'))
      this.errors.push(params.entry.text)
    else if (method === 'Network.loadingFailed' && !params.canceled)
      this.errors.push(`Network: ${params.errorText || 'request failed'}`)
  }

  /**
   * Listen for an event. Any number of listeners per method, called in the
   * order they were added; returns a function that removes this one.
   */
  on(method: string, listener: Listener): () => void {
    let set = this.listeners.get(method)
    if (!set) this.listeners.set(method, set = new Set())
    set.add(listener)
    return () => this.off(method, listener)
  }

  off(method: string, listener: Listener): void {
    this.listeners.get(method)?.delete(listener)
  }

  /**
   * The next `method` event whose params pass `match` (any, by default).
   * Rejects after `timeoutMs`, or when Chrome goes away.
   */
  once<T = any>(method: string, match: (params: T) => boolean = () => true, timeoutMs: number = this.commandTimeoutMs): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (this.closed) return reject(new Error('Chrome closed the connection'))
      const timer = setTimeout(() => {
        off()
        clearInterval(watch)
        reject(new Error(`Timed out after ${timeoutMs}ms waiting for ${method}`))
      }, timeoutMs)
      const watch = setInterval(() => {
        if (!this.closed) return
        clearTimeout(timer)
        clearInterval(watch)
        off()
        reject(new Error('Chrome closed the connection'))
      }, 100)
      const off = this.on(method, (params: T) => {
        if (!match(params)) return
        clearTimeout(timer)
        clearInterval(watch)
        off()
        resolve(params)
      })
    })
  }

  /**
   * Send a command and resolve with its result. `Fetch.enable` and
   * `Fetch.disable` are layered with `intercept()` handlers, and a second
   * answer to one paused request resolves without being sent (see the class
   * docs).
   */
  send<T = any>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (method === 'Fetch.enable') {
      const { patterns, ...rest } = params as { patterns?: FetchPattern[] }
      // No patterns means every request at the request stage.
      this.ownFetch = { patterns: patterns?.length ? patterns.map(pattern => ({ ...pattern })) : [{ urlPattern: '*' }], params: rest }
      return this.closed ? this.command(method, params) : this.applyFetch()
    }
    if (method === 'Fetch.disable') {
      this.ownFetch = null
      return this.closed ? this.command(method, params) : this.applyFetch()
    }
    if (FETCH_ANSWERS.has(method) && typeof params.requestId === 'string') {
      if (this.answered.get(params.requestId) === true) return Promise.resolve({} as T)
      if (this.answered.has(params.requestId)) this.remember(params.requestId, true)
    }
    return this.command<T>(method, params)
  }

  private command<T = any>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = ++this.id
    return new Promise<T>((resolve, reject) => {
      if (this.closed) return reject(new Error('Chrome closed the connection'))
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Chrome command timed out: ${method}`))
      }, this.commandTimeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  /** Evaluate `expression` in the page (awaiting a promise) and return its value. */
  async evaluate<T = any>(expression: string): Promise<T> {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
    return result.result?.value as T
  }

  /** Close the socket (Chrome keeps running; `launch()`'s `close` stops it). */
  disconnect(): void {
    this.markClosed()
    try {
      this.socket.close()
    }
    catch {}
  }
}

/** Open a session on a DevTools WebSocket URL (`ws://127.0.0.1:9222/devtools/page/...`). */
export async function connect(url: string, options: CdpOptions = {}): Promise<Cdp> {
  const socket = new WebSocket(url)
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer)
      socket.removeEventListener('open', opened)
      socket.removeEventListener('error', failed)
      socket.removeEventListener('close', failed)
      if (error) {
        try { socket.close() }
        catch {}
        reject(error)
      }
      else resolve()
    }
    const opened = () => finish()
    const failed = () => finish(new Error(`Could not connect to Chrome at ${url}`))
    const timer = setTimeout(() => finish(new Error(`Timed out connecting to Chrome at ${url}`)), options.connectTimeoutMs ?? 30_000)
    socket.addEventListener('open', opened, { once: true })
    socket.addEventListener('error', failed, { once: true })
    socket.addEventListener('close', failed, { once: true })
  })
  return new Cdp(socket, options)
}

// ---------------------------------------------------------------------------
// Finding and preparing Chrome
// ---------------------------------------------------------------------------

const MAC_CHROMES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
]
const PATH_CHROMES = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome']
const UPDATER_KEYS = ['KSProductID', 'KSUpdateURL', 'KSChannelID', 'KSVersion']
const PRIVATE_BUNDLE_ID = 'dev.stacks.testing.chrome'

/** The Chrome to drive: `CHROME_PATH`, else the first installed one found. Null when there is none. */
export function findChrome(): string | null {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  if (process.platform === 'darwin') {
    const found = MAC_CHROMES.find(path => existsSync(path))
    if (found) return found
  }
  for (const name of PATH_CHROMES) {
    const found = Bun.which(name)
    if (found) return found
  }
  return null
}

/** The `.app` bundle an executable inside `Contents/MacOS/` belongs to, or null. */
function appBundleOf(executable: string): string | null {
  const match = /^(.*?\.app)\/Contents\/MacOS\/[^/]+$/.exec(executable)
  return match ? match[1]! : null
}

function plist(info: string, command: string): { ok: boolean, out: string } {
  const result = Bun.spawnSync(['/usr/libexec/PlistBuddy', '-c', command, info], { stdout: 'pipe', stderr: 'pipe' })
  return { ok: result.exitCode === 0, out: result.stdout.toString().trim() }
}

/** True when this Chrome would be killed by GoogleUpdater (it still carries the updater's keys). */
export function chromeHasUpdater(executable: string): boolean {
  const app = appBundleOf(executable)
  if (!app || process.platform !== 'darwin') return false
  const info = join(app, 'Contents/Info.plist')
  return existsSync(info) && UPDATER_KEYS.some(key => plist(info, `Print :${key}`).ok)
}

export interface PreparedChrome {
  /** The executable to launch. */
  executable: string
  /** The cloned `.app`. */
  app: string
  /** Reused from an earlier run rather than cloned now. */
  reused: boolean
}

/**
 * A private clone of a macOS Chrome that GoogleUpdater leaves alone (see the
 * module docs): `cp -cR`, the `KS*` keys deleted from `Info.plist`, its own
 * `CFBundleIdentifier`, `codesign --force --deep --sign -`. Kept in
 * `directory` (default a per-version folder in the temp directory) and
 * reused while its version matches the source's.
 */
export function prepareMacChrome(options: { source?: string, directory?: string } = {}): PreparedChrome {
  if (process.platform !== 'darwin') throw new Error('prepareMacChrome is for macOS; elsewhere launch Chrome as installed')
  const source = options.source ?? MAC_CHROMES[0]!
  const sourceApp = appBundleOf(source)
  if (!sourceApp || !existsSync(sourceApp)) throw new Error(`No Chrome app bundle at ${source}`)
  const sourceInfo = join(sourceApp, 'Contents/Info.plist')
  const version = plist(sourceInfo, 'Print :CFBundleShortVersionString').out || 'unknown'
  const executableName = plist(sourceInfo, 'Print :CFBundleExecutable').out || 'Google Chrome'
  const directory = options.directory ?? join(tmpdir(), `stacks-chrome-${version.replace(/[^\w.-]/g, '_')}`)
  const app = join(directory, 'Chrome.app')
  const executable = join(app, 'Contents/MacOS', executableName)
  const info = join(app, 'Contents/Info.plist')

  if (existsSync(executable) && plist(info, 'Print :CFBundleIdentifier').out === PRIVATE_BUNDLE_ID
    && plist(info, 'Print :CFBundleShortVersionString').out === version)
    return { executable, app, reused: true }

  // Build beside the final path and move it in, so a run killed half-way
  // never leaves a half-signed app that a later run would reuse.
  mkdirSync(directory, { recursive: true })
  const staging = mkdtempSync(join(directory, 'staging-'))
  const staged = join(staging, 'Chrome.app')
  const run = (command: string[], what: string) => {
    const result = Bun.spawnSync(command, { stdout: 'pipe', stderr: 'pipe' })
    if (result.exitCode !== 0) throw new Error(`${what} failed: ${result.stderr.toString().trim()}`)
  }
  try {
    run(['/bin/cp', '-cR', sourceApp, staged], 'Cloning Chrome')
    const stagedInfo = join(staged, 'Contents/Info.plist')
    for (const key of UPDATER_KEYS) plist(stagedInfo, `Delete :${key}`)
    run(['/usr/libexec/PlistBuddy', '-c', `Set :CFBundleIdentifier ${PRIVATE_BUNDLE_ID}`, stagedInfo], 'Renaming the Chrome bundle')
    run(['codesign', '--force', '--deep', '--sign', '-', staged], 'Re-signing Chrome')
    rmSync(app, { recursive: true, force: true })
    renameSync(staged, app)
  }
  finally {
    rmSync(staging, { recursive: true, force: true })
  }
  return { executable, app, reused: false }
}

// ---------------------------------------------------------------------------
// Launching
// ---------------------------------------------------------------------------

export interface Viewport {
  width: number
  height: number
  deviceScaleFactor?: number
  mobile?: boolean
}

export interface LaunchOptions extends CdpOptions {
  /** The Chrome executable. Default `findChrome()`. */
  chromePath?: string
  /**
   * On macOS, run a private clone that GoogleUpdater leaves alone
   * (`prepareMacChrome`). Default true when neither `chromePath` nor
   * `CHROME_PATH` names a Chrome and the found one carries the updater's keys.
   */
  stableMacChrome?: boolean
  /**
   * Keep this profile directory across launches (its storage, caches and
   * service workers), for a run that must start Chrome again part-way. The
   * caller removes it. Default a fresh temporary profile, removed on close.
   */
  profile?: string
  /** Default true. */
  headless?: boolean
  /** Default 1440 x 1000 at scale 1. Pass false to leave Chrome's own. */
  viewport?: Viewport | false
  /** More Chrome flags. */
  args?: string[]
  /**
   * URL patterns of live-reload streams to answer with one that asks to retry
   * in a day, so a file saved mid-run cannot reload the page under a check.
   * (Blocking the stream does not work: the client reloads when it closes.)
   * Only requests these patterns match are answered, so a test can still
   * pause its own requests with `cdp.intercept()` or `Fetch.enable`.
   * Default `['*\/_stx/hmr*']`; false leaves them alone.
   */
  quietLiveReload?: string[] | false
  /**
   * Accept every JavaScript dialog (alert, confirm, "Leave site?") and record
   * it in `cdp.errors`, since a dialog blocks the page and every command sent
   * to it until answered. Default true.
   */
  acceptDialogs?: boolean
  /**
   * Remove "HeadlessChrome" from the user agent (some players, Vimeo's for
   * one, never become ready for it), or set your own. Default true.
   */
  userAgent?: boolean | string
  /** This call's deadline for acquiring/starting Chrome, target discovery and session setup. Default 30 s. */
  startTimeoutMs?: number
  /**
   * Share one Chrome per process and give this launch its own browser context
   * (see `launch()`). Default true; a `profile` always gets a Chrome of its own.
   */
  shared?: boolean
}

export type ChromeStartupPhase = 'process-acquire' | 'process-start' | 'devtools-port' | 'browser-connect' | 'context-create' | 'target-create' | 'target-discovery' | 'page-connect' | 'page-prepare'

interface StartupProgress {
  started: number
  phase: ChromeStartupPhase
  phaseStartedMs: Partial<Record<ChromeStartupPhase, number>>
}

function startupPhase(progress: StartupProgress, phase: ChromeStartupPhase): void {
  progress.phase = phase
  progress.phaseStartedMs[phase] = Date.now() - progress.started
}

export interface ChromeLaunchDiagnostics {
  pid: number | null
  chromePath: string
  profile: string
  temporaryProfile: boolean
  elapsedMs: number
  /** The operation still pending when launch failed, before cleanup. */
  phase?: ChromeStartupPhase
  /** Milliseconds from this launch's start when each reached phase began. */
  phaseStartedMs?: Partial<Record<ChromeStartupPhase, number>>
  exitCodeBeforeCleanup: number | null
  signalCodeBeforeCleanup: string | number | null
  exitCode: number | null
  signalCode: string | number | null
  portFileExisted: boolean
  portFileContents: string | null
  stderrTail: string
  stderrTruncated: boolean
  cleanupError: string | null
}

export class ChromeLaunchError extends Error {
  constructor(cause: unknown, public readonly diagnostics: ChromeLaunchDiagnostics) {
    super(`${cause instanceof Error ? cause.message : String(cause)}\nChrome startup: ${JSON.stringify(diagnostics)}`, { cause })
    this.name = 'ChromeLaunchError'
  }
}

async function finishesWithin(promise: Promise<unknown>, timeoutMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([promise.then(() => true), new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), timeoutMs) })])
  }
  finally { clearTimeout(timer) }
}

/** Only a small prefix belongs in a startup diagnostic, even for a corrupt file. */
function portEvidence(path: string): string | null {
  let fd: number | undefined
  try {
    fd = openSync(path, 'r')
    const buffer = Buffer.alloc(1024)
    return buffer.subarray(0, readSync(fd, buffer, 0, buffer.length, 0)).toString('utf8')
  }
  catch { return null }
  finally {
    if (fd !== undefined) {
      try { closeSync(fd) }
      catch {}
    }
  }
}

export interface LaunchedChrome {
  cdp: Cdp
  /**
   * End this session: dispose its browser context on a shared Chrome, or stop
   * a Chrome of its own and remove a temporary profile. Safe to call twice.
   */
  close: () => Promise<void>
  /** The page's DevTools WebSocket URL, to connect a second session. */
  target: string
  /** The DevTools HTTP port. */
  port: number
  /** The executable that was started. */
  chromePath: string
}

/** stx's live-reload stream. */
export const LIVE_RELOAD_PATTERNS: readonly string[] = ['*/_stx/hmr*']

/**
 * Answer live-reload streams matching `patterns` (default stx's) with one that
 * asks to retry in a day, so a file saved mid-run cannot reload the page.
 * Only those requests: every other paused request is left to the session's
 * other Fetch handlers (`Cdp.intercept`, or your own `Fetch.enable`).
 * `launch()` calls this unless `quietLiveReload` is false. Resolves with a
 * function that stops it.
 */
export async function quietLiveReload(cdp: Cdp, patterns: readonly string[] = LIVE_RELOAD_PATTERNS): Promise<() => Promise<void>> {
  if (!patterns.length) return async () => {}
  return await cdp.intercept(patterns.map(urlPattern => ({ urlPattern })), (paused, session) => {
    session.send('Fetch.fulfillRequest', {
      requestId: paused.requestId,
      responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: 'text/event-stream' }],
      body: Buffer.from('retry: 86400000\n\n').toString('base64'),
    }).catch(() => {})
  })
}

function resolveChrome(options: LaunchOptions): string {
  const named = options.chromePath ?? process.env.CHROME_PATH
  if (named) return named
  const found = findChrome()
  if (!found) throw new Error('No Chrome found: install Google Chrome or Chromium, or set CHROME_PATH')
  const stable = options.stableMacChrome ?? true
  if (stable && process.platform === 'darwin' && chromeHasUpdater(found))
    return prepareMacChrome({ source: found }).executable
  return found
}

/** A Chrome process this module started, up to the point a DevTools port is known. */
interface StartedChrome {
  readonly pid: number | null
  readonly chromePath: string
  readonly profile: string
  readonly port: number
  /** The browser-wide DevTools endpoint, from DevToolsActivePort's second line. */
  readonly browserPath: string
  /** Throws once the startup deadline has passed or the process has exited. */
  remaining: () => number
  /** Stop the process and remove a temporary profile. Safe to call twice. */
  close: () => Promise<void>
  /** The evidence for a failed launch; `cleanup` stops the process first. */
  failure: (error: unknown, cleanup: boolean, observation?: StartupProgress) => Promise<ChromeLaunchError>
  readonly exited: () => boolean
}

/** Spawn Chrome and wait for its DevTools port. Throws a `ChromeLaunchError` with the startup evidence. */
async function startChrome(options: LaunchOptions, chromePath: string, started: number, timeoutMs: number, progress: StartupProgress): Promise<StartedChrome> {
  startupPhase(progress, 'process-start')
  if (!existsSync(chromePath)) throw new Error(`Chrome was not found at ${chromePath}`)
  const profile = options.profile || mkdtempSync(join(tmpdir(), 'stacks-browser-'))
  // A kept profile still names the last launch's port.
  rmSync(join(profile, 'DevToolsActivePort'), { force: true })
  const portFile = join(profile, 'DevToolsActivePort')
  const chrome = (() => {
    try {
      return Bun.spawn([
        chromePath,
        ...(options.headless === false ? [] : ['--headless=new']),
        '--remote-debugging-port=0',
        `--user-data-dir=${profile}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--disable-component-update',
        '--disable-extensions',
        '--hide-scrollbars',
        // A re-signed clone (prepareMacChrome) is a new app to the Keychain, so
        // its first cookie read asks the user for "Chrome Safe Storage" and every
        // http page hangs behind that invisible prompt. A test profile needs no
        // real Keychain.
        '--use-mock-keychain',
        ...(options.args ?? []),
        'about:blank',
      ], { stdin: 'ignore', stdout: 'ignore', stderr: 'pipe' })
    }
    catch (error) {
      let cleanupError: string | null = null
      try { if (!options.profile) rmSync(profile, { recursive: true, force: true }) }
      catch (failure) { cleanupError = String(failure) }
      throw new ChromeLaunchError(error, { pid: null, chromePath, profile, temporaryProfile: !options.profile, elapsedMs: Date.now() - started, phase: progress.phase, phaseStartedMs: { ...progress.phaseStartedMs }, exitCodeBeforeCleanup: null, signalCodeBeforeCleanup: null, exitCode: null, signalCode: null, portFileExisted: false, portFileContents: null, stderrTail: '', stderrTruncated: false, cleanupError })
    }
  })()

  let stderrTail = ''
  let stderrTruncated = false
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let stderrDone: Promise<void> = Promise.resolve()

  let closing: Promise<void> | undefined
  const close = (): Promise<void> => closing ??= (async () => {
    let processOff = false
    const failures: string[] = []
    try {
      if (chrome.exitCode === null && chrome.signalCode === null) {
        try { chrome.kill('SIGTERM') }
        catch {} // Exit may race this signal; still require the exit proof below.
      }
      if (!await finishesWithin(chrome.exited, 2_000)) {
        try { chrome.kill('SIGKILL') }
        catch {} // The following wait also covers a process which just exited.
        if (!await finishesWithin(chrome.exited, 2_000)) throw new Error(`Chrome process ${chrome.pid} did not exit after SIGKILL`)
      }
      processOff = true
    }
    catch (error) {
      failures.push(String(error))
      processOff = chrome.exitCode !== null || chrome.signalCode !== null
    }
    finally {
      try {
        if (!await finishesWithin(stderrDone, 100) && reader) {
          if (!await finishesWithin(reader.cancel(), 100)) throw new Error('Chrome stderr cancellation did not finish')
        }
        if (!await finishesWithin(stderrDone, 100)) throw new Error('Chrome stderr reader did not finish')
      }
      catch (error) { failures.push(String(error)) }
      finally {
        // Never retire a profile while an unconfirmed process may still use it.
        if (processOff && !options.profile) {
          try { rmSync(profile, { recursive: true, force: true }) }
          catch (error) { failures.push(String(error)) }
        }
      }
    }
    if (failures.length) throw new Error(`Chrome cleanup failed: ${failures.join('; ')}`)
  })()
  const exited = () => chrome.exitCode !== null || chrome.signalCode !== null
  const remaining = () => {
    const value = timeoutMs - (Date.now() - started)
    if (value <= 0) throw new Error(`Timed out after ${timeoutMs}ms starting Chrome`)
    if (exited()) throw new Error('Chrome exited during startup')
    return value
  }
  const failure = async (error: unknown, cleanup: boolean, observation = progress): Promise<ChromeLaunchError> => {
    const elapsedMs = Date.now() - observation.started
    const phase = observation.phase, phaseStartedMs = { ...observation.phaseStartedMs }
    const exitCodeBeforeCleanup = chrome.exitCode
    const signalCodeBeforeCleanup = chrome.signalCode
    const portFileExisted = existsSync(portFile)
    const portFileContents = portEvidence(portFile)
    let cleanupError: string | null = null
    if (cleanup) {
      try { await close() }
      catch (failed) { cleanupError = failed instanceof Error ? failed.message : String(failed) }
    }
    return new ChromeLaunchError(error, { pid: chrome.pid, chromePath, profile, temporaryProfile: !options.profile, elapsedMs, phase, phaseStartedMs, exitCodeBeforeCleanup, signalCodeBeforeCleanup, exitCode: chrome.exitCode, signalCode: chrome.signalCode, portFileExisted, portFileContents, stderrTail, stderrTruncated, cleanupError })
  }

  try {
    reader = chrome.stderr.getReader()
    const stderrReader = reader
    stderrDone = (async () => {
      const decoder = new TextDecoder()
      for (;;) {
        const { value, done } = await stderrReader.read()
        const text = decoder.decode(value, { stream: !done })
        stderrTruncated ||= stderrTail.length + text.length > 16_384
        stderrTail = (stderrTail + text).slice(-16_384)
        if (done) return
      }
    })().catch((error) => { stderrTail = `${stderrTail}\n[stderr read failed: ${String(error)}]`.slice(-16_384) })
    // A loaded machine can take a while to bring Chrome up; 10 s was too tight.
    startupPhase(progress, 'devtools-port')
    await waitFor(() => { remaining(); return portEvidence(portFile)?.includes('\n') }, remaining(), { label: 'Chrome to start' })
    const [portLine, browserPath = ''] = (portEvidence(portFile) ?? '').split('\n')
    const port = Number(portLine)
    if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('Chrome wrote an invalid DevToolsActivePort')
    return { pid: chrome.pid, chromePath, profile, port, browserPath: browserPath.trim(), remaining, close, failure, exited }
  }
  catch (error) {
    throw await failure(error, true)
  }
}

/** Reject with `label` unless `promise` settles within `ms`. */
async function within<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms ${label}`)), ms) })])
  }
  finally { clearTimeout(timer) }
}

/** The domains, viewport, user agent and handlers every launched page starts with. */
async function prepareSession(session: Cdp, options: LaunchOptions): Promise<void> {
  await Promise.all([
    session.send('Page.enable'),
    session.send('Runtime.enable'),
    session.send('Network.enable'),
    session.send('Log.enable'),
    ...(options.viewport === false ? [] : [session.send('Emulation.setDeviceMetricsOverride', { deviceScaleFactor: 1, mobile: false, width: 1440, height: 1000, ...options.viewport })]),
  ])

  if (options.userAgent !== false) {
    const agent = typeof options.userAgent === 'string'
      ? options.userAgent
      : String((await session.send('Browser.getVersion')).userAgent || '').replace('HeadlessChrome', 'Chrome')
    if (agent) await session.send('Network.setUserAgentOverride', { userAgent: agent })
  }

  if (options.quietLiveReload !== false)
    await quietLiveReload(session, options.quietLiveReload)

  if (options.acceptDialogs !== false) {
    session.on('Page.javascriptDialogOpening', (params) => {
      session.errors.push(`Dialog (${params.type}) on ${params.url}: ${params.message || '(no message)'}`)
      session.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {})
    })
  }
}

/**
 * How long a shared Chrome outlives its last session, for the next `launch()`
 * to reuse. Long enough for a suite that closes one journey and opens the
 * next; short enough that a finished script exits promptly.
 */
export const SHARED_CHROME_LINGER_MS: number = 1_500

interface SharedChrome {
  chrome: StartedChrome
  browser: Cdp
  sessions: number
  linger?: ReturnType<typeof setTimeout>
}

const sharedChromes = new Map<string, Promise<SharedChrome>>()
/** Shared Chromes still running, by pid, with the temporary profile to remove. */
const sharedProcesses = new Map<number, string>()
let exitHookInstalled = false

/**
 * A process that exits while sharing a Chrome takes it along. Synchronous,
 * because nothing asynchronous runs once a process has started to exit (a
 * script ending in `process.exit()` included).
 */
function installExitHook(): void {
  if (exitHookInstalled) return
  exitHookInstalled = true
  process.once('exit', () => {
    for (const [pid, profile] of sharedProcesses) {
      try { process.kill(pid, 'SIGKILL') }
      catch {}
      try { if (profile) rmSync(profile, { recursive: true, force: true }) }
      catch {}
    }
  })
}

/** Stop every shared Chrome now, instead of after it lingers. */
export async function closeSharedBrowsers(): Promise<void> {
  const entries = [...sharedChromes.values()]
  sharedChromes.clear()
  await Promise.allSettled(entries.map(async (pending) => {
    const shared = await pending
    clearTimeout(shared.linger)
    shared.browser.disconnect()
    await shared.chrome.close()
    if (shared.chrome.pid !== null) sharedProcesses.delete(shared.chrome.pid)
  }))
}

async function acquireShared(key: string, options: LaunchOptions, chromePath: string, started: number, timeoutMs: number, progress: StartupProgress): Promise<SharedChrome> {
  const existing = sharedChromes.get(key)
  if (existing) {
    const remainingMs = timeoutMs - (Date.now() - started)
    if (remainingMs <= 0) throw new Error(`Timed out after ${timeoutMs}ms starting Chrome`)
    // A caller with a short budget must not inherit another caller's longer
    // cold start. Timing out this wait does not stop the process it borrows.
    const shared = await within(existing.catch(() => null), remainingMs, 'waiting for shared Chrome')
    if (shared && !shared.browser.closed && !shared.chrome.exited()) {
      clearTimeout(shared.linger)
      shared.sessions++
      return shared
    }
    if (sharedChromes.get(key) === existing) sharedChromes.delete(key)
  }
  const starting = (async (): Promise<SharedChrome> => {
    const chrome = await startChrome(options, chromePath, started, timeoutMs, progress)
    if (chrome.pid !== null) sharedProcesses.set(chrome.pid, chrome.profile)
    try {
      if (!chrome.browserPath.startsWith('/devtools/browser/')) throw new Error('Chrome wrote no browser endpoint in DevToolsActivePort')
      startupPhase(progress, 'browser-connect')
      const browser = await connect(`ws://127.0.0.1:${chrome.port}${chrome.browserPath}`, { ...options, connectTimeoutMs: Math.min(options.connectTimeoutMs ?? 30_000, chrome.remaining()) })
      return { chrome, browser, sessions: 0 }
    }
    catch (error) {
      if (chrome.pid !== null) sharedProcesses.delete(chrome.pid)
      throw await chrome.failure(error, true)
    }
  })()
  sharedChromes.set(key, starting)
  installExitHook()
  try {
    const shared = await starting
    shared.sessions++
    return shared
  }
  catch (error) {
    if (sharedChromes.get(key) === starting) sharedChromes.delete(key)
    throw error
  }
}

/** One session fewer; the last one lets Chrome linger, then stops it. */
function releaseShared(key: string, shared: SharedChrome, immediately = false): Promise<void> {
  shared.sessions = Math.max(0, shared.sessions - 1)
  if (shared.sessions > 0) return Promise.resolve()
  const stop = async () => {
    if (shared.sessions > 0) return
    const entry = sharedChromes.get(key)
    if (entry && await entry.catch(() => null) === shared) sharedChromes.delete(key)
    shared.browser.disconnect()
    await shared.chrome.close()
    if (shared.chrome.pid !== null) sharedProcesses.delete(shared.chrome.pid)
  }
  if (immediately) return stop()
  clearTimeout(shared.linger)
  shared.linger = setTimeout(() => { stop().catch(() => {}) }, SHARED_CHROME_LINGER_MS)
  return Promise.resolve()
}

/** A page in its own browser context on the shared Chrome for these options. */
async function launchShared(options: LaunchOptions, chromePath: string, started: number, timeoutMs: number, progress: StartupProgress): Promise<LaunchedChrome> {
  const key = JSON.stringify([chromePath, options.headless !== false, options.args ?? []])
  const shared = await acquireShared(key, options, chromePath, started, timeoutMs, progress)
  const left = () => {
    const value = timeoutMs - (Date.now() - started)
    if (value <= 0) throw new Error(`Timed out after ${timeoutMs}ms starting Chrome`)
    return value
  }
  let contextId: string | undefined
  let cdp: Cdp | undefined
  const dispose = async () => {
    if (contextId && !shared.browser.closed)
      await shared.browser.send('Target.disposeBrowserContext', { browserContextId: contextId }).catch(() => {})
  }
  try {
    // Its own cookies, storage, cache and service workers: nothing a journey
    // signs in to or stores reaches the next one, or one running beside it.
    startupPhase(progress, 'context-create')
    contextId = (await within(shared.browser.send('Target.createBrowserContext', { disposeOnDetach: false }), left(), 'creating a browser context')).browserContextId
    startupPhase(progress, 'target-create')
    const { targetId } = await within(shared.browser.send('Target.createTarget', { url: 'about:blank', browserContextId: contextId }), left(), 'opening a page')
    const target = `ws://127.0.0.1:${shared.chrome.port}/devtools/page/${targetId}`
    startupPhase(progress, 'page-connect')
    const session = cdp = await connect(target, { ...options, connectTimeoutMs: Math.min(options.connectTimeoutMs ?? 30_000, left()) })
    startupPhase(progress, 'page-prepare')
    await within(prepareSession(session, options), left(), 'preparing the page')
    left()
    let closing: Promise<void> | undefined
    const close = (): Promise<void> => closing ??= (async () => {
      session.disconnect()
      await dispose()
      await releaseShared(key, shared)
    })()
    return { cdp: session, close, target, port: shared.chrome.port, chromePath }
  }
  catch (error) {
    cdp?.disconnect()
    await dispose()
    const alone = shared.sessions <= 1
    const failure = await shared.chrome.failure(error, false, progress)
    // The Chrome this launch started for itself goes with it; one others are
    // using stays up for them.
    await releaseShared(key, shared, alone).catch((failed) => { failure.diagnostics.cleanupError = failed instanceof Error ? failed.message : String(failed) })
    throw failure
  }
}

/** A Chrome of its own, for a launch that keeps a profile or asked not to share. */
async function launchDedicated(options: LaunchOptions, chromePath: string, started: number, timeoutMs: number, progress: StartupProgress): Promise<LaunchedChrome> {
  const chrome = await startChrome(options, chromePath, started, timeoutMs, progress)
  let cdp: Cdp | undefined
  let closing: Promise<void> | undefined
  const close = (): Promise<void> => closing ??= (async () => {
    cdp?.disconnect()
    await chrome.close()
  })()
  const startupTimer = setTimeout(() => cdp?.disconnect(), Math.max(1, timeoutMs - (Date.now() - started)))
  try {
    const port = chrome.port
    startupPhase(progress, 'target-discovery')
    const targets = await waitFor(async () => {
      const list = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(Math.min(1_000, chrome.remaining())) }).then(response => response.json()).catch(() => [])
      return Array.isArray(list) && list.length ? list : null
    }, Math.min(12_000, chrome.remaining()), { label: 'a page target' })
    const page = targets.find(target => target.type === 'page' && target.url === 'about:blank') || targets.find(target => target.type === 'page')
    if (!page) throw new Error('Chrome did not expose a page target')
    startupPhase(progress, 'page-connect')
    cdp = await connect(page.webSocketDebuggerUrl, { ...options, connectTimeoutMs: Math.min(options.connectTimeoutMs ?? 30_000, chrome.remaining()) })
    chrome.remaining()
    startupPhase(progress, 'page-prepare')
    await prepareSession(cdp, options)
    chrome.remaining()
    clearTimeout(startupTimer)
    return { cdp, close, target: page.webSocketDebuggerUrl, port, chromePath }
  }
  catch (error) {
    clearTimeout(startupTimer)
    cdp?.disconnect()
    throw await chrome.failure(error, true)
  }
}

/**
 * Open a session on a page of a headless Chrome, with the `Page`, `Runtime`,
 * `Network` and `Log` domains enabled.
 *
 * **One Chrome per process, a fresh browser context per launch.** Starting
 * Chrome is the slow part (seconds, more on a loaded machine), so launches
 * with the same executable, headless mode and flags share one process, and
 * each gets its own browser context: separate cookies, storage, cache and
 * service workers, so a journey signed in as one person and another signed in
 * beside it never see each other's session. `close()` disposes the context; the
 * Chrome lingers briefly ({@link SHARED_CHROME_LINGER_MS}) for the next launch,
 * then stops, and `closeSharedBrowsers()` stops it at once.
 *
 * A launch that keeps a `profile`, passes `shared: false`, or runs with
 * `STACKS_BROWSER_SHARED=0` gets a Chrome of its own, stopped by `close()`.
 */
export async function launch(options: LaunchOptions = {}): Promise<LaunchedChrome> {
  const timeoutMs = options.startTimeoutMs ?? 30_000
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('startTimeoutMs must be positive and finite')
  const chromePath = resolveChrome(options)
  const started = Date.now()
  const progress: StartupProgress = { started, phase: 'process-acquire', phaseStartedMs: { 'process-acquire': 0 } }
  const shared = !options.profile && options.shared !== false && process.env.STACKS_BROWSER_SHARED !== '0'
  return shared
    ? await launchShared(options, chromePath, started, timeoutMs, progress)
    : await launchDedicated(options, chromePath, started, timeoutMs, progress)
}

// ---------------------------------------------------------------------------
// Settling and navigating
// ---------------------------------------------------------------------------

export interface SettleOptions {
  /** How long the page must stay quiet. Default 1000 ms. */
  quietMs?: number
  /** Give up after this long. Default 15 s. */
  timeoutMs?: number
}

/**
 * Wait until the document has loaded and no request has been in flight for
 * `quietMs` (event streams excluded, see `Cdp`). Resolves true once settled,
 * false at the timeout (a page that never goes quiet is often the finding);
 * rejects only if Chrome goes away.
 */
export async function settle(cdp: Cdp, options: SettleOptions = {}): Promise<boolean> {
  const quietMs = options.quietMs ?? 1000
  const timeoutMs = options.timeoutMs ?? 15_000
  const started = Date.now()
  let quietSince = 0
  while (Date.now() - started < timeoutMs) {
    if (cdp.closed) throw new Error('Chrome closed the connection')
    const busy = cdp.inFlight.size > 0 || await cdp.evaluate<boolean>(`document.readyState !== 'complete'`).catch(() => true)
    if (busy) quietSince = 0
    else if (!quietSince) quietSince = Date.now()
    else if (Date.now() - quietSince >= quietMs) return true
    await Bun.sleep(100)
  }
  return false
}

/** Navigate and wait for the page to settle. Resolves with whether it settled. */
export async function navigate(cdp: Cdp, url: string, options: SettleOptions = {}): Promise<boolean> {
  const result = await cdp.send('Page.navigate', { url })
  if (result?.errorText) throw new Error(`Could not open ${url}: ${result.errorText}`)
  return await settle(cdp, options)
}

// ---------------------------------------------------------------------------
// Page audit
// ---------------------------------------------------------------------------

export interface PageAuditOptions extends SettleOptions {
  /** Use this session instead of launching Chrome (it is left open). */
  cdp?: Cdp
  /** Options for the Chrome `auditPage` launches when no `cdp` is given. */
  launch?: LaunchOptions
  /** Viewport for this page; default the launch's. */
  viewport?: Viewport
  /**
   * Which same-origin requests count as API calls for duplicate detection.
   * Default: paths under `/api/`, excluding event streams (paths ending in
   * `/events`).
   */
  isApiRequest?: (url: URL, method: string) => boolean
  /** Run before navigating: sign in, seed storage (`Page.addScriptToEvaluateOnNewDocument`), block a URL. */
  beforeNavigate?: (cdp: Cdp) => Promise<void> | void
  /**
   * What counts as one page load when looking for duplicates.
   *
   * - `'navigation'` (default): a page that sends you on is two loads. A new
   *   load starts with each new main-frame document after the first, and with
   *   each same-document (history API) navigation to a different path, which
   *   is how a client-side router moves (`/today` replacing itself with
   *   `/home`). A query or hash change stays in the same load.
   * - `'visit'`: the whole visit is one load, however often the page moved.
   */
  pageLoads?: 'navigation' | 'visit'
}

/** The requests one page load made. */
export interface PageLoad {
  /** Where this load was (its last URL, when it changed only its query or hash). */
  url: string
  /** API calls made during this load, as `METHOD /path?query`, in order. */
  apiRequests: string[]
  /** The API calls this load made more than once. */
  duplicates: Record<string, number>
}

export interface PageAuditReport {
  url: string
  /**
   * Where the page ended up (`location.href` once it settled): differs from
   * `url` when it redirected, on the server or in the client. Absent only on
   * reports built before this field existed.
   */
  finalUrl?: string
  /** API calls the page made, as `METHOD /path?query`, in order, over every load. */
  apiRequests: string[]
  /**
   * The API calls made more than once within one page load, with the highest
   * count any load reached. A request repeated only because the page moved on
   * (see `PageAuditOptions.pageLoads`) is not a duplicate.
   */
  duplicates: Record<string, number>
  /** Each page load in order: one, unless the page sent you on. */
  loads?: PageLoad[]
  /** Same-origin responses with status 400 or above, as `STATUS /path`. */
  failed: string[]
  /** `cdp.errors` raised while the page loaded. */
  errors: string[]
  /** The page went quiet before the timeout. */
  settled: boolean
  durationMs: number
}

const defaultIsApi = (url: URL): boolean => url.pathname.startsWith('/api/') && !url.pathname.endsWith('/events')

/** Count how often each entry appears, keeping those seen more than once. */
export function duplicateRequests(requests: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const request of requests) counts[request] = (counts[request] || 0) + 1
  return Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 1))
}

/** What happened during a visit, in order, for `splitPageLoads`. */
export type PageAuditEvent =
  | { type: 'request', request: string }
  /** `sameDocument`: a history API or fragment navigation (`Page.navigatedWithinDocument`), not a new document. */
  | { type: 'navigated', url: string, sameDocument: boolean }

function pathOf(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.origin}${parsed.pathname}`
  }
  catch {
    return url.replace(/[?#].*$/, '')
  }
}

/**
 * Split a visit's requests into page loads (see `PageAuditOptions.pageLoads`).
 * The first new document is the page itself; each later one, and each
 * same-document navigation to another path, starts the next load.
 */
export function splitPageLoads(url: string, events: readonly PageAuditEvent[], mode: 'navigation' | 'visit' = 'navigation'): PageLoad[] {
  const loads: Array<{ url: string, apiRequests: string[] }> = [{ url, apiRequests: [] }]
  let committed = false
  for (const event of events) {
    const current = loads.at(-1)!
    if (event.type === 'request') {
      current.apiRequests.push(event.request)
      continue
    }
    const opensLoad = mode === 'navigation' && committed
      && (event.sameDocument ? pathOf(event.url) !== pathOf(current.url) : true)
    committed = true
    if (opensLoad) loads.push({ url: event.url, apiRequests: [] })
    else current.url = event.url
  }
  return loads.map(load => ({ ...load, duplicates: duplicateRequests(load.apiRequests) }))
}

/** The highest count each request reached in any one load. */
export function loadDuplicates(loads: readonly PageLoad[]): Record<string, number> {
  const duplicates: Record<string, number> = {}
  for (const load of loads) {
    for (const [request, count] of Object.entries(load.duplicates))
      duplicates[request] = Math.max(duplicates[request] ?? 0, count)
  }
  return duplicates
}

/**
 * Load `url` once and report what it cost and what went wrong: the same API
 * request made more than once in one page load, failed same-origin requests,
 * and console errors, and where the page landed. A page that sends you on
 * (`/today` to `/home`) is counted as two loads (`pageLoads`). Never throws
 * for a page problem: a launch or navigation failure is reported in `errors`.
 *
 * @example
 * const report = await auditPage('http://localhost:3000/dashboard', {
 *   beforeNavigate: cdp => cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('token', ${JSON.stringify(token)})` }),
 * })
 * expect(report.duplicates).toEqual({})
 * expect(report.failed).toEqual([])
 */
export async function auditPage(url: string, options: PageAuditOptions = {}): Promise<PageAuditReport> {
  const started = Date.now()
  const origin = new URL(url).origin
  const isApi = options.isApiRequest ?? defaultIsApi
  const apiRequests: string[] = []
  const events: PageAuditEvent[] = []
  const failed: string[] = []
  let launched: LaunchedChrome | null = null
  let cdp = options.cdp
  const removers: Array<() => void> = []
  const errorsBefore = cdp?.errors.length ?? 0
  let mainFrame: string | undefined
  let lastUrl = url

  const finish = async (settled: boolean, extraErrors: string[] = []): Promise<PageAuditReport> => {
    const loads = splitPageLoads(url, events, options.pageLoads)
    let finalUrl = lastUrl
    if (cdp && !cdp.closed) {
      const here = await cdp.evaluate<string>('location.href').catch(() => null)
      // A failed navigation leaves Chrome's own error page, which is nowhere.
      if (here && here !== 'about:blank' && !here.startsWith('chrome-error:')) finalUrl = here
    }
    return {
      url,
      finalUrl,
      apiRequests,
      duplicates: loadDuplicates(loads),
      loads,
      failed,
      errors: [...(cdp?.errors.slice(errorsBefore) ?? []), ...extraErrors],
      settled,
      durationMs: Date.now() - started,
    }
  }

  try {
    if (!cdp) {
      launched = await launch(options.launch)
      cdp = launched.cdp
    }
    const session = cdp
    removers.push(session.on('Network.requestWillBeSent', (params) => {
      const request = new URL(params.request.url)
      if (request.origin === origin && isApi(request, params.request.method)) {
        const entry = `${params.request.method} ${request.pathname}${request.search}`
        apiRequests.push(entry)
        events.push({ type: 'request', request: entry })
      }
    }))
    removers.push(session.on('Network.responseReceived', (params) => {
      const response = new URL(params.response.url)
      if (response.origin === origin && params.response.status >= 400)
        failed.push(`${params.response.status} ${response.pathname}`)
    }))
    removers.push(session.on('Page.frameNavigated', (params) => {
      if (params.frame?.parentId) return
      mainFrame = params.frame?.id ?? mainFrame
      // A page that failed to load commits Chrome's error page; `unreachableUrl` is the one asked for.
      lastUrl = params.frame?.unreachableUrl || `${params.frame?.url ?? lastUrl}${params.frame?.urlFragment ?? ''}`
      events.push({ type: 'navigated', url: lastUrl, sameDocument: false })
    }))
    removers.push(session.on('Page.navigatedWithinDocument', (params) => {
      if (mainFrame && params.frameId !== mainFrame) return
      lastUrl = params.url
      events.push({ type: 'navigated', url: params.url, sameDocument: true })
    }))
    // For the navigation events (`launch()` has it on; a caller's session may not).
    await session.send('Page.enable')
    mainFrame = (await session.send('Page.getFrameTree').catch(() => null))?.frameTree?.frame?.id
    if (options.viewport)
      await session.send('Emulation.setDeviceMetricsOverride', { deviceScaleFactor: 1, mobile: false, ...options.viewport })
    await options.beforeNavigate?.(session)
    const settled = await navigate(session, url, options)
    return await finish(settled)
  }
  catch (error) {
    return await finish(false, [`audit: ${(error as Error)?.message ?? String(error)}`])
  }
  finally {
    for (const remove of removers) remove()
    await launched?.close().catch(() => {})
  }
}

/** The path and query of a URL, or the text itself when it is not one. */
function shortUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}`
  }
  catch {
    return url
  }
}

/** One line per page: `/today -> /home: 12 api | dup 2x GET /api/me | failed 404 /api/x | errors ...`. */
export function formatPageAudit(report: PageAuditReport): string {
  const path = shortUrl(report.url)
  const landed = report.finalUrl ? shortUrl(report.finalUrl) : path
  const dup = Object.entries(report.duplicates).map(([request, count]) => `${count}x ${request}`)
  return `${path}${landed !== path ? ` -> ${landed}` : ''}: ${report.apiRequests.length} api`
    + `${dup.length ? ` | dup ${dup.join(', ')}` : ''}`
    + `${report.failed.length ? ` | failed ${report.failed.join(', ')}` : ''}`
    + `${report.errors.length ? ` | errors ${report.errors.slice(0, 3).join(' ; ')}` : ''}`
    + `${report.settled ? '' : ' | never settled'}`
}

/** True when the report found nothing: no duplicates, failures or errors, and the page settled. */
export function pageAuditClean(report: PageAuditReport): boolean {
  return report.settled && !Object.keys(report.duplicates).length && !report.failed.length && !report.errors.length
}
