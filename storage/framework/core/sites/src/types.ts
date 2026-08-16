/**
 * What the resolver hands the rest of the request: enough to scope queries,
 * theme a render, and build absolute URLs - without another DB round trip.
 */
export interface SiteContext {
  id: number
  uuid: string
  name: string
  /** The subdomain under `config.sites.baseDomain`, e.g. `stmarks`. */
  subdomain: string
  /** The host that matched THIS request (custom domain or subdomain form). */
  host: string
  /** Owning team, for dashboard authorization. Null for unowned sites. */
  teamId: number | null
  status: string
  settings: Record<string, unknown>
}

/** The pieces of `config.sites` the resolver actually reads, resolved to values. */
export interface ResolvedSitesOptions {
  enabled: boolean
  baseDomain: string
  platformHosts: string[]
  strict: boolean
  trustProxyHost: boolean
  cacheTtlSeconds: number
}

export type HostKind
  = | { kind: 'platform' }
    | { kind: 'subdomain', subdomain: string }
    | { kind: 'custom', domain: string }

/**
 * The storage seam the resolver reads through, injectable so the pure
 * resolution pipeline is testable without a database. The default store
 * queries `sites` / `site_domains` via `@stacksjs/database`.
 */
export interface SiteStore {
  /** Site by verified custom domain, or null. */
  byDomain: (domain: string) => Promise<SiteContext | null>
  /** Site by subdomain slug, or null. */
  bySubdomain: (subdomain: string) => Promise<SiteContext | null>
}
