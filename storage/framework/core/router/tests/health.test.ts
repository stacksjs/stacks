import { describe, expect, it } from 'bun:test'
import { runHealthProbes } from '../src/health'

describe('application health probes', () => {
  it('returns exact probe latency and a healthy aggregate', async () => {
    const times = [100, 107, 110]
    const result = await runHealthProbes([
      { name: 'database', run: async () => true },
    ], {
      now: () => times.shift() ?? 110,
    })

    expect(result).toEqual({
      status: 'healthy',
      checks: {
        database: { ok: true, ms: 7 },
      },
      timestamp: 110,
    })
  })

  it('marks the aggregate degraded and preserves probe failures', async () => {
    const result = await runHealthProbes([
      { name: 'database', run: async () => true },
      { name: 'cache', run: async () => { throw new Error('cache unavailable') } },
    ])

    expect(result.status).toBe('degraded')
    expect(result.checks.database.ok).toBe(true)
    expect(result.checks.cache.ok).toBe(false)
    expect(result.checks.cache.message).toBe('cache unavailable')
  })

  it('keeps the configured probe order when checks finish out of order', async () => {
    const result = await runHealthProbes([
      { name: 'database', run: async () => await Bun.sleep(5) },
      { name: 'cache', run: async () => true },
    ])

    expect(Object.keys(result.checks)).toEqual(['database', 'cache'])
  })

  it('bounds stalled probes', async () => {
    const result = await runHealthProbes([
      { name: 'database', run: async () => await new Promise(() => {}) },
    ], { timeoutMs: 5 })

    expect(result.status).toBe('degraded')
    expect(result.checks.database.message).toBe('timeout')
  })
})
