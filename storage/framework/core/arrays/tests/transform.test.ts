import { describe, expect, it } from 'bun:test'
import {
  chunk,
  compact,
  countBy,
  difference,
  drop,
  dropLast,
  dropLastWhile,
  dropWhile,
  first,
  groupBy,
  intersection,
  keyBy,
  maxBy,
  meanBy,
  minBy,
  sortBy,
  splitAt,
  splitWhen,
  sumBy,
  tail,
  take,
  takeLast,
  takeLastWhile,
  takeWhile,
  times,
  union,
  unzip,
  zip,
  zipWith,
} from '../src/transform'

/**
 * Nothing here mutates its input. Asserted once per function that returns an
 * array rather than repeated in prose, because an accidental in-place sort or
 * splice is the failure this whole file is most likely to develop.
 */
function unchanged<T>(input: T[], run: (input: T[]) => unknown): void {
  const before = structuredClone(input)
  run(input)
  expect(input).toEqual(before)
}

describe('chunk', () => {
  it('splits into consecutive groups, the last one short', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]])
  })

  it('handles a size larger than the array, and an empty array', () => {
    expect(chunk([1, 2], 10)).toEqual([[1, 2]])
    expect(chunk([], 3)).toEqual([])
  })

  it('refuses a size that cannot produce progress', () => {
    // A size of 0 would loop forever; a fractional one would produce
    // overlapping groups. Both are caller errors worth naming.
    expect(() => chunk([1], 0)).toThrow(/positive integer/)
    expect(() => chunk([1], -1)).toThrow(/positive integer/)
    expect(() => chunk([1], 1.5)).toThrow(/positive integer/)
  })

  it('does not mutate', () => {
    unchanged([1, 2, 3], input => chunk(input, 2))
  })
})

describe('compact', () => {
  it('drops null and undefined', () => {
    expect(compact([1, null, 2, undefined, 3])).toEqual([1, 2, 3])
  })

  it('keeps other falsy values, which are data rather than mistakes', () => {
    expect(compact([0, '', false, Number.NaN, null])).toEqual([0, '', false, Number.NaN])
  })

  it('narrows the type', () => {
    const values: Array<number | null | undefined> = [1, null, 2]
    const compacted: number[] = compact(values)
    expect(compacted).toEqual([1, 2])
  })
})

describe('first and tail', () => {
  it('answers undefined for an empty array rather than throwing', () => {
    expect(first([1, 2, 3])).toBe(1)
    expect(first([])).toBeUndefined()
  })

  it('returns everything after the first element', () => {
    expect(tail([1, 2, 3])).toEqual([2, 3])
    expect(tail([1])).toEqual([])
    expect(tail([])).toEqual([])
  })
})

describe('take and drop', () => {
  it('take and drop are complementary', () => {
    const input = [1, 2, 3, 4]
    for (const count of [0, 1, 2, 4, 10])
      expect([...take(input, count), ...drop(input, count)]).toEqual(input)
  })

  it('takeLast and dropLast are complementary', () => {
    const input = [1, 2, 3, 4]
    for (const count of [0, 1, 2, 4, 10])
      expect([...dropLast(input, count), ...takeLast(input, count)]).toEqual(input)
  })

  /**
   * `slice` reads a negative index as counting from the end, so `take(xs, -2)`
   * would silently return everything but the last two - which reads as "take
   * two" at the call site. Zero is the only sensible answer.
   */
  it('takes nothing for a negative count, rather than counting from the end', () => {
    expect(take([1, 2, 3, 4], -2)).toEqual([])
    expect(takeLast([1, 2, 3, 4], -2)).toEqual([])
    expect(drop([1, 2, 3, 4], -2)).toEqual([1, 2, 3, 4])
    expect(dropLast([1, 2, 3, 4], -2)).toEqual([1, 2, 3, 4])
  })

  it('does not mutate', () => {
    unchanged([1, 2, 3], input => take(input, 2))
    unchanged([1, 2, 3], input => drop(input, 2))
  })
})

