import { describe, expect, it } from 'bun:test'
import { format } from '../src/format'

describe('format', () => {
  describe('date tokens', () => {
    const date = new Date(2024, 2, 15) // March 15, 2024

    it('formats 4-digit year (YYYY)', () => {
      expect(format(date, 'YYYY')).toBe('2024')
    })

    it('formats 2-digit year (YY)', () => {
      expect(format(date, 'YY')).toBe('24')
    })

    it('formats padded month (MM)', () => {
      expect(format(date, 'MM')).toBe('03')
    })

    it('formats unpadded month (M)', () => {
      expect(format(date, 'M')).toBe('3')
    })

    it('formats full month name (MMMM)', () => {
      expect(format(date, 'MMMM')).toBe('March')
    })

    it('formats short month name (MMM)', () => {
      expect(format(date, 'MMM')).toBe('Mar')
    })

    it('formats padded day (DD)', () => {
      expect(format(new Date(2024, 0, 5), 'DD')).toBe('05')
    })

    it('formats unpadded day (D)', () => {
      expect(format(new Date(2024, 0, 5), 'D')).toBe('5')
    })

    it('formats full weekday name (dddd)', () => {
      expect(format(date, 'dddd')).toBe('Friday')
    })

    it('formats short weekday name (ddd)', () => {
      expect(format(date, 'ddd')).toBe('Fri')
    })

    it('formats narrow weekday (d)', () => {
      expect(format(date, 'd')).toBe('F')
    })
  })

  describe('time tokens', () => {
    it('formats 24-hour padded (HH)', () => {
      expect(format(new Date(2024, 0, 1, 8, 0, 0), 'HH')).toBe('08')
      expect(format(new Date(2024, 0, 1, 14, 0, 0), 'HH')).toBe('14')
    })

    it('formats 24-hour unpadded (H)', () => {
      expect(format(new Date(2024, 0, 1, 8, 0, 0), 'H')).toBe('8')
      expect(format(new Date(2024, 0, 1, 0, 0, 0), 'H')).toBe('0')
    })

    it('formats 12-hour padded (hh)', () => {
      expect(format(new Date(2024, 0, 1, 14, 0, 0), 'hh')).toBe('02')
      expect(format(new Date(2024, 0, 1, 0, 0, 0), 'hh')).toBe('12')
    })

    it('formats 12-hour unpadded (h)', () => {
      expect(format(new Date(2024, 0, 1, 14, 0, 0), 'h')).toBe('2')
      expect(format(new Date(2024, 0, 1, 0, 0, 0), 'h')).toBe('12')
    })

    it('formats padded minutes (mm)', () => {
      expect(format(new Date(2024, 0, 1, 0, 5, 0), 'mm')).toBe('05')
      expect(format(new Date(2024, 0, 1, 0, 59, 0), 'mm')).toBe('59')
    })

    it('formats unpadded minutes (m)', () => {
      expect(format(new Date(2024, 0, 1, 0, 0, 0), 'm')).toBe('0')
      expect(format(new Date(2024, 0, 1, 0, 5, 0), 'm')).toBe('5')
    })

    it('formats padded seconds (ss)', () => {
      expect(format(new Date(2024, 0, 1, 0, 0, 5), 'ss')).toBe('05')
      expect(format(new Date(2024, 0, 1, 0, 0, 59), 'ss')).toBe('59')
    })

    it('formats unpadded seconds (s)', () => {
      expect(format(new Date(2024, 0, 1, 0, 0, 0), 's')).toBe('0')
    })

    it('formats AM/PM uppercase (A)', () => {
      expect(format(new Date(2024, 0, 1, 0, 0, 0), 'A')).toBe('AM')
      expect(format(new Date(2024, 0, 1, 11, 59, 0), 'A')).toBe('AM')
      expect(format(new Date(2024, 0, 1, 12, 0, 0), 'A')).toBe('PM')
      expect(format(new Date(2024, 0, 1, 23, 59, 0), 'A')).toBe('PM')
    })

    it('formats am/pm lowercase (a)', () => {
      expect(format(new Date(2024, 0, 1, 0, 0, 0), 'a')).toBe('am')
      expect(format(new Date(2024, 0, 1, 12, 0, 0), 'a')).toBe('pm')
    })

    it('formats timezone offset (Z)', () => {
      const z = format(new Date(2024, 0, 1), 'Z')
      expect(z).toMatch(/^[+-]\d{4}$/)
    })
  })

  describe('midnight and noon', () => {
    it('formats midnight correctly', () => {
      const midnight = new Date(2024, 0, 1, 0, 0, 0)
      expect(format(midnight, 'HH:mm:ss')).toBe('00:00:00')
      expect(format(midnight, 'h:mm A')).toBe('12:00 AM')
    })

    it('formats noon correctly', () => {
      const noon = new Date(2024, 0, 1, 12, 0, 0)
      expect(format(noon, 'HH:mm')).toBe('12:00')
      expect(format(noon, 'h:mm A')).toBe('12:00 PM')
    })

    it('formats end of day correctly', () => {
      const eod = new Date(2024, 0, 1, 23, 59, 59)
      expect(format(eod, 'HH:mm:ss')).toBe('23:59:59')
      expect(format(eod, 'h:mm:ss A')).toBe('11:59:59 PM')
    })
  })

  describe('leap years', () => {
    it('formats Feb 29 on a leap year', () => {
      expect(format(new Date(2024, 1, 29), 'YYYY-MM-DD')).toBe('2024-02-29')
    })

    it('formats Feb 29 on year 2000', () => {
      expect(format(new Date(2000, 1, 29), 'YYYY-MM-DD')).toBe('2000-02-29')
    })

    it('formats Feb 28 on a non-leap year', () => {
      expect(format(new Date(2023, 1, 28), 'YYYY-MM-DD')).toBe('2023-02-28')
    })
  })

  describe('year boundaries', () => {
    it('formats 2-digit year 00', () => {
      expect(format(new Date(2000, 0, 1), 'YY')).toBe('00')
    })

    it('formats 2-digit year 99', () => {
      expect(format(new Date(1999, 0, 1), 'YY')).toBe('99')
    })
  })

  describe('month boundaries', () => {
    it('formats all months correctly', () => {
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      for (let i = 0; i < 12; i++) {
        expect(format(new Date(2024, i, 1), 'MMMM')).toBe(months[i])
      }
    })

    it('formats Jan 1 and Dec 31', () => {
      expect(format(new Date(2024, 0, 1), 'YYYY-MM-DD')).toBe('2024-01-01')
      expect(format(new Date(2024, 11, 31), 'YYYY-MM-DD')).toBe('2024-12-31')
    })
  })

  describe('combined patterns', () => {
    it('formats full datetime string', () => {
      const d = new Date(2024, 2, 15, 14, 30, 45)
      expect(format(d, 'dddd, MMMM D, YYYY h:mm:ss A')).toBe('Friday, March 15, 2024 2:30:45 PM')
    })

    it('formats compact date', () => {
      expect(format(new Date(2024, 2, 15), 'YYYYMMDD')).toBe('20240315')
    })

    it('formats compact datetime', () => {
      expect(format(new Date(2024, 2, 15, 14, 30, 45), 'YYYYMMDDTHHmmss')).toBe('20240315T143045')
    })

    it('preserves literal separators', () => {
      expect(format(new Date(2024, 0, 15), 'YYYY/MM/DD')).toBe('2024/01/15')
      expect(format(new Date(2024, 0, 15), 'YYYY-MM-DD')).toBe('2024-01-15')
    })
  })

  describe('input types', () => {
    it('accepts Date object', () => {
      expect(format(new Date(2024, 0, 1), 'YYYY')).toBe('2024')
    })

    it('accepts ISO string', () => {
      expect(format('2024-06-15T10:30:00', 'YYYY-MM-DD')).toBe('2024-06-15')
    })

    it('uses default format when none provided', () => {
      expect(format(new Date(2024, 2, 15))).toBe('2024-03-15')
    })

    it('throws on invalid date string', () => {
      expect(() => format('not-a-date', 'YYYY')).toThrow('Invalid date')
    })
  })
})
