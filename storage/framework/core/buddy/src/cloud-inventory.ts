/**
 * Read-only inventory of what is hosted on which server.
 *
 * Consolidating boxes (stacksjs/stacks#2342) starts with a question nothing
 * could answer: what is actually running on each server? `config/cloud.ts`
 * cannot answer it. It describes ONE project's sites, and the boxes are
 * multi-tenant - other projects deploy onto them from their own repositories
 * with `cloud.attachTo`, and their sites appear nowhere in this file. Reading
 * config here and calling it an inventory would report a shared box as if this
 * project were alone on it, which is exactly the wrong answer to act on.
 *
 * So the inventory is assembled from three sources, weakest to strongest:
 *
 *  1. `config/cloud.ts` - what THIS project intends to deploy, and where.
 *  2. The provider API - which servers exist, and which project owns each
 *     (ts-cloud stamps `ts-cloud/project`, `/environment` and `/role` labels
 *     on every box it provisions).
 *  3. The box's own rpx registry (`/etc/rpx/sites.d`) - one JSON fragment per
 *     project, holding every route that project serves here. This is the only
 *     source that sees co-tenants, so it is the one that decides what is
 *     hosted where. `@stacksjs/ts-cloud` already builds and parses it for the
 *     port allocator; this module reuses those primitives rather than
 *     inventing a second reading of the same files.
 *
 * The pure half (shaping, reconciling, rendering) is separated from the two IO
 * calls so the reconciliation can be tested without a server or a token.
 */

/** A server as reported by the provider, with its ts-cloud identity resolved. */
export interface InventoryServer {
  id: string
  name: string
  status: string
  ipv4?: string
  ipv6?: string
  type?: string
  location?: string
  labels: Record<string, string>
  /** `ts-cloud/project`: the project that provisioned and owns this box. */
  project?: string
  /** `ts-cloud/environment`: production, staging, ... */
  environment?: string
  /** `ts-cloud/role`: app, services, lb. */
  role?: string
}

/** One site this project declares in `config/cloud.ts`. */
export interface DeclaredSite {
  name: string
  kind: string
  domain?: string
  path: string
  port?: number
  /** `/var/www/<slug>-<name>`, the install base ts-cloud derives. */
  installBase?: string
  /**
   * No `domain`, so the gateway never routes it and it cannot appear in the
   * box's registry. That is a deliberate configuration (loopback-only
   * services reached through another site's proxy), not a missing deploy.
   */
  loopbackOnly: boolean
}

/** One route the box serves, as recorded by the project that deployed it. */
export interface HostedRoute {
  /** The project that owns this route (the fragment's `slug`). */
  slug: string
  host: string
  path: string
  /** Where the route goes: an upstream, a static dir, or a redirect target. */
  target: string
  kind: 'app' | 'static' | 'redirect' | 'unknown'
}

/** What a box answered when asked for its registry. */
export interface HostProbe {
  server: string
  ip?: string
  routes: HostedRoute[]
  /** Why the probe produced nothing, when it produced nothing. */
  unavailable?: string
}

/** Declared sites lined up against what a box actually serves. */
export interface Reconciliation {
  /** Declared here and present on the box. */
  present: DeclaredSite[]
  /** Declared here, routable, and absent from the box's registry. */
  absent: DeclaredSite[]
  /** Declared here with no domain: no gateway route by design. */
  loopback: DeclaredSite[]
  /** Routes on the box owned by some other project. */
  foreign: HostedRoute[]
}

const LABEL_PROJECT = 'ts-cloud/project'
const LABEL_ENVIRONMENT = 'ts-cloud/environment'
const LABEL_ROLE = 'ts-cloud/role'

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/**
 * Shape one provider server record into the inventory's own type.
 *
 * Written against the Hetzner server payload (the shape `resolveAttachTargetBox`
 * in the deploy command already reads), but only touches fields any provider
 * listing carries, so an AWS/local-box listing can be mapped onto it too.
 */
