/**
 * Cache Options - Configuration for the caching system
 */
export interface CacheOptions {
  /**
   * **Cache Driver**
   *
   * The cache driver that will be used by your application to store
   * cached data. Supports 'memory' and 'redis' drivers.
   *
   * @default "memory"
   */
  driver: 'memory' | 'redis'

  /**
   * **Cache Prefix**
   *
   * The prefix used when storing items in the cache. Useful when
   * multiple applications share the same cache driver.
   *
   * @default "stacks"
   */
  prefix: string

  /**
   * **Cache TTL**
   *
   * Default time to live for items stored in the cache (in seconds).
   * Use 0 for no expiration.
   *
   * @default 3600
   */
  ttl: number

  /**
   * **Max Keys**
   *
   * Maximum number of keys to store in the cache.
   * Use -1 for unlimited.
   *
   * @default -1
   */
  maxKeys?: number

  /**
   * **Use Clones**
   *
   * Whether to clone values when getting/setting.
   * Disable for better performance with immutable data.
   *
   * @default true
   */
  useClones?: boolean

  /**
   * **Driver-specific configurations**
   */
  drivers: {
    redis?: {
      /**
       * Redis connection URL
       * @example "redis://localhost:6379"
       */
      url?: string

      /**
       * Redis Host
       * @default "localhost"
       */
      host: string

      /**
       * Redis Port
       * @default 6379
       */
      port: number

      /**
       * Redis Username
       */
      username?: string

      /**
       * Redis Password
       */
      password?: string

      /**
       * Redis Database number
       * @default 0
       */
      database?: number

      /**
       * Enable TLS
       * @default false
       */
      tls?: boolean
    }

    memory?: {
      /**
       * Maximum number of keys
       * @default -1
       */
      maxKeys?: number

      /**
       * Check period for expired keys (in seconds)
       * @default 600
       */
      checkPeriod?: number

      /**
       * Delete keys on expire
       * @default true
       */
      deleteOnExpire?: boolean
    }
  }
}

export type CacheConfig = Partial<CacheOptions>

/**
 * Cache Driver Interface - Defines the API for all cache implementations
 */
export interface CacheDriver {
  /**
   * Get a cached value
   */
  get: <T>(key: string) => Promise<T | undefined>

  /**
   * Get multiple cached values
   */
  mget: <T>(keys: string[]) => Promise<Record<string, T>>

  /**
   * Set a cached value with optional TTL (in seconds)
   */
  set: <T>(key: string, value: T, ttl?: number) => Promise<boolean>

  /**
   * Set multiple cached values
   */
  mset: <T>(entries: Array<{ key: string, value: T, ttl?: number }>) => Promise<boolean>

  /**
   * Set a cached value that never expires
   */
  setForever: <T>(key: string, value: T) => Promise<boolean>

  /**
   * Get a value or set it if not cached
   */
  getOrSet: <T>(key: string, fetcher: () => T | Promise<T>, ttl?: number) => Promise<T>

  /**
   * Delete one or more keys
   */
  del: (keys: string | string[]) => Promise<number>

  /**
   * Check if a key exists
   */
  has: (key: string) => Promise<boolean>

  /**
   * Check if a key is missing
   */
  missing: (key: string) => Promise<boolean>

  /**
   * Delete a single key (alias for del)
   */
  remove: (key: string) => Promise<void>

  /**
   * Delete multiple keys
   */
  deleteMany: (keys: string[]) => Promise<number>

  /**
   * Clear all cached values
   */
  clear: () => Promise<void>

  /**
   * Clear all cached values (alias for clear)
   */
  flush: () => Promise<void>

  /**
   * Get all keys matching a pattern
   */
  keys: (pattern?: string) => Promise<string[]>

  /**
   * Get the TTL of a key (in seconds)
   */
  getTtl: (key: string) => Promise<number | undefined>

  /**
   * Set/update the TTL of a key
   */
  ttl: (key: string, ttl: number) => Promise<boolean>

  /**
   * Get a value and delete it atomically
   */
  take: <T>(key: string) => Promise<T | undefined>

  /**
   * Get cache statistics
   */
  getStats: () => Promise<CacheStats>

  /**
   * Close the cache connection
   */
  close: () => Promise<void>

  /**
   * Disconnect from the cache (alias for close)
   */
  disconnect: () => Promise<void>
}

/**
 * Cache Statistics
 */
export interface CacheStats {
  hits: number
  misses: number
  keys: number
  size?: number
  hitRate?: number
}