describe('takeWhile and dropWhile', () => {
  /**
   * The difference from `filter`: these stop at the first failure. A later
   * element that would pass is not included, which is the entire reason to
   * reach for them.
   */
  it('stop at the first failure rather than filtering', () => {
    expect(takeWhile([1, 2, 5, 1], n => n < 3)).toEqual([1, 2])
    expect(dropWhile([1, 2, 5, 1], n => n < 3)).toEqual([5, 1])
  })

  it('are complementary', () => {
    const input = [1, 2, 5, 1]
    const predicate = (n: number): boolean => n < 3
    expect([...takeWhile(input, predicate), ...dropWhile(input, predicate)]).toEqual(input)
  })

  it('handle always-true and always-false predicates', () => {
    expect(takeWhile([1, 2], () => true)).toEqual([1, 2])
    expect(takeWhile([1, 2], () => false)).toEqual([])
    expect(dropWhile([1, 2], () => true)).toEqual([])
    expect(dropWhile([1, 2], () => false)).toEqual([1, 2])
  })

  it('pass the index', () => {
    expect(takeWhile(['a', 'b', 'c'], (_, index) => index < 2)).toEqual(['a', 'b'])
  })
})

describe('takeLastWhile and dropLastWhile', () => {
  it('scan from the end and keep the original order', () => {
    expect(takeLastWhile([1, 5, 2, 1], n => n < 3)).toEqual([2, 1])
    expect(dropLastWhile([1, 5, 2, 1], n => n < 3)).toEqual([1, 5])
  })

  it('are complementary', () => {
    const input = [1, 5, 2, 1]
    const predicate = (n: number): boolean => n < 3
    expect([...dropLastWhile(input, predicate), ...takeLastWhile(input, predicate)]).toEqual(input)
  })

  it('handle always-true and always-false predicates', () => {
    expect(takeLastWhile([1, 2], () => true)).toEqual([1, 2])
    expect(takeLastWhile([1, 2], () => false)).toEqual([])
    expect(dropLastWhile([1, 2], () => true)).toEqual([])
    expect(dropLastWhile([1, 2], () => false)).toEqual([1, 2])
  })
})

describe('groupBy', () => {
  it('groups under the produced key, preserving order within a group', () => {
    expect(groupBy([1, 2, 3, 4], n => (n % 2 ? 'odd' : 'even')))
      .toEqual({ odd: [1, 3], even: [2, 4] })
  })

  /**
   * An `undefined` key drops the element instead of creating an `"undefined"`
   * bucket, which is what lets this filter and group in one pass.
   */
  it('drops an element whose key is undefined', () => {
    expect(groupBy([1, 2, 3], n => (n === 2 ? undefined : 'kept')))
      .toEqual({ kept: [1, 3] })
  })

  it('returns an empty object for an empty array', () => {
    expect(groupBy([], () => 'x')).toEqual({})
  })
})

describe('keyBy', () => {
  it('indexes by the produced key', () => {
    const users = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }]
    expect(keyBy(users, user => user.id)).toEqual({ a: users[0], b: users[1] } as never)
  })

  it('lets the last one win on a duplicate key', () => {
    // Matches what an assignment loop does, and suits a list already in
    // priority order.
    expect(keyBy([{ id: 'a', n: 1 }, { id: 'a', n: 2 }], user => user.id))
      .toEqual({ a: { id: 'a', n: 2 } } as never)
  })

  it('skips an undefined key', () => {
    expect(keyBy([1, 2], n => (n === 1 ? undefined : 'two'))).toEqual({ two: 2 } as never)
  })
})

describe('countBy', () => {
  it('counts elements per key', () => {
    expect(countBy(['a', 'bb', 'c'], word => word.length)).toEqual({ 1: 2, 2: 1 } as never)
  })

  it('skips an undefined key', () => {
    expect(countBy([1, 2, 3], n => (n === 2 ? undefined : 'kept'))).toEqual({ kept: 2 } as never)
  })
})

