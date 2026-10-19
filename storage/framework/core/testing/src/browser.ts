/**
 * Headless Chrome over the DevTools Protocol, for browser tests and audits.
 *
 * No browser package: the Chrome already on the machine and Bun's own
 * WebSocket client. `launch()` starts a private headless Chrome and returns a
 * `Cdp` session on its page; `auditPage()` loads one URL and reports the
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
 * cp -cR "/Applications/Google Chrome.app" /tmp/chrome/Chrome.app
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
export async function waitFor<T>(read: () => Promise<T> | T, timeoutMs = 12_000, options: { intervalMs?: number, label?: string } = {}): Promise<NonNullable<T>> {
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
 *
 * Enable the `Network`, `Runtime` and `Log` domains for those to fill;
 * `launch()` does.
 */
export class Cdp {
  private id = 0
  private pending = new Map<number, Pending>()
  private listeners = new Map<string, Set<Listener>>()
  private readonly commandTimeoutMs: number

  /** What went wrong on the page, in order. */
  errors: string[] = []
  /** Requests still loading: request id to `METHOD url`. */
  inFlight = new Map<string, string>()
  /** Chrome went away; every later command fails at once. */
  closed = false

  constructor(private socket: WebSocket, options: CdpOptions = {}) {
    this.commandTimeoutMs = options.commandTimeoutMs ?? 30_000
    // Fail what is waiting at once rather than after each command's timeout.
    socket.addEventListener('close', () => this.markClosed())
    socket.addEventListener('message', event => this.receive(String(event.data)))
  }

  private markClosed(): void {
    this.closed = true
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
    for (const listener of [...(this.listeners.get(message.method) ?? [])]) {
      try {
        listener(message.params ?? {})
      }
      catch (error) {
        this.errors.push(`Listener for ${message.method} threw: ${(error as Error)?.message ?? String(error)}`)
      }
    }
  }

  private track(method: string, params: any): void {
    if (method === 'Network.requestWillBeSent')
      this.inFlight.set(params.requestId, `${params.request?.method} ${params.request?.url}`)
    else if (method === 'Network.loadingFinished' || method === 'Network.loadingFailed')
      this.inFlight.delete(params.requestId)
    else if (method === 'Network.responseReceived' && params.response?.mimeType === 'text/event-stream')
      this.inFlight.delete(params.requestId)

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
  once<T = any>(method: string, match: (params: T) => boolean = () => true, timeoutMs = this.commandTimeoutMs): Promise<T> {
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

  /** Send a command and resolve with its result. */
  send<T = any>(method: string, params: Record<string, unknown> = {}): Promise<T> {
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
    run(['cp', '-cR', sourceApp, staged], 'Cloning Chrome')
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
  /** Deadline for process startup, target discovery and session setup. Default 30 s. */
  startTimeoutMs?: number
}

export interface ChromeLaunchDiagnostics {
  pid: number | null
  chromePath: string
  profile: string
  temporaryProfile: boolean
  elapsedMs: number
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
  /** Stop Chrome and remove a temporary profile. Safe to call twice. */
  close: () => Promise<void>
  /** The page's DevTools WebSocket URL, to connect a second session. */
  target: string
  /** The DevTools HTTP port. */
  port: number
  /** The executable that was started. */
  chromePath: string
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

/**
 * Start a private headless Chrome and open a session on its page, with the
 * `Page`, `Runtime`, `Network` and `Log` domains enabled.
 */
export async function launch(options: LaunchOptions = {}): Promise<LaunchedChrome> {
  const timeoutMs = options.startTimeoutMs ?? 30_000
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('startTimeoutMs must be positive and finite')
  const chromePath = resolveChrome(options)
  const started = Date.now()
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
      throw new ChromeLaunchError(error, { pid: null, chromePath, profile, temporaryProfile: !options.profile, elapsedMs: Date.now() - started, exitCodeBeforeCleanup: null, signalCodeBeforeCleanup: null, exitCode: null, signalCode: null, portFileExisted: false, portFileContents: null, stderrTail: '', stderrTruncated: false, cleanupError })
    }
  })()

  let stderrTail = ''
  let stderrTruncated = false
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let stderrDone: Promise<void> = Promise.resolve()

  let cdp: Cdp | undefined
  let closing: Promise<void> | undefined
  const close = (): Promise<void> => closing ??= (async () => {
    cdp?.disconnect()
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
  const remaining = () => {
    const value = timeoutMs - (Date.now() - started)
    if (value <= 0) throw new Error(`Timed out after ${timeoutMs}ms starting Chrome`)
    if (chrome.exitCode !== null || chrome.signalCode !== null) throw new Error('Chrome exited during startup')
    return value
  }
  const startupTimer = setTimeout(() => cdp?.disconnect(), Math.max(1, timeoutMs - (Date.now() - started)))

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
    await waitFor(() => { remaining(); return portEvidence(portFile)?.includes('\n') }, remaining(), { label: 'Chrome to start' })
    const port = Number(portEvidence(portFile)?.split('\n')[0])
    if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('Chrome wrote an invalid DevToolsActivePort')
    const targets = await waitFor(async () => {
      const list = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(Math.min(1_000, remaining())) }).then(response => response.json()).catch(() => [])
      return Array.isArray(list) && list.length ? list : null
    }, Math.min(12_000, remaining()), { label: 'a page target' })
    const page = targets.find(target => target.type === 'page' && target.url === 'about:blank') || targets.find(target => target.type === 'page')
    if (!page) throw new Error('Chrome did not expose a page target')
    cdp = await connect(page.webSocketDebuggerUrl, { ...options, connectTimeoutMs: Math.min(options.connectTimeoutMs ?? 30_000, remaining()) })
    remaining()
    const session = cdp

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

    const quiet = options.quietLiveReload === false ? [] : options.quietLiveReload ?? ['*/_stx/hmr*']
    if (quiet.length) {
      session.on('Fetch.requestPaused', (params) => {
        session.send('Fetch.fulfillRequest', {
          requestId: params.requestId,
          responseCode: 200,
          responseHeaders: [{ name: 'Content-Type', value: 'text/event-stream' }],
          body: Buffer.from('retry: 86400000\n\n').toString('base64'),
        }).catch(() => {})
      })
      await session.send('Fetch.enable', { patterns: quiet.map(urlPattern => ({ urlPattern })) })
    }

    if (options.acceptDialogs !== false) {
      session.on('Page.javascriptDialogOpening', (params) => {
        session.errors.push(`Dialog (${params.type}) on ${params.url}: ${params.message || '(no message)'}`)
        session.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {})
      })
    }

