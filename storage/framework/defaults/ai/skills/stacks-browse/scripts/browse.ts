#!/usr/bin/env bun
/**
 * Dependency-free headless browser driver for the /stacks-browse QA skill.
 *
 * No Playwright, no Puppeteer, no npm packages. It launches a Chromium-family
 * browser already on the machine and drives it over the Chrome DevTools
 * Protocol using only Bun's native `Bun.spawn`, `fetch`, and `WebSocket`.
 *
 * Commands:
 *   bun browse.ts navigate   <url>
 *   bun browse.ts screenshot <url> [--viewport WxH] [--full] [--element SEL] [--scale N] [--out PATH]
 *   bun browse.ts responsive <url> [--out-dir DIR]
 *   bun browse.ts monitor    <url> [--ms 5000]
 *   bun browse.ts snapshot   <url>
 *   bun browse.ts scenario   <url> --step '{"action":"click","selector":"button"}'
 *   bun browse.ts crawl      <url> [--viewport 1280x900] [--max 500] [--path /extra] [--progress]
 *
 * Browser discovery order: $BROWSE_BROWSER → PATH (chromium, google-chrome, …)
 * → common macOS app bundles → a Playwright-cached chromium as last resort.
 */

import { spawn } from 'bun'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// ── Browser discovery ──────────────────────────────────────────────────────

function which(bin: string): string | null {
  try {
    const r = Bun.spawnSync(['which', bin])
    const out = r.stdout.toString().trim()
    return out && existsSync(out) ? out : null
  }
  catch {
    return null
  }
}

/** Ordered list of candidate browser binaries — validated lazily at launch. */
function collectCandidates(): string[] {
  const out: string[] = []
  const add = (p: string | null) => { if (p && existsSync(p) && !out.includes(p)) out.push(p) }

  if (process.env.BROWSE_BROWSER)
    add(process.env.BROWSE_BROWSER)

  for (const bin of ['chromium', 'chromium-browser', 'google-chrome-stable', 'google-chrome', 'brave-browser', 'microsoft-edge', 'chrome'])
    add(which(bin))

  for (const p of [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  ]) add(p)

  // Last resort: a Chromium that Playwright may have cached. We only borrow the
  // binary — we never import or require Playwright itself.
  const cacheRoot = join(process.env.HOME || '', 'Library/Caches/ms-playwright')
  if (existsSync(cacheRoot)) {
    try {
      const hit = Bun.spawnSync(['find', cacheRoot, '-maxdepth', '3', '-name', 'chrome-headless-shell', '-o', '-maxdepth', '3', '-name', 'Chromium'])
      for (const p of hit.stdout.toString().trim().split('\n').filter(Boolean)) add(p)
    }
    catch { /* ignore */ }
  }

  if (!out.length)
    throw new Error('No Chromium-family browser found. Install one (e.g. `brew install --cask chromium`) or set BROWSE_BROWSER=/path/to/chrome.')
  return out
}

/** A candidate is usable only if it actually runs — `--version` weeds out dead
 *  wrappers (e.g. a Homebrew shim pointing at an uninstalled .app). */
function runs(bin: string): boolean {
  try {
    const r = Bun.spawnSync([bin, '--version'], { stdout: 'pipe', stderr: 'pipe' })
    return r.exitCode === 0 && r.stdout.toString().trim().length > 0
  }
  catch {
    return false
  }
}

// ── Minimal CDP client over Bun's native WebSocket ──────────────────────────

interface CdpEvent { method: string, params: any }

class Cdp {
  private ws: WebSocket
  private id = 0
  // `_v` / `_e` are parameter names in a type position, never bound to anything.
  private pending = new Map<number, { resolve: (_v: any) => void, reject: (_e: any) => void }>()
  private listeners: ((_e: CdpEvent) => void)[] = []

