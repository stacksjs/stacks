import { timingSafeEqual } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, posix, win32 } from 'node:path'
import process from 'node:process'
import { isAgentHost, newAgentToken, rememberedPort, sessionCookie, staticContentType, staticFileResponse } from './agent'

/**
 * The agent behind a web view desktop app (`desktop.webview`): a loopback
 * server that serves the app's views and its own request handling, with a
 * Craft web view window as its only caller. The same on macOS, Windows and
 * Linux.
 *
 * Only the app's own window may call it. The launcher opens the window on a
 * URL carrying a one-time token; that request trades it for an HttpOnly,
 * SameSite=Strict cookie and is redirected to the same page without it. Every
 * later request must carry the cookie and name this server in its Host header,
 * so a page in a browser on the same machine cannot reach the agent, and a
 * DNS-rebinding page (whose Host is its own name) cannot pose as the app. The
 * token and the cookie are new on every launch.
 */

/** What a request handler is told about the agent it runs in. */
export interface WebviewAgentContext {
  appName: string
  version: string
  /** `http://127.0.0.1:<port>`. */
  origin: string
  port: number
  /** The app's own folder for data that outlives an update. */
  dataDir: string
}

/** Answers a request the window made. Returning nothing lets the views answer it. */
export type WebviewHandler = (request: Request, context: WebviewAgentContext) => Response | undefined | null | void | Promise<Response | undefined | null | void>

/** A second launch of the app, forwarded to the one already running. */
export interface SecondInstanceLaunch {
  /** The second launch's arguments, less the executable. */
  args: string[]
  /** The link that started it, when one of the app's URL schemes did. */
  url?: string
  cwd: string
}

/** How the views are served. */
export type WebviewViews =
  /** Built pages in a directory (`buddy build:desktop --views-only`, tests). */
  | { kind: 'static', dir: string }
  /** Built pages compiled into the agent: request path to embedded file. */
  | { kind: 'embedded', files: Record<string, string> }
  /** The project's stx views, rendered live (`buddy dev:desktop`). */
  | { kind: 'stx', dir: string, components?: string[], root: string, serve?: StxServe }
  | { kind: 'none' }

/** `serve` from `bun-plugin-stx/serve`, as much of it as the agent uses. */
export type StxServe = (options: {
  patterns: string[]
  port: number
  quiet?: boolean
  componentsDir?: string
  additionalComponentsDirs?: string[]
  onRequest: (request: Request, server: { stop: (force?: boolean) => unknown }) => Response | undefined | Promise<Response | undefined>
}) => Promise<void>

export interface WebviewAgentOptions {
  appName: string
  version?: string
  views: WebviewViews
  handler?: WebviewHandler
  /** The port to try first. Default: the one in `portFile`, else any free port. */
  port?: number
  /** Where the port is remembered, so the page's origin (and its local storage) is the same on the next launch. */
  portFile?: string
  dataDir?: string
  /** The session cookie's name. Default `stacks_desktop`. */
  cookieName?: string
  /** Paths answered by `handler` without the session cookie: a prefix ending in `/`, or an exact path. */
  publicPaths?: string[]
  /** Guards `/__desktop/instance`: only a process that can read the lock file knows it. */
  instanceSecret?: string
  onSecondInstance?: (launch: SecondInstanceLaunch) => void | Promise<void>
}

export interface WebviewAgent {
  port: number
  origin: string
  /** A URL for one window: the page plus a token that works once. */
  launchUrl: (path?: string) => string
  /** Resolves when the window has made its first authorized request. */
  windowReady: Promise<void>
  stop: () => void
}

export const INSTANCE_PATH = '/__desktop/instance'
export const INSTANCE_HEADER = 'x-desktop-instance'

/** Framework assets a page loads before its cookie matters; nothing private is served from them. */
const ASSET_PREFIXES = ['/_stx/', '/assets/']

function sameSecret(given: string | null, expected: string): boolean {
  if (!given) return false
  const left = Buffer.from(given)
  const right = Buffer.from(expected)
  return left.length === right.length && timingSafeEqual(left, right)
}

function matchesPath(pathname: string, patterns: readonly string[]): boolean {
  return patterns.some(pattern => pattern.endsWith('/') ? pathname.startsWith(pattern) : pathname === pattern)
}

export interface WebviewGateOptions {
  port: () => number
  cookieName?: string
  publicPaths?: string[]
  instanceSecret?: string
  appName?: string
}

