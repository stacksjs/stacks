import { expect, test } from 'bun:test'
import { DateTime } from '../src/now'
import { parse } from '../src/parse'
import { format } from '../src/format'

test('years below 100 remain literal through parsing, creation and period boundaries', () => {
  for (const year of [0, 50, 99]) {
    const text = `${String(year).padStart(4, '0')}-06-15`
    expect(parse(text).getFullYear()).toBe(year)
    expect(parse(text, 'YYYY-MM-DD').getFullYear()).toBe(year)
    expect(parse(`${text} +0000`, 'YYYY-MM-DD Z').getUTCFullYear()).toBe(year)
    const value = DateTime.create(year, 6, 15)
    expect(value.year).toBe(year)
    expect(value.startOfYear().year).toBe(year)
    expect(value.endOfYear().year).toBe(year)
    expect(value.endOfMonth().year).toBe(year)
    expect(format(value.toNativeDate(), 'YYYY-MM-DD')).toBe(text)
    const utc = parse(`${text} +0000`, 'YYYY-MM-DD Z')
    expect(format(utc, 'YYYY-MM-DD Z', { tz: 'UTC' })).toBe(`${text} +0000`)
  }
  expect(parse('0000-02-29').getDate()).toBe(29)
})
