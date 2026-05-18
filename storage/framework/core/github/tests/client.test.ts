import { describe, expect, test } from 'bun:test'
import { mapWithConcurrency } from '../src/client'

describe('mapWithConcurrency', () => {
  test('preserves input order even when workers finish out of order', async () => {
    const result = await mapWithConcurrency([1, 2, 3, 4, 5], 3, async (n) => {
      // largest values resolve first to flip natural ordering
      await new Promise(r => setTimeout(r, (10 - n) * 5))
      return n * 2
    })
    expect(result).toEqual([2, 4, 6, 8, 10])
  })

  test('caps concurrency at the requested limit', async () => {
    let inFlight = 0
    let peak = 0
    const items = Array.from({ length: 20 }, (_, i) => i)
    await mapWithConcurrency(items, 4, async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise(r => setTimeout(r, 5))
      inFlight--
    })
    expect(peak).toBeLessThanOrEqual(4)
  })

  test('handles empty input without spinning workers', async () => {
    const result = await mapWithConcurrency([], 8, async () => 1)
    expect(result).toEqual([])
  })
})