/** What the gate decided about one request. */
export type GateDecision =
  /** Answered here: a refusal, or the token trade's redirect. */
  | { response: Response }
  /** The app's own window. */
  | { allow: 'window' }
  /** A path the app opened to callers without the cookie. */
  | { allow: 'public' }
  /** A framework asset: the views answer it, the app's handler does not see it. */
  | { allow: 'asset' }
  /** A second launch, already authenticated by the instance secret. */
  | { allow: 'instance' }

export interface WebviewGate {
  check: (request: Request) => GateDecision
  /** A one-time token for a window about to open. Unused tokens stop working after a minute. */
  mint: () => string
  readonly cookieName: string
}

const LAUNCH_TOKEN_TTL_MS = 60_000

/**
 * The rules every request passes before the app or the views see it. Kept
 * apart from the server so both ways of serving views (the agent's own server
 * and stx's) apply the same ones.
 */
export function createWebviewGate(options: WebviewGateOptions): WebviewGate {
  const cookieName = options.cookieName ?? 'stacks_desktop'
  const session = newAgentToken()
  const pending = new Map<string, number>()
  const refusal = `Open ${options.appName ?? 'the app'} to use this.`

  return {
    cookieName,
    mint() {
      const token = newAgentToken()
      pending.set(token, Date.now() + LAUNCH_TOKEN_TTL_MS)
      return token
    },
    check(request) {
      const url = new URL(request.url)
      if (!isAgentHost(request.headers.get('host'), options.port()))
        return { response: new Response('Forbidden', { status: 403 }) }

      if (url.pathname === INSTANCE_PATH) {
        if (request.method !== 'POST' || !options.instanceSecret || !sameSecret(request.headers.get(INSTANCE_HEADER), options.instanceSecret))
          return { response: new Response('Forbidden', { status: 403 }) }
        return { allow: 'instance' }
      }

      const offered = url.searchParams.get('session')
      if (offered !== null) {
        const expires = pending.get(offered)
        pending.delete(offered)
        if (request.method !== 'GET' || expires === undefined || expires < Date.now())
          return { response: new Response(refusal, { status: 401 }) }
        url.searchParams.delete('session')
        return {
          response: new Response(null, {
            status: 302,
            headers: { 'location': `${url.pathname}${url.search}`, 'set-cookie': sessionCookie(cookieName, session), 'cache-control': 'no-store' },
          }),
        }
      }

      const cookies = request.headers.get('cookie')
      if (cookies && cookies.split(/;\s*/).includes(`${cookieName}=${session}`)) return { allow: 'window' }
      if (options.publicPaths?.length && matchesPath(url.pathname, options.publicPaths)) return { allow: 'public' }
      if (request.method === 'GET' && matchesPath(url.pathname, ASSET_PREFIXES)) return { allow: 'asset' }
      return { response: new Response(refusal, { status: 401 }) }
    },
  }
}

/** Whether nothing is listening on a loopback port. */
export function portIsFree(port: number): boolean {
  try {
    Bun.listen({ hostname: '127.0.0.1', port, socket: { data() {} } }).stop(true)
    return true
  }
  catch {
    return false
  }
}

/**
 * The port to serve on: the one asked for, else the one remembered from the
 * last launch, when it is still free; otherwise any free port. The choice is
 * written back, so the next launch starts from it.
 */
export function pickAgentPort(options: { port?: number, portFile?: string } = {}): number {
  const wanted = options.port ?? rememberedPort(options.portFile)
  let port = wanted && portIsFree(wanted) ? wanted : 0
  if (!port) {
    const probe = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { data() {} } })
    port = probe.port
    probe.stop(true)
  }
  rememberPort(options.portFile, port)
  return port
}

function rememberPort(portFile: string | undefined, port: number): void {
  if (!portFile) return
  try {
    mkdirSync(dirname(portFile), { recursive: true })
    writeFileSync(portFile, String(port))
  }
  catch {}
}

export interface DesktopAppPaths {
  /** Survives updates, which replace the app wholesale. */
  dataDir: string
  portFile: string
  lockFile: string
  logFile: string
  /** Where a downloaded update waits to be installed. */
  updatesDir: string
}

/**
 * Where a desktop app keeps its own files, by platform: Application Support
 * and `~/Library/Logs` on macOS, `%APPDATA%` on Windows, the XDG data and
 * state directories on Linux.
 */
