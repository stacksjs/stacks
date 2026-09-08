import type { EnhancedRequest } from '@stacksjs/bun-router'
import { describe, expect, it } from 'bun:test'
import process from 'node:process'
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

  it('enforces a declarative route limit before the handler runs again', async () => {
    const router = createStacksRouter({ autoDiscoverRoutes: false, csrf: false })
    let calls = 0
    router.get('/route-limit-contract', () => ({ calls: ++calls })).rateLimit(1, 'minute')
    const server = await router.serve({ port: 0, hostname: '127.0.0.1' })

    try {
      const url = `http://127.0.0.1:${server.port}/route-limit-contract`
      expect((await fetch(url)).status).toBe(200)
      expect((await fetch(url)).status).toBe(429)
      expect(calls).toBe(1)
    }
    finally {
      server.stop()
    }
  })
})
