import { expect, test } from 'bun:test'
import { parse } from '../src/parse'

test('format separators are literals, not regular expression operators', () => {
  expect(() => parse('2024x06x15', 'YYYY.MM.DD')).toThrow()
  const value = parse('2024.06.15 (14:30)', 'YYYY.MM.DD (HH:mm)')
  expect([value.getFullYear(), value.getMonth(), value.getDate(), value.getHours(), value.getMinutes()]).toEqual([2024, 5, 15, 14, 30])
  expect(parse('2024+06+15', 'YYYY+MM+DD').getDate()).toBe(15)
  expect(() => parse('2024.06.15 14:30', 'YYYY.MM.DD (HH:mm)')).toThrow()
})
