import type { Request } from '@stacksjs/router'
import { createRateLimitMiddleware, Middleware, parseThrottleString } from '@stacksjs/router'

// Cache for rate limiters to avoid creating new instances for each request
const limiterCache = new Map<string, ReturnType<typeof createRateLimitMiddleware>>()

/**
 * Throttle Middleware
 *
 * Rate limits requests based on IP address or authenticated user.
 * Uses Laravel-style throttle patterns.
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
 * Headers added to all responses:
 *   - X-RateLimit-Limit: Maximum requests allowed
 *   - X-RateLimit-Remaining: Remaining requests in current window
 *   - X-RateLimit-Reset: Unix timestamp when the limit resets
 *   - Retry-After: Seconds until limit resets (only on 429)
 */
export default new Middleware({
  name: 'throttle',
  priority: 1, // Run early, after maintenance but before auth

  async handle(request: Request) {
    // Get throttle params from middleware params (e.g., '60,1' from 'throttle:60,1')
    const params = (request as any)._middlewareParams?.throttle || '60,1'

    // Get or create rate limiter for this pattern
    let limiter = limiterCache.get(params)
    if (!limiter) {
      try {
        const config = parseThrottleString(params)
        limiter = createRateLimitMiddleware(config, `throttle:${params}`)
        limiterCache.set(params, limiter)
      }
      catch (error) {
        console.error(`[Throttle] Invalid throttle pattern: ${params}`, error)
        // Use default if pattern is invalid
        const defaultConfig = parseThrottleString('60,1')
        limiter = createRateLimitMiddleware(defaultConfig, 'throttle:default')
        limiterCache.set(params, limiter)
      }
    }

    // Create a next function that continues the request
    // The middleware will handle rate limiting and return 429 if needed
    const result = await limiter(request as any, async () => null)

    // If result is a Response (429), throw it to short-circuit the request
    if (result instanceof Response) {
      // Transform the response to match stacks format
      const body = await result.clone().json().catch(() => ({}))
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
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // Continue normally - rate limit not exceeded
  },
})
