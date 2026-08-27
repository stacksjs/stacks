/**
 * Reverse-proxy helpers shared by the dev views server
 * (core/actions/src/dev/views.ts) and the production server
 * (`buddy serve`) so same-origin `/api/**` traffic behaves identically
 * in both topologies (stacksjs/stacks#1950).
 */

/** The prefix that is always API-bound, with or without configuration. */
export const DEFAULT_API_PREFIX = '/api/'

/**
 * Verbs that never match a static stx page render, so they always belong to
 * bun-router. Without this rule, `route.post('/subscribe', ...)` declared at
 * the root hits stx-serve and 404s.
 */
export const DEFAULT_API_METHODS: readonly string[] = ['POST', 'PUT', 'PATCH', 'DELETE']

/**
 * What the views server forwards to the API process.
 *
 * ## Why this is configuration and not a route lookup
 *
 * The obvious fix for stacksjs/stacks#2230 is to ask the router:
 * `route.getAllowedMethods(pathname)` already answers exactly the right
 * question. It is not reachable from here. `isApiBoundRequest` is called from
 * an `onRequest` hook inside the VIEWS process, and the route table is
 * registered in the API process — a different process in `buddy dev`, and
 * potentially a different host in production, where `production-server.ts`
 * proxies to an `apiBase` URL. Importing the app's route files into the views
 * process to consult them would execute route registration there, pulling the
 * models and database in with it, and in a split deployment the views site may
 * not ship that code at all.
 *
 * So the app declares it, the way Next's `rewrites()` does. Empty by default,
 * so nothing changes for an app that does not set it.
 *
 * ## The cost of adding a path here
 *
 * stx's `onRequest` runs BEFORE static file serving, so any path this matches
 * permanently shadows a `public/` file of the same name. Adding `/script.js`
 * means `public/script.js` stops being reachable. That is a fine trade when
 * the API really does own the path, and a confusing one otherwise, which is
 * why `describeApiProxyRules` exists and the dev server prints it at boot.
 */
export interface ApiProxyRules {
  /** Path prefixes forwarded to the API. Always contains {@link DEFAULT_API_PREFIX}. */
  prefixes: string[]
  /** Exact paths forwarded to the API regardless of verb. */
  paths: string[]
  /** Verbs always forwarded. Defaults to {@link DEFAULT_API_METHODS}. */
  methods: Set<string>
}

/** The shape an app writes in `config/server.ts` under `proxy`. */
export interface ApiProxyConfig {
  prefixes?: readonly string[]
  paths?: readonly string[]
  methods?: readonly string[]
}

/**
 * Normalise app configuration into the rules the predicate reads.
 *
 * `/api/` is always present: it is the prefix the framework's own generated
 * routes use, and an app that dropped it would find its auto-CRUD endpoints
 * unreachable with no indication why. Configuring `prefixes` ADDS to it.
 *
 * Resolve this once at boot rather than per request. `@stacksjs/config`
 * populates `overrides` asynchronously, so a per-request read would answer
 * differently depending on how far boot had progressed.
 */
export function resolveApiProxyRules(input: ApiProxyConfig = {}): ApiProxyRules {
  const prefixes = [DEFAULT_API_PREFIX]
  for (const raw of input.prefixes ?? []) {
    const prefix = String(raw).trim()
    if (!prefix || !prefix.startsWith('/'))
      continue
    // Store with a trailing slash so `/admin` cannot match `/administrators`,
    // but keep the bare path matchable too — see `matchesPrefix`.
    const normalized = prefix.endsWith('/') ? prefix : `${prefix}/`
    if (!prefixes.includes(normalized))
      prefixes.push(normalized)
  }

  const paths: string[] = []
  for (const raw of input.paths ?? []) {
    const path = String(raw).trim()
    if (!path || !path.startsWith('/'))
      continue
    // A trailing slash on an exact path is almost always a typo, and `/health/`
    // not matching `/health` would be a genuinely baffling ten minutes.
    const normalized = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
    if (!paths.includes(normalized))
      paths.push(normalized)
  }

  const methods = new Set(
    (input.methods ?? DEFAULT_API_METHODS).map(method => String(method).toUpperCase()),
  )

  return { prefixes, paths, methods }
}

/** `/health/` and `/health` both match a `/health/` prefix. */
function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname.startsWith(prefix) || pathname === prefix.slice(0, -1)
}

/**
 * Whether a request can only be answered by bun-router.
 *
 * With no `rules`, this is the original fixed policy: the canonical `/api/**`
 * prefix, or a mutating verb. Callers that have resolved the app's
 * configuration pass it in.
 */
export function isApiBoundRequest(req: Request, pathname: string, rules?: ApiProxyRules): boolean {
  return isApiBoundPath(req.method, pathname, rules)
}

/**
 * The same decision, without a `Request` to ask.
 *
 * Boot-time checks want to know whether a route the API registered can ever
 * be reached through the views server, and constructing a `Request` per route
 * to find out would be silly. More to the point, a second implementation of
 * this rule would drift from the one that actually routes traffic, and a
 * diagnostic that disagrees with the thing it describes is worse than none.
 */
