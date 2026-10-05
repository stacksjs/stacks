import { clientAddress, createRateLimitMiddleware, Middleware, parseThrottleString } from '@stacksjs/router'

// Cache for rate limiters to avoid creating new instances for each request
const limiterCache = new Map<string, ReturnType<typeof createRateLimitMiddleware>>()

const RATE_LIMIT_HEADERS = ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'] as const

/**
 * Whose budget a request spends.
 *
 * A signed-in request spends its user's: the Auth middleware stamps
 * `_authenticatedUser`, and Throttle runs after it (priority 2 to Auth's 1),
 * so people sharing an address - an office, a phone carrier's NAT, every test
 * user on 127.0.0.1 - do not exhaust each other. bun-router's own default
 * reads `request.user.id`, which on a Stacks request is the async `user()`
 * accessor, so it never saw a user and every request fell through to an
 * address.
 *
 * Anything else spends its client address's, as `clientAddress()` resolves
 * it: the socket peer, or - only when that peer is a trusted proxy - the
 * forwarding headers it vouches for (`CF-Connecting-IP` only when the hop
 * that delivered the request is Cloudflare). A client-written
 * `X-Forwarded-For` no longer buys a fresh budget.
 */
function throttleKey(request: { _authenticatedUser?: unknown }): string {
  const user = request._authenticatedUser as { id?: unknown } | null | undefined
  const id = user?.id
  if ((typeof id === 'number' && Number.isFinite(id)) || (typeof id === 'string' && id !== ''))
    return `user:${id}`
  return `ip:${clientAddress(request as unknown as Request) ?? 'unknown'}`
}

/**
 * Throttle Middleware
 *
 * Rate limits requests per authenticated user, or per client address for
 * anonymous requests (see `throttleKey`). Uses Laravel-style throttle patterns.
 *
 * Usage:
 *   .middleware('throttle:60,1')     // 60 requests per 1 minute
 *   .middleware('throttle:100,5')    // 100 requests per 5 minutes
 *   .middleware('throttle:1000,1h')  // 1000 requests per hour
 *   .middleware('throttle:10,30s')   // 10 requests per 30 seconds
 *
 * Pattern formats:
 *   - 'maxAttempts' - e.g., '60' (60 per minute, default window)
 *   - 'maxAttempts,minutes' - e.g., '60,1' (60 per 1 minute)
 *   - 'maxAttempts,Ns' - e.g., '10,30s' (10 per 30 seconds)
 *   - 'maxAttempts,Nm' - e.g., '100,5m' (100 per 5 minutes)
 *   - 'maxAttempts,Nh' - e.g., '1000,1h' (1000 per 1 hour)
 *
 * Response (429 Too Many Requests):
 * {
 *   "success": false,
 *   "message": "Too many requests. Please try again in X seconds.",
 *   "retryAfter": X
 * }
 *
 * Headers added to all responses (successful ones via `_responseHeaders`):
 *   - X-RateLimit-Limit: Maximum requests allowed
 *   - X-RateLimit-Remaining: Remaining requests in current window
 *   - X-RateLimit-Reset: Unix timestamp when the limit resets
 *   - Retry-After: Seconds until limit resets (only on 429)
 */
export default new Middleware({
  name: 'throttle',
  // After Auth (1), so an authenticated request is keyed on its user rather
  // than on an address it may share with strangers.
  priority: 2,

  async handle(request) {
    // Get throttle params from middleware params (e.g., '60,1' from 'throttle:60,1')
    const params = request._middlewareParams?.throttle || '60,1'

    // Get or create rate limiter for this pattern
    let limiter = limiterCache.get(params)
    if (!limiter) {
      try {
        const config = parseThrottleString(params as Parameters<typeof parseThrottleString>[0])
        limiter = createRateLimitMiddleware({ ...config, keyGenerator: throttleKey }, `throttle:${params}`)
        limiterCache.set(params, limiter)
      }
      catch (error) {
        console.error(`[Throttle] Invalid throttle pattern: ${params}`, error)
        // Use default if pattern is invalid
        const defaultConfig = parseThrottleString('60,1')
        limiter = createRateLimitMiddleware({ ...defaultConfig, keyGenerator: throttleKey }, 'throttle:default')
        limiterCache.set(params, limiter)
      }
    }

    // The limiter stamps its X-RateLimit-* headers onto whatever `next()`
    // answers, so hand it a placeholder and read them back. Passing `null`
    // here meant a request that got through never learned its budget.
    const result = await limiter(request as any, async () => new Response(null, { status: 204 }))

    // A 429 short-circuits the request
    if (result instanceof Response && result.status === 429) {
      // Transform the response to match stacks format
      const retryAfter = result.headers.get('Retry-After') || '60'

      throw new Response(JSON.stringify({
        success: false,
        message: `Too many requests. Please try again in ${retryAfter} seconds.`,
        retryAfter: Number.parseInt(retryAfter, 10),
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': result.headers.get('X-RateLimit-Limit') || '',
          'X-RateLimit-Remaining': result.headers.get('X-RateLimit-Remaining') || '0',
          'X-RateLimit-Reset': result.headers.get('X-RateLimit-Reset') || '',
          'Retry-After': retryAfter,
          // CORS headers (if any) are applied by the router's post-response
          // CORS wrapper using the configured policy — hardcoding
          // `Access-Control-Allow-Origin: *` here leaked the rate-limit
          // body cross-origin even when the configured policy was
          // restrictive. See stacksjs/stacks#1859 R-3.
        },
      })
    }

    // Within the limit: ask the router to put the budget on the real response.
    if (result instanceof Response) {
      const headers: Record<string, string> = { ...request._responseHeaders }
      for (const name of RATE_LIMIT_HEADERS) {
        const value = result.headers.get(name)
        if (value !== null)
          headers[name] = value
      }
      request._responseHeaders = headers
    }
  },
})
