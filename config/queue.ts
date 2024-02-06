import type { QueueConfig } from '@stacksjs/types'

/**
 * **Queue Options**
 *
 * This configuration defines all of your search engine options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  default: 'sync',

  connections: {
    sync: {
      driver: 'sync',
    },

    // database: {
    //   driver: 'database',
    //   table: 'jobs',
    //   queue: 'default',
    // },

    // redis: {
    //   driver: 'redis',
    //   connection: 'default',
    //   queue: 'default',
    // },

    sqs: {
      driver: 'sqs',
      key: '', // set this if you
      secret: '',
      prefix: '',
      suffix: '',
      queue: 'default',
      region: 'us-east-1',
    },
  },
} satisfies QueueConfig
