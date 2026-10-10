import { expect, test } from 'bun:test'
import { addClockMinutes, calendarDay, expandWeeklySchedule, localDateRange, localTimeSpan, netHoursBetween, parseWeeklySchedule, timeWindowsCover } from '../src/schedule'

test('weekly recurrence rejects coercion and partial corruption instead of changing its weekdays', () => {
  expect(parseWeeklySchedule({ weekdays: [1, 1, '3'], start_time: '09:00' })).toEqual({ weekdays: [1, 3], start_time: '09:00' })
  for (const value of [true, null, {}, '', 7, -1, 1.5]) expect(parseWeeklySchedule({ weekdays: [1, value], start_time: '09:00' })).toBeNull()
  expect(parseWeeklySchedule({ weekdays: [1], start_time: '24:00' })).toBeNull()
})
test('recurrence keeps duration, validates real dates and refuses silent range truncation', () => {
  expect(addClockMinutes('09:00', 90)).toBe('10:30')
  expect(() => addClockMinutes('23:30', 60)).toThrow()
  expect(() => calendarDay('2026-02-30')).toThrow()
  expect(expandWeeklySchedule({ weekdays: [1], start_time: '09:00' }, '2026-10-05', '2026-10-12', 60).map(slot => slot.session_date)).toEqual(['2026-10-05', '2026-10-12'])
  expect(() => expandWeeklySchedule({ weekdays: [1], start_time: '09:00' }, '2026-01-01', '2029-01-01', 60)).toThrow('800')
})
test('continuous availability can span adjacent windows but cannot cross a gap', () => {
  const windows = [{ start_time: '09:00', end_time: '10:00' }, { start_time: '10:00', end_time: '11:00' }]
  expect(timeWindowsCover(windows, '09:30', '10:30')).toBe(true)
  expect(timeWindowsCover([{ ...windows[0]! }, { start_time: '10:01', end_time: '11:00' }], '09:30', '10:30')).toBe(false)
  expect(timeWindowsCover(windows, '08:59', '10:30')).toBe(false)
})
test('local date ranges include complete DST and timezone-boundary days', () => {
  expect(() => localDateRange('0099-01-01', '0099-01-01', 'UTC')).toThrow('0101')
  expect(() => localDateRange('9999-12-31', '9999-12-31', 'UTC')).toThrow('9999')
  expect(() => localDateRange('0100-01-01', '0100-01-01', 'America/Los_Angeles')).toThrow('0101')
  expect(localDateRange('0101-01-01', '0101-01-01', 'America/Los_Angeles').start.getUTCFullYear()).toBe(101)
  const spring = localDateRange('2026-03-08', '2026-03-08', 'America/Los_Angeles')
  expect((spring.end.getTime() - spring.start.getTime()) / 3600000).toBe(23)
  const fall = localDateRange('2026-11-01', '2026-11-01', 'America/Los_Angeles')
  expect((fall.end.getTime() - fall.start.getTime()) / 3600000).toBe(25)
  expect(localDateRange('2026-10-10', '2026-10-10', 'Pacific/Kiritimati').start.toISOString()).toBe('2026-10-09T10:00:00.000Z')
})
test('time remains exact until its display or monetary rounding boundary', () => {
  expect(netHoursBetween('2026-10-10T09:00:00Z', '2026-10-10T09:01:00Z')).toBe(1 / 60)
  expect(netHoursBetween(null, '2026-10-10T09:01:00Z')).toBe(0)
  expect(netHoursBetween('2026-10-10T09:00:00Z', '2026-10-10T10:00:00Z', 10)).toBeCloseTo(5 / 6)
})

test('local intervals retain overnight and timezone-aware overlap boundaries', () => {
  expect(() => localTimeSpan('0100-01-01', '00:00', '01:00', 'Pacific/Kiritimati')).toThrow()
  expect(localTimeSpan('0101-01-01', '00:00', '01:00', 'Pacific/Kiritimati').start.getUTCFullYear()).toBe(101)
  const night = localTimeSpan('2026-10-10', '22:00', '02:00', 'America/Los_Angeles')
  expect(night.start.toISOString()).toBe('2026-10-11T05:00:00.000Z')
  expect(night.end.toISOString()).toBe('2026-10-11T09:00:00.000Z')
  expect(() => localTimeSpan('2026-10-10', '09:00', '09:00', 'UTC')).toThrow()
})
