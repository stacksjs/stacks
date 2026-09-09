import type { EnhancedRequest } from '@stacksjs/bun-router'
import { describe, expect, it } from 'bun:test'
import process from 'node:process'
import { HttpError } from '@stacksjs/error-handling/http'
import { clearRateLimit, rateLimit, rateLimitStatus } from '../src/rate-limit'
import { runWithRequest } from '../src/request-context'
import { createStacksRouter } from '../src/stacks-router'

describe('action rate limiting', () => {
  it('keeps request identities isolated during cold loading and warm calls', async () => {
    await Promise.all(['192.0.2.1', '192.0.2.2'].map((ip) => {
      const request = new Request('https://example.com', { headers: { 'x-real-ip': ip } }) as EnhancedRequest
      return runWithRequest(request, async () => {
        await rateLimit('context-identity', 1).over(1003)
        expect(await rateLimitStatus('context-identity', 1, 1003)).toEqual({ count: 1, limit: 1, remaining: 0 })
        await expect(rateLimit('context-identity', 1).over(1003)).rejects.toMatchObject({ status: 429 })
        await clearRateLimit('context-identity', 1, 1003)
        expect(await rateLimitStatus('context-identity', 1, 1003)).toEqual({ count: 0, limit: 1, remaining: 1 })
      })
    }))
  })

  it('shares a new quota between concurrent first callers', async () => {
    const key = 'concurrent-first-callers'
    const options = { identity: 'same-client' }
    // A unique window keeps this cold even when another test loaded the module.
    await Promise.all([
      rateLimit(key, 3, options).over(997),
      rateLimit(key, 3, options).over(997),
    ])
    expect(await rateLimitStatus(key, 3, 997, options)).toEqual({ count: 2, limit: 3, remaining: 1 })
    await rateLimit(key, 3, options).over(997)
    await expect(rateLimit(key, 3, options).over(997)).rejects.toMatchObject({ status: 429, headers: { 'RateLimit-Limit': '3', 'RateLimit-Remaining': '0' } })
    await clearRateLimit(key, 3, 997, options)
  })

  it.each([
    ['second', 1],
    ['minute', 60],
    ['hour', 3600],
    ['day', 86_400],
  ] as const)('maps the %s period to its window', async (period, windowSeconds) => {
    const key = `period-${period}`
    const options = { identity: 'period-contract' }
    await clearRateLimit(key, 2, windowSeconds, options)

    await rateLimit(key, 2, options).per(period)

    expect(await rateLimitStatus(key, 2, windowSeconds, options)).toEqual({
      count: 1,
      limit: 2,
      remaining: 1,
    })
  })

  it('handles every rejected cold helper when the limiter import fails', async () => {
    const child = Bun.spawn([
      process.execPath,
      `--config=${import.meta.dir}/fixtures/cold-start.toml`,
      `${import.meta.dir}/fixtures/rate-limit-import-failure.ts`,
    ], { stdout: 'pipe', stderr: 'pipe' })
    const timeout = setTimeout(() => child.kill(), 10_000)
    try {
      const [exitCode, stderr] = await Promise.all([
        child.exited,
        new Response(child.stderr).text(),
      ])
      expect(exitCode, stderr).toBe(0)
    }
    finally {
      clearTimeout(timeout)
    }
  })

  it('rejects an unknown period at runtime', async () => {
    await expect(rateLimit('invalid-period', 1).per('week' as 'minute')).rejects.toThrow('unknown period')
  })

  it('keeps warm quota errors and recovery specific to each bucket', async () => {
    for (const max of [1, 2]) {
      const key = `warm-quota-error-${max}`
      const options = { identity: `client-${max}` }
      for (let i = 0; i < max; i++)
        await rateLimit(key, max, options).per('hour')
      try {
        await rateLimit(key, max, options).per('hour')
        throw new Error('Expected quota rejection')
      }
      catch (error) {
        expect(error).toBeInstanceOf(HttpError)
        const failure = error as HttpError & { headers: Record<string, string> }
        expect(failure.status).toBe(429)
        expect(failure.details).toEqual({ key, max, retryAfter: expect.any(Number) })
        expect(failure.headers['RateLimit-Limit']).toBe(String(max))
        expect(failure.headers['RateLimit-Remaining']).toBe('0')
        expect(Number(failure.headers['Retry-After'])).toBeGreaterThan(0)
      }
      await clearRateLimit(key, max, 3600, options)
      await rateLimit(key, max, options).per('hour')
      expect(await rateLimitStatus(key, max, 3600, options)).toEqual({ count: 1, limit: max, remaining: max - 1 })
    }
  })

  it.each([false, true])('enforces a declarative route limit before the handler runs again (nativeRoutes=%s)', async (nativeRoutes) => {
    const router = createStacksRouter({ autoDiscoverRoutes: false, csrf: false })
    let calls = 0
    const path = `/route-limit-contract-${nativeRoutes}`
    router.get(path, () => ({ calls: ++calls })).rateLimit(1, 'minute')
    const server = await router.serve({ port: 0, hostname: '127.0.0.1', nativeRoutes })

    try {
      const url = `http://127.0.0.1:${server.port}${path}`
      expect((await fetch(url)).status).toBe(200)
      const denied = await fetch(url)
      expect(denied.status).toBe(429)
      expect(Number(denied.headers.get('retry-after'))).toBeGreaterThan(0)
      expect(denied.headers.get('x-content-type-options')).toBe('nosniff')
      expect(calls).toBe(1)
    }
    finally {
      server.stop()
    }
  })
})

