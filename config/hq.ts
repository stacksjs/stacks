import type { HqConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

/**
 * **HQ Services**
 *
 * The hosted services this app is connected to. They are separate products:
 * each has its own account, keys, plan and subscription, so each entry carries
 * its own credentials. `./buddy hq:connect` fills the matching `.env` values
 * and `./buddy hq:status` prints usage against each service's allowance.
 *
 * `key` is what the app sends with. `readKey` is what the app's own dashboard
 * reads with and must stay on the server. `config/logging.ts` and
 * `config/monitoring.ts` take their LogHQ and BugHQ settings from here.
 */
export default {
  bughq: {
    url: env.BUGHQ_HOST || 'https://bughq.org',
    key: env.BUGHQ_KEY || undefined,
    readKey: env.BUGHQ_READ_KEY || undefined,
    project: env.BUGHQ_PROJECT_ID || undefined,
  },

  loghq: {
    url: env.LOGHQ_BASE_URL || 'https://loghq.org',
    key: env.LOGHQ_KEY || undefined,
    readKey: env.LOGHQ_READ_KEY || undefined,
    project: env.LOGHQ_PROJECT_ID || undefined,
  },

  analyticshq: {
    url: env.ANALYTICSHQ_URL || 'https://analyticshq.org',
    readKey: env.ANALYTICSHQ_READ_KEY || undefined,
    project: env.ANALYTICSHQ_SITE_ID || undefined,
  },

  statushq: {
    url: env.STATUSHQ_URL || 'https://statushq.org',
    key: env.STATUSHQ_KEY || undefined,
    readKey: env.STATUSHQ_READ_KEY || undefined,
  },

  commshq: {
    url: env.COMMSHQ_URL || 'https://commshq.org',
    key: env.COMMSHQ_KEY || undefined,
    readKey: env.COMMSHQ_READ_KEY || undefined,
  },
} satisfies HqConfig
