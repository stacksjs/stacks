import { describe, expect, test } from 'bun:test'
import { DateTime, now } from '../src'

describe('@stacksjs/datetime - edge cases', () => {
  describe('DateTime.now()', () => {
    test('returns an instance close to current time', () => {
      const before = Date.now()
      const dt = DateTime.now()
      const after = Date.now()

      expect(dt.timestamp).toBeGreaterThanOrEqual(before)
      expect(dt.timestamp).toBeLessThanOrEqual(after)
    })

    test('now() helper returns a DateTime instance', () => {
      const dt = now()
      expect(dt).toBeInstanceOf(DateTime)
    })
  })

  describe('add / subtract', () => {
    test('addDays adds the correct number of days', () => {
      const dt = DateTime.create(2024, 3, 1)
      const result = dt.addDays(5)
      expect(result.day).toBe(6)
      expect(result.month).toBe(3)
    })

    test('subDays subtracts days correctly', () => {
      const dt = DateTime.create(2024, 3, 10)
      const result = dt.subDays(5)
      expect(result.day).toBe(5)
    })

    test('addHours adds hours correctly', () => {
      const dt = DateTime.create(2024, 1, 1, 10, 0, 0)
      const result = dt.addHours(3)
      expect(result.hour).toBe(13)
    })

    test('subHours subtracts hours correctly', () => {
      const dt = DateTime.create(2024, 1, 1, 10, 0, 0)
      const result = dt.subHours(3)
      expect(result.hour).toBe(7)
    })

    test('addMinutes adds minutes correctly', () => {
      const dt = DateTime.create(2024, 1, 1, 10, 30, 0)
      const result = dt.addMinutes(45)
      expect(result.hour).toBe(11)
      expect(result.minute).toBe(15)
    })

    test('subMinutes subtracts minutes correctly', () => {
      const dt = DateTime.create(2024, 1, 1, 10, 30, 0)
      const result = dt.subMinutes(45)
      expect(result.hour).toBe(9)
      expect(result.minute).toBe(45)
    })

    test('addDays crossing month boundary', () => {
      const dt = DateTime.create(2024, 1, 30)
      const result = dt.addDays(5)
      expect(result.month).toBe(2)
      expect(result.day).toBe(4)
    })
  })

  describe('format with custom tokens', () => {
    test('YYYY-MM-DD format', () => {
      const dt = DateTime.create(2024, 3, 15)
      expect(dt.format('YYYY-MM-DD')).toBe('2024-03-15')
    })

    test('HH:mm:ss format', () => {
      const dt = DateTime.create(2024, 1, 1, 14, 30, 45)
      expect(dt.format('HH:mm:ss')).toBe('14:30:45')
    })

    test('toDateString() returns YYYY-MM-DD', () => {
      const dt = DateTime.create(2024, 12, 25)
      expect(dt.toDateString()).toBe('2024-12-25')
    })

    test('toTimeString() returns HH:mm:ss', () => {
      const dt = DateTime.create(2024, 1, 1, 8, 5, 3)
      expect(dt.toTimeString()).toBe('08:05:03')
    })

    test('toDateTimeString() returns YYYY-MM-DD HH:mm:ss', () => {
      const dt = DateTime.create(2024, 6, 15, 9, 30, 0)
      expect(dt.toDateTimeString()).toBe('2024-06-15 09:30:00')
    })
  })

  describe('startOf / endOf', () => {
    test('startOfDay() zeroes out time', () => {
      const dt = DateTime.create(2024, 3, 15, 14, 30, 45)
      const start = dt.startOfDay()
      expect(start.hour).toBe(0)
      expect(start.minute).toBe(0)
      expect(start.second).toBe(0)
      expect(start.day).toBe(15)
    })

    test('endOfDay() sets time to 23:59:59', () => {
      const dt = DateTime.create(2024, 3, 15, 10, 0, 0)
      const end = dt.endOfDay()
      expect(end.hour).toBe(23)
      expect(end.minute).toBe(59)
      expect(end.second).toBe(59)
      expect(end.day).toBe(15)
    })

    test('startOfMonth() sets to first day at midnight', () => {
      const dt = DateTime.create(2024, 3, 15, 14, 30, 0)
      const start = dt.startOfMonth()
      expect(start.day).toBe(1)
      expect(start.hour).toBe(0)
      expect(start.month).toBe(3)
    })

    test('endOfMonth() sets to last day at 23:59:59', () => {
      const dt = DateTime.create(2024, 3, 15)
      const end = dt.endOfMonth()
      expect(end.day).toBe(31)
      expect(end.hour).toBe(23)
      expect(end.minute).toBe(59)
    })
  })

  describe('comparison', () => {
    test('isBefore() returns true when date is earlier', () => {
      const earlier = DateTime.create(2024, 1, 1)
      const later = DateTime.create(2024, 12, 31)
      expect(earlier.isBefore(later)).toBe(true)
      expect(later.isBefore(earlier)).toBe(false)
    })

    test('isAfter() returns true when date is later', () => {
      const earlier = DateTime.create(2024, 1, 1)
      const later = DateTime.create(2024, 12, 31)
      expect(later.isAfter(earlier)).toBe(true)
      expect(earlier.isAfter(later)).toBe(false)
    })

    test('isSame() returns true for identical timestamps', () => {
      const dt1 = DateTime.create(2024, 6, 15, 12, 0, 0)
      const dt2 = DateTime.create(2024, 6, 15, 12, 0, 0)
      expect(dt1.isSame(dt2)).toBe(true)
    })

    test('isSame() returns false for different timestamps', () => {
      const dt1 = DateTime.create(2024, 6, 15, 12, 0, 0)
      const dt2 = DateTime.create(2024, 6, 15, 12, 0, 1)
      expect(dt1.isSame(dt2)).toBe(false)
    })

    test('isBetween() works correctly', () => {
      const start = DateTime.create(2024, 1, 1)
      const middle = DateTime.create(2024, 6, 15)
      const end = DateTime.create(2024, 12, 31)
      expect(middle.isBetween(start, end)).toBe(true)
      expect(start.isBetween(middle, end)).toBe(false)
    })
  })

  describe('parsing', () => {
    test('parse from ISO string', () => {
      const dt = DateTime.parse('2024-03-15')
      expect(dt.year).toBe(2024)
      expect(dt.month).toBe(3)
      expect(dt.day).toBe(15)
    })

    test('parse from ISO datetime string', () => {
      const dt = DateTime.parse('2024-03-15T14:30:00.000Z')
      expect(dt.year).toBe(2024)
      expect(dt.month).toBe(3)
    })

    test('parse from timestamp via fromDate', () => {
      const date = new Date(2024, 2, 15, 10, 30, 0)
      const dt = DateTime.fromDate(date)
      expect(dt.year).toBe(2024)
      expect(dt.month).toBe(3)
      expect(dt.day).toBe(15)
      expect(dt.hour).toBe(10)
      expect(dt.minute).toBe(30)
    })

    test('parse with format string', () => {
      const dt = DateTime.parse('15-03-2024', 'DD-MM-YYYY')
      expect(dt.year).toBe(2024)
      expect(dt.month).toBe(3)
      expect(dt.day).toBe(15)
    })
  })

  describe('invalid date handling', () => {
    test('parsing invalid string throws', () => {
      expect(() => DateTime.parse('not-a-date')).toThrow()
    })

    test('parsing with mismatched format throws', () => {
      expect(() => DateTime.parse('2024-03-15', 'DD/MM/YYYY')).toThrow()
    })
  })

  describe('leap year handling', () => {
    test('2024 is a leap year', () => {
      const dt = DateTime.create(2024, 1, 1)
      expect(dt.isLeapYear()).toBe(true)
    })

    test('2023 is not a leap year', () => {
      const dt = DateTime.create(2023, 1, 1)
      expect(dt.isLeapYear()).toBe(false)
    })

    test('2000 is a leap year (divisible by 400)', () => {
      const dt = DateTime.create(2000, 1, 1)
      expect(dt.isLeapYear()).toBe(true)
    })

    test('1900 is not a leap year (divisible by 100 but not 400)', () => {
      const dt = DateTime.create(1900, 1, 1)
      expect(dt.isLeapYear()).toBe(false)
    })

    test('Feb 29 exists in leap year 2024', () => {
      const dt = DateTime.create(2024, 2, 29)
      expect(dt.month).toBe(2)
      expect(dt.day).toBe(29)
    })

    test('endOfMonth in Feb 2024 (leap year) is day 29', () => {
      const dt = DateTime.create(2024, 2, 1)
      const end = dt.endOfMonth()
      expect(end.day).toBe(29)
    })

    test('endOfMonth in Feb 2023 (non-leap year) is day 28', () => {
      const dt = DateTime.create(2023, 2, 1)
      const end = dt.endOfMonth()
      expect(end.day).toBe(28)
    })
  })
})
