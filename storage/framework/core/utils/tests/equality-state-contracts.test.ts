import { expect, test } from 'bun:test'
import { isDeepEqual } from '../src/equal'

test('object equality compares own key sets before values', () => {
  expect(isDeepEqual({ a: undefined }, { b: undefined })).toBe(false)
  const hidden = Object.defineProperty({ b: undefined }, 'a', { value: undefined })
  expect(isDeepEqual({ a: undefined }, hidden)).toBe(false)
  expect(isDeepEqual(hidden, { a: undefined })).toBe(false)
  expect(isDeepEqual({ a: 1 }, Object.assign(Object.create({ a: 1 }), { b: 1 }))).toBe(false)
  expect(isDeepEqual(Object.assign(Object.create(null), { a: 1 }), { a: 1 })).toBe(true)
})

test('array holes are distinct from supplied undefined and equality is symmetric', () => {
  for (const other of [[1], [undefined]]) {
    expect(isDeepEqual(Array(1), other)).toBe(false)
    expect(isDeepEqual(other, Array(1))).toBe(false)
  }
  expect(isDeepEqual(Array(1), Array(1))).toBe(true)
  expect(isDeepEqual([Array(1)], [[1]])).toBe(false)
})

test('cyclic comparisons terminate and failed unordered candidates do not poison later matches', () => {
  const one: { next?: unknown, value: number } = { value: 1 }
  one.next = one
  const first: { next?: unknown, value: number } = { value: 1 }, second = { next: first, value: 1 }
  first.next = second
  expect(isDeepEqual(one, first)).toBe(true)
  second.value = 2
  expect(isDeepEqual(one, first)).toBe(false)
  const a = new Set<unknown>(), b = new Set<unknown>()
  a.add(a); b.add(b)
  expect(isDeepEqual(a, b)).toBe(true)
  const m1 = new Map<unknown, unknown>(), m2 = new Map<unknown, unknown>()
  m1.set(m1, a); m2.set(m2, b)
  expect(isDeepEqual(m1, m2)).toBe(true)
  expect(isDeepEqual(new Set([{ x: 1 }, { x: 2 }]), new Set([{ x: 2 }, { x: 1 }]))).toBe(true)
  expect(isDeepEqual(new Set([{ x: 1 }, { x: 2 }]), new Set([{ x: 2 }, { x: 2 }]))).toBe(false)
})