describe('sortBy', () => {
  /**
   * `Array.prototype.sort` compares stringified values, so `[10, 9].sort()` is
   * `[10, 9]`. This is the single most common reason to reach for `sortBy`.
   */
  it('compares numbers as numbers', () => {
    expect(sortBy([10, 9, 100], n => n)).toEqual([9, 10, 100])
    expect([10, 9, 100].slice().sort()).toEqual([10, 100, 9])
  })

  it('sorts descending when asked', () => {
    expect(sortBy([1, 3, 2], { by: n => n, order: 'desc' })).toEqual([3, 2, 1])
  })

  it('falls through to the next selector on a tie', () => {
    const people = [
      { role: 'admin', name: 'zoe' },
      { role: 'user', name: 'amy' },
      { role: 'admin', name: 'ann' },
    ]

    expect(sortBy(people, person => person.role, person => person.name).map(person => person.name))
      .toEqual(['ann', 'zoe', 'amy'])
  })

  it('mixes directions across selectors', () => {
    const rows = [{ a: 1, b: 1 }, { a: 1, b: 2 }, { a: 2, b: 1 }]

    expect(sortBy(rows, row => row.a, { by: row => row.b, order: 'desc' }))
      .toEqual([{ a: 1, b: 2 }, { a: 1, b: 1 }, { a: 2, b: 1 }])
  })

  it('compares dates, booleans and bigints by their own type', () => {
    const dates = [new Date('2026-03-01'), new Date('2024-01-01')]
    expect(sortBy(dates, date => date)[0]).toEqual(new Date('2024-01-01'))
    expect(sortBy([true, false], flag => flag)).toEqual([false, true])
    expect(sortBy([10n, 9n], value => value)).toEqual([9n, 10n])
  })

  it('is stable and does not mutate', () => {
    const rows = [{ k: 1, id: 'a' }, { k: 1, id: 'b' }, { k: 1, id: 'c' }]
    expect(sortBy(rows, row => row.k).map(row => row.id)).toEqual(['a', 'b', 'c'])
    unchanged([3, 1, 2], input => sortBy(input, n => n))
  })
})

describe('sumBy, meanBy, maxBy and minBy', () => {
  const orders = [{ total: 10 }, { total: 30 }, { total: 20 }]

  it('sums and averages the selected number', () => {
    expect(sumBy(orders, order => order.total)).toBe(60)
    expect(meanBy(orders, order => order.total)).toBe(20)
  })

  it('sums an empty array to zero, the identity for addition', () => {
    expect(sumBy([], () => 1)).toBe(0)
  })

  /**
   * `undefined` rather than `NaN`: an empty list has no mean, and a number that
   * poisons every later arithmetic is a worse answer than one the type forces
   * you to handle.
   */
  it('has no mean for an empty array', () => {
    expect(meanBy([], () => 1)).toBeUndefined()
  })

  it('returns the element, not the value', () => {
    expect(maxBy(orders, order => order.total)).toBe(orders[1]!)
    expect(minBy(orders, order => order.total)).toBe(orders[0]!)
  })

  it('gives a tie to the first, so an ordered input stays stable', () => {
    const tied = [{ id: 'a', n: 1 }, { id: 'b', n: 1 }]
    expect(maxBy(tied, item => item.n)?.id).toBe('a')
    expect(minBy(tied, item => item.n)?.id).toBe('a')
  })

  it('has no extreme for an empty array', () => {
    expect(maxBy([], () => 1)).toBeUndefined()
    expect(minBy([], () => 1)).toBeUndefined()
  })

  it('handles negative values, where a zero-initialised accumulator would lie', () => {
    expect(maxBy([{ n: -5 }, { n: -1 }], item => item.n)?.n).toBe(-1)
    expect(minBy([{ n: 5 }, { n: 1 }], item => item.n)?.n).toBe(1)
  })
})