export function desktopAppPaths(appName: string, options: { platform?: string, home?: string, env?: Record<string, string | undefined> } = {}): DesktopAppPaths {
  const platform = options.platform ?? process.platform
  const home = options.home ?? homedir()
  const env = options.env ?? process.env
  const slug = appName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app'
  let dataDir: string
  let logFile: string
  const path = platform === 'win32' ? win32 : posix
  if (platform === 'darwin') {
    dataDir = path.join(home, 'Library', 'Application Support', appName)
    logFile = path.join(home, 'Library', 'Logs', `${appName}.log`)
  }
  else if (platform === 'win32') {
    dataDir = path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), appName)
    logFile = path.join(dataDir, 'logs', `${appName}.log`)
  }
  else {
    dataDir = path.join(env.XDG_DATA_HOME || path.join(home, '.local', 'share'), slug)
    logFile = path.join(env.XDG_STATE_HOME || path.join(home, '.local', 'state'), slug, `${slug}.log`)
  }
  return {
    dataDir,
    portFile: path.join(dataDir, 'agent.port'),
    lockFile: path.join(dataDir, 'agent.lock'),
    logFile,
    updatesDir: path.join(dataDir, 'updates'),
  }
}

/**
 * The PATH an agent needs to find the tools a person installed.
 *
 * An app started from Finder, Explorer or a `.desktop` file does not get the
 * PATH a terminal has: launchd hands out `/usr/bin:/bin:/usr/sbin:/sbin`, and a
 * desktop session on Linux skips the shell profile where `~/.bun/bin` and its
 * like are added. So `bun`, `git`, `docker` or `ssh` installed by a package
 * manager is invisible to the app on a machine where it works in a terminal.
 * The places installers use come first, and whatever PATH exists is kept last.
 */
