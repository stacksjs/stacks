import type { Server } from 'bun'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, normalize, sep } from 'node:path'

/**
 * The process behind a desktop app that runs its own API (`macos.agent`): a
 * loopback HTTP server that serves the app's routes in process, with Craft's
 * AppKit host as its window.
 *
 * Only the host the agent started may call it. The host fetches
 * `/native/session` first and gets the session cookie (HttpOnly, so the
 * screens' JavaScript never holds it; SameSite=Strict, so another site's form
 * or fetch never sends it). Every other request must carry that cookie and
 * name this server in its Host header, so a DNS-rebinding page - whose Host
 * is its own name, not 127.0.0.1 - cannot pose as the app. The token is new
 * on every launch, so a cookie from an earlier run is worthless.
 */

export type AgentHandler = (request: Request) => Response | Promise<Response>

export interface DesktopAgentOptions {
  /** Answers every authorized request: the app's routes and actions. */
  handler: AgentHandler
  /** Shown by `/native/session`, for the host and for diagnostics. */
  name?: string
  version?: string
  /** The port to try first. Default: the one in `portFile`, else any free port. */
  port?: number
  /** Where the port is remembered, so the origin (and what the host keeps per origin) is the same on the next launch. */
  portFile?: string
  /** The session cookie's name. Default `stacks_desktop`. */
  cookieName?: string
  /** Static files served without a session (a web UI); an HTML page sets the session cookie, as `/native/session` does. */
  staticDir?: string
}

export interface DesktopAgent {
  port: number
  /** `http://127.0.0.1:<port>`, what the host is given as `--api-url`. */
  url: string
  server: Server<undefined>
  /** The session in force. */
  readonly token: string
  /** Mint a new session; every cookie issued before it stops working. */
  rotateToken: () => string
  stop: () => void
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
}

/** A fresh session token: 192 random bits. */
export function newAgentToken(): string {
  return randomBytes(24).toString('hex')
}

/** Whether a Host header names this agent: 127.0.0.1 or localhost, on its port. Nothing else, not even another loopback alias. */
export function isAgentHost(host: string | null, port: number): boolean {
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`
}

export function sessionCookie(name: string, token: string): string {
  return `${name}=${token}; Path=/; HttpOnly; SameSite=Strict`
}

/** Whether the request carries this session's cookie. */
export function hasSessionCookie(request: Request, name: string, token: string): boolean {
  const cookies = request.headers.get('cookie')
  if (!cookies) return false
  return cookies.split(/;\s*/).includes(`${name}=${token}`)
}

/** The port remembered from the last launch, or 0 (any free port) when there is none worth trying. */
export function rememberedPort(portFile: string | undefined): number {
  if (!portFile) return 0
  try {
    const port = Number(readFileSync(portFile, 'utf8').trim())
    return Number.isInteger(port) && port > 1024 && port < 65536 ? port : 0
  }
  catch {
    return 0
  }
}

/**
 * A file under `root` for a request path, or null: `/about` is `about.html`,
 * then `about/index.html`, then the file itself. Never outside `root`. HTML is
 * not cached, so a rebuilt page is the one the next launch shows.
 */
export function staticFileResponse(root: string, pathname: string): Response | null {
  const base = normalize(root)
  let clean: string
  try { clean = decodeURIComponent(pathname).replace(/\/+$/, '') || '/index' }
  catch { return null }
  const candidates = clean === '/index' ? ['index.html'] : [`${clean}.html`, `${clean}/index.html`, clean]
  for (const candidate of candidates) {
    const file = normalize(join(base, candidate))
    // `..` in a path is resolved before this check.
    if (file !== base && !file.startsWith(`${base}${sep}`)) continue
    if (!existsSync(file) || !statSync(file).isFile()) continue
    const headers: Record<string, string> = { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' }
    if (extname(file) === '.html') headers['cache-control'] = 'no-store'
    return new Response(Bun.file(file), { headers })
  }
  return null
}

/** The content type for a file name, by extension. */
export function staticContentType(file: string): string {
  return MIME[extname(file)] ?? 'application/octet-stream'
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
}

export async function startDesktopAgent(options: DesktopAgentOptions): Promise<DesktopAgent> {
  const cookieName = options.cookieName ?? 'stacks_desktop'
  let token = newAgentToken()
  let port = 0

  function serveStatic(pathname: string): Response | null {
    if (!options.staticDir) return null
    const response = staticFileResponse(options.staticDir, pathname)
    // An HTML page is where a web UI starts, so it carries the session, as `/native/session` does.
    if (response?.headers.get('content-type')?.startsWith('text/html')) response.headers.set('set-cookie', sessionCookie(cookieName, token))
    return response
  }

  async function fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const host = request.headers.get('host')

    // AppKit's URLSession keeps the cookie for every native window; the
    // screens' script context never sees it.
    if (url.pathname === '/native/session') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
      if (!isAgentHost(host, port)) return json({ error: 'Forbidden' }, 403)
      const response = json({ name: options.name ?? null, version: options.version ?? null, renderer: 'appkit' })
      response.headers.set('set-cookie', sessionCookie(cookieName, token))
      return response
    }

    if (!isAgentHost(host, port)) return json({ error: 'Forbidden' }, 403)

    if (request.method === 'GET' && !url.pathname.startsWith('/api/')) {
      const file = serveStatic(url.pathname)
      if (file) return file
    }

    if (!hasSessionCookie(request, cookieName, token)) return json({ error: 'Forbidden' }, 403)

    try {
      return await options.handler(request)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[agent] ${request.method} ${url.pathname}: ${message}`)
      return json({ error: message }, 500)
    }
  }

  const serve = (wanted: number): Server<undefined> => Bun.serve({ hostname: '127.0.0.1', port: wanted, idleTimeout: 0, fetch })
  const wanted = options.port ?? rememberedPort(options.portFile)
  let server: Server<undefined>
  try {
    server = serve(wanted)
  }
  catch (error) {
    // Taken by something else since the last launch: any free port will do,
    // at the cost of the origin changing once.
    if (wanted === 0) throw error
    server = serve(0)
  }
  port = server.port ?? 0

  if (options.portFile) {
    try {
      mkdirSync(dirname(options.portFile), { recursive: true })
      writeFileSync(options.portFile, String(port))
    }
    catch {}
  }

  return {
    port,
    url: `http://127.0.0.1:${port}`,
    server,
    get token() { return token },
    rotateToken() {
      token = newAgentToken()
      return token
    },
    stop() {
      server.stop(true)
    },
  }
}
