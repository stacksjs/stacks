import { expect, test } from 'bun:test'
import { DateTime } from '../src/now'

test('only omitted DateTime input defaults to now', () => {
  expect(Number.isFinite(new DateTime().timestamp)).toBe(true)
  expect(() => new DateTime('')).toThrow()
  expect(() => DateTime.parse('')).toThrow()
  expect(() => new DateTime('   ')).toThrow()
  expect(() => new DateTime(new Date(Number.NaN))).toThrow()
})
