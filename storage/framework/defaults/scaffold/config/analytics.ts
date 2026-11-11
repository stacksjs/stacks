import type { AnalyticsConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

/**
 * AnalyticsHQ is Stacks' first-party analytics driver. Set `ANALYTICSHQ_SITE_ID`
 * to the site id from your AnalyticsHQ app to enable it. An empty site id emits
 * no tracking tags.
 */
export default {
  driver: 'analyticshq',
  environments: ['production', 'staging'],

  drivers: {
    analyticshq: {
      siteId: env.ANALYTICSHQ_SITE_ID || '',
    },
  },
} satisfies AnalyticsConfig