  private constructor(ws: WebSocket) {
    this.ws = ws
    const rejectPending = (message: string): void => {
      const error = new Error(message)
      for (const pending of this.pending.values())
        pending.reject(error)
      this.pending.clear()
    }
    ws.addEventListener('message', (ev: any) => {
      const msg = JSON.parse(ev.data)
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)!
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
      }
      else if (msg.method) {
        for (const l of this.listeners) l({ method: msg.method, params: msg.params })
      }
    })
    ws.addEventListener('close', () => rejectPending('CDP connection closed'))
    ws.addEventListener('error', () => rejectPending('CDP connection failed'))
  }

  static connect(wsUrl: string, timeoutMs = 10_000): Promise<Cdp> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl)
      const t = setTimeout(() => reject(new Error('CDP connect timeout')), timeoutMs)
      ws.addEventListener('open', () => { clearTimeout(t); resolve(new Cdp(ws)) })
      ws.addEventListener('error', e => { clearTimeout(t); reject(e) })
    })
  }

  send(method: string, params: Record<string, any> = {}): Promise<any> {
    if (this.ws.readyState !== WebSocket.OPEN)
      return Promise.reject(new Error('CDP connection is not open'))

    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  on(fn: (e: CdpEvent) => void): () => void {
    this.listeners.push(fn)
    return () => {
      const index = this.listeners.indexOf(fn)
      if (index !== -1)
        this.listeners.splice(index, 1)
    }
  }

  waitFor(method: string, predicate: (p: any) => boolean = () => true, timeoutMs = 15_000): Promise<any> {
    return new Promise((resolve, reject) => {
      let unsubscribe = () => {}
      const t = setTimeout(() => {
        unsubscribe()
        reject(new Error(`Timed out waiting for ${method}`))
      }, timeoutMs)
      unsubscribe = this.on(e => {
        if (e.method === method && predicate(e.params)) {
          clearTimeout(t)
          unsubscribe()
          resolve(e.params)
        }
      })
    })
  }

  close(): void {
    try { this.ws.close() }
    catch { /* ignore */ }
  }
}

// ── Browser lifecycle ───────────────────────────────────────────────────────

interface Session { proc: ReturnType<typeof spawn>, port: number, userDataDir: string, browser: string }

async function tryLaunch(browser: string): Promise<Session | null> {
  const userDataDir = join(tmpdir(), `stacks-browse-${process.pid}-${Math.floor(Number(process.hrtime.bigint() % 1000000n))}`)
  mkdirSync(userDataDir, { recursive: true })

  const isHeadlessShell = /chrome-headless-shell|headless_shell/.test(browser)
  const proc = spawn([
    browser,
    ...(isHeadlessShell ? [] : ['--headless=new']),
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--mute-audio',
    '--force-color-profile=srgb',
    'about:blank',
  ], { stdout: 'ignore', stderr: 'ignore' })

  // Chromium writes the chosen port to <user-data-dir>/DevToolsActivePort.
  const portFile = join(userDataDir, 'DevToolsActivePort')
  for (let i = 0; i < 80; i++) {
    if (existsSync(portFile)) {
      const line = readFileSync(portFile, 'utf8').split('\n')[0]?.trim()
      if (line)
        return { proc, port: Number(line), userDataDir, browser }
    }
    await Bun.sleep(50)
  }
  try { proc.kill() }
  catch { /* ignore */ }
  return null
}

async function launch(): Promise<Session> {
  const tried: string[] = []
  for (const browser of collectCandidates()) {
    if (!runs(browser)) { tried.push(`${browser} (won't run)`); continue }
    const s = await tryLaunch(browser)
    if (s)
      return s
    tried.push(`${browser} (no DevTools port)`)
  }
  throw new Error(`Could not launch any browser. Tried:\n  ${tried.join('\n  ')}\nSet BROWSE_BROWSER=/path/to/chrome to override.`)
}

async function openPage(port: number): Promise<Cdp> {
  // Reuse the current page when it exists. A renderer can terminate its target
  // after a long crawl even while Chromium itself remains healthy, so create a
  // replacement target through CDP's HTTP endpoint when the list is empty.
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() as any[]
      const page = list.find(t => t.type === 'page')
      if (page?.webSocketDebuggerUrl)
        return Cdp.connect(page.webSocketDebuggerUrl)

      const created = await (await fetch(
        `http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`,
        { method: 'PUT' },
      )).json() as any
      if (created?.webSocketDebuggerUrl)
        return Cdp.connect(created.webSocketDebuggerUrl)
    }
    catch { /* not ready yet */ }
    await Bun.sleep(50)
  }
  throw new Error('Could not find a page target to attach to.')
}

interface BrowserPage {
  cdp: Cdp
  targetId: string
}

