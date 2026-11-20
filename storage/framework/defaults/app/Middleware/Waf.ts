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
 * - `paranoiaLevel`, thresholds, `maxBodyBytes`, `bypassPaths`, `exclusions`:
 *   as on box deploys.
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

/** The engine for these settings, compiled once and kept for the process. */
function engineFor(settings: WafSecurityOptions): Waf {
  const key = JSON.stringify(settings)
  let waf = engines.get(key)
  if (!waf) {
    waf = new Waf({
      ...settings,
      mode: settings.mode === 'blocking' ? 'blocking' : 'detection',
      rules: (settings.rules ?? []).map(file => isAbsolute(file) ? file : path.projectPath(file)),
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
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text()
  const decision = waf.inspect({
    method: request.method,
    uri: `${url.pathname}${url.search}`,
    headers: request.headers.entries(),
    body,
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
