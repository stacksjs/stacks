/**
 * Multi-site (request-level tenancy) configuration.
 *
 * One Stacks app serving many public web properties, each resolved from the
 * request's Host header: either a subdomain of `baseDomain` or a verified
 * custom domain in `site_domains`. Deploy-level tenancy (`cloud.attachTo`)
 * is a different axis - that is many apps on one box; this is many sites in
 * one app.
 */
export interface SitesOptions {
  /**
   * Master switch. Disabled, the resolver never runs and every request is
   * "platform" context - the single-site behavior every existing app has.
   */
  enabled: boolean

  /**
   * The domain whose subdomains are site slugs, e.g. `campushq.com` makes
   * `stmarks.campushq.com` resolve the site with subdomain `stmarks`.
   */
  baseDomain: string

  /**
   * Hosts that are the app itself rather than a tenant site - the marketing
   * domain, the dashboard host, localhost. Requests here resolve no site and
   * are never 404'd by `strict`.
   */
  platformHosts: string[]

  /**
   * When true, a request whose host matches neither a site nor a platform
   * host is answered 404 instead of falling through as platform context.
   */
  strict: boolean

  /**
   * Honor `X-Forwarded-Host` over `Host`. Required behind the stx views
   * proxy and the rpx gateway; leave off only when clients hit the app
   * server directly (they could forge the header).
   */
  trustProxyHost: boolean

  /** Seconds a host -> site resolution stays cached in-process. */
  cacheTtlSeconds: number
}

export type SitesConfig = Partial<SitesOptions>