async function createPage(port: number): Promise<BrowserPage> {
  const created = await (await fetch(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`,
    { method: 'PUT' },
  )).json() as any
  if (!created?.id || !created?.webSocketDebuggerUrl)
    throw new Error('Could not create an isolated page target.')

  return {
    cdp: await Cdp.connect(created.webSocketDebuggerUrl),
    targetId: created.id,
  }
}

async function closePage(port: number, page: BrowserPage): Promise<void> {
  page.cdp.close()
  try {
    await fetch(`http://127.0.0.1:${port}/json/close/${encodeURIComponent(page.targetId)}`)
  }
  catch { /* the target or browser may already have closed */ }
}

function kill(s: Session): void {
  try { s.proc.kill() }
  catch { /* ignore */ }
}

// ── Page helpers ────────────────────────────────────────────────────────────

interface PageState {
  consoleErrors: string[]
  console: string[]
  dispose: () => void
  responses: { url: string, status: number, ms: number, type: string }[]
  mainStatus: number | null
}

async function gotoAndInstrument(cdp: Cdp, url: string, opts: { viewport?: { w: number, h: number }, scale?: number, timeoutMs?: number, cookies?: string[], settleMs?: number, scheme?: string } = {}): Promise<PageState> {
  let unsubscribe = () => {}
  const state: PageState = {
    consoleErrors: [],
    console: [],
    dispose: () => unsubscribe(),
    responses: [],
    mainStatus: null,
  }
  const startById = new Map<string, number>()

  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Log.enable')
  await cdp.send('Network.enable')

  // Pre-seed cookies (e.g. maintenance/coming-soon bypass tokens) so gated
  // pages can be QA'd headlessly. Each entry is a `name=value` pair scoped
  // to the target origin.
  if (opts.cookies?.length) {
    const origin = new URL(url)
    for (const entry of opts.cookies) {
      const eq = entry.indexOf('=')
      if (eq === -1) continue
      await cdp.send('Network.setCookie', {
        name: entry.slice(0, eq).trim(),
        value: entry.slice(eq + 1).trim(),
        domain: origin.hostname,
        path: '/',
      })
    }
  }

  if (opts.viewport) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: opts.viewport.w,
      height: opts.viewport.h,
      deviceScaleFactor: opts.scale ?? 1,
      mobile: opts.viewport.w < 600,
    })
  }

  // Emulate light/dark so prefers-color-scheme pages can be QA'd in both
  // schemes without flipping the host OS setting.
  if (opts.scheme === 'light' || opts.scheme === 'dark') {
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: opts.scheme }],
    })
  }

  unsubscribe = cdp.on((e) => {
    if (e.method === 'Runtime.consoleAPICalled') {
      const text = (e.params.args || []).map((a: any) => a.value ?? a.description ?? a.type).join(' ')
      state.console.push(`[${e.params.type}] ${text}`)
      if (e.params.type === 'error') state.consoleErrors.push(text)
    }
    else if (e.method === 'Runtime.exceptionThrown') {
      const d = e.params.exceptionDetails
      state.consoleErrors.push(d?.exception?.description || d?.text || 'Uncaught exception')
    }
    else if (e.method === 'Log.entryAdded' && e.params.entry?.level === 'error') {
      state.consoleErrors.push(e.params.entry.text)
    }
    else if (e.method === 'Network.requestWillBeSent') {
      startById.set(e.params.requestId, e.params.timestamp * 1000)
    }
    else if (e.method === 'Network.responseReceived') {
      const r = e.params.response
      const started = startById.get(e.params.requestId) ?? (r.timing?.requestTime ?? 0) * 1000
      const ms = started ? Math.max(0, Math.round(e.params.timestamp * 1000 - started)) : 0
      state.responses.push({ url: r.url, status: r.status, ms, type: e.params.type })
      if (e.params.type === 'Document' && state.mainStatus == null)
        state.mainStatus = r.status
    }
  })

  await cdp.send('Page.navigate', { url })
  try { await cdp.waitFor('Page.loadEventFired', () => true, opts.timeoutMs ?? 15_000) }
  catch { /* SSE/long-poll pages may never fire load; proceed after a settle */ }
  // Settle after load so load-triggered entrance animations finish before a
  // screenshot; pages with longer motion pass --settle to stretch it.
  await Bun.sleep(opts.settleMs ?? 700)
  return state
}

async function title(cdp: Cdp): Promise<string> {
  const r = await cdp.send('Runtime.evaluate', { expression: 'document.title', returnByValue: true })
  return r.result?.value ?? ''
}

async function captureScreenshot(cdp: Cdp, opts: { full?: boolean, element?: string } = {}): Promise<Buffer> {
  let clip: any
  let captureBeyondViewport = false

  if (opts.element) {
    const r = await cdp.send('Runtime.evaluate', {
      expression: `(() => { const el = document.querySelector(${JSON.stringify(opts.element)}); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x + scrollX, y: b.y + scrollY, width: b.width, height: b.height }; })()`,
      returnByValue: true,
    })
    if (!r.result?.value)
      throw new Error(`Element not found: ${opts.element}`)
    clip = { ...r.result.value, scale: 1 }
    captureBeyondViewport = true
  }
  else if (opts.full) {
    const m = await cdp.send('Page.getLayoutMetrics')
    const size = m.cssContentSize || m.contentSize
    clip = { x: 0, y: 0, width: Math.ceil(size.width), height: Math.ceil(size.height), scale: 1 }
    captureBeyondViewport = true
  }

  const r = await cdp.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip, captureBeyondViewport } : {}) })
  return Buffer.from(r.data, 'base64')
}