    remaining()
    clearTimeout(startupTimer)
    return { cdp: session, close, target: page.webSocketDebuggerUrl, port, chromePath }
  }
  catch (error) {
    clearTimeout(startupTimer)
    const elapsedMs = Date.now() - started
    const exitCodeBeforeCleanup = chrome.exitCode
    const signalCodeBeforeCleanup = chrome.signalCode
    const portFileExisted = existsSync(portFile)
    const portFileContents = portEvidence(portFile)
    let cleanupError: string | null = null
    try { await close() }
    catch (failure) { cleanupError = failure instanceof Error ? failure.message : String(failure) }
    throw new ChromeLaunchError(error, { pid: chrome.pid, chromePath, profile, temporaryProfile: !options.profile, elapsedMs, exitCodeBeforeCleanup, signalCodeBeforeCleanup, exitCode: chrome.exitCode, signalCode: chrome.signalCode, portFileExisted, portFileContents, stderrTail, stderrTruncated, cleanupError })
  }
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
}

export interface PageAuditReport {
  url: string
  /** API calls the page made, as `METHOD /path?query`, in order. */
  apiRequests: string[]
  /** The API calls made more than once, with how many times. */
  duplicates: Record<string, number>
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

/**
 * Load `url` once and report what it cost and what went wrong: the same API
 * request made more than once in one load, failed same-origin requests, and
 * console errors. Never throws for a page problem: a launch or navigation
 * failure is reported in `errors`.
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
  const failed: string[] = []
  let launched: LaunchedChrome | null = null
  let cdp = options.cdp
  const removers: Array<() => void> = []
  const errorsBefore = cdp?.errors.length ?? 0
  try {
    if (!cdp) {
      launched = await launch(options.launch)
      cdp = launched.cdp
    }
    const session = cdp
    removers.push(session.on('Network.requestWillBeSent', (params) => {
      const request = new URL(params.request.url)
      if (request.origin === origin && isApi(request, params.request.method))
        apiRequests.push(`${params.request.method} ${request.pathname}${request.search}`)
    }))
    removers.push(session.on('Network.responseReceived', (params) => {
      const response = new URL(params.response.url)
      if (response.origin === origin && params.response.status >= 400)
        failed.push(`${params.response.status} ${response.pathname}`)
    }))
    if (options.viewport)
      await session.send('Emulation.setDeviceMetricsOverride', { deviceScaleFactor: 1, mobile: false, ...options.viewport })
    await options.beforeNavigate?.(session)
    const settled = await navigate(session, url, options)
    return { url, apiRequests, duplicates: duplicateRequests(apiRequests), failed, errors: session.errors.slice(errorsBefore), settled, durationMs: Date.now() - started }
  }
  catch (error) {
    return {
      url,
      apiRequests,
      duplicates: duplicateRequests(apiRequests),
      failed,
      errors: [...(cdp?.errors.slice(errorsBefore) ?? []), `audit: ${(error as Error)?.message ?? String(error)}`],
      settled: false,
      durationMs: Date.now() - started,
    }
  }
  finally {
    for (const remove of removers) remove()
    await launched?.close().catch(() => {})
  }
}

/** One line per page: `/path: 12 api | dup 2x GET /api/me | failed 404 /api/x | errors ...`. */
export function formatPageAudit(report: PageAuditReport): string {
  let path = report.url
  try {
    const parsed = new URL(report.url)
    path = `${parsed.pathname}${parsed.search}`
  }
  catch {}
  const dup = Object.entries(report.duplicates).map(([request, count]) => `${count}x ${request}`)
  return `${path}: ${report.apiRequests.length} api`
    + `${dup.length ? ` | dup ${dup.join(', ')}` : ''}`
    + `${report.failed.length ? ` | failed ${report.failed.join(', ')}` : ''}`
    + `${report.errors.length ? ` | errors ${report.errors.slice(0, 3).join(' ; ')}` : ''}`
    + `${report.settled ? '' : ' | never settled'}`
}

/** True when the report found nothing: no duplicates, failures or errors, and the page settled. */
export function pageAuditClean(report: PageAuditReport): boolean {
  return report.settled && !Object.keys(report.duplicates).length && !report.failed.length && !report.errors.length
}
