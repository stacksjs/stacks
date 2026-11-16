/**
 * What an uptime service should ask of an app's routes, worked out from the
 * routes themselves.
 *
 * The router knows three things about a route that an outside monitor has to
 * guess: whether it needs a signed-in user, whether its input is validated,
 * and whether its path can be requested as it stands. That is enough to check
 * most of an app without being told anything, and without ever changing its
 * data:
 *
 *   - A page must answer 2xx or redirect. A GET route with no parameters
 *     must answer, or refuse for want of credentials: what fails it is being
 *     gone or broken.
 *   - A route behind auth is asked for WITHOUT credentials, and must refuse.
 *     That proves the route is mounted and its guard is up, which is the
 *     failure worth knowing about: a guard that fell off still answers 200.
 *   - A writing route whose input is validated is sent an empty body, and must
 *     refuse it. The handler never runs, so nothing is created, and the answer
 *     still proves the route, its action and its rules all loaded.
 *
 * Everything else is left out, with the reason, because asking would either
 * mean nothing or do something: a path with parameters has no value to fill
 * in, a webhook is signed by its sender, and a writing route with no
 * validation would simply run.
 *
 * Pure: no router, no network. `buddy hq:sync` collects the routes and sends
 * what this returns; StatusHQ runs the checks.
 */

/** How a check reads: what kind of route it is, in one word. */
export type RouteCheckKind = 'page' | 'public' | 'guard' | 'validation'

/**
 * A status a check accepts: a class (`2xx`, `3xx`, `4xx`) or one code (`401`).
 */
export type ExpectedStatus = string

export interface RouteCheck {
  /** `GET /api/posts`. Stable across syncs: it is what a check is matched by. */
  id: string
  method: string
  path: string
  kind: RouteCheckKind
  expect: ExpectedStatus[]
  /** Send `{}` as JSON. Only ever on a route that must refuse it. */
  send?: 'empty-json'
  /** The route's name, where it has one. */
  name?: string
}

export interface SkippedRoute {
  method: string
  path: string
  reason: string
}

export interface RouteManifest {
  version: 1
  checks: RouteCheck[]
  skipped: SkippedRoute[]
}

/**
 * A route's own say in how it is checked: `route.get(...).monitor(false)` to
 * be left alone, or an object to change what is asked.
 */
export type RouteMonitorOption = false | {
  /** Statuses to accept instead of the ones worked out. */
  expect?: Array<number | string>
  /** The path to request, for a route with parameters: `/posts/1`. */
  path?: string
}

/** A route as the collector hands it over. */
export interface ManifestRoute {
  method: string
  path: string
  name?: string
  middleware?: readonly string[]
  /**
   * Whether the route's action validates its input, and whether an empty body
   * fails that validation. `required` means it does: only then is it safe to
   * send one.
   */
  validation?: 'required' | 'optional'
  monitor?: RouteMonitorOption
}