interface CrawlPage {
  consoleErrors: string[]
  failedRequests: Array<{ status: number, url: string }>
  horizontalOverflowPx: number
  layout: {
    bodyScrollWidth: number
    documentScrollWidth: number
    mainClientWidth: number | null
    mainOverflowX: string | null
    mainScrollWidth: number | null
    viewportWidth: number
  }
  overflowingElements: Array<{
    element: string
    left: number
    right: number
    width: number
    overflowContainer?: {
      element: string
      left: number
      right: number
      clientWidth: number
      scrollWidth: number
      overflowX: string
    }
  }>
  path: string
  status: number | null
  title: string
}

function crawlTarget(candidate: string, origin: string): string | null {
  try {
    const url = new URL(candidate, origin)
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol))
      return null

    url.hash = ''
    return url.href
  }
  catch {
    return null
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function parseFlags(args: string[]): { positional: string[], flags: Record<string, string | boolean | Array<string | boolean>> } {
  const positional: string[] = []
  const flags: Record<string, string | boolean | Array<string | boolean>> = {}
  for (let i = 0; i < args.length; i++) {
    const a = args.at(i)
    if (a === undefined)
      break

    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = args[i + 1]
      const value: string | boolean = (next && !next.startsWith('--')) ? next : true
      if (typeof value === 'string') i++
      // Repeated flags (--cookie a=1 --cookie b=2) collect into an array.
      if (key in flags) {
        const prev = flags[key]
        flags[key] = Array.isArray(prev) ? [...prev, value] : [prev as string | boolean, value]
      }
      else {
        flags[key] = value
      }
    }
    else { positional.push(a) }
  }
  return { positional, flags }
}

/** Normalize a (possibly repeated) flag into a flat string list. */
function flagList(value: string | boolean | Array<string | boolean> | undefined): string[] {
  if (value == null || value === false) return []
  const arr = Array.isArray(value) ? value : [value]
  return arr.filter((v): v is string => typeof v === 'string')
}

function parseViewport(value: string | undefined): { w: number, h: number } {
  if (!value)
    return { w: 1280, h: 900 }

  const dimensions = value.split('x')
  const w = Number(dimensions[0])
  const h = Number(dimensions[1])

  if (dimensions.length !== 2 || !Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1)
    throw new TypeError(`Invalid viewport "${value}". Expected WIDTHxHEIGHT, for example 1280x900.`)

  return { w, h }
}

type ScenarioAction = 'assert' | 'click' | 'fill' | 'focus' | 'press' | 'wait'

interface ScenarioStep {
  action: ScenarioAction
  selector?: string
  text?: string
  absent?: boolean
  focused?: boolean
  value?: string
  key?: string
  ms?: number
  settle?: number
}

function parseScenarioStep(value: string): ScenarioStep {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  }
  catch (error) {
    throw new TypeError(`Invalid scenario step JSON: ${value}`, { cause: error })
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new TypeError('Each scenario step must be a JSON object.')

  const step = parsed as Record<string, unknown>
  if (!['assert', 'click', 'fill', 'focus', 'press', 'wait'].includes(String(step.action)))
    throw new TypeError(`Unsupported scenario action: ${String(step.action)}`)

  const action = step.action as ScenarioAction
  if (['assert', 'click', 'fill', 'focus'].includes(action) && typeof step.selector !== 'string')
    throw new TypeError(`Scenario action "${action}" requires a selector.`)
  if (action === 'fill' && typeof step.value !== 'string')
    throw new TypeError('Scenario action "fill" requires a string value.')
  if (step.absent !== undefined && (action !== 'assert' || typeof step.absent !== 'boolean'))
    throw new TypeError('Scenario "absent" is a boolean supported only by assert actions.')
  if (step.focused !== undefined && (action !== 'assert' || typeof step.focused !== 'boolean'))
    throw new TypeError('Scenario "focused" is a boolean supported only by assert actions.')
  if (action === 'press' && typeof step.key !== 'string')
    throw new TypeError('Scenario action "press" requires a key.')
  if (action === 'wait' && (!Number.isFinite(step.ms) || Number(step.ms) < 0 || Number(step.ms) > 30_000))
    throw new TypeError('Scenario action "wait" requires ms between 0 and 30000.')

  return step as unknown as ScenarioStep
}

