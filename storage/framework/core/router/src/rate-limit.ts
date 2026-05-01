/**
 * Action-level rate limiting helper.
 *
 * Middleware-level rate limiting handles "this IP cannot make more than
 * N requests/sec" — but it can't see *which* action is being hit, so
 * it bucket-counts everything together. This helper lets an individual
 * action enforce its own quota: `await rateLimit('create-post', 10).per('hour')`
 * blocks the action specifically, throws a typed `HttpError(429)` with
 * the right Retry-After header, and is keyed off the authenticated user
 * (or IP fallback) so two users don't share a bucket.
 *
 * Backed by `@stacksjs/cache`, so it works with whichever driver the
 * project has configured (Redis in prod, memory in dev/tests).
 */

import { HttpError } from '@stacksjs/error-handling'
import { getCurrentRequest } from './request-context'

interface RateLimitWindow {
  count: number
  resetAt: number // unix seconds
}

const PERIOD_SECONDS: Record<string, number> = {
  second: 1,
  minute: 60,
  hour: 3600,
  day: 86_400,
}

/**
 * Build a rate-limit identity for the current scope. Defaults to:
 *   1. The authenticated user id (if available)
 *   2. The bearer token (if set)
 *   3. The client IP from `x-forwarded-for` / `x-real-ip` / fallback
 *
 * Callers can pass a custom `identity` to `rateLimit(...)` to bucket
 * by something else (e.g. a customer id from the request body).
 */
function defaultIdentity(): string {
  const req = getCurrentRequest() as (Request & {
    _authenticatedUser?: { id?: number | string }
    _currentAccessToken?: { id?: number | string }
  }) | undefined
  if (req) {
    const userId = req._authenticatedUser?.id
    if (userId !== undefined) return `user:${userId}`
    const tokenId = req._currentAccessToken?.id
    if (tokenId !== undefined) return `token:${tokenId}`
    const fwd = req.headers.get('x-forwarded-for')
    if (fwd) return `ip:${fwd.split(',')[0].trim()}`
    const realIp = req.headers.get('x-real-ip')
    if (realIp) return `ip:${realIp}`
  }
  return 'anon'
}

/**
 * Check if `key` has exceeded `max` operations in the given period.
 * Throws `HttpError(429)` when over budget; otherwise increments the
 * counter and returns silently.
 *
 * The fluent `.per(period)` form lets call sites read naturally:
 *
 * @example
 * ```ts
 * await rateLimit('create-post', 10).per('hour')
 * await rateLimit('login-attempts', 5, { identity: email }).per('minute')
 * ```
 */
export function rateLimit(
  key: string,
  max: number,
  options: { identity?: string, ttl?: number } = {},
): {
    /** Run with a string period name (`'minute'`, `'hour'`, …). */
    per(period: 'second' | 'minute' | 'hour' | 'day'): Promise<void>
    /** Run with a numeric ttl in seconds (overrides `per`). */
    over(ttlSeconds: number): Promise<void>
  } {
  const id = options.identity ?? defaultIdentity()
  const cacheKey = `__ratelimit__:${key}:${id}`

  const run = async (ttl: number): Promise<void> => {
    const { cache } = await import('@stacksjs/cache')
    const now = Math.floor(Date.now() / 1000)
    const existing = await cache.get<RateLimitWindow>(cacheKey)

    let window: RateLimitWindow
    if (!existing || existing.resetAt <= now) {
      window = { count: 1, resetAt: now + ttl }
    }
    else {
      window = { count: existing.count + 1, resetAt: existing.resetAt }
    }

    if (window.count > max) {
      const retryAfter = Math.max(1, window.resetAt - now)
      throw Object.assign(new HttpError(429, 'Too many requests', {
        key,
        max,
        retryAfter,
      }), {
        // Bun-router middleware error handling reads `headers` off the
        // thrown error to merge into the 429 response. Without
        // Retry-After the client has no signal for backoff timing.
        headers: { 'Retry-After': String(retryAfter) },
      })
    }

    const ttlRemaining = Math.max(1, window.resetAt - now)
    await cache.set(cacheKey, window, ttlRemaining)
  }

  return {
    async per(period) {
      const ttl = options.ttl ?? PERIOD_SECONDS[period]
      if (!ttl) throw new Error(`rateLimit().per: unknown period '${period}'`)
      await run(ttl)
    },
    async over(ttlSeconds) {
      if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
        throw new Error(`rateLimit().over: ttl must be a positive number, got ${ttlSeconds}`)
      }
      await run(ttlSeconds)
    },
  }
}

/**
 * Read the current bucket state without incrementing. Useful for
 * dashboards that want to display "you have N attempts remaining"
 * without consuming an attempt.
 */
export async function rateLimitStatus(
  key: string,
  options: { identity?: string } = {},
): Promise<{ count: number, resetAt: number } | null> {
  const id = options.identity ?? defaultIdentity()
  const cacheKey = `__ratelimit__:${key}:${id}`
  const { cache } = await import('@stacksjs/cache')
  return (await cache.get<RateLimitWindow>(cacheKey)) ?? null
}

/**
 * Drop the bucket for the given key (e.g. after a successful login,
 * the failed-attempt counter should reset).
 */
export async function clearRateLimit(key: string, options: { identity?: string } = {}): Promise<void> {
  const id = options.identity ?? defaultIdentity()
  const cacheKey = `__ratelimit__:${key}:${id}`
  const { cache } = await import('@stacksjs/cache')
  await cache.del(cacheKey)
}
