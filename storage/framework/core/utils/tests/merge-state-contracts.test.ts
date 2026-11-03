import { expect, test } from 'bun:test'
import { runInNewContext } from 'node:vm'
import { merge } from '../src/merge'

test('utility merge copies own fields without reading inherited getters', () => {
  let reads = 0
  const prototype = Object.defineProperty({}, 'secret', { enumerable: true, get() { reads++; return 'private' } })
  expect(merge(Object.assign(Object.create(prototype), { name: 'Alice' }))).toEqual({ name: 'Alice' })
  expect(reads).toBe(0)
  expect(merge(JSON.parse('{"__proto__":{"isAdmin":true},"constructor":"own"}'))).toEqual({ constructor: 'own' })
})

test('utility merge preserves non-plain values rather than copying their internals', () => {
  class Custom { value = 1 }
  for (const value of [new URL('https://example.test'), new URLSearchParams('a=1'), new ArrayBuffer(2), new Blob(['data']), new Custom()])
    expect(merge({ value }).value).toBe(value)
})

test('record replacements drop old non-record keys while arrays still concatenate', () => {
  for (const value of [[1, 2], new Date(0), new Map(), 'old', 3])
    expect(merge<Record<string, unknown>>({ value }, { value: { enabled: true } })).toEqual({ value: { enabled: true } })
  expect(merge({ items: [1] }, { items: [2] })).toEqual({ items: [1, 2] })
  const first = { nested: { left: 1 } }
  expect(merge(first, { nested: { right: 2 } })).toEqual({ nested: { left: 1, right: 2 } })
  expect(first).toEqual({ nested: { left: 1 } })
})

test('plain-record detection preserves null-derived classes and merges cross-realm records', () => {
  const instance = runInNewContext('(new (class Custom extends null { constructor() { return Object.create(new.target.prototype) } }))')
  instance.value = 1
  expect(merge({ instance }).instance).toBe(instance)
  const foreign = runInNewContext('({ right: 2 })')
  expect(merge({ nested: { left: 1 } }, { nested: foreign })).toEqual({ nested: { left: 1, right: 2 } })
})
