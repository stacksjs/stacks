import { expect, test } from 'bun:test'
import { parse } from '../src/parse'

test('formatted parsing rejects impossible calendar dates, clock parts and offsets', () => {
  for (const date of ['2024-00-01', '2024-13-01', '2024-01-00', '2024-01-32', '2023-02-29'])
    expect(() => parse(date, 'YYYY-MM-DD')).toThrow()
  for (const time of ['24:00:00', '25:00:00', '23:60:00', '23:59:60'])
    expect(() => parse(`2024-01-01 ${time}`, 'YYYY-MM-DD HH:mm:ss')).toThrow()
  for (const time of ['00:30 AM', '13:30 PM'])
    expect(() => parse(time, 'hh:mm A')).toThrow()
  for (const offset of ['+9960', '+2400', '+1260'])
    expect(() => parse(`2024-01-01 ${offset}`, 'YYYY-MM-DD Z')).toThrow()
  expect(parse('2024-02-29 +0530', 'YYYY-MM-DD Z').toISOString()).toBe('2024-02-28T18:30:00.000Z')
  expect(parse('12:30 AM', 'hh:mm A').getHours()).toBe(0)
})