/**
 * One provider server record, as the listing returns it.
 *
 * Written against the Hetzner payload and naming only the fields this function
 * reads, so another provider's listing satisfies it too. Every field is
 * optional and `unknown` because it is JSON from an external API: `text()` is
 * what turns each one into a string or nothing.
 */
export interface ProviderServerPayload {
  id?: unknown
  name?: unknown
  status?: unknown
  labels?: Record<string, unknown>
  public_net?: { ipv4?: { ip?: unknown }, ipv6?: { ip?: unknown } }
  server_type?: { name?: unknown }
  datacenter?: { name?: unknown, location?: { name?: unknown } }
}

export function toInventoryServer(raw: ProviderServerPayload | null | undefined): InventoryServer {
  const labels: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw?.labels ?? {})) {
    if (typeof value === 'string')
      labels[key] = value
  }

  return {
    id: String(raw?.id ?? ''),
    name: text(raw?.name) ?? '(unnamed)',
    status: text(raw?.status) ?? 'unknown',
    ipv4: text(raw?.public_net?.ipv4?.ip),
    ipv6: text(raw?.public_net?.ipv6?.ip),
    type: text(raw?.server_type?.name),
    location: text(raw?.datacenter?.location?.name) ?? text(raw?.datacenter?.name),
    labels,
    project: text(labels[LABEL_PROJECT]),
    environment: text(labels[LABEL_ENVIRONMENT]),
    role: text(labels[LABEL_ROLE]),
  }
}

/**
 * The sites this project declares, in the same terms the box reports.
 *
 * `kind` and `installBase` come from ts-cloud when it is loadable, because
 * `siteInstallBase` is documented as the single source of truth for the
 * install path and a second copy of that rule here would be free to drift.
 * When ts-cloud cannot be loaded the site is still listed, without them: a
 * partial inventory beats no inventory, and every other field is local.
 */
export function declaredSites(
  sites: Record<string, any> | undefined,
  helpers?: { resolveSiteKind?: (site: any) => string, siteInstallBase?: (slug: string, site: string) => string },
  slug?: string,
): DeclaredSite[] {
  return Object.entries(sites ?? {}).map(([name, site]) => {
    const domain = text(site?.domain)
    const port = Number(site?.port)

    return {
      name,
      kind: helpers?.resolveSiteKind?.(site) ?? 'unknown',
      domain,
      path: text(site?.path) ?? '/',
      port: Number.isFinite(port) && port > 0 ? port : undefined,
      installBase: slug && helpers?.siteInstallBase ? helpers.siteInstallBase(slug, name) : undefined,
      loopbackOnly: !domain,
    }
  })
}

/**
 * Flatten the box's registry fragments into one route list.
 *
 * A fragment is `{ slug, ...RpxGatewayConfig }`, so `proxies` carries the
 * routes: `to` is the public host, `path` the prefix it owns, and exactly one
 * of `from` / `static` / `redirect` says where it goes. A fragment written by
 * an older ts-cloud may have no `slug`, which the writer defaults to `app`.
 */
/**
 * One `/etc/rpx/sites.d` fragment, as parsed off the box.
 *
 * Every field is optional and `unknown`, because this is JSON written by
 * another machine and read here defensively - `text()` and the `typeof` tests
 * below are what turn it into something usable. As `any` those checks were
 * indistinguishable from probing for fields that never existed.
 */
export interface HostRouteFragment {
  slug?: unknown
  proxies?: unknown
}

/** One proxy entry inside a fragment, in the same spirit. */
export interface HostRouteProxy {
  to?: unknown
  path?: unknown
  from?: unknown
  static?: unknown
  redirect?: unknown
}

