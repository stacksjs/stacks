import { expect, test } from 'bun:test'
import { deepMerge, setPath } from '../src/index'

test('plain source records replace non-plain nested merge targets', () => {
  class RecordClass { old = true }
  for (const target of [new Date(0), new Map(), new Set(), /old/, new URL('https://example.test'), new Error('old'), new WeakMap(), new RecordClass()]) {
    const result = deepMerge({ value: target }, { value: { enabled: true } })
    expect(Object.getPrototypeOf(result.value)).toBe(Object.prototype)
    expect(JSON.stringify(result)).toBe('{"value":{"enabled":true}}')
  }
})

test('absent optional source properties retain the target and present properties override it', () => {
  const source: { value?: string } = {}
  expect(deepMerge({ value: 1 }, source).value).toBe(1)
  source.value = 'new'
  expect(deepMerge({ value: 1 }, source).value).toBe('new')
})

test('persistent array length updates retain native length semantics', () => {
  const source = { items: [1, 2, 3], other: {} }
  const shorter = setPath(source, ['items', 'length'], 1)
  expect(shorter.items).toEqual([1])
  expect(shorter.other).toBe(source.other)
  expect(source.items).toEqual([1, 2, 3])
  const longer = setPath(source.items, ['length'], 5)
  expect(longer.length).toBe(5)
  expect(Object.hasOwn(longer, 4)).toBe(false)
  for (const length of [-1, 1.5, NaN, Infinity, 2 ** 32]) expect(() => setPath(source.items, ['length'], length)).toThrow(RangeError)
})
