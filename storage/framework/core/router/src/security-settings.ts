import type { ClientAddressOptions } from '@stacksjs/bun-router'
import type { StorageProvider } from 'ts-rate-limiter'
import process from 'node:process'
import { clientAddress as resolveClientAddress } from '@stacksjs/bun-router'
import { config } from '@stacksjs/config'

/**
 * The `config/security.ts` settings the request layer reads on every request:
 * the rate-limit scale, the trusted proxies behind `clientAddress()`, and the
 * shared store rate limits count in.
 */

/**
 * The multiplier applied to every application rate limit and the login
 * lockout. `STACKS_RATE_LIMIT_SCALE` wins over `config.security.rateLimit.scale`;
 * anything that is not a positive finite number reads as 1.
 */
export function rateLimitScale(): number {
  const fromEnv = process.env.STACKS_RATE_LIMIT_SCALE
  const raw = fromEnv !== undefined && fromEnv !== '' ? Number(fromEnv) : (config.security as { rateLimit?: { scale?: unknown } } | undefined)?.rateLimit?.scale
  const scale = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(scale) && scale > 0 ? scale : 1
}

/** `max` under the configured scale, never below 1. */
export function scaledLimit(max: number): number {
  return Math.max(1, Math.floor(max * rateLimitScale()))
}

/**
 * `config.security.trustedProxies`, or undefined for bun-router's default
 * (loopback, private and link-local networks). A non-array is ignored with
 * the default kept, rather than trusting everything or nothing by accident.
 */
export function trustedProxies(): readonly string[] | undefined {
  const configured = (config.security as { trustedProxies?: unknown } | undefined)?.trustedProxies
  if (!Array.isArray(configured))
    return undefined
  return configured.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
}

/**
 * The client's address, believing forwarding headers only from the proxies
 * `config.security.trustedProxies` names (default: loopback and private
 * networks). Explicit `options` win. This is what `@stacksjs/router` exports
 * as `clientAddress`, shadowing bun-router's config-unaware export.
 */
export function clientAddress(req: Request, options?: ClientAddressOptions): string | null {
  if (options)
    return resolveClientAddress(req, options)
  const proxies = trustedProxies()
  return resolveClientAddress(req, proxies ? { trustedProxies: proxies } : undefined)
}

interface CacheSettings {
  driver?: string
  prefix?: string
  drivers?: { redis?: { url?: string, host?: string, port?: number, username?: string, password?: string, database?: number, tls?: boolean } }
}

/**
 * The Redis URL and key prefix of the configured cache, or null when the
 * cache is not Redis. Shared by every limiter that must count across
 * processes (this package's and `@stacksjs/auth`'s lockout).
 */
export function cacheRedisConnection(cache: CacheSettings | undefined = (config as { cache?: CacheSettings }).cache): { url: string, prefix: string } | null {
  const redis = cache?.drivers?.redis
  if (cache?.driver !== 'redis' || !redis)
    return null
  const prefix = cache.prefix ?? 'stacks'
  if (redis.url)
    return { url: redis.url, prefix }
  const protocol = redis.tls ? 'rediss' : 'redis'
  const credentials = redis.username
    ? `${encodeURIComponent(redis.username)}:${encodeURIComponent(redis.password ?? '')}@`
    : redis.password
      ? `:${encodeURIComponent(redis.password)}@`
      : ''
  const database = redis.database == null ? '' : `/${redis.database}`
  return { url: `${protocol}://${credentials}${redis.host ?? '127.0.0.1'}:${redis.port ?? 6379}${database}`, prefix }
}

let warnedSharedStore = false

function warnSharedStoreOnce(error: unknown): void {
  if (warnedSharedStore)
    return
  warnedSharedStore = true
  console.warn(`[router] rate limits fell back to this process's memory: the configured Redis cache is unreachable (${error instanceof Error ? error.message : String(error)}). Limits are per process until it recovers.`)
}

/**
 * A ts-rate-limiter storage that counts in the shared store and falls back
 * to process memory when the shared store errors, so a Redis outage weakens
 * limits to per-process instead of failing every rate-limited request.
 */
export function fallbackStorage(shared: StorageProvider, local: StorageProvider): StorageProvider {
  async function attempt<T>(primary: () => Promise<T>, secondary: () => Promise<T>): Promise<T> {
    try {
      return await primary()
    }
    catch (error) {
      warnSharedStoreOnce(error)
      return secondary()
    }
  }
  return {
    increment: (key, windowMs) => attempt(() => shared.increment(key, windowMs), () => local.increment(key, windowMs)),
    reset: key => attempt(() => shared.reset(key), () => local.reset(key)),
    getCount: key => attempt(() => shared.getCount?.(key) ?? Promise.resolve(0), () => local.getCount?.(key) ?? Promise.resolve(0)),
    dispose: () => {
      shared.dispose?.()
      local.dispose?.()
    },
  }
}

let sharedStorage: Promise<StorageProvider | null> | undefined

/**
 * The storage route and action rate limits count in: the configured Redis
 * cache when there is one (so a limit holds across every process and
 * instance), otherwise null for ts-rate-limiter's in-memory default.
 */
export function sharedRateLimitStorage(): Promise<StorageProvider | null> {
  return sharedStorage ??= (async () => {
    const connection = cacheRedisConnection()
    if (!connection)
      return null
    const [{ RedisClient }, { MemoryStorage, RedisStorage }] = await Promise.all([import('bun'), import('ts-rate-limiter')])
    const client = new RedisClient(connection.url)
    const shared = new RedisStorage({ client, keyPrefix: `${connection.prefix}:ratelimit:` })
    return fallbackStorage(shared, new MemoryStorage())
  })()
}

/**
 * Count route and action rate limits in `storage` (any ts-rate-limiter
 * `StorageProvider`: a database-backed one, a test double), or `null` for
 * process memory. Call `resetRateLimiters()` afterwards so limiters already
 * built pick it up.
 */
export function useRateLimitStorage(storage: StorageProvider | null): void {
  sharedStorage = Promise.resolve(storage)
}

/** Forget the resolved store (tests, or after changing the cache config). */
export function resetSharedRateLimitStorage(): void {
  sharedStorage = undefined
  warnedSharedStore = false
}
