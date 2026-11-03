import { expect, test } from 'bun:test'
import { safeJsonStringify } from '../src/safe-json'

test('shared references serialize completely while actual ancestors become circular markers', () => {
  const shared = { id: 1 }
  expect(safeJsonStringify({ a: shared, b: shared })).toBe('{"a":{"id":1},"b":{"id":1}}')
  expect(safeJsonStringify([shared, shared])).toBe('[{"id":1},{"id":1}]')
  const root: { child?: unknown, shared?: unknown } = {}
  root.child = { parent: root, shared }
  root.shared = shared
  expect(safeJsonStringify(root)).toBe('{"child":{"parent":"[Circular]","shared":{"id":1}},"shared":{"id":1}}')
})

test('unsupported roots retain JSON undefined semantics and bigint values remain lossless', () => {
  for (const value of [undefined, () => 1, Symbol('value')]) expect(safeJsonStringify(value)).toBeUndefined()
  expect(safeJsonStringify({ id: 9007199254740993n })).toBe('{"id":"9007199254740993"}')
  expect(safeJsonStringify(null)).toBe('null')
})
