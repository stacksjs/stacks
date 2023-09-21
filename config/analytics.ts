import type { AnalyticsConfig } from '@stacksjs/types'

/**
 * **Analytics Configuration**
 *
 * This configuration defines all of your Analytics options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  driver: 'fathom',

  drivers: {
    googleAnalytics: {
      trackingId: 'UA-XXXXXXXXX-X',
    },

    fathom: {
      siteId: 'WOLZMJDL',
    },
  },
} satisfies AnalyticsConfig
