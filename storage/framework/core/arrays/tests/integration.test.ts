import { describe, expect, test } from 'bun:test'
import { Arr } from '../src/macro'
import {
  contains,
  containsAll,
  containsAny,
  containsNone,
  containsOnly,
  doesNotContain,
} from '../src/contains'
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

// ─── Math Functions ─────────────────────────────────────────────────────────

describe('Math Functions - Real Data', () => {
  test('sum computes the total of an array', () => {
    expect(sum([1, 2, 3, 4, 5])).toBe(15)
    expect(sum([10, -5, 3])).toBe(8)
    expect(sum([])).toBe(0)
  })

  test('average returns the arithmetic mean', () => {
    expect(average([2, 4, 6])).toBe(4)
    expect(average([10, 20, 30, 40])).toBe(25)
  })

  test('avg is an alias for average', () => {
    expect(avg([1, 2, 3])).toBe(average([1, 2, 3]))
  })

  test('median returns the middle value', () => {
    expect(median([1, 3, 5])).toBe(3)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([7])).toBe(7)
  })

  test('mode returns the most frequent value', () => {
    expect(mode([1, 2, 2, 3])).toBe(2)
    expect(mode([4, 4, 4, 1, 1])).toBe(4)
    expect(mode([5])).toBe(5)
  })

  test('product multiplies all elements', () => {
    expect(product([2, 3, 4])).toBe(24)
    expect(product([1, 5, 10])).toBe(50)
    expect(product([0, 100])).toBe(0)
  })

  test('min returns the smallest value', () => {
    expect(min([3, 1, 4, 1, 5])).toBe(1)
    expect(min([-10, 0, 10])).toBe(-10)
  })

  test('max returns the largest value', () => {
    expect(max([3, 1, 4, 1, 5])).toBe(5)
    expect(max([-10, 0, 10])).toBe(10)
  })

  test('range computes max - min', () => {
    expect(range([1, 2, 3, 4])).toBe(3)
    expect(range([-5, 5])).toBe(10)
  })

  test('variance computes population variance', () => {
    expect(variance([1, 2, 3, 4])).toBe(1.25)
  })

  test('standardDeviation computes population std dev', () => {
    const sd = standardDeviation([1, 2, 3, 4])
    expect(sd).toBeCloseTo(Math.sqrt(1.25), 10)
  })

  test('zScore computes standard score', () => {
    const z = zScore([1, 2, 3, 4], 2.5)
    expect(z).toBeCloseTo(0, 10) // 2.5 is the mean
  })

  test('percentile interpolates correctly', () => {
    const data = [10, 20, 30, 40, 50]
    const p50 = percentile(data, 50)
    expect(p50).toBe(30)
  })

  test('interquartileRange computes IQR', () => {
    const iqr = interquartileRange([1, 2, 3, 4, 5, 6, 7, 8])
    expect(iqr).toBeGreaterThan(0)
  })

  test('covariance of identical arrays equals variance', () => {
    const arr = [1, 2, 3, 4]
    expect(covariance(arr, arr)).toBe(variance(arr))
  })

  test('covariance of inversely related arrays is negative', () => {
    expect(covariance([1, 2, 3, 4], [4, 3, 2, 1])).toBe(-1.25)
  })

  test('math functions throw on empty arrays', () => {
    expect(() => average([])).toThrow()
    expect(() => median([])).toThrow()
    expect(() => mode([])).toThrow()
    expect(() => min([])).toThrow()
    expect(() => max([])).toThrow()
  })
})

// ─── Helper Functions ─────────────────────────────────────────────────────────

describe('Helper Functions - Real Data', () => {
  test('toArray wraps non-arrays', () => {
    expect(toArray('foo')).toEqual(['foo'])
    expect(toArray([1, 2])).toEqual([1, 2])
    expect(toArray(null)).toEqual([])
    expect(toArray(undefined)).toEqual([])
  })

  test('flatten deeply nested arrays', () => {
    expect(flatten([1, [2, [3, [4]]]])).toEqual([1, 2, 3, 4])
    expect(flatten([])).toEqual([])
    expect(flatten('hello')).toEqual(['hello'])
  })

  test('mergeArrayable merges multiple arrays', () => {
    expect(mergeArrayable([1, 2], [3, 4], [5])).toEqual([1, 2, 3, 4, 5])
    expect(mergeArrayable(null, [1], undefined)).toEqual([1])
  })

  test('uniq removes duplicates', () => {
    expect(uniq([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3])
    expect(uniq(['a', 'b', 'a'])).toEqual(['a', 'b'])
  })

  test('unique is an alias for uniq', () => {
    expect(unique([1, 1, 2])).toEqual(uniq([1, 1, 2]))
  })

  test('uniqueBy uses custom equality', () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 1 }]
    const result = uniqueBy(items, (a, b) => a.id === b.id)
    expect(result.length).toBe(2)
    expect(result[0].id).toBe(1)
    expect(result[1].id).toBe(2)
  })

  test('last returns the final element', () => {
    expect(last([10, 20, 30])).toBe(30)
    expect(last([42])).toBe(42)
  })

  test('at accesses by positive and negative index', () => {
    expect(at([10, 20, 30], 0)).toBe(10)
    expect(at([10, 20, 30], -1)).toBe(30)
    expect(at([10, 20, 30], -2)).toBe(20)
    expect(at([], 0)).toBeUndefined()
  })

  test('remove splices an element from the array', () => {
    const arr = [1, 2, 3, 4]
    expect(remove(arr, 2)).toBe(true)
    expect(arr).toEqual([1, 3, 4])
    expect(remove(arr, 99)).toBe(false)
  })

  test('move repositions elements', () => {
    expect(move([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4])
    expect(move([1, 2, 3, 4], -1, 0)).toEqual([4, 1, 2, 3])
  })

  test('clampArrayRange clamps index within bounds', () => {
    expect(clampArrayRange([1, 2, 3], -5)).toBe(0)
    expect(clampArrayRange([1, 2, 3], 1)).toBe(1)
    expect(clampArrayRange([1, 2, 3], 10)).toBe(2)
  })

  test('sample returns the requested number of items', () => {
    const arr = [1, 2, 3, 4, 5]
    const result = sample(arr, 3)
    expect(result.length).toBe(3)
    result.forEach(item => expect(arr).toContain(item))
  })

  test('shuffle returns an array with the same elements', () => {
    const original = [1, 2, 3, 4, 5]
    const copy = [...original]
    shuffle(copy)
    expect(copy.length).toBe(original.length)
    expect(copy.sort()).toEqual(original.sort())
  })

  test('partition splits array by predicate', () => {
    const [evens, odds] = partition([1, 2, 3, 4, 5, 6], i => i % 2 === 0)
    expect(evens).toEqual([2, 4, 6])
    expect(odds).toEqual([1, 3, 5])
  })
})

