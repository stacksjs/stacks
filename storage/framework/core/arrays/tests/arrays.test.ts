import { describe, expect, test } from 'bun:test'
import {
  Arr,
  at,
  average,
  clampArrayRange,
  contains,
  containsAll,
  containsAny,
  containsNone,
  containsOnly,
  covariance,
  doesNotContain,
  flatten,
  interquartileRange,
  last,
  max,
  median,
  mergeArrayable,
  min,
  mode,
  move,
  partition,
  percentile,
  product,
  range,
  remove,
  sample,
  shuffle,
  standardDeviation,
  sum,
  toArray,
  uniq,
  variance,
  zScore,
} from '../src'

describe('@stacksjs/arrays', () => {
  describe('helpers', () => {
    test('toArray', () => {
      expect(toArray('foo')).toEqual(['foo'])
      expect(toArray(['foo'])).toEqual(['foo'])
      expect(toArray(null)).toEqual([])
      expect(toArray(undefined)).toEqual([])
      expect(toArray(1)).toEqual([1])
    })

    test('flatten', () => {
      expect(flatten([1, [2, [3, [4, [5]]]]])).toEqual([1, 2, 3, 4, 5])
    })

    test('mergeArrayable', () => {
      expect(mergeArrayable([1, 2], [3, 4], [5, 6])).toEqual([1, 2, 3, 4, 5, 6])
    })

    test('partition', () => {
      const [odd, even] = partition([1, 2, 3, 4], i => i % 2 !== 0)
      expect(odd).toEqual([1, 3])
      expect(even).toEqual([2, 4])
    })

    test('uniq', () => {
      expect(uniq([1, 2, 2, 3, 3, 4])).toEqual([1, 2, 3, 4])
    })

    test('last', () => {
      expect(last([1, 2, 3])).toBe(3)
      expect(last([])).toBeUndefined()
    })

    test('remove', () => {
      const arr = [1, 2, 3]
      expect(remove(arr, 2)).toBe(true)
      expect(arr).toEqual([1, 3])
      expect(remove(arr, 4)).toBe(false)
    })

    test('at', () => {
      expect(at([1, 2, 3], 1)).toBe(2)
      expect(at([1, 2, 3], -1)).toBe(3)
    })

    test('move', () => {
      expect(move([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4])
    })

    test('clampArrayRange', () => {
      expect(clampArrayRange([1, 2, 3], 4)).toBe(2)
    })

    test('sample', () => {
      const arr = [1, 2, 3, 4, 5]
      const result = sample(arr, 2)
      expect(result.length).toBe(2)
      result.forEach(item => expect(arr).toContain(item))
    })

    test('shuffle', () => {
      const arr = [1, 2, 3, 4, 5]
      const shuffled = shuffle([...arr])
      expect(shuffled).toHaveLength(arr.length)
      expect(shuffled).toEqual(expect.arrayContaining(arr))
    })
  })

  describe('contains', () => {
    test('contains', () => {
      expect(contains('foo', ['foo', 'bar'])).toBe(true)
      expect(contains('foo', ['bar'])).toBe(false)
    })

    test('containsAll', () => {
      expect(containsAll(['foo', 'bar'], ['foo', 'bar', 'baz'])).toBe(true)
      expect(containsAll(['foo', 'bar'], ['foo', 'baz'])).toBe(false)
    })

    test('containsAny', () => {
      expect(containsAny(['foo', 'bar'], ['foo', 'baz'])).toBe(true)
      expect(containsAny(['foo', 'bar'], ['baz'])).toBe(false)
    })

    test('containsNone', () => {
      expect(containsNone(['foo', 'bar'], ['baz'])).toBe(true)
      expect(containsNone(['foo', 'bar'], ['foo', 'baz'])).toBe(false)
    })

    test('containsOnly', () => {
      expect(containsOnly(['foo', 'bar'], ['foo', 'bar'])).toBe(true)
      expect(containsOnly(['foo', 'bar'], ['foo', 'bar', 'baz'])).toBe(false)
    })

    test('doesNotContain', () => {
      expect(doesNotContain('foo', ['bar'])).toBe(true)
      expect(doesNotContain('foo', ['foo', 'bar'])).toBe(false)
    })
  })

  describe('math', () => {
    test('average', () => {
      expect(average([1, 2, 3, 4])).toBe(2.5)
    })

    test('median', () => {
      expect(median([1, 2, 3, 4])).toBe(2.5)
      expect(median([1, 2, 3, 4, 5])).toBe(3)
    })

    test('mode', () => {
      expect(mode([1, 2, 2, 3, 4])).toBe(2)
    })

    test('sum', () => {
      expect(sum([1, 2, 3, 4])).toBe(10)
    })

    test('product', () => {
      expect(product([1, 2, 3, 4])).toBe(24)
    })

    test('min', () => {
      expect(min([1, 2, 3, 4])).toBe(1)
    })

    test('max', () => {
      expect(max([1, 2, 3, 4])).toBe(4)
    })

    test('range', () => {
      expect(range([1, 2, 3, 4])).toBe(3)
    })

    test('variance', () => {
      expect(variance([1, 2, 3, 4])).toBe(1.25)
    })

    test('standardDeviation', () => {
      expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 1)
    })

    test('zScore', () => {
      expect(zScore([1, 2, 3, 4, 5], 3)).toBeCloseTo(0, 2)
    })

    test('percentile', () => {
      expect(percentile([1, 2, 3, 4], 75)).toBeCloseTo(3.25, 2)
    })

    test('interquartileRange', () => {
      expect(interquartileRange([1, 2, 3, 4, 5, 6, 7, 8])).toBe(4)
    })

    test('covariance', () => {
      expect(covariance([1, 2, 3, 4], [1, 2, 3, 4])).toBe(1.25)
      expect(covariance([1, 2, 3, 4], [4, 3, 2, 1])).toBe(-1.25)
    })
  })

  describe('Arr macro', () => {
    test('Arr.contains', () => {
      expect(Arr.contains('foo', ['foo', 'bar'])).toBe(true)
      expect(Arr.contains('foo', ['bar'])).toBe(false)
    })

    test('Arr.toArray', () => {
      expect(Arr.toArray('foo')).toEqual(['foo'])
      expect(Arr.toArray(['foo'])).toEqual(['foo'])
    })

    test('Arr.flatten', () => {
      expect(Arr.flatten([1, [2, [3, [4, [5]]]]])).toEqual([1, 2, 3, 4, 5])
    })

    test('Arr.unique', () => {
      expect(Arr.unique([1, 2, 2, 3, 3, 4])).toEqual([1, 2, 3, 4])
    })

    test('Arr.last', () => {
      expect(Arr.last([1, 2, 3])).toBe(3)
    })

    test('Arr.remove', () => {
      const arr = [1, 2, 3]
      expect(Arr.remove(arr, 2)).toBe(true)
      expect(arr).toEqual([1, 3])
    })

    test('Arr.random', () => {
      const arr = [1, 2, 3, 4, 5]
      const result = Arr.random(arr, 2)
      expect(result.length).toBe(2)
      result.forEach(item => expect(arr).toContain(item))
    })

    test('Arr.sum', () => {
      expect(Arr.sum([1, 2, 3, 4])).toBe(10)
    })

    test('Arr.average', () => {
      expect(Arr.average([1, 2, 3, 4])).toBe(2.5)
    })

    test('Arr.median', () => {
      expect(Arr.median([1, 2, 3, 4, 5])).toBe(3)
    })

    test('Arr.mode', () => {
      expect(Arr.mode([1, 2, 2, 3, 4])).toBe(2)
    })
  })
})
