import { describe, expect, it } from 'bun:test'
import { interquartileRange, move, percentile, zScore } from '../src'

/**
 * The interquartile range took its halves in the order given, so the same
 * numbers gave different answers; percentile answered 0 (or an extrapolation)
 * for an empty array or a percentile outside 0 to 100; and the documented
 * examples for zScore, percentile, interquartileRange and move did not match
 * what the functions return.
 */
describe('interquartileRange', () => {
  it('does not depend on the order of the numbers', () => {
    expect(interquartileRange([4, 1, 3, 2])).toBe(interquartileRange([1, 2, 3, 4]))
    expect(interquartileRange([8, 3, 1, 7, 2, 6, 5, 4])).toBe(4)
  })

  it('is 0 for one number and refuses none', () => {
    expect(interquartileRange([5])).toBe(0)
    expect(() => interquartileRange([])).toThrow('interquartile range of an empty array')
  })
})

describe('percentile', () => {
  it('is the value at a percentile, at the ends and between ranks', () => {
    expect(percentile([3, 1, 2], 0)).toBe(1)
    expect(percentile([3, 1, 2], 100)).toBe(3)
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5)
    expect(percentile([1, 2, 3, 4], 75)).toBe(3.25)
  })

  it('refuses what has no answer instead of making one up', () => {
    expect(() => percentile([], 50)).toThrow('empty array')
    expect(() => percentile([1, 2, 3], 150)).toThrow(RangeError)
    expect(() => percentile([1, 2, 3], -10)).toThrow(RangeError)
    expect(() => percentile([1, 2, 3], Number.NaN)).toThrow(RangeError)
  })
})

describe('documented examples', () => {
  it('match what the functions return', () => {
    expect(zScore([1, 2, 3, 4], 2)).toBeCloseTo(-0.4472135954999579, 12)
    expect(zScore([1, 2, 3, 4], 3)).toBeCloseTo(0.4472135954999579, 12)
    expect(interquartileRange([1, 2, 3, 4])).toBe(2)
    expect(move([1, 2, 3, 4], -1, -2)).toEqual([1, 2, 4, 3])
    expect(move([1, 2, 3, 4], 0, -1)).toEqual([2, 3, 4, 1])
  })
})
