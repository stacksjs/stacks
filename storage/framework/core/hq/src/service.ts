import type { ConnectCodeStore } from './connect-codes'
import type { MeterPolicy, MeterPolicyName } from './policy'
import type { UsageReport } from './types'
import { isPeriod, periodOf } from './period'
import { evaluate } from './policy'

export * from './connect-codes'
export type { UsageReport } from './types'

/**
 * The three endpoints every HQ service answers the same way:
 *
 *   POST /api/cli/connect          -> { code, approveUrl }
 *   GET  /api/cli/connect/{code}   -> pending | { project, ingestKey, readKey, dashboardUrl }
 *   GET  /api/v1/usage  (read key) -> { meter, used, limit, period, state, upgradeUrl }[]
 *
 * Nothing here knows a router or a database. A service implements
 * `HqServiceAdapter` over its own users, projects and keys, and mounts the
 * handlers in its own `routes/hq.ts`. Accounts stay the service's: no
 * identity crosses from one service to another.
 */

export interface ConnectGrant {
  project: { id: string, name: string }
  /** The key the app's SDK writes with. */
  ingestKey: string
  /** The key the app's dashboard reads with. Server-side only. */
  readKey: string
  dashboardUrl: string
}

export interface ConnectRequest {
  /** The app's name as the CLI sent it; the project is created or reused under it. */
  app: string
}

/** Who a read key speaks for. */
export interface ReadPrincipal {
  /** The account usage is metered against. */
  owner: string
  project?: string
}

export interface MeterReading {
  meter: string
  used: number
  limit: number | null
  /** Defaults to soft ingest. */
  policy?: MeterPolicy | MeterPolicyName
  /** Defaults to the current period. */
  period?: string
}

export interface HqServiceAdapter<User = unknown> {
  /** `bughq`, `loghq`, ... Used in messages only. */
  service: string
  /** The page a signed-in user approves a connect on. It receives the code. */
  approveUrl: (code: string) => string
  /** Where this service sells its plan. */
  upgradeUrl: string | ((principal: ReadPrincipal) => string)
  codes: ConnectCodeStore
  /**
   * Create, or reuse, the project named after the app for this user and
   * answer its keys. Called once per approval, and must be safe to repeat.
   */
  provision: (user: User, request: ConnectRequest) => Promise<ConnectGrant>
  /** Resolve a presented read key, or `null`. Compare in constant time. */
  authenticateReadKey: (readKey: string) => Promise<ReadPrincipal | null>
  /** The principal's standing on every meter this service has. */
  usage: (principal: ReadPrincipal) => Promise<MeterReading[]>
}

export interface HqServiceOptions {
  /** How long a code may wait for approval and collection. Default ten minutes. */
  codeTtlMs?: number
  now?: () => Date
}

/** The request shape the handlers read. A Fetch `Request` and bun-router's request both fit. */
export interface HqRequest {
  url: string
  method?: string
  headers: { get: (name: string) => string | null }
  json?: () => Promise<unknown>
  params?: Record<string, string | undefined>
}

export type ConnectPollResponse
  = | { status: 'pending' }
    | { status: 'expired' }
    | ({ status: 'approved' } & ConnectGrant)

export type ApproveResult
  = | { ok: true, project: ConnectGrant['project'] }
    | { ok: false, reason: 'expired' | 'already_approved' }

export interface HqRoute {
  method: 'GET' | 'POST'
  /** Path with `{param}` segments, as bun-router spells them. */
  path: string
  handler: (request: HqRequest) => Promise<Response>
}

export interface HqService<User = unknown> {
  /** `POST /api/cli/connect` */
  startConnect: (request: HqRequest) => Promise<Response>
  /** `GET /api/cli/connect/{code}`. The code is read from `request.params`, else the last path segment. */
  pollConnect: (request: HqRequest, code?: string) => Promise<Response>
  /** What the approve page shows before the user confirms. `null` once expired, approved or unknown. */
  describeConnect: (code: string) => Promise<{ app: string, expiresAt: number } | null>
  /** Call from the approve page's action, with the signed-in user, once they confirm. */
  approveConnect: (code: string, user: User) => Promise<ApproveResult>
  /** `GET /api/v1/usage` */
  usage: (request: HqRequest) => Promise<Response>
  /** The three routes, to register one by one. */
  routes: HqRoute[]
  /** Dispatch a request to whichever route it matches; `null` when none does. */
  handle: (request: HqRequest) => Promise<Response | null>
}

export const CONNECT_PATH = '/api/cli/connect'
export const USAGE_PATH = '/api/v1/usage'

const encoder = new TextEncoder()
const CODE = /^[\w-]{32,128}$/

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes)
    binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++)
    bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** SHA-256 of a connect code, hex. This, never the code, is what a store holds. */
export async function hashConnectCode(code: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(`hq-connect-code:${code}`)))
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function grantKey(code: string): Promise<CryptoKey> {
  const material = await crypto.subtle.digest('SHA-256', encoder.encode(`hq-connect-grant:${code}`))
  return crypto.subtle.importKey('raw', material, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

async function sealGrant(code: string, grant: ConnectGrant): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)))
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await grantKey(code), encoder.encode(JSON.stringify(grant))))
  return `${base64Url(iv)}.${base64Url(sealed)}`
}

