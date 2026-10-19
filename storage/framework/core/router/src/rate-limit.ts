/**
 * Action-level rate limiting helpers.
 *
 * Thin wrapper around `ts-rate-limiter` that gives Stacks actions a
 * one-line `await rateLimit(key, max).per('hour')` ergonomics. The
 * underlying limiter is shared across calls (cached per `windowMs`)
 * so the bucket math stays correct across requests in the same
 * process — and `RateLimitError` thrown from the lib is translated
 * into the framework's `HttpError(429)` with `Retry-After` set.
 *
 * Counts live in the configured Redis cache when there is one
 * (`config/cache.ts` driver `redis`), so a limit holds across every worker
 * and instance; otherwise, and while Redis is unreachable, in this process's
 * memory. Every `max` is multiplied by `config.security.rateLimit.scale`.
 *
 * Why not just use `bun-router`'s built-in rate-limit middleware?
 * That middleware buckets per-request — fine for blanket "60 reqs
 * per IP per minute" enforcement, but action-specific quotas (e.g.
 * "5 password resets per email per hour") need a per-call hook the
 * action handler can invoke conditionally. This module provides that.
 */

import type { RateLimiter, StorageProvider } from 'ts-rate-limiter'
import { getCurrentRequest } from './request-context'
import { clientAddress, scaledLimit, sharedRateLimitStorage } from './security-settings'

type Period = 'second' | 'minute' | 'hour' | 'day'

/**
 * Per-(key,window) limiter cache. Reusing the same `RateLimiter`
 * instance across calls is what keeps the bucket counts coherent —
 * a fresh instance per call would lose every previous count.
 *
 * The cache key is `${windowMs}:${max}` so two action sites that share
 * the same shape but different keys still share the same limiter
 * (the bucket scope is the *value* passed to `enforce(key)`, not the
 * RateLimiter instance).
 */
let limiterCache: Map<string, RateLimiter> | undefined
let limiterModule: typeof import('ts-rate-limiter') | undefined
let httpErrorModule: typeof import('@stacksjs/error-handling/http-error') | undefined
let limiterModulePromise: Promise<typeof import('ts-rate-limiter')> | undefined
let limiterStorage: StorageProvider | null | undefined
let limiterStoragePromise: Promise<StorageProvider | null> | undefined

function loadLimiterModule(): Promise<typeof import('ts-rate-limiter')> {
  return limiterModulePromise ??= import('ts-rate-limiter').then(module => limiterModule = module)
}

function loadLimiterStorage(): Promise<StorageProvider | null> {
  return limiterStoragePromise ??= sharedRateLimitStorage().then(storage => limiterStorage = storage)
}

/** Drop cached limiters and the resolved store (tests, or after a config change). */
export function resetRateLimiters(): void {
  for (const limiter of limiterCache?.values() ?? [])
    (limiter as { dispose?: () => void }).dispose?.()
  limiterCache = undefined
  limiterStorage = undefined
  limiterStoragePromise = undefined
}

function getLimiter(requestedMax: number, windowMs: number): RateLimiter | Promise<RateLimiter> {
  const max = scaledLimit(requestedMax)
  const cacheKey = `${windowMs}:${max}`
  let limiter = limiterCache?.get(cacheKey)
  if (!limiter) {
    if (!limiterModule || limiterStorage === undefined) {
      // Re-enter after loading so concurrent cold callers share the cached instance.
      return Promise.all([loadLimiterModule(), loadLimiterStorage()]).then(() => getLimiter(requestedMax, windowMs))
    }
    const { RateLimiter } = limiterModule
    limiter = new RateLimiter({
      windowMs,
      maxRequests: max,
      algorithm: 'fixed-window',
      ...(limiterStorage && { storage: limiterStorage }),
      // Header generation is handled by the framework error path;
      // disable here so we don't pay for unused work.
      standardHeaders: false,
      legacyHeaders: false,
    })
    const cache = limiterCache ??= new Map()
    cache.set(cacheKey, limiter)
  }
  return limiter
}

/**
 * Resolve the bucket identity for the current scope: `options.identity` when
 * given, else the signed-in user, else the client's address as
 * `clientAddress()` resolves it - the socket peer, or forwarding headers only
 * when that peer is a trusted proxy. The same key the Throttle middleware uses.
 *
 * It was ts-rate-limiter's `defaultIdentity`, which keys on the first 32
 * characters of any bearer value, then a client-written `X-Forwarded-For` /
 * `X-Real-IP`, then `'anon'` - and never on the socket. So a new junk
 * `Authorization` or forwarding header bought a fresh budget on every
 * request, while every client sending neither shared one `anon` bucket: one
 * client could exhaust `/login` for everybody.
 */
