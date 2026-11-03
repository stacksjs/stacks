import { describe, expect, test } from 'bun:test'
import { sql } from '../src/types'

// stacksjs/stacks#3157: sql.literal() inlines a value where a fragment cannot
// carry bound parameters, so what it emits has to be a literal on every
// dialect, MySQL's backslash escapes included.
describe('sql.literal', () => {
  test('a number, boolean or null is inlined bare', () => {
    expect(sql.literal(42).raw).toBe('42')
    expect(sql.literal(true).raw).toBe('1')
    expect(sql.literal(null).raw).toBe('NULL')
  })

  test('a quote is doubled, so the string stays one literal', () => {
    expect(sql.literal(`O'Brien`).raw).toBe(`'O''Brien'`)
    expect(sql.literal(`' OR 1=1 --`).raw).toBe(`''' OR 1=1 --'`)
  })

  test('a timestamp string, the framework\'s own use, is inlined as is', () => {
    expect(sql.literal('2026-11-03T12:00:00.000').raw).toBe(`'2026-11-03T12:00:00.000'`)
  })

  test('a string with a backslash is refused rather than left to MySQL to unescape', () => {
    // On MySQL `'\'' OR 1=1 -- '` is the string `'` followed by live SQL.
    expect(() => sql.literal(`\\' OR 1=1 -- `)).toThrow(/backslash/)
    expect(() => sql.literal('C:\\path')).toThrow(/Bind it instead/)
  })
})
