/**
 * @stacksjs/cache
 *
 * A high-performance, type-safe caching library powered by ts-cache.
 *
 * @example
 * ```ts
 * import { cache, createCache, createMemoryCache, createRedisCache } from '@stacksjs/cache'
 *
 * // Use the default memory cache
 * await cache.set('key', 'value', 60) // 60 second TTL
 * const value = await cache.get('key')
 *
 * // Create a custom Redis cache
 * const redisCache = createRedisCache({
 *   host: 'localhost',
 *   port: 6379,
 *   prefix: 'myapp',
 * })
 *
 * // Use the factory function
 * const customCache = createCache('memory', { maxKeys: 1000 })
 * ```
 */

export * from './drivers'
