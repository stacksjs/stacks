/**
 * ### Cache Options
 *
 * This configuration defines all of your cache options. Because Stacks is full-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */

 import { env } from "../env";

 export const cache = {
  default: env.cache_driver || 'redis',

  redis: {
    driver: 'redis',
    connection: 'cache',
    host: env.redis_host || '127.0.0.1',
    port: env.redis_port || '6379'
  },

}
