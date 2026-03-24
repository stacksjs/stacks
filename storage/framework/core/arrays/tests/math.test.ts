import { describe, expect, it } from 'bun:test'
import {
  average,
  avg,
  covariance,
  interquartileRange,
  max,
  median,
  min,
  mode,
  percentile,
  product,
  range,
  standardDeviation,
  sum,
  variance,
  zScore,
} from '../src/math'

describe('sum', () => {
  it('should return sum of numbers', () => {
    expect(sum([1, 2, 3, 4])).toBe(10)
  })

  it('should return 0 for empty array', () => {
    expect(sum([])).toBe(0)
  })

  it('should handle negative numbers', () => {
    expect(sum([-1, -2, 3])).toBe(0)
  })

  it('should handle single element', () => {
    expect(sum([5])).toBe(5)
  })
})

describe('average', () => {
  it('should return the average', () => {
    expect(average([1, 2, 3, 4])).toBe(2.5)
  })

  it('should throw for empty array', () => {
    expect(() => average([])).toThrow('Cannot compute average of an empty array')
  })

  it('should handle single element', () => {
    expect(average([10])).toBe(10)
  })

  it('should handle negative numbers', () => {
    expect(average([-2, 2])).toBe(0)
  })
})

describe('avg', () => {
  it('should be an alias for average', () => {
    expect(avg([1, 2, 3, 4])).toBe(2.5)
  })
})

describe('median', () => {
  it('should return median for odd-length array', () => {
    expect(median([1, 2, 3])).toBe(2)
  })

  it('should return median for even-length array', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  it('should throw for empty array', () => {
    expect(() => median([])).toThrow('Cannot compute median of an empty array')
  })

  it('should handle single element', () => {
    expect(median([5])).toBe(5)
  })

  it('should handle unsorted input', () => {
    expect(median([3, 1, 2])).toBe(2)
  })

  it('should handle negative numbers', () => {
    expect(median([-3, -1, -2])).toBe(-2)
  })
})

describe('mode', () => {
  it('should return the most frequent value', () => {
    expect(mode([1, 2, 2, 3])).toBe(2)
  })

  it('should return first element when all unique', () => {
    expect(mode([1, 2, 3, 4])).toBe(1)
  })

  it('should throw for empty array', () => {
    expect(() => mode([])).toThrow('Cannot compute mode of an empty array')
  })

  it('should handle single element', () => {
    expect(mode([7])).toBe(7)
  })

  it('should return highest frequency value', () => {
    expect(mode([1, 2, 2, 3, 3, 4, 4, 4])).toBe(4)
  })
})

describe('product', () => {
  it('should return the product of numbers', () => {
    expect(product([1, 2, 3, 4])).toBe(24)
  })

  it('should return 1 for empty array', () => {
    expect(product([])).toBe(1)
  })

  it('should handle zeros', () => {
    expect(product([1, 0, 3])).toBe(0)
  })

  it('should handle negative numbers', () => {
    expect(product([-2, 3])).toBe(-6)
  })
})

describe('min', () => {
  it('should return the minimum value', () => {
    expect(min([3, 1, 4, 1, 5])).toBe(1)
  })

  it('should throw for empty array', () => {
    expect(() => min([])).toThrow('Cannot compute min of an empty array')
  })

  it('should handle negative numbers', () => {
    expect(min([1, -5, 3])).toBe(-5)
  })
})

describe('max', () => {
  it('should return the maximum value', () => {
    expect(max([3, 1, 4, 1, 5])).toBe(5)
  })

  it('should throw for empty array', () => {
    expect(() => max([])).toThrow('Cannot compute max of an empty array')
  })

  it('should handle negative numbers', () => {
    expect(max([-3, -1, -5])).toBe(-1)
  })
})

describe('range', () => {
  it('should return the range', () => {
    expect(range([1, 2, 3, 4])).toBe(3)
  })

  it('should handle negative numbers', () => {
    expect(range([-1, 5])).toBe(6)
  })
})

describe('variance', () => {
  it('should return the variance', () => {
    expect(variance([1, 2, 3, 4])).toBe(1.25)
  })
})

describe('standardDeviation', () => {
  it('should return the standard deviation', () => {
    expect(standardDeviation([1, 2, 3, 4])).toBeCloseTo(1.118033988749895, 10)
  })

  it('should return 0 for identical values', () => {
    expect(standardDeviation([5, 5, 5])).toBe(0)
  })
})

describe('zScore', () => {
  it('should return 0 for the mean value', () => {
    expect(zScore([1, 2, 3, 4, 5], 3)).toBeCloseTo(0, 10)
  })

  it('should return positive z-score for above-mean values', () => {
    expect(zScore([1, 2, 3, 4], 3)).toBeGreaterThan(0)
  })

  it('should return negative z-score for below-mean values', () => {
    expect(zScore([1, 2, 3, 4], 1)).toBeLessThan(0)
  })
})

describe('percentile', () => {
  it('should compute percentile correctly', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(percentile(arr, 50)).toBe(5.5)
  })

  it('should return first element for 0th percentile', () => {
    expect(percentile([1, 2, 3, 4], 0)).toBe(1)
  })
})

describe('interquartileRange', () => {
  it('should return the IQR', () => {
    expect(interquartileRange([1, 2, 3, 4])).toBe(2)
  })
})

describe('covariance', () => {
  it('should return positive covariance for positively correlated arrays', () => {
    expect(covariance([1, 2, 3, 4], [1, 2, 3, 4])).toBe(1.25)
  })

  it('should return negative covariance for negatively correlated arrays', () => {
    expect(covariance([1, 2, 3, 4], [4, 3, 2, 1])).toBe(-1.25)
  })

  it('should throw for arrays of different length', () => {
    expect(() => covariance([1, 2], [1, 2, 3])).toThrow('Arrays must have the same length')
  })
})
