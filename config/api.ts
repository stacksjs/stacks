import type { ApiConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

/**
 * **API Configuration**
 *
 * This configuration defines all of your API options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  path: env.API_PATH || '/api',
} satisfies ApiConfig
