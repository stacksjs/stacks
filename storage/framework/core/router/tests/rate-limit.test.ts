import { describe, expect, it } from 'bun:test'
import { clearRateLimit, rateLimit, rateLimitStatus } from '../src/rate-limit'

describe('action rate limiting', () => {
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

  it('rejects an unknown period at runtime', async () => {
    await expect(rateLimit('invalid-period', 1).per('week' as 'minute')).rejects.toThrow('unknown period')
  })
})
