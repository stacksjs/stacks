import type { SitesConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

/**
 * **Sites Configuration**
 *
 * Request-level multi-site tenancy: one deployment serving many public web
 * properties, resolved per request from the Host header. A host is either
 * `{subdomain}.{baseDomain}` (a Site row's `subdomain`) or a verified custom
 * domain (a SiteDomain row). Off by default - a single-site app never runs
 * the resolver.
 */
export default {
  enabled: false,

  /** Subdomains of this domain are site slugs: `stmarks.` + baseDomain. */
  baseDomain: env.APP_URL ?? 'stacks.localhost',

  /**
   * Hosts that are the app itself (marketing site, dashboard, localhost) -
   * they resolve no site and are exempt from `strict`.
   */
  platformHosts: ['localhost', 'stacks.localhost'],

  /** 404 requests whose host matches neither a site nor a platform host. */
  strict: false,

  /**
   * Honor X-Forwarded-Host from the fronting proxy (stx views server, rpx).
   * Disable only when clients reach the app server directly.
   */
  trustProxyHost: true,

  /** Seconds a host resolution stays cached in-process. */
  cacheTtlSeconds: 60,
} satisfies SitesConfig
