/**
 * **Analytics Options**
 *
 * This configuration defines all of your Analytics options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export interface AnalyticsOptions {
  driver: 'google-analytics' | 'fathom'

  drivers: {
    googleAnalytics?: {
      trackingId: string
    }
    fathom?: {
      siteId: string
    }
  }
}

export type AnalyticsConfig = Partial<AnalyticsOptions>