describe('zip, zipWith and unzip', () => {
  it('stops at the shorter array', () => {
    expect(zip([1, 2, 3], ['a', 'b'])).toEqual([[1, 'a'], [2, 'b']])
    expect(zip([1], [])).toEqual([])
  })

  it('combines element-wise, with the index', () => {
    expect(zipWith([1, 2], [10, 20], (a, b) => a + b)).toEqual([11, 22])
    expect(zipWith([1, 2], [1, 1], (a, b, index) => a + b + index)).toEqual([2, 4])
  })

  it('unzip reverses zip', () => {
    const left = [1, 2, 3]
    const right = ['a', 'b', 'c']
    expect(unzip(zip(left, right))).toEqual([left, right])
    expect(unzip([])).toEqual([[], []])
  })
})

describe('difference, intersection and union', () => {
  it('difference keeps order and duplicates from the first array', () => {
    expect(difference([1, 2, 2, 3], [2])).toEqual([1, 3])
    expect(difference([1, 2], [])).toEqual([1, 2])
  })

  it('intersection keeps the first order and removes duplicates', () => {
    expect(intersection([1, 2, 2, 3], [2, 3, 4])).toEqual([2, 3])
    expect(intersection([1], [2])).toEqual([])
  })

  it('union keeps first-seen order across every array', () => {
    expect(union([1, 2], [2, 3], [3, 4])).toEqual([1, 2, 3, 4])
    expect(union()).toEqual([])
  })

  /**
   * Membership is `Set` identity, so structurally equal objects are different
   * elements. Worth pinning: a caller comparing objects needs a selector, and
   * finding that out from a silently wrong result is expensive.
   */
  it('compares by identity, not by structure', () => {
    const shared = { id: 1 }
    expect(difference([shared], [{ id: 1 }])).toEqual([shared])
    expect(difference([shared], [shared])).toEqual([])
  })

  it('treats NaN as equal to itself, as SameValueZero does', () => {
    expect(difference([Number.NaN, 1], [Number.NaN])).toEqual([1])
  })
})

describe('splitAt and splitWhen', () => {
  it('splitAt cuts at the index', () => {
    expect(splitAt([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]])
    expect(splitAt([1, 2, 3, 4], 0)).toEqual([[], [1, 2, 3, 4]])
  })

  it('splitAt counts a negative index from the end, like slice', () => {
    expect(splitAt([1, 2, 3, 4], -1)).toEqual([[1, 2, 3], [4]])
  })

  it('splitAt gives one empty half when out of range, rather than throwing', () => {
    expect(splitAt([1, 2], 99)).toEqual([[1, 2], []])
    expect(splitAt([1, 2], -99)).toEqual([[], [1, 2]])
  })

  it('splitWhen starts the second half at the matching element', () => {
    expect(splitWhen([1, 2, 3, 1], n => n > 2)).toEqual([[1, 2], [3, 1]])
  })

  it('splitWhen puts everything in the first half when nothing matches', () => {
    expect(splitWhen([1, 2], n => n > 9)).toEqual([[1, 2], []])
  })

  it('both always concatenate back to the input', () => {
    const input = [1, 2, 3, 4]
    for (const [left, right] of [splitAt(input, 2), splitWhen(input, n => n > 2), splitWhen(input, () => false)])
      expect([...left, ...right]).toEqual(input)
  })
})

describe('times', () => {
  it('builds an array from the index', () => {
    expect(times(3, index => index * 2)).toEqual([0, 2, 4])
    expect(times(0, () => 1)).toEqual([])
  })

  it('refuses a count that is not a non-negative integer', () => {
    expect(() => times(-1, () => 1)).toThrow(/non-negative integer/)
    expect(() => times(1.5, () => 1)).toThrow(/non-negative integer/)
  })

  it('produces a dense array, so map and forEach visit every slot', () => {
    // `Array.from({ length: n })` is dense; `Array(n)` would not be, and
    // `.map` would skip every hole.
    expect(times(3, () => 'x').map(value => value.toUpperCase())).toEqual(['X', 'X', 'X'])
  })
})
