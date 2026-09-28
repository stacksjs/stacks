import type { AnalyticsConfig } from '@stacksjs/types'

/**
 * AnalyticsHQ is Stacks' first-party analytics driver. Paste the site id from
 * your AnalyticsHQ app to enable it. An empty site id emits no tracking tags.
 */
export default {
  driver: 'analyticshq',
  environments: ['production', 'staging'],

  drivers: {
    analyticshq: {
      siteId: '',
    },
  },
} satisfies AnalyticsConfig