/**
 * A burst against a fresh quota admits exactly `max` of them.
 *
 * ts-rate-limiter's fixed-window strategy returned its own mutable increment
 * result, so every caller in a simultaneous burst read whatever the counter had
 * reached by the time it looked rather than the count its own call produced. At
 * a quota of 3, ten simultaneous requests were all rejected - including the
 * three that should have been admitted. Fixed upstream in ts-rate-limiter
 * bbf0ba1 by snapshotting count and resetTime per call, adopted here
 * (stacksjs/stacks#2453).
 *
 * Both a cold quota (nothing has loaded the module or built this limiter) and a
 * warm one, because the two take different paths through the limiter cache and
 * the defect was only ever visible on a burst.
 */
describe('burst admission', () => {
  it.each([
    ['cold', 991],
    ['warm', 992],
  ] as const)('admits exactly the quota from a %s burst of ten', async (_state, windowSeconds) => {
    const key = `burst-${windowSeconds}`
    const options = { identity: 'burst-client' }
    await clearRateLimit(key, 3, windowSeconds, options)

    if (_state === 'warm')
      await clearRateLimit(key, 3, windowSeconds, options)

    const outcomes = await Promise.all(
      Array.from({ length: 10 }, () =>
        rateLimit(key, 3, options).over(windowSeconds).then(() => 'admitted' as const, (error: unknown) => error)),
    )

    const admitted = outcomes.filter(outcome => outcome === 'admitted')
    const rejected = outcomes.filter(outcome => outcome !== 'admitted')

    expect(admitted).toHaveLength(3)
    expect(rejected).toHaveLength(7)

    for (const rejection of rejected) {
      expect(rejection).toBeInstanceOf(HttpError)
      expect(rejection).toMatchObject({
        status: 429,
        headers: { 'RateLimit-Limit': '3', 'RateLimit-Remaining': '0' },
      })
      expect(Number((rejection as HttpError).headers?.['Retry-After'])).toBeGreaterThan(0)
    }

    expect(await rateLimitStatus(key, 3, windowSeconds, options)).toMatchObject({ limit: 3, remaining: 0 })
    await clearRateLimit(key, 3, windowSeconds, options)
  })
})
