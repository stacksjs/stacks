import type { AnalyticsConfig } from '@stacksjs/types'

/**
 * **Analytics Configuration**
 *
 * This configuration defines all of your Analytics options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  driver: 'analyticshq',
  environments: ['production', 'staging'],

  drivers: {
    analyticshq: {
      siteId: 'd61994a9bf380d24c81029c3',
    },
  },
} satisfies AnalyticsConfig