export function routesFromFragments(fragments: readonly HostRouteFragment[]): HostedRoute[] {
  const routes: HostedRoute[] = []

  for (const fragment of fragments) {
    const slug = text(fragment?.slug) ?? 'app'

    // One cast, at the boundary where remote JSON becomes a known shape.
    const proxies: HostRouteProxy[] = Array.isArray(fragment?.proxies) ? fragment.proxies as HostRouteProxy[] : []

    for (const proxy of proxies) {
      const host = text(proxy?.to)
      if (!host)
        continue

      routes.push({
        slug,
        host,
        path: text(proxy?.path) ?? '/',
        ...describeRouteTarget(proxy),
      })
    }
  }

  return routes.sort((a, b) => a.slug.localeCompare(b.slug) || a.host.localeCompare(b.host) || a.path.localeCompare(b.path))
}

function describeRouteTarget(proxy: HostRouteProxy | null | undefined): { target: string, kind: HostedRoute['kind'] } {
  const from = proxy?.from
  if (typeof from === 'string' && from.trim())
    return { target: from.trim(), kind: 'app' }
  if (Array.isArray(from) && from.length)
    return { target: from.filter((u: unknown) => typeof u === 'string').join(', '), kind: 'app' }

  const staticRoute = proxy?.static
  if (typeof staticRoute === 'string' && staticRoute.trim())
    return { target: staticRoute.trim(), kind: 'static' }
  if (staticRoute && typeof staticRoute === 'object') {
    const dir = text((staticRoute as { dir?: unknown }).dir)
    if (dir)
      return { target: dir, kind: 'static' }
  }

  const redirect = text((proxy?.redirect as { to?: unknown } | null | undefined)?.to) ?? text(proxy?.redirect)
  if (redirect)
    return { target: redirect, kind: 'redirect' }

  return { target: '(no upstream)', kind: 'unknown' }
}

/**
 * Line this project's declared sites up against what the box serves.
 *
 * Matching is on host + path rather than on the site key, because the site key
 * is local to a repository and the box has no idea what it is. Two projects
 * both calling a site `main` is normal; two projects serving the same host and
 * path is the collision worth seeing.
 */
export function reconcile(declared: readonly DeclaredSite[], routes: readonly HostedRoute[], slug: string): Reconciliation {
  const ours = new Set(
    routes.filter(route => route.slug === slug).map(route => routeKey(route.host, route.path)),
  )

  const present: DeclaredSite[] = []
  const absent: DeclaredSite[] = []
  const loopback: DeclaredSite[] = []

  for (const site of declared) {
    if (site.loopbackOnly)
      loopback.push(site)
    else if (ours.has(routeKey(site.domain!, site.path)))
      present.push(site)
    else
      absent.push(site)
  }

  return { present, absent, loopback, foreign: routes.filter(route => route.slug !== slug) }
}

function routeKey(host: string, path: string): string {
  const normalized = path === '/' ? '/' : path.replace(/\/+$/, '')
  return `${host.toLowerCase()}${normalized || '/'}`
}

/** Group routes by the project that owns them, biggest tenant first. */
export function tenantsOf(routes: readonly HostedRoute[]): Array<{ slug: string, routes: HostedRoute[] }> {
  const bySlug = new Map<string, HostedRoute[]>()
  for (const route of routes) {
    const bucket = bySlug.get(route.slug)
    if (bucket)
      bucket.push(route)
    else
      bySlug.set(route.slug, [route])
  }

  return [...bySlug.entries()]
    .map(([slug, grouped]) => ({ slug, routes: grouped }))
    .sort((a, b) => b.routes.length - a.routes.length || a.slug.localeCompare(b.slug))
}

/**
 * Which servers this project's own sites are not accounted for on.
 *
 * A project attaches to exactly one box per environment, so its sites should
 * all show up in one place. Sites missing everywhere is the signal that
 * matters for consolidation: either they were never deployed, or they are on a
 * box this listing did not reach.
 */
export function unaccountedSites(declared: readonly DeclaredSite[], probes: readonly HostProbe[], slug: string): DeclaredSite[] {
  const seen = new Set<string>()
  for (const probe of probes) {
    for (const route of probe.routes) {
      if (route.slug === slug)
        seen.add(routeKey(route.host, route.path))
    }
  }

  return declared.filter(site => !site.loopbackOnly && !seen.has(routeKey(site.domain!, site.path)))
}

