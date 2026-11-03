import { expect, test } from 'bun:test'
import { mask } from '../src/helpers'

test('mask rejects ambiguous coordinates and keeps Unicode character counts', () => {
  for (const value of [1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => mask('abcdef', '*', value, 1)).toThrow(RangeError)
    expect(() => mask('abcdef', '*', 1, value)).toThrow(RangeError)
  }
  expect(mask('😀abcd', '*', 1, 2)).toBe('😀**cd')
  expect(mask('😀abcd', '*', -2)).toBe('😀ab**')
  expect(mask('abcdef', '*', 1, -2)).toBe('abcdef')
})
