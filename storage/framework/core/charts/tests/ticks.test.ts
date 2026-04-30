import { describe, expect, it } from 'bun:test'
import { formatTick, niceTicks } from '../src/ticks'

describe('niceTicks', () => {
  it('produces ascending tick values that span the input range', () => {
    const ticks = niceTicks(0, 87)
    expect(ticks[0]).toBeLessThanOrEqual(0)
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(87)
    for (let i = 1; i < ticks.length; i++)
      expect(ticks[i]).toBeGreaterThan(ticks[i - 1])
  })

  it('handles zero range gracefully', () => {
    const ticks = niceTicks(5, 5)
    expect(ticks.length).toBeGreaterThanOrEqual(1)
  })
})

describe('formatTick', () => {
  it('compacts thousands and millions', () => {
    expect(formatTick(1500)).toBe('1.5K')
    expect(formatTick(2_500_000)).toBe('2.5M')
  })

  it('keeps integers raw under 1000', () => {
    expect(formatTick(42)).toBe('42')
  })
})
