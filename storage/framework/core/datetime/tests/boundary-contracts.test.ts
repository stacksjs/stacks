import { expect, test } from 'bun:test'
import { addCalendarMonths, todayIn } from '../src/calendar'
import { isoInZone, zonedTimeToUtc, zoneOffsetMinutes } from '../src/zone'
import { timeWindowsCover } from '../src/schedule'

test('named-zone inputs reject impossible calendars and clocks before DST resolution', () => {
  for (const value of ['2026-02-30T12:00', '2026-02-29', '2026-13-01', '2026-00-01', '2026-01-00', '2026-01-01T25:70', '2026-01-01T12:00:60'])
    expect(() => zonedTimeToUtc(value, 'UTC')).toThrow(RangeError)
  expect(zonedTimeToUtc('2024-02-29T12:00', 'UTC').toISOString()).toBe('2024-02-29T12:00:00.000Z')
  expect(zonedTimeToUtc('2026-10-25T02:30', 'Europe/Berlin').toISOString()).toBe('2026-10-25T00:30:00.000Z')
  expect(zonedTimeToUtc('2026-03-29T02:30', 'Europe/Berlin').toISOString()).toBe('2026-03-29T01:30:00.000Z')
})

test('zone offsets keep astronomical years and canonical calendar dates stay in range', () => {
  for (const value of ['0000-06-01T12:00:00Z', '-000001-06-01T12:00:00Z', '0099-06-01T12:00:00Z'])
    expect(zoneOffsetMinutes(new Date(value), 'UTC')).toBe(0)
  expect(todayIn('UTC', new Date('0000-06-01T12:00:00Z'))).toBe('0000-06-01')
  expect(zonedTimeToUtc('0000-06-01T12:00', 'UTC').toISOString()).toBe('0000-06-01T12:00:00.000Z')
  for (const value of ['-000001-06-01T12:00:00Z', '+010000-06-01T12:00:00Z'])
    expect(() => todayIn('UTC', new Date(value))).toThrow(RangeError)
})

test('calendar months clamp literal early years and reject only out-of-range results', () => {
  for (const [year, day] of [['0000', '29'], ['0004', '29'], ['0099', '28'], ['0100', '28'], ['0400', '29']]) {
    const original = new Date(`${year}-01-31T12:34:56.789Z`)
    expect(addCalendarMonths(original, 1, { utc: true }).toISOString()).toBe(`${year}-02-${day}T12:34:56.789Z`)
    expect(original.getUTCMonth()).toBe(0)
  }
  for (const months of [Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER])
    expect(() => addCalendarMonths(new Date('2026-01-31T12:00:00Z'), months, { utc: true })).toThrow(RangeError)
  for (const value of [8640000000000000, -8640000000000000])
    for (const utc of [true, false]) expect(addCalendarMonths(new Date(value), 0, { utc }).getTime()).toBe(value)
  expect(addCalendarMonths(new Date(-8640000000000000), 1, { utc: true }).toISOString()).toBe('-271821-05-20T00:00:00.000Z')
  const local = new Date(0)
  local.setFullYear(0, 0, 31)
  local.setHours(12, 34, 56, 789)
  const next = addCalendarMonths(local, 1)
  expect([next.getFullYear(), next.getMonth(), next.getDate(), next.getHours()]).toEqual([0, 1, 29, 12])
  expect(() => addCalendarMonths(local, Number.MAX_SAFE_INTEGER)).toThrow(RangeError)
})

test('availability validates every span regardless of input order or early coverage', () => {
  const good = { start_time: '09:00', end_time: '17:00' }
  const bad = { start_time: '18:00', end_time: '17:00' }
  for (const windows of [[good, bad], [bad, good]]) expect(() => timeWindowsCover(windows, '10:00', '11:00')).toThrow()
  expect(() => timeWindowsCover([bad], '10:00', '10:00')).toThrow()
  expect(timeWindowsCover([good], '10:00', '11:00')).toBe(true)
})

test('ISO zone output retains full second precision for expanded and BCE years', () => {
  for (const value of ['+010000-01-01T00:00:37Z', '-000001-06-01T12:34:56Z', '0000-06-01T12:34:56Z']) {
    const instant = new Date(value)
    const text = isoInZone(instant, 'UTC')
    expect(text).toBe(`${instant.toISOString().slice(0, -5)}+00:00`)
    expect(new Date(text).getTime()).toBe(instant.getTime())
  }
})
