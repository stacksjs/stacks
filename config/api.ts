import { env } from '@stacksjs/env'
import type { ApiConfig } from '@stacksjs/types'

/**
 * **API**
 *
 * This configuration defines your API. Because Stacks is fully-typed, you may hover
 * any of the options below and the definitions will be provided. In case you have
 * any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  prefix: env.API_PREFIX || 'api',
  // version: 'v1',
  description: 'My awesome Stacks API',
  deploy: true,
  memorySize: 512,
  prewarm: 10,
  timeout: 30,
} satisfies ApiConfig
