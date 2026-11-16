/**
 * Sending an app's routes to StatusHQ, so it checks them.
 *
 * `buddy hq:connect statushq` runs this once the app is connected, `buddy
 * deploy` runs it after a release is live, and `buddy hq:sync` runs it by
 * hand. What to check is worked out by `@stacksjs/hq/route-manifest` from the
 * routes the router has registered; this file collects those, sends them, and
 * says what StatusHQ did with them.
 *
 * The network half takes its `fetch` and `print` from the caller, so it is
 * tested without a server. The collecting half loads the app's routes the way
 * `buddy generate:openapi` does.
 */

import type { ManifestRoute, RouteManifest } from '@stacksjs/hq/route-manifest'
import { buildRouteManifest, summarizeRouteManifest } from '@stacksjs/hq/route-manifest'

export const ROUTE_SYNC_PATH = '/api/v1/routes/sync'

export interface RouteSyncDeps {
  fetch: (input: string, init?: RequestInit) => Promise<Response>
  print: (line: string) => void
}

/** What StatusHQ answers a sync with. */
export interface RouteSyncReport {
  monitor: { id: string | number, name: string, dashboardUrl?: string, intervalSeconds?: number }
  checks: { total: number, added: number, changed: number, removed: number, unchanged: number }
  /** Checks StatusHQ was sent and is not running, each with why. */
  notMonitored: Array<{ id: string, reason: string }>
}

export type RouteSyncOutcome
  = | { ok: true, report: RouteSyncReport }
    | { ok: false, reason: string }

function origin(url: string): string | null {
  try {
    const parsed = new URL(url.includes('://') ? url : `https://${url}`)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : null
  }
  catch {
    return null
  }
}

function isReport(value: unknown): value is RouteSyncReport {
  const body = value as Partial<RouteSyncReport> | null
  return !!body && typeof body === 'object' && !!body.monitor && typeof body.monitor === 'object'
    && !!body.checks && typeof body.checks.total === 'number' && Array.isArray(body.notMonitored)
}

/**
 * Send a manifest to StatusHQ. Never throws: a sync runs at the tail of a
 * connect or a deploy, and neither should fail because a monitor could not be
 * told about a route.
 */
export async function syncRoutes(
  service: { url: string, key: string },
  app: { name: string, baseUrl: string },
  manifest: RouteManifest,
  deps: Pick<RouteSyncDeps, 'fetch'>,
): Promise<RouteSyncOutcome> {
  const serviceOrigin = origin(service.url)
  const baseUrl = origin(app.baseUrl)
  if (!serviceOrigin)
    return { ok: false, reason: 'no StatusHQ URL is configured in config/services.ts' }
  if (!service.key)
    return { ok: false, reason: 'STATUSHQ_KEY is not set: run `buddy hq:connect statushq`' }
  if (!baseUrl)
    return { ok: false, reason: 'APP_URL is not a web address, so there is nowhere to check the routes' }
  if (/^https?:\/\/(?:localhost|127\.|\[?::1|[^/]+\.(?:localhost|test)(?::|$))/i.test(baseUrl))
    return { ok: false, reason: `APP_URL is ${baseUrl}, which StatusHQ cannot reach` }

  let response: Response
  try {
    response = await deps.fetch(`${serviceOrigin}${ROUTE_SYNC_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${service.key}` },
      body: JSON.stringify({ app: app.name, baseUrl, manifest }),
      signal: AbortSignal.timeout(30_000),
    })
  }
  catch {
    return { ok: false, reason: `could not reach ${serviceOrigin}` }
  }

  const body = await response.json().catch(() => null) as unknown
  if (response.status === 404 || response.status === 405)
    return { ok: false, reason: 'this StatusHQ does not take route syncs yet' }
  if (response.status === 401 || response.status === 403)
    return { ok: false, reason: 'StatusHQ refused the key: run `buddy hq:connect statushq` again' }
  if (!response.ok) {
    const said = body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : `it answered ${response.status}`
    return { ok: false, reason: said }
  }
  if (!isReport(body))
    return { ok: false, reason: 'StatusHQ answered something that is not a sync report' }
  return { ok: true, report: body }
}

