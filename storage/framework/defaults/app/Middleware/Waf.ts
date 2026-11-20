import type { WafSecurityOptions } from '@stacksjs/types'
import type { WafDecision } from '@stacksjs/waf'
import { isAbsolute } from 'node:path'
import { config } from '@stacksjs/config'
import { HttpError } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { path } from '@stacksjs/path'
import { clientAddress, Middleware, peerSocket } from '@stacksjs/router'
import { Waf } from '@stacksjs/waf'

/**
 * Waf Middleware
 *
 * Runs each request through zig-waf in process (`@stacksjs/waf`), for an app
 * that is not behind rpx: `buddy dev`, serverless, a host of your own. On a box
 * deploy rpx's dataplane runs the same engine in front of the app, so this is
 * not needed there.
 *
 * It reads `config.security.waf`:
 *
 * - `mode`: `detection` (the default) logs a match and lets the request
 *   through; `blocking` refuses it with the status the rule asked for. `off`
 *   turns the middleware into a no-op.
 * - `rules`: the SecLang files to load, usually an OWASP CRS checkout. Required:
 *   zig-waf ships no rules.
 * - `library`: zig-waf's shared library, or set `ZIG_WAF_LIBRARY`.
 * - `dataDir`: where the rules' `.data` files are; defaults to the last rule
 *   file's directory, a CRS checkout's `rules/`.
 * - `allowedMethods`: defaults to CRS's GET HEAD POST OPTIONS plus the PUT,
 *   PATCH and DELETE a Stacks API's update and destroy routes use.
 * - `maxBodyBytes`: at most this much of a body is read. Blocking refuses a
 *   larger one with 413; detection inspects its start and logs that it could
 *   not see the rest.
 * - `paranoiaLevel`, thresholds, `bypassPaths`, `exclusions`: as on box deploys.
 *
 * Off unless a route asks for it:
 * route.post('/login', 'Actions/Auth/LoginAction').middleware('waf')
 * route.group({ middleware: ['waf'] }, () => { ... })
 *
 * A request built in-process (a test, an internal `handleRequest`) has no
 * socket, so there is no network traffic to inspect and it passes.
 */
export default new Middleware({
  name: 'waf',
  priority: 1,

  async handle(request) {
    await inspectWithWaf(request as unknown as Request, (config as { security?: { waf?: WafSecurityOptions } }).security?.waf ?? {})
  },
})

const engines = new Map<string, Waf>()

/** A configured path, relative to the project root unless it is absolute. */
function fromProject(file: string): string {
  return isAbsolute(file) ? file : path.projectPath(file)
}

/** The engine for these settings, compiled once and kept for the process. */
function engineFor(settings: WafSecurityOptions): Waf {
  const key = JSON.stringify(settings)
  let waf = engines.get(key)
  if (!waf) {
    waf = new Waf({
      ...settings,
      mode: settings.mode === 'blocking' ? 'blocking' : 'detection',
      rules: (settings.rules ?? []).map(fromProject),
      dataDir: settings.dataDir === undefined ? undefined : fromProject(settings.dataDir),
    })
    for (const warning of waf.warnings)
      log.warn(`[waf] ${warning}`)
    engines.set(key, waf)
  }
  return waf
}

/**
 * Inspect one request under `settings`; refuse it with an `HttpError` when the
 * engine enforces a decision. Returns what the engine decided, or `null` when
 * the request was not inspected.
 */
export async function inspectWithWaf(request: Request, settings: WafSecurityOptions): Promise<WafDecision | null> {
  if (settings.mode === 'off')
    return null

  const socket = peerSocket(request)
  if (!socket)
    return null

  let waf: Waf
  try {
    waf = engineFor(settings)
  }
  catch (error) {
    // A WAF asked to block that cannot start must not quietly let everything
    // through; one asked only to watch should not take the app down.
    log.error(`[waf] ${(error as Error).message}`)
    if (settings.mode === 'blocking')
      throw new HttpError(503, 'Service Unavailable')
    return null
  }

  const url = new URL(request.url)
  const body = await bodyPrefix(request, waf.maxBodyBytes)
  if (body.oversized) {
    // Past maxBodyBytes the engine sees only the start, so padding a request
    // would carry anything past every rule. Blocking refuses it; detection
    // inspects what fits and says what it could not see.
    if (settings.mode === 'blocking')
      throw new HttpError(413, 'Payload Too Large')
    log.warn(`[waf] ${request.method} ${url.pathname}: the body is larger than maxBodyBytes (${waf.maxBodyBytes}); only its start was inspected`)
  }

  const decision = waf.inspect({
    method: request.method,
    uri: `${url.pathname}${url.search}`,
    headers: request.headers.entries(),
    body: body.bytes,
    clientAddress: clientAddress(request) ?? socket.address,
    clientPort: socket.port,
    serverAddress: url.hostname,
    serverPort: Number(url.port) || (url.protocol === 'https:' ? 443 : 80),
  })

  if (decision.matched) {
    log.warn(`[waf] rule ${decision.ruleId ?? 'unknown'} matched ${request.method} ${url.pathname} from ${clientAddress(request) ?? socket.address}: ${decision.enforced ? 'refused' : 'allowed (detection mode)'}`)
    if (decision.enforced)
      throw new HttpError(decision.status ?? 403, 'Forbidden')
  }
  return decision
}

/**
 * At most `limit` bytes of the body, without taking it from the action.
 *
 * The router buffers a JSON body (`_rawBody`) and replays it; a form or
 * multipart body it reads from a clone and leaves the original for the action.
 * So this reads the buffered copy when there is one and a clone otherwise,
 * stopping one byte past the limit: enough to know the body is larger, never
 * the whole of an arbitrarily large upload in memory.
 */
async function bodyPrefix(request: Request, limit: number): Promise<{ bytes?: Uint8Array, oversized: boolean }> {
  if (request.method === 'GET' || request.method === 'HEAD')
    return { oversized: false }

  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > limit)
    return { oversized: true }

  const buffered = (request as { _rawBody?: unknown })._rawBody
  if (typeof buffered === 'string') {
    const all = new TextEncoder().encode(buffered)
    return { bytes: all.subarray(0, limit), oversized: all.length > limit }
  }

  if (!request.body || request.bodyUsed)
    return { oversized: false }

  const reader = request.clone().body!.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (size <= limit) {
    const { done, value } = await reader.read()
    if (done)
      break
    chunks.push(value)
    size += value.length
  }
  const oversized = size > limit
  // Cancelled so this branch stops buffering what the action goes on to read,
  // and not awaited: a tee branch's cancel settles only once both branches
  // are cancelled (the Streams standard), and the action's branch is still
  // being read.
  if (oversized)
    void reader.cancel().catch(() => {})

  const bytes = new Uint8Array(Math.min(size, limit))
  let offset = 0
  for (const chunk of chunks) {
    if (offset >= bytes.length)
      break
    const part = chunk.subarray(0, bytes.length - offset)
    bytes.set(part, offset)
    offset += part.length
  }
  return { bytes, oversized }
}
