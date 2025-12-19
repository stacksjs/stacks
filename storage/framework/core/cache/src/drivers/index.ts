/**
 * Stacks Cache - Powered by ts-cache
 *
 * A high-performance, type-safe caching system with support for
 * memory and Redis drivers.
 */

import type { CacheDriver, CacheStats } from '@stacksjs/types'
import { CacheManager, createCache as createTsCache, MemoryDriver, RedisDriver } from '@stacksjs/ts-cache'

/**
 * Memory cache options
 */
export interface MemoryOptions {
  /**
   * Default TTL in seconds (0 = no expiration)
   */
  stdTTL?: number

  /**
   * Check period for expired keys in seconds
   */
  checkPeriod?: number

  /**
   * Maximum number of keys (-1 = unlimited)
   */
  maxKeys?: number

  /**
   * Clone values on get/set
   */
  useClones?: boolean

  /**
   * Key prefix for namespacing
   */
  prefix?: string
}

/**
 * Redis cache options
 */
export interface RedisOptions {
  /**
   * Redis connection URL
   */
  url?: string

  /**
   * Redis host
   */
  host?: string

  /**
   * Redis port
   */
  port?: number

  /**
   * Redis username
   */
  username?: string

  /**
   * Redis password
   */
  password?: string

  /**
   * Redis database number
   */
  database?: number

  /**
   * Enable TLS
   */
  tls?: boolean

  /**
   * Default TTL in seconds
   */
  stdTTL?: number

  /**
   * Key prefix for namespacing
   */
  prefix?: string
}

/**
 * Stacks Cache Wrapper
 *
 * Wraps ts-cache's CacheManager to provide a consistent API
 * that matches the Stacks CacheDriver interface.
 */
export class StacksCache implements CacheDriver {
  private manager: CacheManager

  constructor(manager: CacheManager) {
    this.manager = manager
  }

  async get<T>(key: string): Promise<T | undefined> {
    return await this.manager.get<T>(key)
  }

  async mget<T>(keys: string[]): Promise<Record<string, T>> {
    return await this.manager.mget<T>(keys)
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    return await this.manager.set(key, value, ttl)
  }

  async mset<T>(entries: Array<{ key: string, value: T, ttl?: number }>): Promise<boolean> {
    return await this.manager.mset(entries)
  }

  async setForever<T>(key: string, value: T): Promise<boolean> {
    return await this.manager.set(key, value, 0)
  }

  async getOrSet<T>(key: string, fetcher: () => T | Promise<T>, ttl?: number): Promise<T> {
    return await this.manager.fetch(key, fetcher, ttl)
  }

  async del(keys: string | string[]): Promise<number> {
    return await this.manager.del(keys)
  }

  async has(key: string): Promise<boolean> {
    return await this.manager.has(key)
  }

  async missing(key: string): Promise<boolean> {
    return !(await this.manager.has(key))
  }

  async remove(key: string): Promise<void> {
    await this.manager.del(key)
  }

  async deleteMany(keys: string[]): Promise<number> {
    return await this.manager.del(keys)
  }

  async clear(): Promise<void> {
    await this.manager.flush()
  }

  async flush(): Promise<void> {
    await this.manager.flush()
  }

  async keys(pattern?: string): Promise<string[]> {
    return await this.manager.keys(pattern)
  }

  async getTtl(key: string): Promise<number | undefined> {
    return await this.manager.getTtl(key)
  }

  async ttl(key: string, ttl: number): Promise<boolean> {
    return await this.manager.ttl(key, ttl)
  }

  async take<T>(key: string): Promise<T | undefined> {
    return await this.manager.take<T>(key)
  }

  async getStats(): Promise<CacheStats> {
    const stats = await this.manager.getStats()
    return {
      hits: stats.hits,
      misses: stats.misses,
      keys: stats.keys,
      size: stats.size,
      hitRate: stats.hitRate,
    }
  }

  async close(): Promise<void> {
    await this.manager.close()
  }

  async disconnect(): Promise<void> {
    await this.manager.close()
  }

  /**
   * Get the underlying CacheManager for advanced usage
   */
  get cacheManager(): CacheManager {
    return this.manager
  }
}

/**
 * Create a memory cache driver
 */
export function createMemoryCache(options: MemoryOptions = {}): CacheDriver {
  const manager = createTsCache({
    driver: 'memory',
    stdTTL: options.stdTTL ?? 0,
    checkPeriod: options.checkPeriod ?? 600,
    maxKeys: options.maxKeys ?? -1,
    useClones: options.useClones ?? true,
    prefix: options.prefix,
  })

  return new StacksCache(manager)
}

/**
 * Create a Redis cache driver
 */
export function createRedisCache(options: RedisOptions = {}): CacheDriver {
  const manager = createTsCache({
    driver: 'redis',
    url: options.url,
    host: options.host ?? 'localhost',
    port: options.port ?? 6379,
    password: options.password,
    database: options.database ?? 0,
    tls: options.tls ?? false,
    stdTTL: options.stdTTL ?? 0,
    prefix: options.prefix,
  })

  return new StacksCache(manager)
}

/**
 * Create a cache driver based on the specified type
 */
export function createCache(driver: 'memory', options?: MemoryOptions): CacheDriver
export function createCache(driver: 'redis', options?: RedisOptions): CacheDriver
export function createCache(
  driver: 'memory' | 'redis',
  options?: MemoryOptions | RedisOptions,
): CacheDriver {
  if (driver === 'redis') {
    return createRedisCache(options as RedisOptions)
  }
  return createMemoryCache(options as MemoryOptions)
}

// Default memory cache instance
const defaultMemoryManager = createTsCache({
  driver: 'memory',
  stdTTL: 0,
  checkPeriod: 600,
  maxKeys: -1,
  useClones: true,
})

/**
 * Default memory cache instance
 */
export const memory: CacheDriver = new StacksCache(defaultMemoryManager)

/**
 * Default cache instance (memory)
 */
export const cache: CacheDriver = memory

// Re-export ts-cache utilities for advanced usage
export {
  CacheManager,
  MemoryDriver,
  RedisDriver,
} from '@stacksjs/ts-cache'

// Re-export patterns and utilities
export {
  // Patterns
  CacheAsidePattern,
  MultiLevelPattern,
  RefreshAheadPattern,
  WriteThroughPattern,
  // Utilities
  BatchOperations,
  CacheInvalidation,
  CacheLock,
  CircuitBreaker,
  memoize,
  RateLimiter,
} from '@stacksjs/ts-cache'
