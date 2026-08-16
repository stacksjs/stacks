import type { HostKind, ResolvedSitesOptions, SiteContext, SiteStore } from './types'
import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database'

/**
 * Lowercase, strip the port and any trailing dot. `Host: StMarks.CampusHQ.com:443.`
 * and `stmarks.campushq.com` are the same site; DNS names are case-insensitive
 * and the port is transport, not identity.
 *
 * IDN hosts arrive from the browser already punycoded (`xn--...`), so domains
 * must be STORED punycoded; this function does not transcode.
 */
export function normalizeHost(raw: string | null | undefined): string {
  if (!raw)
    return ''

  let host = raw.trim().toLowerCase()

  // IPv6 literal like [::1]:3000 - the bracket form has no site semantics,
  // but strip the port off cleanly rather than mangling on the wrong colon.
  if (host.startsWith('[')) {
    const close = host.indexOf(']')
    if (close !== -1)
      host = host.slice(0, close + 1)
  }
  else {
    const colon = host.indexOf(':')
    if (colon !== -1)
      host = host.slice(0, colon)
  }

  return host.endsWith('.') ? host.slice(0, -1) : host
}

/** `config.sites` with every field resolved to a concrete value. */
export function sitesOptions(): ResolvedSitesOptions {
  const raw = (config as { sites?: Partial<ResolvedSitesOptions> }).sites ?? {}
  return {
    enabled: raw.enabled ?? false,
    baseDomain: normalizeHost(raw.baseDomain ?? ''),
    platformHosts: (raw.platformHosts ?? []).map(normalizeHost),
    strict: raw.strict ?? false,
    trustProxyHost: raw.trustProxyHost ?? true,
    cacheTtlSeconds: raw.cacheTtlSeconds ?? 60,
  }
}

/**
 * Pure classification of a normalized host. Platform wins over subdomain so
 * the app's own hosts (`www.<baseDomain>`, the apex itself) can never resolve
 * as tenants even when they syntactically look like one.
 */
export function classifyHost(host: string, options: Pick<ResolvedSitesOptions, 'baseDomain' | 'platformHosts'>): HostKind {
  if (!host || options.platformHosts.includes(host))
    return { kind: 'platform' }

  const base = options.baseDomain
  if (base && host === base)
    return { kind: 'platform' }

  if (base && host.endsWith(`.${base}`)) {
    const sub = host.slice(0, -(base.length + 1))
    // Only one label deep: `a.b.campushq.com` is not a site slug, and `www`
    // belongs to the platform.
    if (sub && !sub.includes('.') && sub !== 'www')
      return { kind: 'subdomain', subdomain: sub }
    return { kind: 'platform' }
  }

  return { kind: 'custom', domain: host }
}

/**
 * The Host header this request should be judged by. Prefers the proxy's
 * `X-Forwarded-Host` when configured to (both the stx views proxy and the rpx
 * gateway forward it); otherwise the connection's own Host.
 */
export function requestHost(headers: Headers, options: Pick<ResolvedSitesOptions, 'trustProxyHost'>): string {
  const forwarded = options.trustProxyHost ? headers.get('x-forwarded-host') : null
  // A proxy chain may append hops comma-separated; the first is the client-facing one.
  const first = forwarded?.split(',')[0]
  return normalizeHost(first || headers.get('host'))
}

function rowToContext(row: Record<string, unknown>, host: string): SiteContext {
  let settings: Record<string, unknown> = {}
  const rawSettings = row.settings
  if (typeof rawSettings === 'string' && rawSettings) {
    try {
      settings = JSON.parse(rawSettings) as Record<string, unknown>
    }
    catch {
      // A malformed settings blob should not take the site down.
    }
  }
  else if (rawSettings && typeof rawSettings === 'object') {
    settings = rawSettings as Record<string, unknown>
  }

  return {
    id: Number(row.id),
    uuid: String(row.uuid ?? ''),
    name: String(row.name ?? ''),
    subdomain: String(row.subdomain ?? ''),
    host,
    teamId: row.team_id == null ? null : Number(row.team_id),
    status: String(row.status ?? 'active'),
    settings,
  }
}

const SITE_COLUMNS = ['id', 'uuid', 'name', 'subdomain', 'team_id', 'status', 'settings'] as const

/** The default store: `sites` + `site_domains` via the query builder. */
export const databaseSiteStore: SiteStore = {
  async byDomain(domain: string): Promise<SiteContext | null> {
    const link = await db
      .selectFrom('site_domains')
      .where('domain', '=', domain)
      .where('verified_at', 'is not', null)
      .select(['site_id'])
      .executeTakeFirst() as { site_id: number } | undefined

    if (!link)
      return null

    const site = await db
      .selectFrom('sites')
      .where('id', '=', link.site_id)
      .where('status', '=', 'active')
      .select([...SITE_COLUMNS])
      .executeTakeFirst() as Record<string, unknown> | undefined

    return site ? rowToContext(site, domain) : null
  },

  async bySubdomain(subdomain: string): Promise<SiteContext | null> {
    const site = await db
      .selectFrom('sites')
      .where('subdomain', '=', subdomain)
      .where('status', '=', 'active')
      .select([...SITE_COLUMNS])
      .executeTakeFirst() as Record<string, unknown> | undefined

    return site ? rowToContext(site, `${subdomain}.${sitesOptions().baseDomain}`) : null
  },
}

// host -> { site, expiresAt }. In-process rather than the cache driver: the
// lookup sits on EVERY request, misses must stay cheap, and a 60s TTL bounds
// staleness tightly enough that cross-process invalidation isn't worth a
// network hop. `clearSiteCache()` is wired to Site/SiteDomain observe events
// for the common single-process case.
const CACHE_KEY = Symbol.for('stacks.sites.hostCache')
const hostCache = ((globalThis as Record<symbol, unknown>)[CACHE_KEY]
  ??= new Map<string, { site: SiteContext | null, expiresAt: number }>()) as Map<string, { site: SiteContext | null, expiresAt: number }>

export function clearSiteCache(): void {
  hostCache.clear()
}

/**
 * Host -> site, cached. Null means "no such site": platform hosts, unknown
 * hosts, and disabled multi-site all land there - `strict` decides what the
 * caller does about unknown ones.
 */
export async function resolveSiteByHost(
  rawHost: string,
  store: SiteStore = databaseSiteStore,
  options: ResolvedSitesOptions = sitesOptions(),
): Promise<SiteContext | null> {
  if (!options.enabled)
    return null

  const host = normalizeHost(rawHost)
  if (!host)
    return null

  const cached = hostCache.get(host)
  if (cached && cached.expiresAt > Date.now())
    return cached.site

  const kind = classifyHost(host, options)
  let site: SiteContext | null = null
  if (kind.kind === 'custom')
    site = await store.byDomain(kind.domain)
  else if (kind.kind === 'subdomain')
    site = await store.bySubdomain(kind.subdomain)

  hostCache.set(host, { site, expiresAt: Date.now() + options.cacheTtlSeconds * 1000 })
  return site
}

/** Is this host the app itself rather than a tenant site? */
export function isPlatformHost(rawHost: string, options: ResolvedSitesOptions = sitesOptions()): boolean {
  return classifyHost(normalizeHost(rawHost), options).kind === 'platform'
}