/** A sync, as the lines a terminal shows. */
export function describeRouteSync(manifest: RouteManifest, outcome: RouteSyncOutcome): string[] {
  const counts = summarizeRouteManifest(manifest)
  const found = `${counts.total} route check(s): ${counts.page} page(s), ${counts.public} public, ${counts.guard} behind auth, ${counts.validation} validated. ${counts.skipped} left out.`
  if (!outcome.ok)
    return [`StatusHQ: routes not synced (${outcome.reason})`, `  Found ${found}`]

  const { report } = outcome
  const { checks } = report
  const lines = [
    `StatusHQ: checking ${checks.total} route(s) as "${report.monitor.name}"${report.monitor.intervalSeconds ? `, every ${Math.round(report.monitor.intervalSeconds / 60)} min` : ''}.`,
    `  ${checks.added} added, ${checks.changed} changed, ${checks.removed} removed, ${checks.unchanged} unchanged. Found ${found}`,
  ]
  if (report.monitor.dashboardUrl)
    lines.push(`  Monitor: ${report.monitor.dashboardUrl}`)
  if (report.notMonitored.length) {
    lines.push(`  ${report.notMonitored.length} not monitored:`)
    for (const entry of report.notMonitored.slice(0, 10))
      lines.push(`    ${entry.id}: ${entry.reason}`)
    if (report.notMonitored.length > 10)
      lines.push(`    and ${report.notMonitored.length - 10} more`)
  }
  return lines
}

/** Whether an empty body fails an action's validation: only then may one be sent. */
export function validationOf(validations: Record<string, { rule: { validate: (value: unknown) => unknown } }> | undefined): 'required' | 'optional' | undefined {
  const rules = Object.values(validations ?? {})
  if (rules.length === 0)
    return undefined
  for (const { rule } of rules) {
    try {
      const result = rule.validate(undefined) as { valid?: unknown } | boolean | null | undefined
      // A rule that answers later is not one this can vouch for.
      if (result && typeof (result as { then?: unknown }).then === 'function')
        continue
      if (result === false || (typeof result === 'object' && result !== null && result.valid === false))
        return 'required'
    }
    catch {
      // A rule that throws on nothing refuses nothing.
      return 'required'
    }
  }
  return 'optional'
}

/**
 * The app's routes and pages, as a manifest.
 *
 * Loads the routes the way the server does, without serving. A route whose
 * action cannot be loaded is still listed: it is read as unvalidated, which
 * leaves a writing route out rather than guessing.
 */
export async function collectRouteManifest(): Promise<RouteManifest> {
  const router = await import('@stacksjs/router')
  await router.loadRoutes(await router.appRouteRegistry())

  const routes: ManifestRoute[] = []
  for (const route of router.listRegisteredRoutes()) {
    let validation: ManifestRoute['validation']
    const writes = route.method.toUpperCase() !== 'GET'
    if (writes) {
      try {
        const validations = route.action?.validations ?? (route.handler ? await router.resolveActionValidations(route.handler) : undefined)
        validation = validationOf(validations as Parameters<typeof validationOf>[0])
      }
      catch {
        validation = undefined
      }
    }
    routes.push({ method: route.method, path: route.path, name: route.name, middleware: route.middleware, validation, monitor: route.monitor })
  }

  let pages: string[] = []
  try {
    const { projectPath } = await import('@stacksjs/path')
    const { config } = await import('@stacksjs/config')
    const { scanViewSitemapEntries } = await import('@stacksjs/actions/seo')
    const scan = await scanViewSitemapEntries(projectPath('resources/views'), (config as { app?: { seo?: unknown } }).app?.seo as never)
    pages = scan.entries.map((entry) => {
      const loc = String((entry as { loc?: unknown, path?: unknown }).path ?? (entry as { loc?: unknown }).loc ?? '')
      try {
        return new URL(loc, 'http://app.invalid').pathname
      }
      catch {
        return ''
      }
    }).filter(Boolean)
  }
  catch {
    // An app with no views, or a page scan that cannot run, still has routes.
  }

  return buildRouteManifest(routes, pages)
}