export function widenedPath(options: { platform?: string, home?: string, env?: Record<string, string | undefined> } = {}): string {
  const platform = options.platform ?? process.platform
  const home = options.home ?? homedir()
  const env = options.env ?? process.env
  const current = env.PATH ?? env.Path ?? ''
  const path = platform === 'win32' ? win32 : posix
  const delimiter = platform === 'win32' ? ';' : ':'
  const added = platform === 'win32'
    ? [
        path.join(home, '.bun', 'bin'),
        path.join(env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Microsoft', 'WinGet', 'Links'),
        path.join(home, 'scoop', 'shims'),
        path.join(env.ProgramFiles || 'C:\\Program Files', 'Git', 'cmd'),
      ]
    : [
        path.join(home, '.local', 'bin'),
        path.join(home, '.bun', 'bin'),
        path.join(home, '.npm-global', 'bin'),
        path.join(home, '.cargo', 'bin'),
        ...(platform === 'darwin' ? ['/opt/homebrew/bin'] : ['/home/linuxbrew/.linuxbrew/bin', '/snap/bin']),
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
        '/usr/sbin',
        '/sbin',
      ]
  const seen = new Set<string>()
  return [...added, ...current.split(delimiter)].filter((entry) => {
    if (!entry || seen.has(entry)) return false
    seen.add(entry)
    return true
  }).join(delimiter)
}

/** Set this process's PATH (and so its children's) to `widenedPath()`. */
export function applyWidenedPath(): void {
  const path = widenedPath()
  process.env.PATH = path
  if (process.platform === 'win32' && process.env.Path !== undefined) process.env.Path = path
}

function embeddedFileResponse(files: Record<string, string>, pathname: string): Response | null {
  let clean: string
  try { clean = decodeURIComponent(pathname).replace(/\/+$/, '') || '/index' }
  catch { return null }
  for (const candidate of clean === '/index' ? ['/index.html'] : [`${clean}.html`, `${clean}/index.html`, clean]) {
    const file = files[candidate]
    if (!file) continue
    const headers: Record<string, string> = { 'content-type': staticContentType(candidate) }
    if (candidate.endsWith('.html')) headers['cache-control'] = 'no-store'
    return new Response(Bun.file(file), { headers })
  }
  return null
}

async function readSecondInstance(request: Request): Promise<SecondInstanceLaunch | null> {
  const body = await request.json().catch(() => null) as Partial<SecondInstanceLaunch> | null
  if (!body || !Array.isArray(body.args) || !body.args.every(arg => typeof arg === 'string')) return null
  return { args: body.args, cwd: typeof body.cwd === 'string' ? body.cwd : '', ...(typeof body.url === 'string' ? { url: body.url } : {}) }
}

export async function startWebviewAgent(options: WebviewAgentOptions): Promise<WebviewAgent> {
  let port = 0
  const gate = createWebviewGate({ port: () => port, cookieName: options.cookieName, publicPaths: options.publicPaths, instanceSecret: options.instanceSecret, appName: options.appName })
  let markReady!: () => void
  const windowReady = new Promise<void>((resolve) => { markReady = resolve })

  const context = (): WebviewAgentContext => ({
    appName: options.appName,
    version: options.version ?? '0.0.0',
    origin: `http://127.0.0.1:${port}`,
    port,
    dataDir: options.dataDir ?? '',
  })

  /** Everything short of the views: a Response, or undefined for the views to answer. */
  async function before(request: Request): Promise<Response | undefined> {
    const decision = gate.check(request)
    if ('response' in decision) return decision.response
    if (decision.allow === 'instance') {
      const launch = await readSecondInstance(request)
      if (!launch) return new Response('Bad request', { status: 400 })
      try { await options.onSecondInstance?.(launch) }
      catch (error) { console.error(`[agent] second instance: ${error instanceof Error ? error.message : String(error)}`) }
      return new Response(null, { status: 204 })
    }
    if (decision.allow === 'asset') return undefined
    if (decision.allow === 'window') markReady()
    if (!options.handler) return decision.allow === 'public' ? new Response('Not found', { status: 404 }) : undefined
    try {
      const answer = await options.handler(request, context())
      if (answer instanceof Response) return answer
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[agent] ${request.method} ${new URL(request.url).pathname}: ${message}`)
      return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
    }
    // A public path is the app's to answer; the views are the window's.
    return decision.allow === 'public' ? new Response('Not found', { status: 404 }) : undefined
  }

  const launchUrl = (path = '/'): string => {
    const url = new URL(path, `http://127.0.0.1:${port}`)
    url.searchParams.set('session', gate.mint())
    return url.toString()
  }

  const views = options.views
  if (views.kind === 'stx') {
    port = pickAgentPort({ port: options.port, portFile: options.portFile })
    const serve = views.serve ?? ((await import(Bun.resolveSync('bun-plugin-stx/serve', views.root))) as { serve: StxServe }).serve
    let stxServer: { stop: (force?: boolean) => unknown } | undefined
    const [componentsDir, ...additionalComponentsDirs] = views.components ?? []
    // serve() keeps the process alive and does not resolve; it is not awaited.
    void serve({
      patterns: [views.dir],
      port,
      quiet: true,
      ...(componentsDir ? { componentsDir } : {}),
      ...(additionalComponentsDirs.length ? { additionalComponentsDirs } : {}),
      onRequest: (request, server) => {
        stxServer = server
        return before(request)
      },
    })
    // serve() binds asynchronously: answer only once it does. A request with no cookie is refused by the gate, which is an answer.
    for (let attempt = 0; attempt < 200; attempt++) {
      try {
        await fetch(`http://127.0.0.1:${port}/`, { redirect: 'manual' })
        break
      }
      catch {
        await Bun.sleep(25)
      }
    }
    return { port, origin: `http://127.0.0.1:${port}`, launchUrl, windowReady, stop: () => { stxServer?.stop(true) } }
  }

  const fetchHandler = async (request: Request): Promise<Response> => {
    const answered = await before(request)
    if (answered) return answered
    const pathname = new URL(request.url).pathname
    const page = request.method !== 'GET' && request.method !== 'HEAD'
      ? null
      : views.kind === 'static' ? staticFileResponse(views.dir, pathname) : views.kind === 'embedded' ? embeddedFileResponse(views.files, pathname) : null
    return page ?? new Response('Not found', { status: 404 })
  }
  const listen = (wanted: number) => Bun.serve({ hostname: '127.0.0.1', port: wanted, idleTimeout: 0, fetch: fetchHandler })
  const wanted = options.port ?? rememberedPort(options.portFile)
  let server: ReturnType<typeof listen>
  try {
    server = listen(wanted)
  }
  catch (error) {
    // Taken since the last launch: any free port, at the cost of the origin changing once.
    if (wanted === 0) throw error
    server = listen(0)
  }
  port = server.port ?? 0
  rememberPort(options.portFile, port)
  return { port, origin: `http://127.0.0.1:${port}`, launchUrl, windowReady, stop: () => { server.stop(true) } }
}
