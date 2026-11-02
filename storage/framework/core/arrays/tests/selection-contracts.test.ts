import { expect, test } from 'bun:test'
import { drop, dropLast, maxBy, minBy, sortBy, take, takeLast } from '../src/transform'

test('selected extrema retain infinite endpoints and the first tied item', () => {
  const low = { value: -Infinity }, high = { value: Infinity }
  expect(maxBy([low], item => item.value)).toBe(low)
  expect(minBy([high], item => item.value)).toBe(high)
  expect(maxBy([NaN, -Infinity], value => value)).toBe(-Infinity)
  expect(minBy([NaN, Infinity], value => value)).toBe(Infinity)
  expect(maxBy([NaN], value => value)).toBeUndefined()
  expect(minBy([], value => value)).toBeUndefined()
  expect(maxBy([low, { value: -Infinity }], item => item.value)).toBe(low)
  expect(minBy([high, { value: Infinity }], item => item.value)).toBe(high)
})

test('head and tail counts use the same nonnegative integer normalization', () => {
  const input = [1, 2, 3]
  for (const count of [1.5, 0.5, NaN, Infinity, -Infinity, -1, 4]) {
    const expected = count === Infinity ? 3 : Number.isNaN(count) ? 0 : Math.min(3, Math.max(0, Math.trunc(count)))
    expect(take(input, count).length).toBe(expected)
    expect(takeLast(input, count).length).toBe(expected)
    expect(drop(input, count).length).toBe(3 - expected)
    expect(dropLast(input, count).length).toBe(3 - expected)
  }
  expect(takeLast(input, 1.5)).toEqual([3])
  expect(dropLast(input, 1.5)).toEqual([1, 2])
  expect(input).toEqual([1, 2, 3])
})

test('sortBy selects each key once per item and keeps stable ties', () => {
  const input = [{ id: 'a', group: 2 }, { id: 'b', group: 1 }, { id: 'c', group: 1 }]
  const calls = [0, 0]
  const result = sortBy(input, item => { calls[0]!++; return item.group }, { by: () => { calls[1]!++; return 1 }, order: 'desc' })
  expect(result.map(item => item.id)).toEqual(['b', 'c', 'a'])
  expect(calls).toEqual([3, 3])
  expect(input.map(item => item.id)).toEqual(['a', 'b', 'c'])
})
