/**
 * **Analytics Options**
 *
 * This configuration defines all of your Analytics options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export interface AnalyticsOptions {
  /** The analytics driver/provider to use */
  driver: 'google-analytics' | 'fathom' | 'plausible' | 'self-hosted'

  drivers: {
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
