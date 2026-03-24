import { describe, expect, test } from 'bun:test'
import { DateTime, now } from '../src/now'
import { format } from '../src/format'
import { parse } from '../src/parse'

describe('DateTime Integration', () => {
  describe('Factory methods', () => {
    test('DateTime.now() returns current date', () => {
      const dt = DateTime.now()
      const native = new Date()
      expect(dt.year).toBe(native.getFullYear())
      expect(dt.month).toBe(native.getMonth() + 1)
      expect(dt.day).toBe(native.getDate())
    })

    test('now() helper is same as DateTime.now()', () => {
      const dt = now()
      expect(dt.year).toBe(new Date().getFullYear())
    })

    test('DateTime.create builds specific date', () => {
      const dt = DateTime.create(2024, 3, 15, 10, 30, 45)
      expect(dt.year).toBe(2024)
      expect(dt.month).toBe(3)
      expect(dt.day).toBe(15)
      expect(dt.hour).toBe(10)
      expect(dt.minute).toBe(30)
      expect(dt.second).toBe(45)
    })

    test('DateTime.parse parses ISO string', () => {
      const dt = DateTime.parse('2024-06-15')
      expect(dt.year).toBe(2024)
      expect(dt.month).toBe(6)
      expect(dt.day).toBe(15)
    })

    test('DateTime.fromDate wraps native Date', () => {
      const native = new Date(2023, 11, 25, 8, 0, 0) // Dec 25, 2023
      const dt = DateTime.fromDate(native)
      expect(dt.year).toBe(2023)
      expect(dt.month).toBe(12)
      expect(dt.day).toBe(25)
    })
  })

  describe('Formatting', () => {
    test('toDateString returns YYYY-MM-DD', () => {
      const dt = DateTime.create(2024, 1, 5)
      expect(dt.toDateString()).toBe('2024-01-05')
    })

    test('toTimeString returns HH:mm:ss', () => {
      const dt = DateTime.create(2024, 1, 1, 14, 30, 5)
      expect(dt.toTimeString()).toBe('14:30:05')
    })

    test('toDateTimeString returns combined format', () => {
      const dt = DateTime.create(2024, 3, 15, 9, 5, 30)
      expect(dt.toDateTimeString()).toBe('2024-03-15 09:05:30')
    })

    test('format with custom tokens', () => {
      const dt = DateTime.create(2024, 3, 15)
      expect(dt.format('YYYY/MM/DD')).toBe('2024/03/15')
      expect(dt.format('DD-MM-YYYY')).toBe('15-03-2024')
    })

    test('format with month name tokens', () => {
      const dt = DateTime.create(2024, 3, 15)
      const result = dt.format('MMMM D, YYYY')
      expect(result).toBe('March 15, 2024')
    })

    test('format with AM/PM', () => {
      const morning = DateTime.create(2024, 1, 1, 9, 0, 0)
      const afternoon = DateTime.create(2024, 1, 1, 15, 0, 0)
      expect(morning.format('h:mm A')).toBe('9:00 AM')
      expect(afternoon.format('h:mm A')).toBe('3:00 PM')
    })
  })

  describe('Manipulation', () => {
    test('addDays advances by correct number of days', () => {
      const dt = DateTime.create(2024, 1, 30)
      const result = dt.addDays(5)
      expect(result.toDateString()).toBe('2024-02-04')
    })

    test('subDays goes backwards', () => {
      const dt = DateTime.create(2024, 3, 1)
      const result = dt.subDays(1)
      expect(result.toDateString()).toBe('2024-02-29') // 2024 is a leap year
    })

    test('addMonths advances months correctly', () => {
      const dt = DateTime.create(2024, 1, 15)
      expect(dt.addMonths(3).month).toBe(4)
      expect(dt.addMonths(12).year).toBe(2025)
    })

    test('subMonths goes backwards', () => {
      const dt = DateTime.create(2024, 3, 15)
      expect(dt.subMonths(2).month).toBe(1)
    })

    test('addYears advances years', () => {
      const dt = DateTime.create(2024, 6, 1)
      expect(dt.addYears(5).year).toBe(2029)
    })

    test('addHours advances hours', () => {
      const dt = DateTime.create(2024, 1, 1, 22, 0, 0)
      const result = dt.addHours(5)
      expect(result.hour).toBe(3)
      expect(result.day).toBe(2) // crossed midnight
    })

    test('addMinutes advances minutes', () => {
      const dt = DateTime.create(2024, 1, 1, 10, 50, 0)
      const result = dt.addMinutes(20)
      expect(result.hour).toBe(11)
      expect(result.minute).toBe(10)
    })

    test('addWeeks advances by weeks', () => {
      const dt = DateTime.create(2024, 1, 1)
      expect(dt.addWeeks(2).day).toBe(15)
    })

    test('manipulation returns new instance (immutable)', () => {
      const dt = DateTime.create(2024, 1, 1)
      const modified = dt.addDays(1)
      expect(dt.day).toBe(1) // original unchanged
      expect(modified.day).toBe(2)
    })
  })

  describe('Start/End of period', () => {
    test('startOfDay sets time to 00:00:00', () => {
      const dt = DateTime.create(2024, 3, 15, 14, 30, 45)
      const start = dt.startOfDay()
      expect(start.hour).toBe(0)
      expect(start.minute).toBe(0)
      expect(start.second).toBe(0)
      expect(start.day).toBe(15) // same day
    })

    test('endOfDay sets time to 23:59:59', () => {
      const dt = DateTime.create(2024, 3, 15, 8, 0, 0)
      const end = dt.endOfDay()
      expect(end.hour).toBe(23)
      expect(end.minute).toBe(59)
      expect(end.second).toBe(59)
    })

    test('startOfMonth sets to first day midnight', () => {
      const dt = DateTime.create(2024, 3, 15, 14, 30, 0)
      const start = dt.startOfMonth()
      expect(start.day).toBe(1)
      expect(start.hour).toBe(0)
    })

    test('endOfMonth sets to last day 23:59:59', () => {
      const dt = DateTime.create(2024, 2, 10) // February 2024 (leap year)
      const end = dt.endOfMonth()
      expect(end.day).toBe(29) // leap year
      expect(end.hour).toBe(23)
    })

    test('startOfYear sets to Jan 1', () => {
      const dt = DateTime.create(2024, 8, 20)
      const start = dt.startOfYear()
      expect(start.month).toBe(1)
      expect(start.day).toBe(1)
    })

    test('endOfYear sets to Dec 31', () => {
      const dt = DateTime.create(2024, 3, 15)
      const end = dt.endOfYear()
      expect(end.month).toBe(12)
      expect(end.day).toBe(31)
    })
  })

  describe('Comparison', () => {
    test('isBefore and isAfter compare correctly', () => {
      const earlier = DateTime.create(2024, 1, 1)
      const later = DateTime.create(2024, 12, 31)
      expect(earlier.isBefore(later)).toBe(true)
      expect(later.isAfter(earlier)).toBe(true)
      expect(earlier.isAfter(later)).toBe(false)
    })

    test('isSame detects exact match', () => {
      const dt1 = DateTime.create(2024, 6, 15, 10, 30, 0)
      const dt2 = DateTime.create(2024, 6, 15, 10, 30, 0)
      expect(dt1.isSame(dt2)).toBe(true)
    })

    test('isSameDay compares date only', () => {
      const morning = DateTime.create(2024, 3, 15, 8, 0, 0)
      const evening = DateTime.create(2024, 3, 15, 20, 0, 0)
      expect(morning.isSameDay(evening)).toBe(true)
    })

    test('isBetween detects range', () => {
      const start = DateTime.create(2024, 1, 1)
      const middle = DateTime.create(2024, 6, 15)
      const end = DateTime.create(2024, 12, 31)
      expect(middle.isBetween(start, end)).toBe(true)
      expect(start.isBetween(middle, end)).toBe(false)
    })

    test('isPast and isFuture', () => {
      const past = DateTime.create(2020, 1, 1)
      const future = DateTime.create(2099, 1, 1)
      expect(past.isPast()).toBe(true)
      expect(future.isFuture()).toBe(true)
    })

    test('isLeapYear detects leap years', () => {
      expect(DateTime.create(2024, 1, 1).isLeapYear()).toBe(true)
      expect(DateTime.create(2023, 1, 1).isLeapYear()).toBe(false)
      expect(DateTime.create(2000, 1, 1).isLeapYear()).toBe(true)
      expect(DateTime.create(1900, 1, 1).isLeapYear()).toBe(false)
    })
  })

  describe('Differences', () => {
    test('diffInDays computes correct difference', () => {
      const dt1 = DateTime.create(2024, 3, 20)
      const dt2 = DateTime.create(2024, 3, 15)
      expect(dt1.diffInDays(dt2)).toBe(5)
    })

    test('diffInHours computes correct difference', () => {
      const dt1 = DateTime.create(2024, 1, 1, 10, 0, 0)
      const dt2 = DateTime.create(2024, 1, 1, 7, 0, 0)
      expect(dt1.diffInHours(dt2)).toBe(3)
    })

    test('diffInMinutes computes correct difference', () => {
      const dt1 = DateTime.create(2024, 1, 1, 10, 45, 0)
      const dt2 = DateTime.create(2024, 1, 1, 10, 0, 0)
      expect(dt1.diffInMinutes(dt2)).toBe(45)
    })
  })

  describe('Setters (immutable)', () => {
    test('setYear returns new instance', () => {
      const dt = DateTime.create(2024, 6, 15)
      const modified = dt.setYear(2030)
      expect(modified.year).toBe(2030)
      expect(dt.year).toBe(2024) // original unchanged
    })

    test('setMonth returns new instance', () => {
      const dt = DateTime.create(2024, 1, 15)
      expect(dt.setMonth(6).month).toBe(6)
    })

    test('setDay returns new instance', () => {
      const dt = DateTime.create(2024, 3, 1)
      expect(dt.setDay(20).day).toBe(20)
    })
  })

  describe('Standalone parse and format', () => {
    test('parse ISO date string to local', () => {
      const d = parse('2024-03-15')
      expect(d.getFullYear()).toBe(2024)
      expect(d.getMonth()).toBe(2) // 0-indexed
      expect(d.getDate()).toBe(15)
    })

    test('parse with custom format', () => {
      const d = parse('15/03/2024', 'DD/MM/YYYY')
      expect(d.getFullYear()).toBe(2024)
      expect(d.getMonth()).toBe(2)
      expect(d.getDate()).toBe(15)
    })

    test('format a Date with tokens', () => {
      const d = new Date(2024, 2, 15, 14, 30, 5) // March 15, 2024
      expect(format(d, 'YYYY-MM-DD')).toBe('2024-03-15')
      expect(format(d, 'HH:mm:ss')).toBe('14:30:05')
    })

    test('format with timezone', () => {
      const d = new Date('2024-03-15T12:00:00Z')
      const result = format(d, 'HH:mm', { tz: 'UTC' })
      expect(result).toBe('12:00')
    })
  })

  describe('Conversion', () => {
    test('toNativeDate returns a Date instance', () => {
      const dt = DateTime.create(2024, 6, 15)
      const native = dt.toNativeDate()
      expect(native instanceof Date).toBe(true)
      expect(native.getFullYear()).toBe(2024)
    })

    test('toJSON returns ISO string', () => {
      const dt = DateTime.create(2024, 6, 15, 12, 0, 0)
      const json = dt.toJSON()
      expect(json).toContain('2024-06-15')
    })

    test('valueOf returns timestamp number', () => {
      const dt = DateTime.create(2024, 6, 15)
      expect(dt.valueOf()).toBe(dt.timestamp)
    })
  })
})
