import { defineServices, env } from '@stacksjs/config'

/**
 * **Services**
 *
 * This configuration defines all of your services. Because Stacks is fully-typed, you may
 * hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineServices({
  aws: {
    appId: env('AWS_ACCESS_KEY_ID', ''),
    apiKey: env('AWS_SECRET_ACCESS_KEY', ''),
  },

  algolia: {
    appId: '',
    apiKey: '',
  },

  meilisearch: {
    appId: '',
    apiKey: '',
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

  novu: {
    key: env('NOVU_API_KEY', 'test-key'),
  },
})
