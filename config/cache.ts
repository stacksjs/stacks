import type { CacheConfig } from '@stacksjs/types'

/**
 * **Cache Configuration**
 *
 * This configuration defines all of your cache options. Stacks cache is
 * powered by ts-cache, providing high-performance caching with support
 * for memory and Redis drivers.
 */
export default {
  /**
   * The cache driver to use ('memory' or 'redis')
   */
  driver: 'memory',

  /**
   * Key prefix for cache namespacing
   */
  prefix: 'stacks',

  /**
   * Default TTL in seconds (0 = no expiration)
   */
  ttl: 3600,

  /**
   * Maximum number of keys (-1 = unlimited)
   */
  maxKeys: -1,

  /**
   * Clone values on get/set (disable for better performance with immutable data)
   */
  useClones: true,

  drivers: {
    /**
     * Memory driver configuration
     */
    memory: {
      maxKeys: -1,
      checkPeriod: 600,
      deleteOnExpire: true,
    },

    /**
     * Redis driver configuration
     */
    redis: {
      host: '127.0.0.1',
      port: 6379,
      username: '',
      password: '',
      database: 0,
      tls: false,
    },
  },
} satisfies CacheConfig