export function isApiBoundPath(method: string, pathname: string, rules?: ApiProxyRules): boolean {
  const verb = method.toUpperCase()
  if (!rules)
    return pathname.startsWith(DEFAULT_API_PREFIX) || DEFAULT_API_METHODS.includes(verb)

  if (rules.methods.has(verb))
    return true
  if (rules.paths.includes(pathname))
    return true

  return rules.prefixes.some(prefix => matchesPrefix(pathname, prefix))
}

/**
 * A one-line summary of what will be forwarded, for the dev server's boot
 * output.
 *
 * Asked for directly in stacksjs/stacks#2230: a 404 on a route you know you
 * registered is very hard to diagnose when the rule that swallowed it is
 * invisible.
 */
export function describeApiProxyRules(rules: ApiProxyRules): string {
  const parts = [
    `prefixes ${rules.prefixes.join(' ')}`,
    `methods ${[...rules.methods].sort().join('/')}`,
  ]
  if (rules.paths.length > 0)
    parts.push(`paths ${rules.paths.join(' ')}`)

  return parts.join(', ')
}

export interface RoutePathLike {
  method: string
  path: string
}

/**
 * Which of these routes the views server will never forward.
 *
 * A route the API process registers is only reachable through the views
 * server if these rules send it there. `/api/**` and the mutating verbs go by
 * default, which is why `route.post('/subscribe', …)` at the root works and
 * `route.get('/sitemap.xml', …)` does not: the GET is not forwarded, stx
 * renders it as a page, finds no page, and answers its own 404. The handler
 * never runs and nothing says so (stacksjs/stacks#2326).
 *
 * Give this the app's own root-mounted routes, not the whole table. The
 * framework registers around a hundred non-`/api` GETs that are reached in
 * topologies of their own, and listing those buries the one that is broken.
 */
export function unforwardableRoutes<T extends RoutePathLike>(routes: readonly T[], rules: ApiProxyRules): T[] {
  return routes.filter(route => !isApiBoundPath(route.method, route.path, rules))
}

/**
 * The boot warning for routes that cannot be reached, naming the fix.
 *
 * The silence is the part the report called worst: the route is declared, it
 * reads correctly in review, and it 404s in production the same way a typo
 * would.
 */
export function describeUnforwardableRoutes(routes: readonly (RoutePathLike & { file?: string })[]): string {
  const lines = routes.map((route) => {
    const origin = route.file ? ` (${route.file})` : ''
    return `  ${route.method} ${route.path}${origin}`
  })

  return [
    `${routes.length} root-mounted route${routes.length === 1 ? '' : 's'} the views server will not forward, so ${routes.length === 1 ? 'it' : 'they'} will answer the view 404 rather than reaching the handler:`,
    ...lines,
    `Add them to \`proxy.paths\` in config/server.ts (or their prefix to \`proxy.prefixes\`) so the views server forwards them to the API.`,
  ].join('\n')
}

export async function proxyToBackend(req: Request, backendBase: string, stripPrefix?: string): Promise<Response> {
  const incoming = new URL(req.url)
  let pathname = incoming.pathname
  if (stripPrefix && (pathname === stripPrefix || pathname.startsWith(`${stripPrefix}/`))) {
    pathname = pathname.slice(stripPrefix.length) || '/'
  }
  const target = `${backendBase}${pathname}${incoming.search}`

  const fwd = new Headers(req.headers)
  fwd.delete('host')
  fwd.delete('content-length')
  fwd.set('x-forwarded-host', incoming.host)
  fwd.set('x-forwarded-proto', incoming.protocol.replace(':', ''))

  const body = req.method === 'GET' || req.method === 'HEAD'
    ? undefined
    : await req.arrayBuffer()

  const upstream = await fetch(target, {
    method: req.method,
    headers: fwd,
    body,
    redirect: 'manual',
  })

  // Re-emit the body without the upstream's content-length /
  // content-encoding — the body we forward may be re-chunked, and
  // letting the original headers through breaks the response.
  const out = new Headers(upstream.headers)
  out.delete('content-length')
  out.delete('content-encoding')

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  })
}

/**
 * Where this app's `/api/**` traffic goes, or null when there is no safe answer.
 *
 * Returning null is the important part. On a shared box `127.0.0.1:<default>`
 * is not "my API" — it is whichever tenant bound that port first. Several SSR
 * sites legitimately share one instance, so falling back to the framework-wide
 * default silently forwards this app's session cookies, login POSTs and form
 * bodies into a DIFFERENT tenant's process. A 502 with an actionable log beats
 * misdelivering a visitor's credentials to a stranger.
 *
 * So an explicit target wins, and in a deployed environment there is no
 * fallback at all. Only a local dev machine, where nothing else is listening,
 * gets to guess.
 *
 * Lives here rather than beside the production server because more than one
 * server needs it: the public site and the dashboard both proxy to the same
 * API process, and a second copy of this rule is a second place for it to
 * drift.
 */
export function resolveApiBase(configuredPort?: number, env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.API_URL)
    return env.API_URL

  const explicitPort = Number(env.PORT_API)
  if (explicitPort)
    return `http://127.0.0.1:${explicitPort}`

  const deployed = ['production', 'staging', 'development']
    .includes((env.APP_ENV || '').toLowerCase())

  if (deployed)
    return null

  return `http://127.0.0.1:${configuredPort || 3008}`
}
