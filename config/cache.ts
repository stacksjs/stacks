import type { CacheConfig } from '@stacksjs/types'

// Use direct environment variable access to avoid circular dependencies
const envVars = typeof Bun !== 'undefined' ? Bun.env : process.env

/**
 * **Cache Configuration**
 *
 * This configuration defines all of your cache options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  driver: 'dynamodb',
  prefix: 'stacks',
  ttl: 3600,

  drivers: {
    dynamodb: {
      key: envVars.AWS_ACCESS_KEY_ID || '',
      secret: envVars.AWS_SECRET_ACCESS_KEY || '',
      region: envVars.AWS_DEFAULT_REGION || 'us-east-1',
      table: 'cache',
      endpoint: '',
    },

    memcached: {
      persistent_id: '',
      sasl: ['', ''],
      options: {
        // Memcached::OPT_CONNECT_TIMEOUT => 2000,
      },
      servers: [
        {
          host: '127.0.0.1',
          port: 11211,
          weight: 100,
        },
      ],
    },

    redis: {
      connection: 'cache',
      host: '127.0.0.1',
      port: 6379,
      password: '',
      username: 'stacks',
    },
  },
} satisfies CacheConfig