const UNSAFE_TO_REPEAT = /(?:^|[/_.-])(?:logout|signout|sign-out|unsubscribe|callback|oauth|sso|export|download|stream|events|sse|ws|socket)(?:$|[/_.-])/i
const WEBHOOK = /webhook/i
const PARAMETER = /[{:*]/

/** Middleware that turns away a request with no credentials. */
function isGuard(alias: string): boolean {
  const name = alias.split(':')[0]!.toLowerCase()
  return name === 'auth' || name === 'can' || name === 'role' || name === 'abilities' || name === 'verified'
    || name === 'ensureemailisverified' || name === 'team' || name === 'admin'
}

function expectation(values: Array<number | string>): ExpectedStatus[] {
  return [...new Set(values.map(value => String(value).toLowerCase()).filter(value => /^[1-5](?:xx|\d\d)$/.test(value)))]
}

/** Whether a status is one a check accepts. */
export function statusMatches(expect: readonly ExpectedStatus[], status: number): boolean {
  const code = String(status)
  return expect.some(value => (value.endsWith('xx') ? value[0] === code[0] : value === code))
}

function classify(route: ManifestRoute, method: string, path: string): { check: Omit<RouteCheck, 'id' | 'method' | 'path'> } | { skip: string } {
  if (path.startsWith('/__') || path.startsWith('/_'))
    return { skip: 'a framework route, not the app\'s own' }
  if (WEBHOOK.test(path) || WEBHOOK.test(route.name ?? ''))
    return { skip: 'a webhook, which only its sender can sign' }

  const guarded = (route.middleware ?? []).some(isGuard)
  const reads = method === 'GET'

  if (guarded) {
    // No credentials are sent, so the guard is all that can answer. A writing
    // route is sent an empty body, in case a body parser answers before it.
    return reads
      ? { check: { kind: 'guard', expect: ['401', '403', '3xx'] } }
      : { check: { kind: 'guard', expect: ['401', '403', '419', '3xx'], send: 'empty-json' } }
  }

  if (reads) {
    if (UNSAFE_TO_REPEAT.test(path))
      return { skip: 'not safe to request over and over' }
    // An action can turn a request away itself, with no middleware to show
    // for it, and from outside that reads the same as a guard. So a refusal
    // for want of credentials passes too. What fails is what matters: the
    // route gone (404) or broken (5xx).
    return { check: { kind: 'public', expect: ['2xx', '3xx', '401', '403'] } }
  }

  if (route.validation === 'required') {
    // 422 is the validation speaking. 419 and 403 are CSRF answering first,
    // 429 a rate limit: each is the route alive and refusing.
    return { check: { kind: 'validation', expect: ['422', '400', '419', '403', '429'], send: 'empty-json' } }
  }
  if (route.validation === 'optional')
    return { skip: 'an empty body would be accepted, so asking would run it' }
  return { skip: 'writes without validating, so asking would run it' }
}

/**
 * The checks for an app's routes and pages, and what was left out and why.
 *
 * `pages` are the app's own static pages (the ones a sitemap lists), each
 * asked for with a plain GET.
 */
export function buildRouteManifest(routes: readonly ManifestRoute[], pages: readonly string[] = []): RouteManifest {
  const checks = new Map<string, RouteCheck>()
  const skipped: SkippedRoute[] = []

  for (const page of pages) {
    const path = page.startsWith('/') ? page : `/${page}`
    if (PARAMETER.test(path))
      continue
    checks.set(`GET ${path}`, { id: `GET ${path}`, method: 'GET', path, kind: 'page', expect: ['2xx', '3xx'] })
  }

  for (const route of routes) {
    const method = route.method.toUpperCase()
    if (method === 'OPTIONS' || method === 'HEAD')
      continue

    const skip = (reason: string): void => {
      skipped.push({ method, path: route.path, reason })
    }

    if (route.monitor === false) {
      skip('opted out with .monitor(false)')
      continue
    }

    const override = route.monitor || undefined
    const path = override?.path ?? route.path
    if (!path.startsWith('/')) {
      skip('its path does not start with a slash')
      continue
    }
    if (PARAMETER.test(path)) {
      skip('has path parameters, and no .monitor({ path }) to fill them in')
      continue
    }

    const outcome = classify(route, method, path)
    const expect = override?.expect ? expectation(override.expect) : undefined

    if ('skip' in outcome) {
      // A route that says what to expect has taken the decision on itself,
      // but only for a request that changes nothing.
      if (expect?.length && method === 'GET')
        checks.set(`GET ${path}`, { id: `GET ${path}`, method, path, kind: 'public', expect, ...(route.name ? { name: route.name } : {}) })
      else
        skip(outcome.skip)
      continue
    }

    const id = `${method} ${path}`
    // A page and a route at one address are one check: the route's wins, as it
    // knows more about what should answer there.
    checks.set(id, {
      id,
      method,
      path,
      ...outcome.check,
      ...(expect?.length ? { expect } : {}),
      ...(route.name ? { name: route.name } : {}),
    })
  }

  const order = (a: { method: string, path: string }, b: { method: string, path: string }): number =>
    a.path === b.path ? (a.method < b.method ? -1 : a.method > b.method ? 1 : 0) : (a.path < b.path ? -1 : 1)

  return { version: 1, checks: [...checks.values()].sort(order), skipped: skipped.sort(order) }
}

/** The manifest as counts, for a line in a terminal. */
export function summarizeRouteManifest(manifest: RouteManifest): Record<RouteCheckKind | 'skipped' | 'total', number> {
  const count = (kind: RouteCheckKind): number => manifest.checks.filter(check => check.kind === kind).length
  return {
    total: manifest.checks.length,
    page: count('page'),
    public: count('public'),
    guard: count('guard'),
    validation: count('validation'),
    skipped: manifest.skipped.length,
  }
}
