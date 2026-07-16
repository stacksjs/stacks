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

  it('validates variant weights', () => {
    expect(() => variants({})).toThrow(/At least one/)
    expect(() => variants({ control: 0, test: 1 })).toThrow(/positive/)
    expect(() => variants({ control: Number.POSITIVE_INFINITY })).toThrow(/finite/)
  })
})
