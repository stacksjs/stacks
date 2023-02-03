// import type { ServicesOptions } from '@stacksjs/types'
import { env } from '@stacksjs/utils'

/**
 * **Services**
 *
 * This configuration defines all of your services. Because Stacks is fully-typed, you may
 * hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
// export default <ServicesOptions> {
export default {
  algolia: {
    appId: '',
    apiKey: '',
    indexName: '',
  },

  meilisearch: {
    appId: '',
    apiKey: '',
    indexName: '',
  },

  stripe: {
    appId: '',
    apiKey: '',
  },

  planetscale: {
    appId: '',
    apiKey: '',
  },

  supabase: {
    appId: '',
    apiKey: '',
  },

  aws: {
    appId: '',
    apiKey: '',
  },

  novu: {
    key: env('NOVU_API_KEY', 'test-key'),
  },
}
