import { describe, expect, test } from 'bun:test'
import { median, relativeThroughput } from './statistics'

describe('benchmark statistics', () => {
  test('calculates odd and even medians without mutating input', () => {
    const values = [30, 10, 20]

    expect(median(values)).toBe(20)
    expect(median([10, 20])).toBe(15)
    expect(values).toEqual([30, 10, 20])
  })

  test('summarizes run-paired throughput ratios', () => {
    expect(relativeThroughput([80, 120, 100], [100, 100, 200])).toEqual({
      median: 0.8,
      spread: { min: 0.5, max: 1.2 },
    })
  })

  test('rejects samples that cannot be paired', () => {
    expect(() => relativeThroughput([1], [])).toThrow('equal non-empty samples')
    expect(() => relativeThroughput([1], [0])).toThrow('positive baseline samples')
  })
})
