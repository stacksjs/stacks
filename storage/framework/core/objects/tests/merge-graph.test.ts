import { expect, test } from 'bun:test'
import { runInNewContext } from 'node:vm'
import { deepMerge } from '../src'

test('deepMerge preserves self and mutual cycles without mutating the source graph', () => {
  const first: any = { value: 1 }, second: any = { value: 2, next: first }
  first.next = second
  first.self = first
  const target: any = { retained: true }
  expect(deepMerge(target, first)).toBe(target)
  expect(target.self).toBe(target)
  expect(target.next.next).toBe(target)
  expect(target.next.value).toBe(2)
  expect(target.retained).toBe(true)
  expect(first.next).toBe(second)
  expect(first.self).toBe(first)
  expect(target.next).not.toBe(second)
  expect(deepMerge(first, first)).toBe(first)
})

test('deepMerge reuses shared plain nodes and lets each later source update the graph', () => {
  const shared = { value: 1 }
  const source = { a: shared, b: shared }
  const result = deepMerge({ retained: 2 }, source)
  expect(result.a).toBe(result.b)
  expect(result.a).not.toBe(shared)
  const later: any = { a: { extra: true } }
  later.a.parent = later
  const combined: any = deepMerge(result, later)
  expect(combined.a.parent).toBe(combined)
  expect(combined.a.value).toBe(1)
  expect(combined.a.extra).toBe(true)
})


test('graph traversal retains null-derived class instances and merges foreign plain records', () => {
  const instance = runInNewContext('(new (class C extends null { constructor(){ return Object.create(new.target.prototype) } }))')
  instance.value = 1
  expect(deepMerge({} as any, { instance }).instance).toBe(instance)
  const foreign = runInNewContext('({ added: 2 })')
  expect(deepMerge({ nested: { kept: 1 } }, { nested: foreign })).toEqual({ nested: { kept: 1, added: 2 } })
})
