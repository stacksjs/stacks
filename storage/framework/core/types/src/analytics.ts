/**
 * **Analytics Options**
 *
 * This configuration defines all of your Analytics options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export interface AnalyticsOptions {
  /** The analytics driver/provider to use */
  driver: 'google-analytics' | 'fathom' | 'plausible' | 'self-hosted' | 'analyticshq'

  /**
   * First-party server-side pageview capture: the stx servers record page
   * GETs into `analytics_events` (name `pageview`), which is what feeds the
   * native /analytics/pages, /referrers and /devices dashboards. No script,
   * no cookies, catches no-JS traffic; assets and API calls are excluded.
   * Off by default.
   */
  capturePageviews?: boolean

  /**
   * A master switch. `false` renders no analytics at all; `true` does not
   * bypass {@link AnalyticsOptions.environments}, so it cannot be used to turn
   * production reporting on from a laptop by accident (stacksjs/stacks#2792).
   */
  enabled?: boolean

  /**
   * The `APP_ENV` labels permitted to report, checked before any driver builds
   * its tags - so an excluded environment injects no tracking script at all,
   * rather than one that reports itself as local. The label describes the
   * event; it does not stop it leaving.
   *
   * Left unset, analytics behaves exactly as it always has and reports from
   * every environment: no installation's reporting changes because this option
   * exists. Set it to adopt the gate, e.g. `['production', 'staging']` -
   * `REMOTE_TELEMETRY_ENVIRONMENTS` in `@stacksjs/env` is that pair, and what a
   * new remote-telemetry integration should default to. An empty array is off
   * everywhere.
   *
   * `APP_ENV` is a configuration label, not proof of deployment identity: a
   * command launched locally with `APP_ENV=production` passes a production
   * allowlist.
   */
  environments?: readonly string[]

  drivers: {
    /** AnalyticsHQ configuration (https://analyticshq.org, cookie-free) */
    analyticshq?: {
      /** The site id AnalyticsHQ minted (the `data-site` value in its snippet) */
      siteId: string
      /** Custom script URL, for a self-hosted instance or verified custom domain */
      scriptUrl?: string
      /** Count visitors who send Do Not Track / GPC. Skipped by default. */
      respectDnt?: boolean
      /** Report Core Web Vitals. On by default. */
      vitals?: boolean
    }
    /** Google Analytics configuration */
    googleAnalytics?: {
      /** GA4 Measurement ID (e.g., G-XXXXXXXXXX) */
      trackingId: string
      /** Enable debug mode */
      debug?: boolean
    }
    /** Fathom Analytics configuration (privacy-focused) */
    fathom?: {
      /** Fathom site ID */
      siteId: string
      /** Custom script URL */
      scriptUrl?: string
      /** Honor Do Not Track browser setting */
      honorDnt?: boolean
      /** Enable SPA mode for client-side routing */
      spa?: boolean
    }
    /** Plausible Analytics configuration (privacy-focused, open source) */
    plausible?: {
      /** Your domain (e.g., example.com) */
      domain: string
      /** Custom script URL (for self-hosted Plausible) */
      scriptUrl?: string
      /** Track localhost during development */
      trackLocalhost?: boolean
      /** Enable hash-based routing */
      hashMode?: boolean
    }
    /** Self-hosted analytics configuration (using Stacks Analytics / dynamodb-tooling) */
    selfHosted?: {
      /** Site ID for tracking */
      siteId: string
      /** API endpoint URL for collecting analytics (e.g., https://api.example.com/analytics) */
      apiEndpoint: string
      /** Honor Do Not Track browser setting */
      honorDnt?: boolean
      /** Track hash changes as page views */
      trackHashChanges?: boolean
      /** Track outbound link clicks */
      trackOutboundLinks?: boolean
    }
  }
}

export type AnalyticsConfig = Partial<AnalyticsOptions>
