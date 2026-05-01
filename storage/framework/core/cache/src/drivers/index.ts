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
  /**
   * In-flight fetcher map for cache stampede prevention. When N concurrent
   * callers all `remember()` the same missing key, we run the fetcher
   * exactly once and let everyone await the same promise — instead of
   * triggering N parallel DB hits / N API calls / N expensive computes.
   */
  private inflight = new Map<string, Promise<unknown>>()

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
    // First check the cache directly (fast path).
    const cached = await this.manager.get<T>(key)
    if (cached !== undefined) return cached

    // If another caller is already computing this key, wait for that result
    // instead of starting a parallel fetch. This is what stops a cold cache
    // from triggering N database hits when N requests land at the same instant.
    const pending = this.inflight.get(key)
    if (pending) return await (pending as Promise<T>)

    const promise = (async () => {
      try {
        return await this.manager.fetch(key, fetcher, ttl)
      }
      finally {
        this.inflight.delete(key)
      }
    })()
    this.inflight.set(key, promise)
    return await (promise as Promise<T>)
  }

  /**
   * Get a cached value or compute and store it (Laravel-style).
   * TTL comes before callback (Laravel convention).
   */
  async remember<T>(key: string, ttl: number, callback: () => T | Promise<T>): Promise<T> {
    return await this.getOrSet(key, callback, ttl)
  }

  /**
   * Get a cached value or compute and store it forever (no expiration).
   *
   * Routes through `getOrSet` with `ttl: 0` so it inherits the same
   * cache-stampede guard — without that, N concurrent callers all see
   * the empty slot, run `callback()` in parallel, and clobber each
   * other on the way back. The TTL of `0` is what every driver
   * interprets as "no expiration".
   */
  async rememberForever<T>(key: string, callback: () => T | Promise<T>): Promise<T> {
    return this.getOrSet(key, callback, 0)
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
    const total = stats.hits + stats.misses
    return {
      hits: stats.hits,
      misses: stats.misses,
      keys: stats.keys,
      size: stats.ksize + stats.vsize,
      hitRate: total > 0 ? stats.hits / total : 0,
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

  /**
   * Tag-aware writes. Returns a thin wrapper that mirrors the cache API
   * but indexes every write under each tag, so a single
   * `cache.tags(['user:42']).flush()` invalidates every key associated
   * with that tag — no matter what driver they live on.
   *
   * The tag → keys map is kept in cache itself under a reserved prefix
   * so it survives across processes when Redis is the driver. Memory
   * driver gets the same correctness with no persistence guarantee.
   *
   * @example
   * ```ts
   * await cache.tags(['user:42', 'feed']).put('user:42:feed', payload, 300)
   * await cache.tags(['user:42']).flush() // invalidates the feed cache too
   * ```
   */
  tags(tags: readonly string[]): TaggedCache {
    return new TaggedCache(this, tags)
  }
}

/**
 * Tag-scoped wrapper around `StacksCache`. Records every write under
 * the named tag(s) so `flush()` can invalidate cascade-style without the
 * caller having to track keys themselves.
 *
 * The tag index is stored as `string[]` on disk (so it survives the
 * Redis driver's serializer), but operated on in memory as a `Set` so
 * each write is `O(1)` instead of `O(N)` over the existing index.
 *
 * `flush()` uses a per-tag in-process mutex so concurrent flushes don't
 * race-and-lose keys: without it, two parallel flushes could both read
 * the index, both delete, and the second flush would succeed against
 * the now-empty index — leaving any keys added between the two reads
 * orphaned.
 */
export class TaggedCache {
  private static readonly TAG_PREFIX = '__stacks_tag__:'

  /**
   * Per-tag flush mutex. Keyed by the tag-index key (not the user tag)
   * so multiple `tags(['a'])` instances share the same lock for `'a'`.
   * Static — flush ordering is process-global, not instance-local.
   */
  private static readonly flushLocks = new Map<string, Promise<unknown>>()

  constructor(private readonly cache: StacksCache, private readonly tags: readonly string[]) {
    if (!tags || tags.length === 0) {
      throw new Error('cache.tags(...) requires at least one tag')
    }
  }

  private tagKey(tag: string): string {
    return `${TaggedCache.TAG_PREFIX}${tag}`
  }

  private async indexKey(key: string): Promise<void> {
    // Read–modify–write is fine for tag-index updates: the worst case
    // is a stale extra entry on flush, which is harmless (flush attempts
    // to delete keys that no longer exist). Using a Set means the
    // membership check + append is O(1) regardless of index size.
    for (const tag of this.tags) {
      const tagK = this.tagKey(tag)
      const existing = (await this.cache.get<string[]>(tagK)) ?? []
      const set = new Set(existing)
      if (!set.has(key)) {
        set.add(key)
        await this.cache.setForever(tagK, [...set])
      }
    }
  }

  async put<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    const ok = await this.cache.set(key, value, ttl)
    if (ok) await this.indexKey(key)
    return ok
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    return this.put(key, value, ttl)
  }

  async setForever<T>(key: string, value: T): Promise<boolean> {
    const ok = await this.cache.setForever(key, value)
    if (ok) await this.indexKey(key)
    return ok
  }

  async remember<T>(key: string, ttl: number, callback: () => T | Promise<T>): Promise<T> {
    const value = await this.cache.remember(key, ttl, callback)
    await this.indexKey(key)
    return value
  }

  async rememberForever<T>(key: string, callback: () => T | Promise<T>): Promise<T> {
    const value = await this.cache.rememberForever(key, callback)
    await this.indexKey(key)
    return value
  }

  /** Pass-throughs that don't need indexing — included so the tagged
   *  surface looks like the regular cache for ergonomic chains. */
  async get<T>(key: string): Promise<T | undefined> { return this.cache.get<T>(key) }
  async has(key: string): Promise<boolean> { return this.cache.has(key) }

  /**
   * Invalidate every key associated with any of this scope's tags, then
   * drop the tag indexes themselves.
   *
   * Per-tag flush is serialized via a static lock map: concurrent
   * flushes against the same tag await each other so writes that
   * landed between two parallel flushes aren't dropped on the floor
   * (a flush deletes only the keys it observed at read-time; if a
   * second flush had already wiped the index, the late-arriving keys
   * leak forever).
   */
  async flush(): Promise<number> {
    let deleted = 0
    for (const tag of this.tags) {
      const tagK = this.tagKey(tag)
      // Wait for any in-flight flush of the same tag before starting ours.
      const inflight = TaggedCache.flushLocks.get(tagK)
      if (inflight) await inflight.catch(() => { /* prior flush errors don't block ours */ })

      const flushOne = (async () => {
        const keys = (await this.cache.get<string[]>(tagK)) ?? []
        let n = 0
        if (keys.length > 0) n = await this.cache.del(keys)
        await this.cache.del(tagK)
        return n
      })()
      TaggedCache.flushLocks.set(tagK, flushOne)
      try {
        deleted += await flushOne
      }
      finally {
        // Only clear if we're still the latest flush — a later caller
        // may have replaced the slot before we resolved.
        if (TaggedCache.flushLocks.get(tagK) === flushOne) {
          TaggedCache.flushLocks.delete(tagK)
        }
      }
    }
    return deleted
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
