import { describe, expect, it } from 'bun:test'
import { featureBucket, percentage, variants } from '../src/strategies'

describe('rollout strategies', () => {
  it('creates a deterministic bucket', () => {
    expect(featureBucket('checkout\0user:42')).toBe(featureBucket('checkout\0user:42'))
    expect(featureBucket('checkout\0user:42')).toBeGreaterThanOrEqual(0)
    expect(featureBucket('checkout\0user:42')).toBeLessThan(100)
  })

  it('handles percentage boundaries exactly', async () => {
    const context = { name: 'checkout', scope: 1, scopeKey: 'number:1' }
    expect(await percentage(0)(1, context)).toBe(false)
    expect(await percentage(100)(1, context)).toBe(true)
    expect(() => percentage(-1)).toThrow(RangeError)
    expect(() => percentage(101)).toThrow(RangeError)
    expect(() => percentage(Number.NaN)).toThrow(RangeError)
  })

  it('assigns stable weighted variants', async () => {
    const strategy = variants({ control: 50, compact: 30, visual: 20 })
    const context = { name: 'search', scope: { id: 9 }, scopeKey: 'model:User:9' }
    const first = await strategy(context.scope, context)
    const second = await strategy(context.scope, context)
    expect(second).toBe(first)
    expect(['control', 'compact', 'visual']).toContain(first)
  })

  // Consecutive scope keys differ only in their last bytes, and FNV-1a alone
  // barely moves the top bits for that: users 11 to 19 shared a 5% band, and
  // a 10% rollout to users 1 to 100 enabled none of them.
  describe('spreads consecutive ids across the range', () => {
    const bucket = (id: number, flag = 'new-checkout') => featureBucket(`${flag}\0model:User:${id}`)
    const enabled = (from: number, to: number, percent: number, flag?: string) => {
      let on = 0
      for (let id = from; id <= to; id++) if (bucket(id, flag) < percent) on++
      return on
    }

    it('does not cluster neighbours', () => {
      const neighbours = Array.from({ length: 9 }, (_, i) => bucket(11 + i))
      expect(Math.max(...neighbours) - Math.min(...neighbours)).toBeGreaterThan(40)
    })

    it('enables close to the asked share of a small and a large user base', () => {
      // Ten flags, so one flag's luck cannot pass or fail it: each is a
      // sample of 100, whose 10% count varies by about 3 either way.
      const counts = ['new-checkout', 'search', 'beta', 'dark-mode', 'promo', 'flag-a', 'flag-b', 'x', 'onboarding-v2', 'pricing']
        .map(flag => enabled(1, 100, 10, flag))
      expect(Math.min(...counts)).toBeGreaterThan(0)
      expect(counts.reduce((sum, count) => sum + count, 0) / counts.length).toBeGreaterThan(8)
      expect(counts.reduce((sum, count) => sum + count, 0) / counts.length).toBeLessThan(12)
      for (let start = 1; start <= 901; start += 100)
        expect(enabled(start, start + 99, 50)).toBeGreaterThanOrEqual(35)
      expect(Math.abs(enabled(1, 100_000, 10) - 10_000)).toBeLessThan(300)
    })

    it('picks independent scopes for two flags', () => {
      let a = 0
      let both = 0
      for (let id = 1; id <= 100_000; id++) {
        const x = bucket(id, 'flag-a') < 50
        if (x) a++
        if (x && bucket(id, 'flag-b') < 50) both++
      }
      expect(Math.abs(both / a - 0.5)).toBeLessThan(0.01)
    })
  })

  it('validates variant weights', () => {
    expect(() => variants({})).toThrow(/At least one/)
    expect(() => variants({ control: 0, test: 1 })).toThrow(/positive/)
    expect(() => variants({ control: Number.POSITIVE_INFINITY })).toThrow(/finite/)
  })
})