async function openGrant(code: string, sealed: string): Promise<ConnectGrant | null> {
  try {
    const [iv, body] = sealed.split('.')
    if (!iv || !body)
      return null
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64Url(iv) }, await grantKey(code), fromBase64Url(body))
    return JSON.parse(new TextDecoder().decode(plain)) as ConnectGrant
  }
  catch {
    return null
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    // Codes and keys travel in these bodies; nothing between here and the CLI may keep one.
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function appName(value: unknown): string {
  const name = typeof value === 'string' ? value.replace(/[^\w .-]/g, '').trim().slice(0, 64) : ''
  return name || 'app'
}

function pathOf(request: HqRequest): string {
  try {
    return new URL(request.url, 'http://localhost').pathname.replace(/\/+$/, '') || '/'
  }
  catch {
    return ''
  }
}

function bearer(request: HqRequest): string | null {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim())
  return match?.[1] ?? null
}

export function createHqService<User = unknown>(adapter: HqServiceAdapter<User>, options: HqServiceOptions = {}): HqService<User> {
  const now = options.now ?? (() => new Date())
  const ttl = options.codeTtlMs ?? 10 * 60 * 1000

  /** A record that exists and has time left, else null. */
  async function live(code: string) {
    if (!CODE.test(code))
      return null
    const codeHash = await hashConnectCode(code)
    const record = await adapter.codes.find(codeHash)
    return record && record.expiresAt > now().getTime() ? record : null
  }

  async function startConnect(request: HqRequest): Promise<Response> {
    let body: unknown
    try {
      body = await request.json?.()
    }
    catch { /* a connect with no readable body still gets a code */ }

    const code = base64Url(crypto.getRandomValues(new Uint8Array(32)))
    const at = now().getTime()
    await adapter.codes.prune(at).catch(() => {})
    await adapter.codes.create({
      codeHash: await hashConnectCode(code),
      app: appName((body as { app?: unknown } | null | undefined)?.app),
      status: 'pending',
      sealedGrant: null,
      expiresAt: at + ttl,
    })
    return json({ code, approveUrl: adapter.approveUrl(code) }, 201)
  }

  async function describeConnect(code: string): Promise<{ app: string, expiresAt: number } | null> {
    const record = await live(code)
    return record && record.status === 'pending' ? { app: record.app, expiresAt: record.expiresAt } : null
  }

  async function approveConnect(code: string, user: User): Promise<ApproveResult> {
    const record = await live(code)
    if (!record)
      return { ok: false, reason: 'expired' }
    if (record.status !== 'pending')
      return { ok: false, reason: 'already_approved' }
    const grant = await adapter.provision(user, { app: record.app })
    const approved = await adapter.codes.approve(record.codeHash, await sealGrant(code, grant))
    return approved ? { ok: true, project: grant.project } : { ok: false, reason: 'already_approved' }
  }

  async function pollConnect(request: HqRequest, given?: string): Promise<Response> {
    const code = given ?? request.params?.code ?? decodeURIComponent(pathOf(request).split('/').pop() ?? '')
    const expired = (): Response => json({ status: 'expired' } satisfies ConnectPollResponse, 404)
    const record = await live(code)
    if (!record)
      return expired()
    if (record.status === 'pending')
      return json({ status: 'pending' } satisfies ConnectPollResponse)

    // Approved: hand the keys over exactly once. Whoever loses the take, or
    // asks again, is told the code is gone.
    const taken = await adapter.codes.consume(record.codeHash)
    const grant = taken?.sealedGrant ? await openGrant(code, taken.sealedGrant) : null
    if (!grant)
      return expired()
    return json({ status: 'approved', ...grant } satisfies ConnectPollResponse)
  }

  async function usage(request: HqRequest): Promise<Response> {
    const key = bearer(request)
    const principal = key ? await adapter.authenticateReadKey(key) : null
    if (!principal)
      return json({ error: 'unauthorized' }, 401)

    const upgradeUrl = typeof adapter.upgradeUrl === 'function' ? adapter.upgradeUrl(principal) : adapter.upgradeUrl
    const period = periodOf(now())
    const reports: UsageReport[] = (await adapter.usage(principal)).map((reading) => {
      const evaluation = evaluate(reading.used, reading.limit, reading.policy)
      return {
        meter: reading.meter,
        used: evaluation.used,
        limit: evaluation.limit,
        period: isPeriod(reading.period) ? reading.period : period,
        state: evaluation.state,
        upgradeUrl,
      }
    })
    return json(reports)
  }

  const routes: HqRoute[] = [
    { method: 'POST', path: CONNECT_PATH, handler: startConnect },
    { method: 'GET', path: `${CONNECT_PATH}/{code}`, handler: request => pollConnect(request) },
    { method: 'GET', path: USAGE_PATH, handler: usage },
  ]

  async function handle(request: HqRequest): Promise<Response | null> {
    const method = (request.method ?? 'GET').toUpperCase()
    const path = pathOf(request)
    if (method === 'POST' && path === CONNECT_PATH)
      return startConnect(request)
    if (method === 'GET' && path.startsWith(`${CONNECT_PATH}/`) && !path.slice(CONNECT_PATH.length + 1).includes('/'))
      return pollConnect(request, decodeURIComponent(path.slice(CONNECT_PATH.length + 1)))
    if (method === 'GET' && path === USAGE_PATH)
      return usage(request)
    return null
  }

  return { startConnect, pollConnect, describeConnect, approveConnect, usage, routes, handle }
}
