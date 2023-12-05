import type { ApiConfig } from 'stacks:types'
import { env } from 'stacks:env'

/**
 * **API Configuration**
 *
 * This configuration defines all of your API options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  prefix: env.API_PREFIX || 'api',
  description: 'Stacks API',
  memorySize: 512,
  prewarm: 10,
  timeout: 30,
} satisfies ApiConfig