// ─── Contains Functions ─────────────────────────────────────────────────────

describe('Contains Functions - Real Data', () => {
  test('contains checks substring inclusion', () => {
    expect(contains('foobar', ['foo'])).toBe(true)
    expect(contains('hello', ['world'])).toBe(false)
  })

  test('containsAll requires all needles present', () => {
    expect(containsAll(['foobar', 'bazqux'], ['foo', 'baz'])).toBe(true)
    expect(containsAll(['foobar', 'hello'], ['foo', 'xyz'])).toBe(false)
  })

  test('containsAny requires at least one match', () => {
    expect(containsAny(['foobar', 'hello'], ['foo', 'xyz'])).toBe(true)
    expect(containsAny(['hello', 'world'], ['xyz', 'abc'])).toBe(false)
  })

  test('containsNone ensures no matches', () => {
    expect(containsNone(['hello', 'world'], ['xyz'])).toBe(true)
    expect(containsNone(['hello', 'world'], ['hello'])).toBe(false)
  })

  test('containsOnly checks that haystack only contains needles', () => {
    // containsOnly(needles, haystack) calls containsAll(haystack, needles)
    // so it checks that every haystack element is contained in a needle
    expect(containsOnly(['foo', 'bar'], ['foo', 'bar'])).toBe(true)
    expect(containsOnly(['foo', 'bar'], ['foo', 'bar', 'baz'])).toBe(false)
  })

  test('doesNotContain is the inverse of contains', () => {
    expect(doesNotContain('hello', ['world'])).toBe(true)
    expect(doesNotContain('foobar', ['foo'])).toBe(false)
  })
})

// ─── Arr Facade ─────────────────────────────────────────────────────────────

describe('Arr Facade - Real Data', () => {
  test('Arr.sum delegates correctly', () => {
    expect(Arr.sum([5, 10, 15])).toBe(30)
  })

  test('Arr.average delegates correctly', () => {
    expect(Arr.average([2, 4])).toBe(3)
  })

  test('Arr.avg is an alias for average', () => {
    expect(Arr.avg([10, 20])).toBe(15)
  })

  test('Arr.median delegates correctly', () => {
    expect(Arr.median([1, 2, 3])).toBe(2)
  })

  test('Arr.mode delegates correctly', () => {
    expect(Arr.mode([1, 1, 2])).toBe(1)
  })

  test('Arr.range delegates correctly', () => {
    expect(Arr.range([1, 5])).toBe(4)
  })

  test('Arr.contains delegates correctly', () => {
    expect(Arr.contains('foobar', ['foo'])).toBe(true)
  })

  test('Arr.unique removes duplicates', () => {
    expect(Arr.unique([1, 1, 2, 3, 3])).toEqual([1, 2, 3])
  })

  test('Arr.last returns last element', () => {
    expect(Arr.last([1, 2, 3])).toBe(3)
  })

  test('Arr.at accesses by index', () => {
    expect(Arr.at([10, 20, 30], 1)).toBe(20)
  })

  test('Arr.remove removes element from array', () => {
    const a = [1, 2, 3]
    Arr.remove(a, 2)
    expect(a).toEqual([1, 3])
  })

  test('Arr.flatten handles nested arrays', () => {
    expect(Arr.flatten([1, [2, [3]]])).toEqual([1, 2, 3])
  })

  test('Arr.toArray wraps scalars', () => {
    expect(Arr.toArray(42)).toEqual([42])
  })

  test('Arr.partition splits by filter', () => {
    const [pass, fail] = Arr.partition([1, 2, 3, 4], i => i > 2)
    expect(pass).toEqual([3, 4])
    expect(fail).toEqual([1, 2])
  })

  test('Arr.sample returns requested count', () => {
    const result = Arr.sample([1, 2, 3, 4, 5], 2)
    expect(result.length).toBe(2)
  })

  test('Arr.shuffle returns same-length array', () => {
    const arr = [1, 2, 3, 4]
    const result = Arr.shuffle([...arr])
    expect(result.length).toBe(4)
  })

  test('Arr.move repositions element', () => {
    expect(Arr.move([1, 2, 3], 0, 2)).toEqual([2, 3, 1])
  })

  test('Arr.clampArrayRange clamps index', () => {
    expect(Arr.clampArrayRange([1, 2, 3], 100)).toBe(2)
  })
})
