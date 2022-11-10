import { env } from '@stacksjs/utils'

/**
 * ### Cache Options
 *
 * This configuration defines all of your cache options. Because Stacks is full-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export const cache = {
  default: env('CACHE_DRIVER', 'redis'),

  redis: {
    driver: 'redis',
    connection: 'cache',
    host: env('REDIS_HOST', '127.0.0.1'),
    port: env('REDIS_PORT', '6379'),
  },

}
