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
 * Why not just use `bun-router`'s built-in rate-limit middleware?
 * That middleware buckets per-request — fine for blanket "60 reqs
 * per IP per minute" enforcement, but action-specific quotas (e.g.
 * "5 password resets per email per hour") need a per-call hook the
 * action handler can invoke conditionally. This module provides that.
 */

import { HttpError } from '@stacksjs/error-handling'
import { RateLimitError, RateLimiter, defaultIdentity } from 'ts-rate-limiter'
import { getCurrentRequest } from './request-context'

const PERIOD_SECONDS = {
  second: 1,
  minute: 60,
  hour: 3600,
  day: 86_400,
} as const
type Period = keyof typeof PERIOD_SECONDS

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
const limiterCache = new Map<string, RateLimiter>()

function getLimiter(max: number, windowMs: number): RateLimiter {
  const cacheKey = `${windowMs}:${max}`
  let limiter = limiterCache.get(cacheKey)
  if (!limiter) {
    limiter = new RateLimiter({
      windowMs,
      maxRequests: max,
      algorithm: 'fixed-window',
      // Header generation is handled by the framework error path;
      // disable here so we don't pay for unused work.
      standardHeaders: false,
      legacyHeaders: false,
    })
    limiterCache.set(cacheKey, limiter)
  }
  return limiter
}

/**
 * Resolve the bucket identity for the current scope. Defaults to
 * `defaultIdentity(req)` from `ts-rate-limiter` (auth user → token →
 * IP → 'anon'); callers can override via `options.identity`.
 */
function resolveIdentity(explicit?: string): string {
  if (explicit !== undefined) return explicit
  const req = getCurrentRequest() as Request | undefined
  return req ? defaultIdentity(req) : 'anon'
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
  const id = resolveIdentity(options.identity)
  const bucketKey = `${key}:${id}`

  const run = async (windowMs: number): Promise<void> => {
    const limiter = getLimiter(max, windowMs)
    try {
      await limiter.enforce(bucketKey)
    }
    catch (err) {
      if (err instanceof RateLimitError) {
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
      const seconds = PERIOD_SECONDS[period]
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
  const id = resolveIdentity(options.identity)
  const bucketKey = `${key}:${id}`
  const limiter = getLimiter(max, windowSeconds * 1000)
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
  const id = resolveIdentity(options.identity)
  const bucketKey = `${key}:${id}`
  const limiter = getLimiter(max, windowSeconds * 1000)
  await limiter.reset(bucketKey)
}
