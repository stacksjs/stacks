import { expect, test } from 'bun:test'
import { groupBy, keyBy, countBy } from '../src/transform'

test('grouping, indexing and counting treat prototype names as ordinary own keys', () => {
  const keys = ['__proto__', 'constructor', 'toString', 'hasOwnProperty']
  const groups = groupBy(keys, value => value)
  const counts = countBy([...keys, ...keys], value => value)
  const indexed = keyBy(keys.map(key => ({ key, admin: true })), value => value.key)
  for (const key of keys) {
    expect(Object.hasOwn(groups, key)).toBe(true)
    expect(groups[key]).toEqual([key])
    expect(counts[key]).toBe(2)
    expect(Object.hasOwn(indexed, key)).toBe(true)
    expect(indexed[key]?.key).toBe(key)
  }
  for (const result of [groups, counts, indexed]) {
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
    expect((result as Record<string, unknown>).admin).toBeUndefined()
  }
})
