import { describe, expect, it } from 'bun:test'
import { parse } from '../src/parse'

describe('parse', () => {
  describe('basic date formats', () => {
    it('parses YYYY-MM-DD', () => {
      const d = parse('2024-03-15', 'YYYY-MM-DD')
      expect(d.getFullYear()).toBe(2024)
      expect(d.getMonth()).toBe(2) // 0-indexed
      expect(d.getDate()).toBe(15)
    })

    it('parses MM/DD/YYYY', () => {
      const d = parse('03/15/2024', 'MM/DD/YYYY')
      expect(d.getFullYear()).toBe(2024)
      expect(d.getMonth()).toBe(2)
      expect(d.getDate()).toBe(15)
    })

    it('parses DD.MM.YYYY', () => {
      const d = parse('15.03.2024', 'DD.MM.YYYY')
      expect(d.getFullYear()).toBe(2024)
      expect(d.getMonth()).toBe(2)
      expect(d.getDate()).toBe(15)
    })

    it('parses YYYY/MM/DD', () => {
      const d = parse('2024/03/15', 'YYYY/MM/DD')
      expect(d.getFullYear()).toBe(2024)
      expect(d.getMonth()).toBe(2)
      expect(d.getDate()).toBe(15)
    })
  })

  describe('with time', () => {
    it('parses full datetime', () => {
      const d = parse('2024-03-15 14:30:45', 'YYYY-MM-DD HH:mm:ss')
      expect(d.getFullYear()).toBe(2024)
      expect(d.getMonth()).toBe(2)
      expect(d.getDate()).toBe(15)
      expect(d.getHours()).toBe(14)
      expect(d.getMinutes()).toBe(30)
      expect(d.getSeconds()).toBe(45)
    })

    it('parses midnight', () => {
      const d = parse('2024-01-01 00:00:00', 'YYYY-MM-DD HH:mm:ss')
      expect(d.getHours()).toBe(0)
      expect(d.getMinutes()).toBe(0)
      expect(d.getSeconds()).toBe(0)
    })

    it('parses end of day', () => {
      const d = parse('2024-01-01 23:59:59', 'YYYY-MM-DD HH:mm:ss')
      expect(d.getHours()).toBe(23)
      expect(d.getMinutes()).toBe(59)
      expect(d.getSeconds()).toBe(59)
    })
  })

  describe('12-hour clock', () => {
    it('parses AM time', () => {
      const d = parse('08:30 AM', 'hh:mm A')
      expect(d.getHours()).toBe(8)
      expect(d.getMinutes()).toBe(30)
    })

    it('parses PM time', () => {
      const d = parse('02:30 PM', 'hh:mm A')
      expect(d.getHours()).toBe(14)
      expect(d.getMinutes()).toBe(30)
    })

    it('parses 12:00 PM as noon', () => {
      const d = parse('12:00 PM', 'hh:mm A')
      expect(d.getHours()).toBe(12)
    })

    it('parses 12:00 AM as midnight', () => {
      const d = parse('12:00 AM', 'hh:mm A')
      expect(d.getHours()).toBe(0)
    })

    it('parses 11:59 PM', () => {
      const d = parse('11:59 PM', 'hh:mm A')
      expect(d.getHours()).toBe(23)
      expect(d.getMinutes()).toBe(59)
    })

    it('parses lowercase am/pm', () => {
      const d = parse('02:30 pm', 'hh:mm a')
      expect(d.getHours()).toBe(14)
    })
  })

  describe('leap years', () => {
    it('parses Feb 29 on leap year 2024', () => {
      const d = parse('2024-02-29', 'YYYY-MM-DD')
      expect(d.getFullYear()).toBe(2024)
      expect(d.getMonth()).toBe(1)
      expect(d.getDate()).toBe(29)
    })

    it('parses Feb 29 on leap year 2000', () => {
      const d = parse('2000-02-29', 'YYYY-MM-DD')
      expect(d.getFullYear()).toBe(2000)
      expect(d.getMonth()).toBe(1)
      expect(d.getDate()).toBe(29)
    })

    it('parses Feb 28 on non-leap year', () => {
      const d = parse('2023-02-28', 'YYYY-MM-DD')
      expect(d.getFullYear()).toBe(2023)
      expect(d.getMonth()).toBe(1)
      expect(d.getDate()).toBe(28)
    })
  })

  describe('2-digit year', () => {
    it('treats 00-69 as 2000-2069', () => {
      expect(parse('15-03-00', 'DD-MM-YY').getFullYear()).toBe(2000)
      expect(parse('15-03-24', 'DD-MM-YY').getFullYear()).toBe(2024)
      expect(parse('15-03-69', 'DD-MM-YY').getFullYear()).toBe(2069)
    })

    it('treats 70-99 as 1970-1999', () => {
      expect(parse('15-03-70', 'DD-MM-YY').getFullYear()).toBe(1970)
      expect(parse('15-03-99', 'DD-MM-YY').getFullYear()).toBe(1999)
    })
  })

  describe('month boundaries', () => {
    it('parses January 1st', () => {
      const d = parse('2024-01-01', 'YYYY-MM-DD')
      expect(d.getMonth()).toBe(0)
      expect(d.getDate()).toBe(1)
    })

    it('parses December 31st', () => {
      const d = parse('2024-12-31', 'YYYY-MM-DD')
      expect(d.getMonth()).toBe(11)
      expect(d.getDate()).toBe(31)
    })

    it('parses month with 31 days', () => {
      const d = parse('2024-01-31', 'YYYY-MM-DD')
      expect(d.getDate()).toBe(31)
    })

    it('parses month with 30 days', () => {
      const d = parse('2024-04-30', 'YYYY-MM-DD')
      expect(d.getDate()).toBe(30)
    })
  })

  describe('unpadded values', () => {
    it('parses single-digit month and day with M/D', () => {
      const d = parse('3/5/2024', 'M/D/YYYY')
      expect(d.getMonth()).toBe(2)
      expect(d.getDate()).toBe(5)
    })

    it('parses M=1, D=1', () => {
      const d = parse('1/1/2024', 'M/D/YYYY')
      expect(d.getMonth()).toBe(0)
      expect(d.getDate()).toBe(1)
    })

    it('parses double-digit with M/D', () => {
      const d = parse('12/25/2024', 'M/D/YYYY')
      expect(d.getMonth()).toBe(11)
      expect(d.getDate()).toBe(25)
    })
  })

  describe('named months', () => {
    it('parses full month name', () => {
      const d = parse('March 15, 2024', 'MMMM D, YYYY')
      expect(d.getFullYear()).toBe(2024)
      expect(d.getMonth()).toBe(2)
      expect(d.getDate()).toBe(15)
    })

    it('parses short month name', () => {
      const d = parse('Mar 15, 2024', 'MMM D, YYYY')
      expect(d.getMonth()).toBe(2)
    })

    it('parses January', () => {
      const d = parse('January 1, 2024', 'MMMM D, YYYY')
      expect(d.getMonth()).toBe(0)
    })

    it('parses December', () => {
      const d = parse('December 31, 2024', 'MMMM D, YYYY')
      expect(d.getMonth()).toBe(11)
      expect(d.getDate()).toBe(31)
    })

    it('parses all short month names', () => {
      const shorts = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      for (let i = 0; i < 12; i++) {
        const d = parse(`${shorts[i]} 1, 2024`, 'MMM D, YYYY')
        expect(d.getMonth()).toBe(i)
      }
    })
  })

  describe('compact formats', () => {
    it('parses YYYYMMDD', () => {
      const d = parse('20240315', 'YYYYMMDD')
      expect(d.getFullYear()).toBe(2024)
      expect(d.getMonth()).toBe(2)
      expect(d.getDate()).toBe(15)
    })

    it('parses YYYYMMDDTHHmmss', () => {
      const d = parse('20240315T143045', 'YYYYMMDDTHHmmss')
      expect(d.getFullYear()).toBe(2024)
      expect(d.getMonth()).toBe(2)
      expect(d.getDate()).toBe(15)
      expect(d.getHours()).toBe(14)
      expect(d.getMinutes()).toBe(30)
      expect(d.getSeconds()).toBe(45)
    })
  })

  describe('ISO fallback (no format)', () => {
    it('parses full ISO string', () => {
      const d = parse('2024-03-15T14:30:00')
      expect(d.getFullYear()).toBe(2024)
      expect(d.getMonth()).toBe(2)
      expect(d.getDate()).toBe(15)
      expect(d.getHours()).toBe(14)
      expect(d.getMinutes()).toBe(30)
    })

    it('parses date-only ISO string as local time', () => {
      const d = parse('2024-03-15')
      expect(d.getFullYear()).toBe(2024)
      expect(d.getMonth()).toBe(2)
      expect(d.getDate()).toBe(15)
    })

    it('parses date-only for all months', () => {
      for (let m = 1; m <= 12; m++) {
        const mStr = String(m).padStart(2, '0')
        const d = parse(`2024-${mStr}-01`)
        expect(d.getMonth()).toBe(m - 1)
        expect(d.getDate()).toBe(1)
      }
    })
  })

  describe('error cases', () => {
    it('throws on invalid date string without format', () => {
      expect(() => parse('not-a-date')).toThrow('Unable to parse date')
    })

    it('throws on format mismatch', () => {
      expect(() => parse('abc', 'YYYY-MM-DD')).toThrow('Unable to parse')
    })

    it('throws on unknown month name', () => {
      expect(() => parse('Foo 15, 2024', 'MMMM D, YYYY')).toThrow('Unknown month')
    })
  })
})
