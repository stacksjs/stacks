import { describe, expect, test } from 'bun:test'
import { mask } from '../src/helpers'

// stacksjs/stacks#314 — Laravel-style Str::mask() helper.

describe('mask', () => {
  test('masks N characters from a positive index', () => {
    expect(mask('1234567890123456', '*', 4, 8)).toBe('1234********3456')
  })

  test('with no length, masks from index to end', () => {
    expect(mask('1234567890123456', '*', 4)).toBe('1234************')
  })

  test('negative index counts from the end', () => {
    expect(mask('1234567890123456', '*', -4, 4)).toBe('123456789012****')
  })

  test('redacts email local part', () => {
    expect(mask('hello@example.com', '*', 1, 4)).toBe('h****@example.com')
  })

  test('uses only the first character of the mask string (length stable)', () => {
    expect(mask('abcdef', 'xy', 1, 3)).toBe('axxxef')
  })

  test('out-of-range index returns the original string', () => {
    expect(mask('abc', '*', 99)).toBe('abc')
  })

  test('empty mask character returns the original string', () => {
    expect(mask('abcdef', '', 1, 3)).toBe('abcdef')
  })

  test('zero length returns the original string', () => {
    expect(mask('abcdef', '*', 2, 0)).toBe('abcdef')
  })

  test('length past end of string truncates to end (no over-pad)', () => {
    expect(mask('abcdef', '*', 4, 99)).toBe('abcd**')
  })

  test('negative index past start clamps to 0', () => {
    expect(mask('abc', '*', -99, 2)).toBe('**c')
  })

  test('empty input returns empty string', () => {
    expect(mask('', '*', 0, 4)).toBe('')
  })
})
