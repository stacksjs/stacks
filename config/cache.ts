import { env } from '@stacksjs/env'
import type { CacheConfig } from '@stacksjs/types'

/**
 * **Cache Configuration**
 *
 * This configuration defines all of your cache options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  driver: env.CACHE_DRIVER || 'redis',
  prefix: env.CACHE_PREFIX || 'stacks',
  ttl: env.CACHE_TTL || 3600,

  drivers: {
    dynamodb: {
      key: env.AWS_ACCESS_KEY_ID || '',
      secret: env.AWS_SECRET_ACCESS_KEY || '',
      region: env.AWS_DEFAULT_REGION || 'us-east-1',
      table: env.DYNAMODB_CACHE_TABLE || 'cache',
      endpoint: env.DYNAMODB_ENDPOINT || '',
    },

    memcached: {
      persistent_id: env.MEMCACHED_PERSISTENT_ID || '',
      sasl: [
        env.MEMCACHED_USERNAME || '',
        env.MEMCACHED_PASSWORD || '',
      ],
      options: {
        // Memcached::OPT_CONNECT_TIMEOUT => 2000,
      },
      servers: [{
        host: env.MEMCACHED_HOST || '127.0.0.1',
        port: env.MEMCACHED_PORT || 11211,
        weight: 100,
      }],
    },

    redis: {
      connection: 'cache',
      host: env.REDIS_HOST || '127.0.0.1',
      port: env.REDIS_PORT || 6379,
    },
  },
} satisfies CacheConfig