function resolveIdentity(explicit?: string): string {
  if (explicit !== undefined) return explicit
  const req = getCurrentRequest() as (Request & { _authenticatedUser?: { id?: unknown } | null }) | undefined
  if (!req) return 'anon'
  const id = req._authenticatedUser?.id
  if ((typeof id === 'number' && Number.isFinite(id)) || (typeof id === 'string' && id !== ''))
    return `user:${id}`
  return `ip:${clientAddress(req) ?? 'unknown'}`
}

/**
 * Check + consume a rate-limit slot for the current scope.
 *
 * @example
 * ```ts
 * await rateLimit('create-post', 10).per('hour')
 * await rateLimit('login-attempts', 5, { identity: email }).per('minute')
 * await rateLimit('expensive-job', 3).over(900) // custom 15-minute ttl
 * ```
 */
export function rateLimit(
  key: string,
  max: number,
  options: { identity?: string } = {},
): {
    /** Run with a string period name (`'minute'`, `'hour'`, …). */
    per: (period: Period) => Promise<void>
    /** Run with a numeric ttl in seconds. */
    over: (ttlSeconds: number) => Promise<void>
  } {
  const run = async (windowMs: number): Promise<void> => {
    const id = resolveIdentity(options.identity)
    const pendingLimiter = getLimiter(max, windowMs)
    const limiter = pendingLimiter instanceof Promise ? await pendingLimiter : pendingLimiter
    const bucketKey = `${key}:${id}`
    try {
      await limiter.enforce(bucketKey)
    }
    catch (err) {
      const { RateLimitError } = await loadLimiterModule()
      if (err instanceof RateLimitError) {
        const { HttpError } = httpErrorModule ??= await import('@stacksjs/error-handling/http-error')
        throw Object.assign(
          new HttpError(429, 'Too many requests', {
            key,
            max,
            retryAfter: err.retryAfter,
          }),
          { headers: err.toHeaders() },
        )
      }
      throw err
    }
  }

  return {
    async per(period) {
      const seconds = period === 'second'
        ? 1
        : period === 'minute'
          ? 60
          : period === 'hour'
            ? 3600
            : period === 'day'
              ? 86_400
              : undefined
      if (!seconds) throw new Error(`rateLimit().per: unknown period '${period}'`)
      await run(seconds * 1000)
    },
    async over(ttlSeconds) {
      if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
        throw new Error(`rateLimit().over: ttl must be a positive number, got ${ttlSeconds}`)
      }
      await run(ttlSeconds * 1000)
    },
  }
}

/**
 * Read the current bucket state without consuming a slot. Useful for
 * "you have N attempts remaining" hints in dashboards and pre-flight
 * checks. Returns `null` if the limiter's storage doesn't expose
 * `getCount` (the default memory storage does; redis storage may not).
 */
export async function rateLimitStatus(
  key: string,
  max: number,
  windowSeconds: number,
  options: { identity?: string } = {},
): Promise<{ count: number, limit: number, remaining: number } | null> {
  const identity = resolveIdentity(options.identity)
  const pendingLimiter = getLimiter(max, windowSeconds * 1000)
  const [id, limiter] = typeof identity === 'string' && !(pendingLimiter instanceof Promise)
    ? [identity, pendingLimiter] as const
    : await Promise.all([identity, pendingLimiter])
  const bucketKey = `${key}:${id}`
  const result = await limiter.peek(bucketKey)
  if (!result) return null
  return {
    count: result.current,
    limit: result.limit,
    remaining: Math.max(0, result.limit - result.current),
  }
}

/**
 * Drop the bucket for the given key (e.g. after a successful login,
 * the failed-attempt counter should reset).
 */
export async function clearRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
  options: { identity?: string } = {},
): Promise<void> {
  const identity = resolveIdentity(options.identity)
  const pendingLimiter = getLimiter(max, windowSeconds * 1000)
  const [id, limiter] = typeof identity === 'string' && !(pendingLimiter instanceof Promise)
    ? [identity, pendingLimiter] as const
    : await Promise.all([identity, pendingLimiter])
  const bucketKey = `${key}:${id}`
  await limiter.reset(bucketKey)
}
