import { defineQueue } from 'stacks/core/utils/src'

/**
 * **Queue Options**
 *
 * This configuration defines all of your search engine options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default defineQueue({
  default: 'sync',

  connections: {
    sync: {
      driver: 'sync',
    },

    database: {
      driver: 'database',
      table: 'jobs',
      queue: 'default',
      retry_after: 90,
    },

    redis: {
      driver: 'redis',
      connection: 'default',
      queue: 'default',
      retry_after: 90,
    },

    sqs: {
      driver: 'sqs',
      key: '',
      secret: '',
      prefix: '',
      suffix: '',
      queue: 'default',
      region: 'us-east-1',
    },
  },

})