/* ------------------------------------------------------------------------ *
 * IO: the two calls that leave this machine.
 * ------------------------------------------------------------------------ */

/** Why a provider listing came back with nothing. */
export type ProviderFailure =
  | { kind: 'no-token' }
  | { kind: 'request-failed', status: number, detail?: string }

export interface ProviderListing {
  servers: InventoryServer[]
  failure?: ProviderFailure
}

/**
 * Every server in the Hetzner project, not just this one's.
 *
 * Deliberately unfiltered. `resolveAttachTargetBox` in the deploy command asks
 * the same API for ONE box by label; consolidation needs the opposite - the
 * full fleet, including boxes this project has no connection to, because
 * "which boxes could these sites move onto" is the question being answered.
 *
 * Failures are reported rather than swallowed, for the reason the deploy
 * command learned the hard way: a missing token, a 401 and an empty project
 * are three very different answers and they used to print as one.
 */
export async function listProviderServers(token: string | undefined, fetchImpl: typeof fetch = fetch): Promise<ProviderListing> {
  if (!token)
    return { servers: [], failure: { kind: 'no-token' } }

  const servers: InventoryServer[] = []
  let page = 1

  // Hetzner pages at 25 by default, so a fleet of any size needs the loop. The
  // bound stops a malformed `next_page` from spinning forever.
  while (page > 0 && page <= 40) {
    let response: Response
    try {
      response = await fetchImpl(`https://api.hetzner.cloud/v1/servers?page=${page}&per_page=50`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    }
    catch (error) {
      return { servers, failure: { kind: 'request-failed', status: 0, detail: error instanceof Error ? error.message : String(error) } }
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return { servers, failure: { kind: 'request-failed', status: response.status, detail: body.slice(0, 200) || undefined } }
    }

    const payload = await response.json().catch(() => ({})) as any
    for (const raw of (Array.isArray(payload?.servers) ? payload.servers : []))
      servers.push(toInventoryServer(raw))

    const next = Number(payload?.meta?.pagination?.next_page)
    page = Number.isFinite(next) && next > page ? next : 0
  }

  return { servers: servers.sort((a, b) => a.name.localeCompare(b.name)) }
}

/** How to phrase a provider failure for an operator. */
export function describeProviderFailure(failure: ProviderFailure): string {
  if (failure.kind === 'no-token') {
    return 'No Hetzner API token, so no servers were looked up. '
      + 'Set HCLOUD_TOKEN (or HETZNER_API_TOKEN, or hetzner.apiToken in config/cloud.ts).'
  }

  const where = failure.status > 0 ? `returned HTTP ${failure.status}` : 'could not be reached'
  return `The Hetzner API ${where}, so the server list is incomplete.${failure.detail ? ` ${failure.detail}` : ''}`
    + (failure.status === 401 || failure.status === 403
      ? ' That is an auth failure, not an empty project: check the token is valid for this Hetzner project.'
      : '')
}

/**
 * Where the rpx gateway keeps one registry fragment per project.
 *
 * Duplicated from ts-cloud's `HOST_SITES_DIR` rather than imported, because
 * that module (`deploy/site-ports`) publishes a `.d.ts` with no JavaScript
 * behind it - the whole file is types-only in 0.12.4 and 0.12.7, so
 * `buildHostSitePortsScript` and `parseHostSiteFragments` type-check on import
 * and then throw at runtime. Reported upstream; when they become loadable,
 * delete both helpers below and call ts-cloud's.
 */
export const HOST_SITES_DIR = '/etc/rpx/sites.d'

/**
 * A shell snippet dumping every registry fragment, one base64 line per file.
 *
 * base64 rather than `cat`, because the fragments are pretty-printed JSON
 * spanning many lines and this keeps the output unambiguously one record per
 * line without needing a JSON tool on the box. A missing directory prints
 * nothing and reads back as "no co-tenants", which is the truth on a box that
 * has never been deployed to.
 */
export function buildHostRoutesScript(sitesDir: string = HOST_SITES_DIR): string {
  return `d='${sitesDir}'
[ -d "$d" ] || exit 0
find "$d" -maxdepth 1 -type f -name '*.json' | sort | while IFS= read -r f; do
  base64 < "$f" | tr -d '\\n'
  echo
done`
}

/**
 * Parse {@link buildHostRoutesScript} output into fragments.
 *
 * A line that will not decode or parse is skipped rather than thrown, matching
 * how the box's own assembler treats a corrupt fragment: one bad file must not
 * take the listing down. The cost is that its routes are invisible here, which
 * is still strictly more than the nothing this command could see before.
 */
export function parseHostRoutesOutput(stdout: string): HostRouteFragment[] {
  const fragments: HostRouteFragment[] = []

  for (const line of stdout.split('\n')) {
    const encoded = line.trim()
    if (!encoded)
      continue

    try {
      fragments.push(JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')))
    }
    catch {
      // Skip: see the note above.
    }
  }

  return fragments
}

/**
 * Ask one box what it serves.
 *
 * Never throws. A box that is off, unreachable, or refuses the key returns an
 * `unavailable` reason instead, so one unreachable server does not cost the
 * listing of every other one - the same failure the captured-mail inbox had,
 * where a single bad record 503'd the whole endpoint.
 */
export async function probeHostRoutes(
  server: InventoryServer,
  exec: (host: string, command: string) => Promise<{ code: number, stdout: string, stderr: string }>,
): Promise<HostProbe> {
  if (!server.ipv4)
    return { server: server.name, routes: [], unavailable: 'no public IPv4 address to reach it on' }

  if (server.status !== 'running')
    return { server: server.name, ip: server.ipv4, routes: [], unavailable: `server is ${server.status}` }

  try {
    const result = await exec(server.ipv4, buildHostRoutesScript())
    if (result.code !== 0) {
      const reason = result.stderr.trim().split('\n')[0] || `ssh exited ${result.code}`
      return { server: server.name, ip: server.ipv4, routes: [], unavailable: reason }
    }

    return { server: server.name, ip: server.ipv4, routes: routesFromFragments(parseHostRoutesOutput(result.stdout)) }
  }
  catch (error) {
    return {
      server: server.name,
      ip: server.ipv4,
      routes: [],
      unavailable: error instanceof Error ? error.message.split('\n')[0] : String(error),
    }
  }
}

/* ------------------------------------------------------------------------ *
 * Rendering.
 * ------------------------------------------------------------------------ */

export interface Inventory {
  slug: string
  environment: string
  servers: InventoryServer[]
  probes: HostProbe[]
  declared: DeclaredSite[]
  providerFailure?: ProviderFailure
}

/**
 * The listing an operator reads, as lines.
 *
 * Returned rather than logged so the format is testable and the command stays
 * a thin caller. Every count is stated so a partial answer reads as partial:
 * a box that could not be probed says so on its own line, and the summary
 * separates "not deployed" from "not visible from here".
 */
export function describeInventory(inventory: Inventory): string[] {
  const lines: string[] = []
  const { slug, servers, probes, declared } = inventory

  if (inventory.providerFailure)
    lines.push(describeProviderFailure(inventory.providerFailure), '')

  if (servers.length === 0) {
    lines.push('No servers found.')
  }
  else {
    lines.push(`${servers.length} server${servers.length === 1 ? '' : 's'}:`, '')
  }

  const probesByServer = new Map(probes.map(probe => [probe.server, probe]))

  for (const server of servers) {
    const facts = [server.ipv4, server.type, server.location, server.status].filter(Boolean)
    lines.push(`  ${server.name}  ${facts.join('  ')}`)
    lines.push(`    ${describeOwnership(server)}`)

    const probe = probesByServer.get(server.name)
    if (!probe) {
      lines.push('    not probed (--no-remote), so co-tenants on this box are not listed')
      lines.push('')
      continue
    }

    if (probe.unavailable) {
      lines.push(`    could not read ${HOST_SITES_DIR}: ${probe.unavailable}`)
      lines.push('')
      continue
    }

    const tenants = tenantsOf(probe.routes)
    if (tenants.length === 0) {
      lines.push(`    serves nothing: ${HOST_SITES_DIR} is empty or absent`)
      lines.push('')
      continue
    }

    lines.push(`    serves ${probe.routes.length} route${probe.routes.length === 1 ? '' : 's'} for ${tenants.length} project${tenants.length === 1 ? '' : 's'}:`)
    for (const tenant of tenants) {
      lines.push(`      ${tenant.slug}${tenant.slug === slug ? ' (this project)' : ''}`)
      for (const route of tenant.routes)
        lines.push(`        ${route.host}${route.path === '/' ? '/' : route.path}  ->  ${describeTarget(route)}`)
    }

    lines.push('')
  }

  lines.push(...describeDeclared(inventory))

  return lines
}

function describeOwnership(server: InventoryServer): string {
  if (!server.project)
    return 'no ts-cloud labels: provisioned outside ts-cloud, or by a version that did not label boxes'

  const detail = [server.environment, server.role && `role ${server.role}`].filter(Boolean).join(', ')
  return `owned by '${server.project}'${detail ? ` (${detail})` : ''}`
}

function describeTarget(route: HostedRoute): string {
  if (route.kind === 'redirect')
    return `redirect to ${route.target}`
  if (route.kind === 'static')
    return `static ${route.target}`
  return route.target
}

function describeDeclared(inventory: Inventory): string[] {
  const { slug, declared, probes } = inventory
  if (declared.length === 0)
    return [`This project ('${slug}') declares no sites in config/cloud.ts.`]

  const lines = [`This project ('${slug}') declares ${declared.length} site${declared.length === 1 ? '' : 's'}: ${declared.map(site => site.name).join(', ')}`]
  const loopback = declared.filter(site => site.loopbackOnly)

  if (loopback.length > 0) {
    lines.push(
      `  ${loopback.length} with no domain, so the gateway never routes ${loopback.length === 1 ? 'it' : 'them'} `
      + `(reached through another site's proxy): ${loopback.map(site => site.name).join(', ')}`,
    )
  }

  // Reconciliation needs at least one box that actually answered. Without one,
  // every routable site is "not found", which is a true statement about this
  // listing and a false one about the deployment - the shape of wrong answer
  // this command exists to stop producing.
  const answered = probes.filter(probe => !probe.unavailable)
  if (answered.length === 0) {
    lines.push('  Nothing to reconcile them against: no box reported what it serves.')
    return lines
  }

  const unaccounted = unaccountedSites(declared, answered, slug)
  lines.push(`  ${declared.length - loopback.length - unaccounted.length} routed by a box above`)

  if (unaccounted.length > 0) {
    // Two very different causes, and this listing cannot tell them apart, so
    // it must not pick one: an undeployed site and a site on a box that was
    // not read look identical from here.
    lines.push(`  ${unaccounted.length} not routed by any box above: ${unaccounted.map(site => site.name).join(', ')}`)
    const unread = probes.length - answered.length
    const unprobed = inventory.servers.length - probes.length
    if (unread > 0)
      lines.push(`    Either they were never deployed, or they are on one of the ${unread} server${unread === 1 ? '' : 's'} that could not be read.`)
    else if (unprobed > 0)
      lines.push(`    Either they were never deployed, or they are on one of the ${unprobed} server${unprobed === 1 ? '' : 's'} this run did not probe.`)
    else
      lines.push('    Either they were never deployed, or they are on a server outside this provider account.')
  }

  return lines
}
