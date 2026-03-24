import { describe, expect, it } from 'bun:test'
import {
  at,
  clampArrayRange,
  flatten,
  last,
  mergeArrayable,
  move,
  partition,
  remove,
  sample,
  shuffle,
  toArray,
  uniq,
  unique,
  uniqueBy,
} from '../src/helpers'

describe('toArray', () => {
  it('should wrap a single value in an array', () => {
    expect(toArray('foo')).toEqual(['foo'])
  })

  it('should return array as-is', () => {
    expect(toArray(['foo'])).toEqual(['foo'])
  })

  it('should return empty array for null', () => {
    expect(toArray(null)).toEqual([])
  })

  it('should return empty array for undefined', () => {
    expect(toArray(undefined)).toEqual([])
  })

  it('should wrap a number', () => {
    expect(toArray(1)).toEqual([1])
  })

  it('should wrap an object', () => {
    expect(toArray({ foo: 'bar' })).toEqual([{ foo: 'bar' }])
  })
})

describe('flatten', () => {
  it('should flatten nested arrays', () => {
    expect(flatten([1, [2, [3, [4, [5]]]]])).toEqual([1, 2, 3, 4, 5])
  })

  it('should handle already-flat arrays', () => {
    expect(flatten([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('should return empty array for null', () => {
    expect(flatten(null)).toEqual([])
  })

  it('should return empty array for undefined', () => {
    expect(flatten(undefined)).toEqual([])
  })
})

describe('mergeArrayable', () => {
  it('should merge multiple arrays', () => {
    expect(mergeArrayable([1, 2], [3, 4], [5, 6])).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('should handle single values', () => {
    expect(mergeArrayable(1, 2, 3)).toEqual([1, 2, 3])
  })

  it('should handle null values', () => {
    expect(mergeArrayable([1], null, [3])).toEqual([1, 3])
  })
})

describe('uniq', () => {
  it('should remove duplicate values', () => {
    expect(uniq([1, 2, 3, 3, 2, 1])).toEqual([1, 2, 3])
  })

  it('should handle empty array', () => {
    expect(uniq([])).toEqual([])
  })

  it('should handle array with no duplicates', () => {
    expect(uniq([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('should handle strings', () => {
    expect(uniq(['a', 'b', 'a'])).toEqual(['a', 'b'])
  })
})

describe('unique', () => {
  it('should be an alias for uniq', () => {
    expect(unique([1, 1, 2, 2, 3])).toEqual([1, 2, 3])
  })
})

describe('uniqueBy', () => {
  it('should deduplicate by custom equality function', () => {
    const result = uniqueBy(
      [{ id: 1 }, { id: 2 }, { id: 1 }],
      (a, b) => a.id === b.id,
    )
    expect(result).toEqual([{ id: 1 }, { id: 2 }])
  })
})

describe('last', () => {
  it('should return the last element', () => {
    expect(last([1, 2, 3])).toBe(3)
  })

  it('should return undefined for empty array', () => {
    expect(last([] as const)).toBeUndefined()
  })

  it('should handle single element', () => {
    expect(last([42])).toBe(42)
  })
})

describe('at', () => {
  it('should return the element at index', () => {
    expect(at([1, 2, 3], 1)).toBe(2)
  })

  it('should support negative index', () => {
    expect(at([1, 2, 3], -1)).toBe(3)
  })

  it('should return undefined for out-of-bounds', () => {
    expect(at([1, 2, 3], 5)).toBeUndefined()
  })

  it('should return undefined for empty array', () => {
    expect(at([] as const, 0)).toBeUndefined()
  })
})

describe('remove', () => {
  it('should remove an element from the array', () => {
    const arr = [1, 2, 3]
    expect(remove(arr, 2)).toBe(true)
    expect(arr).toEqual([1, 3])
  })

  it('should return false if element not found', () => {
    const arr = [1, 2, 3]
    expect(remove(arr, 4)).toBe(false)
    expect(arr).toEqual([1, 2, 3])
  })
})

describe('move', () => {
  it('should move an element from one index to another', () => {
    expect(move([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4])
  })

  it('should handle negative indices', () => {
    expect(move([1, 2, 3, 4], -1, 0)).toEqual([4, 1, 2, 3])
  })

  it('should return same order when from equals to', () => {
    expect(move([1, 2, 3, 4], 1, 1)).toEqual([1, 2, 3, 4])
  })

  it('should return empty array for empty input', () => {
    expect(move([], 0, 1)).toEqual([])
  })
})

describe('clampArrayRange', () => {
  it('should clamp to valid index range', () => {
    expect(clampArrayRange([1, 2, 3], 0)).toBe(0)
    expect(clampArrayRange([1, 2, 3], 2)).toBe(2)
    expect(clampArrayRange([1, 2, 3], 5)).toBe(2)
    expect(clampArrayRange([1, 2, 3], -1)).toBe(0)
  })
})

describe('sample', () => {
  it('should return the requested number of items', () => {
    const result = sample([1, 2, 3, 4, 5], 3)
    expect(result).toHaveLength(3)
  })

  it('should return items from the original array', () => {
    const arr = [1, 2, 3, 4, 5]
    const result = sample(arr, 2)
    for (const item of result) {
      expect(arr).toContain(item)
    }
  })

  it('should return empty array for count 0', () => {
    expect(sample([1, 2, 3], 0)).toEqual([])
  })
})

describe('shuffle', () => {
  it('should return the same length', () => {
    const arr = [1, 2, 3, 4, 5]
    const result = shuffle([...arr])
    expect(result).toHaveLength(arr.length)
  })

  it('should contain the same elements', () => {
    const arr = [1, 2, 3, 4, 5]
    const result = shuffle([...arr])
    expect(result.sort()).toEqual(arr.sort())
  })

  it('should handle empty array', () => {
    expect(shuffle([])).toEqual([])
  })

  it('should handle single element', () => {
    expect(shuffle([1])).toEqual([1])
  })
})

describe('partition', () => {
  it('should divide array into two parts by filter', () => {
    const [odd, even] = partition([1, 2, 3, 4], i => i % 2 !== 0)
    expect(odd).toEqual([1, 3])
    expect(even).toEqual([2, 4])
  })

  it('should handle empty array', () => {
    const [matching, rest] = partition([], (_i: number) => _i > 0)
    expect(matching).toEqual([])
    expect(rest).toEqual([])
  })

  it('should put all items in rest when no match', () => {
    const [matching, rest] = partition([1, 2, 3], () => false)
    expect(matching).toEqual([])
    expect(rest).toEqual([1, 2, 3])
  })
})
