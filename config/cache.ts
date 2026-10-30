import type { CacheConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

/**
 * **Cache Configuration**
 *
 * This configuration defines all of your cache options. Stacks cache is
 * powered by ts-cache, providing high-performance caching with support
 * for memory and Redis drivers.
 */
export default {
  /**
   * The cache driver the default `cache` uses: 'memory', 'redis',
   * 'singlestore', or 'sqlite' (entries kept in a file, across restarts and
   * deploys).
   */
  driver: 'memory',

  /**
   * Key prefix for cache namespacing
   */
  prefix: 'stacks:cache',

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
    // The same variables as the Redis queue driver in config/queue.ts. A
    // REDIS_URL wins; otherwise the parts build one, and an empty value
    // counts as unset.
    redis: {
      url: String(env.REDIS_URL || ''),
      host: String(env.REDIS_HOST || 'localhost'),
      port: Number(env.REDIS_PORT || 6379),
      username: String(env.REDIS_USERNAME || ''),
      password: String(env.REDIS_PASSWORD || ''),
      database: Number(env.REDIS_DB || 0),
      tls: false,
    },

    /**
     * SingleStore driver configuration
     *
     * Persists cache entries in a SingleStore rowstore table (MySQL wire
     * protocol, port 3306). Set `ssl: true` for managed SingleStore (Helios).
     */
    singlestore: {
      host: '127.0.0.1',
      port: 3306,
      username: 'root',
      password: '',
      database: 'stacks',
      table: 'stacks_cache',
      ssl: false,
    },

    /**
     * SQLite driver configuration
     *
     * Keeps entries in a table of a SQLite file, so they outlive the process.
     * Point `path` at a file the deploy keeps, such as one beside the app's
     * database.
     */
    sqlite: {
      path: 'storage/framework/cache/cache.sqlite',
      table: 'stacks_cache',
    },
  },
} satisfies CacheConfig