async function runScenarioStep(cdp: Cdp, step: ScenarioStep): Promise<Record<string, unknown>> {
  if (step.action === 'wait') {
    await Bun.sleep(Number(step.ms))
    return { action: step.action, ms: Number(step.ms), ok: true }
  }

  if (step.action === 'press') {
    const key = step.key || ''
    const keyCode = key.length === 1 ? key.charCodeAt(0) : ({ Enter: 13, Escape: 27, Tab: 9 }[key] || 0)
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: keyCode })
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: keyCode })
    return { action: step.action, key, ok: true }
  }

  const result = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const step = ${JSON.stringify(step)}
      const candidates = Array.from(document.querySelectorAll(step.selector))
      const normalizedText = (element) => (element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim()
      const element = (step.action === 'click' || step.action === 'focus' || step.action === 'assert') && step.text !== undefined
        ? candidates.find(candidate => normalizedText(candidate) === step.text)
          || candidates.find(candidate => normalizedText(candidate).includes(step.text))
        : candidates[0]
      if (!element && step.action === 'assert' && step.absent)
        return { ok: true, action: step.action, selector: step.selector, absent: true }
      if (!element)
        return { ok: false, error: 'Element not found', selector: step.selector }

      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      const visible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
      if (step.action === 'assert' && step.absent) {
        if (visible)
          return { ok: false, error: 'Expected element to be absent', selector: step.selector }
        return { ok: true, action: step.action, selector: step.selector, absent: true }
      }
      if (!visible)
        return { ok: false, error: 'Element is not visible', selector: step.selector }

      if (step.action === 'click') {
        if (element.disabled || element.getAttribute('aria-disabled') === 'true')
          return { ok: false, error: 'Element is disabled', selector: step.selector }
      }
      else if (step.action === 'focus') {
        if (typeof element.focus !== 'function')
          return { ok: false, error: 'Element cannot receive focus', selector: step.selector }
        element.focus()
        if (document.activeElement !== element)
          return { ok: false, error: 'Element did not receive focus', selector: step.selector }
      }
      else if (step.action === 'fill') {
        if (!('value' in element))
          return { ok: false, error: 'Element has no value', selector: step.selector }
        const prototype = Object.getPrototypeOf(element)
        const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
        if (setter)
          setter.call(element, step.value)
        else
          element.value = step.value
        element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: step.value }))
        element.dispatchEvent(new Event('change', { bubbles: true }))
      }
      else if (step.action === 'assert' && step.text !== undefined) {
        const content = (element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim()
        if (!content.includes(step.text))
          return { ok: false, error: 'Expected text was not found', selector: step.selector, expected: step.text, actual: content.slice(0, 240) }
      }

      if (step.action === 'assert' && step.focused !== undefined) {
        const focused = document.activeElement === element
        if (focused !== step.focused)
          return { ok: false, error: step.focused ? 'Expected element to be focused' : 'Expected element not to be focused', selector: step.selector }
      }

      return {
        ok: true,
        action: step.action,
        selector: step.selector,
        tag: element.tagName.toLowerCase(),
        text: normalizedText(element).slice(0, 160),
        clickPoint: step.action === 'click' ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : undefined,
      }
    })()`,
    returnByValue: true,
  })
  const value = result.result?.value as Record<string, unknown> | undefined
  if (!value?.ok)
    throw new Error(`Scenario ${step.action} failed: ${String(value?.error || 'unknown error')} (${step.selector || step.key || ''})`)
  if (step.action === 'click') {
    const point = value.clickPoint as { x: number, y: number }
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 })
    delete value.clickPoint
  }
  return value
}

const BREAKPOINTS = [
  { device: 'Mobile S', w: 320, h: 568 },
  { device: 'Mobile L', w: 428, h: 926 },
  { device: 'Tablet', w: 768, h: 1024 },
  { device: 'Desktop', w: 1280, h: 720 },
  { device: 'Wide', w: 1920, h: 1080 },
]

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  const { positional, flags } = parseFlags(rest)
  const url = positional[0]

  if (!command || command === 'help' || !url) {
    console.log('Usage: bun browse.ts <navigate|screenshot|responsive|monitor|snapshot|scenario|crawl> <url> [flags]')
    console.log('  --cookie "name=value"   repeatable; pre-seeds cookies (e.g. coming-soon bypass)')
    console.log('  --settle 1500           ms to wait after load before acting (default 700; stretch for entrance animations)')
    console.log('  --scheme dark           emulate prefers-color-scheme (light|dark) for QA of theme-aware pages')
    process.exit(url ? 0 : 1)
  }

  let session = await launch()
  const cookies = flagList(flags.cookie)
  const settleMs = flags.settle ? Number(flags.settle) : undefined
  const scheme = typeof flags.scheme === 'string' ? flags.scheme : undefined
  try {
    if (command === 'navigate' || command === 'go') {
      const cdp = await openPage(session.port)
      const t0 = performance.now()
      const state = await gotoAndInstrument(cdp, url, { cookies, settleMs, scheme })
      const loadMs = Math.round(performance.now() - t0)
      console.log(JSON.stringify({
        browser: session.browser,
        url,
        title: await title(cdp),
        status: state.mainStatus,
        loadMs,
        consoleErrors: state.consoleErrors,
        requests: state.responses.length,
      }, null, 2))
      state.dispose()
      cdp.close()
    }

    else if (command === 'screenshot') {
      const cdp = await openPage(session.port)
      const viewport = parseViewport(typeof flags.viewport === 'string' ? flags.viewport : undefined)
      const scale = flags.scale ? Number(flags.scale) : 1
      const out = (flags.out as string) || `storage/framework/runtime/shots/${new URL(url).pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home'}.png`
      mkdirSync(out.split('/').slice(0, -1).join('/') || '.', { recursive: true })
      const state = await gotoAndInstrument(cdp, url, { viewport, scale, cookies, settleMs, scheme })
      const png = await captureScreenshot(cdp, { full: !!flags.full, element: flags.element as string | undefined })
      await Bun.write(out, png)
      console.log(JSON.stringify({ url, out, viewport: `${viewport.w}x${viewport.h}`, scale, full: !!flags.full, element: flags.element ?? null, bytes: png.length }, null, 2))
      state.dispose()
      cdp.close()
    }

    else if (command === 'responsive') {
      const outDir = (flags['out-dir'] as string) || 'storage/framework/runtime/shots/responsive'
      mkdirSync(outDir, { recursive: true })
      const results: any[] = []
      for (const bp of BREAKPOINTS) {
        const cdp = await openPage(session.port)
        const state = await gotoAndInstrument(cdp, url, { viewport: { w: bp.w, h: bp.h }, cookies, settleMs, scheme })
        const overflow = await cdp.send('Runtime.evaluate', {
          expression: 'document.body.scrollWidth > window.innerWidth ? document.body.scrollWidth - window.innerWidth : 0',
          returnByValue: true,
        })
        const out = join(outDir, `${bp.device.toLowerCase().replace(/\s+/g, '-')}.png`)
        await Bun.write(out, await captureScreenshot(cdp, { full: true }))
        results.push({ device: bp.device, viewport: `${bp.w}x${bp.h}`, out, horizontalOverflowPx: overflow.result?.value ?? 0 })
        state.dispose()
        cdp.close()
      }
      console.log(JSON.stringify({ url, results }, null, 2))
    }

    else if (command === 'monitor') {
      const cdp = await openPage(session.port)
      const ms = flags.ms ? Number(flags.ms) : 5000
      const state = await gotoAndInstrument(cdp, url, { cookies, settleMs, scheme })
      await Bun.sleep(ms)
      const failed = state.responses.filter(r => r.status >= 400)
      const slow = state.responses.filter(r => r.ms > 3000)
      console.log(JSON.stringify({
        url,
        consoleErrors: state.consoleErrors,
        consoleMessages: state.console,
        failedRequests: failed,
        slowRequests: slow,
        totalRequests: state.responses.length,
      }, null, 2))
      state.dispose()
      cdp.close()
    }

    else if (command === 'snapshot') {
      const cdp = await openPage(session.port)
      // Captured, not discarded: the `state.dispose()` at the end of this
      // branch needs it. Without the binding that call resolved to stx's
      // auto-imported `state` signal factory, which has no `dispose`, so
      // `browse snapshot` threw on its last line and left the CDP listeners
      // attached.
      const state = await gotoAndInstrument(cdp, url, { cookies, settleMs, scheme })
      const expr = `(() => {
        const sel = (q) => Array.from(document.querySelectorAll(q));
        const txt = (e) => (e.innerText || e.textContent || '').trim().slice(0, 80);
        return {
          title: document.title,
          headings: sel('h1,h2,h3').map(h => h.tagName + ': ' + txt(h)).slice(0, 40),
          links: sel('a[href]').map(a => txt(a) + ' -> ' + a.getAttribute('href')).slice(0, 60),
          buttons: sel('button, [role=button]').map(txt).filter(Boolean).slice(0, 40),
          forms: sel('form').map(f => ({ action: f.getAttribute('action'), fields: sel.call(null, 'input,select,textarea').length })).slice(0, 10),
          landmarks: sel('[role], nav, main, header, footer, aside').map(e => e.getAttribute('role') || e.tagName.toLowerCase()).slice(0, 20),
        };
      })()`
      const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true })
      console.log(JSON.stringify({ url, ...r.result?.value }, null, 2))
      state.dispose()
      cdp.close()
    }

    else if (command === 'scenario') {
      const steps = flagList(flags.step).map(parseScenarioStep)
      if (!steps.length)
        throw new TypeError('Scenario requires at least one --step JSON object.')

      const cdp = await openPage(session.port)
      const viewport = parseViewport(typeof flags.viewport === 'string' ? flags.viewport : undefined)
      const state = await gotoAndInstrument(cdp, url, { viewport, cookies, settleMs, scheme })
      const results: Record<string, unknown>[] = []
      await cdp.send('Page.bringToFront')
      await cdp.send('Runtime.evaluate', {
        expression: `(() => {
          window.__browseFocusHistory = []
          const describe = (element) => element ? {
            tag: element.tagName?.toLowerCase() || null,
            role: element.getAttribute?.('role') || null,
            ariaLabel: element.getAttribute?.('aria-label') || null,
            text: (element.innerText || element.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
          } : null
          document.addEventListener('focusin', event => window.__browseFocusHistory.push({ event: 'focusin', target: describe(event.target) }), true)
          document.addEventListener('focusout', event => window.__browseFocusHistory.push({ event: 'focusout', target: describe(event.target), related: describe(event.relatedTarget) }), true)
        })()`,
      })

      for (const step of steps) {
        results.push(await runScenarioStep(cdp, step))
        if (step.action !== 'wait')
          await Bun.sleep(step.settle ?? 250)
      }

      const finalState = await cdp.send('Runtime.evaluate', {
        expression: `({
          url: location.href,
          title: document.title,
          focusHistory: window.__browseFocusHistory || [],
          activeElement: document.activeElement ? {
            tag: document.activeElement.tagName?.toLowerCase() || null,
            id: document.activeElement.id || null,
            role: document.activeElement.getAttribute?.('role') || null,
            ariaLabel: document.activeElement.getAttribute?.('aria-label') || null,
            ref: document.activeElement.getAttribute?.('data-stx-ref') || null,
            text: (document.activeElement.innerText || document.activeElement.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 120),
          } : null,
          bodyText: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 500),
        })`,
        returnByValue: true,
      })
      let screenshot: string | null = null
      if (typeof flags.out === 'string') {
        screenshot = flags.out
        mkdirSync(screenshot.split('/').slice(0, -1).join('/') || '.', { recursive: true })
        await Bun.write(screenshot, await captureScreenshot(cdp, { full: !!flags.full }))
      }
      const failedRequests = state.responses.filter(response => response.status >= 400)
      console.log(JSON.stringify({
        url,
        viewport: `${viewport.w}x${viewport.h}`,
        steps: results,
        final: finalState.result?.value,
        screenshot,
        consoleMessages: state.console,
        consoleErrors: state.consoleErrors,
        failedRequests,
      }, null, 2))
      if (state.consoleErrors.length || failedRequests.length)
        process.exitCode = 1
      state.dispose()
      cdp.close()
    }

    else if (command === 'crawl') {
      const start = new URL(url)
      const max = flags.max ? Number(flags.max) : 500
      const crawlViewport = parseViewport(typeof flags.viewport === 'string' ? flags.viewport : undefined)
      if (!Number.isInteger(max) || max < 1)
        throw new TypeError(`Invalid crawl max "${String(flags.max)}". Expected a positive integer.`)

      const queue = [
        start.href,
        ...flagList(flags.path)
          .map(path => crawlTarget(path, start.origin))
          .filter((path): path is string => path !== null),
      ]
      const queued = new Set(queue)
      const visited = new Set<string>()
      const pages: CrawlPage[] = []
      const crawlSettleMs = settleMs ?? 350
      let browserPage = await createPage(session.port)
      let cdp = browserPage.cdp
      const createReplacementPage = async (): Promise<BrowserPage> => {
        try {
          return await createPage(session.port)
        }
        catch {
          kill(session)
          session = await launch()
          return createPage(session.port)
        }
      }
      const replacePage = async (): Promise<void> => {
        await closePage(session.port, browserPage)
        browserPage = await createReplacementPage()
        cdp = browserPage.cdp
      }
      const inspectPage = async (current: string): Promise<{
        state: PageState
        value: {
          links?: string[]
          overflow?: number
          overflowing?: CrawlPage['overflowingElements']
          layout?: CrawlPage['layout']
          title?: string
        }
      }> => {
        let lastError: unknown
        for (let attempt = 0; attempt < 2; attempt++) {
          let state: PageState | undefined
          try {
            state = await gotoAndInstrument(cdp, current, {
              cookies,
              settleMs: crawlSettleMs,
              scheme,
              viewport: crawlViewport,
            })
            const inspection = await cdp.send('Runtime.evaluate', {
              expression: `(() => ({
              title: document.title,
              links: Array.from(document.querySelectorAll('a[href]')).map(link => link.href),
              overflow: Math.max(0, document.body.scrollWidth - window.innerWidth),
              layout: (() => {
                const main = document.querySelector('[data-stx-content]')
                return {
                  bodyScrollWidth: document.body.scrollWidth,
                  documentScrollWidth: document.documentElement.scrollWidth,
                  mainClientWidth: main?.clientWidth ?? null,
                  mainOverflowX: main ? getComputedStyle(main).overflowX : null,
                  mainScrollWidth: main?.scrollWidth ?? null,
                  viewportWidth: window.innerWidth,
                }
              })(),
              overflowing: Array.from(document.querySelectorAll('body *'))
                .map((element) => {
                  const rect = element.getBoundingClientRect()
                  const describe = (candidate) => {
                    const candidateClasses = typeof candidate.className === 'string'
                      ? candidate.className.trim().split(/\\s+/).slice(0, 3).join('.')
                      : ''
                    return candidate.tagName.toLowerCase()
                      + (candidate.id ? '#' + candidate.id : '')
                      + (candidateClasses ? '.' + candidateClasses : '')
                  }
                  const classes = typeof element.className === 'string'
                    ? element.className.trim().split(/\\s+/).slice(0, 3).join('.')
                    : ''
                  let ancestor = element.parentElement
                  let overflowContainer
                  while (ancestor && ancestor !== document.body) {
                    const overflowX = getComputedStyle(ancestor).overflowX
                    if (['auto', 'scroll', 'hidden', 'clip'].includes(overflowX)) {
                      const ancestorRect = ancestor.getBoundingClientRect()
                      overflowContainer = {
                        element: describe(ancestor),
                        left: Math.round(ancestorRect.left),
                        right: Math.round(ancestorRect.right),
                        clientWidth: ancestor.clientWidth,
                        scrollWidth: ancestor.scrollWidth,
                        overflowX,
                      }
                      break
                    }
                    ancestor = ancestor.parentElement
                  }
                  return {
                    element: element.tagName.toLowerCase()
                      + (element.id ? '#' + element.id : '')
                      + (classes ? '.' + classes : ''),
                    left: Math.round(rect.left),
                    right: Math.round(rect.right),
                    width: Math.round(rect.width),
                    ...(overflowContainer ? { overflowContainer } : {}),
                  }
                })
                .filter(item => item.width > 0 && (item.left < -1 || item.right > window.innerWidth + 1))
                .sort((a, b) => Math.max(b.right - window.innerWidth, -b.left) - Math.max(a.right - window.innerWidth, -a.left))
                .slice(0, 10),
            }))()`,
              returnByValue: true,
            })
            state.dispose()
            return { state, value: inspection.result?.value || {} }
          }
          catch (error) {
            state?.dispose()
            lastError = error
            if (attempt === 0)
              await replacePage()
          }
        }
        throw lastError
      }

      try {
        while (queue.length > 0 && visited.size < max) {
          const current = queue.shift()!
          if (visited.has(current))
            continue
          visited.add(current)

          const { state, value } = await inspectPage(current)
          const failedRequests = state.responses
            .filter(response => response.status >= 400)
            .map(response => ({ status: response.status, url: response.url }))
          pages.push({
            path: new URL(current).pathname + new URL(current).search,
            title: value.title || '',
            status: state.mainStatus,
            consoleErrors: [...new Set(state.consoleErrors)],
            failedRequests,
            horizontalOverflowPx: Number(value.overflow) || 0,
            layout: value.layout || {
              bodyScrollWidth: 0,
              documentScrollWidth: 0,
              mainClientWidth: null,
              mainOverflowX: null,
              mainScrollWidth: null,
              viewportWidth: 0,
            },
            overflowingElements: value.overflowing || [],
          })
          if (flags.progress) {
            const page = pages.at(-1)!
            console.error(`[crawl] ${pages.length} ${page.status ?? 'none'} ${page.path}`)
          }

          for (const href of value.links || []) {
            const target = crawlTarget(href, start.origin)
            if (!target || queued.has(target) || visited.has(target))
              continue
            queued.add(target)
            queue.push(target)
          }

          if (queue.length > 0 && visited.size < max)
            await replacePage()
        }
      }
      finally {
        await closePage(session.port, browserPage)
      }

      const failures = pages.filter(page =>
        page.status !== 200
        || page.consoleErrors.length > 0
        || page.failedRequests.length > 0
        || page.horizontalOverflowPx > 0)
      console.log(JSON.stringify({
        start: start.href,
        browser: session.browser,
        viewport: `${crawlViewport.w}x${crawlViewport.h}`,
        crawled: pages.length,
        remaining: queue.length,
        max,
        paths: pages.map(page => page.path),
        failures,
      }, null, 2))
      if (failures.length > 0)
        process.exitCode = 1
    }

    else {
      console.error(`Unknown command: ${command}`)
      process.exit(1)
    }
  }
  finally {
    kill(session)
  }
}

main().catch((e) => {
  console.error('browse error:', e?.message || e)
  process.exit(1)
})
