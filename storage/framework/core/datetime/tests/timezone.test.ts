import { describe, expect, it } from 'bun:test'
import { format } from '../src/format'
import { parse } from '../src/parse'

describe('timezone support', () => {
  // Use a fixed UTC instant for all tz-format tests
  // 2024-03-15T14:30:45Z (UTC)
  const utcDate = new Date('2024-03-15T14:30:45Z')

  describe('format with tz option', () => {
    it('formats in UTC', () => {
      expect(format(utcDate, 'YYYY-MM-DD HH:mm:ss', { tz: 'UTC' })).toBe('2024-03-15 14:30:45')
    })

    it('formats in Asia/Tokyo (UTC+9)', () => {
      // 14:30 UTC = 23:30 JST
      expect(format(utcDate, 'HH:mm', { tz: 'Asia/Tokyo' })).toBe('23:30')
      expect(format(utcDate, 'YYYY-MM-DD', { tz: 'Asia/Tokyo' })).toBe('2024-03-15')
    })

    it('formats in America/New_York (UTC-4 in March DST)', () => {
      // 14:30 UTC = 10:30 EDT
      expect(format(utcDate, 'HH:mm', { tz: 'America/New_York' })).toBe('10:30')
    })

    it('formats in America/Los_Angeles (UTC-7 in March DST)', () => {
      // 14:30 UTC = 07:30 PDT
      expect(format(utcDate, 'HH:mm', { tz: 'America/Los_Angeles' })).toBe('07:30')
    })

    it('formats in Europe/London (UTC+0 in March before DST)', () => {
      // March 15 is still GMT (DST starts last Sunday of March)
      expect(format(utcDate, 'HH:mm', { tz: 'Europe/London' })).toBe('14:30')
    })

    it('formats date that crosses day boundary forward', () => {
      // 2024-03-15 23:00 UTC = 2024-03-16 08:00 in Asia/Tokyo
      const lateUtc = new Date('2024-03-15T23:00:00Z')
      expect(format(lateUtc, 'YYYY-MM-DD', { tz: 'Asia/Tokyo' })).toBe('2024-03-16')
      expect(format(lateUtc, 'HH:mm', { tz: 'Asia/Tokyo' })).toBe('08:00')
    })

    it('formats date that crosses day boundary backward', () => {
      // 2024-03-15 02:00 UTC = 2024-03-14 19:00 in America/Los_Angeles
      const earlyUtc = new Date('2024-03-15T02:00:00Z')
      expect(format(earlyUtc, 'YYYY-MM-DD', { tz: 'America/Los_Angeles' })).toBe('2024-03-14')
      expect(format(earlyUtc, 'HH:mm', { tz: 'America/Los_Angeles' })).toBe('19:00')
    })

    it('formats midnight in target timezone', () => {
      // Midnight in Tokyo = 15:00 UTC (previous day)
      const midnightTokyo = new Date('2024-03-14T15:00:00Z')
      expect(format(midnightTokyo, 'HH:mm:ss', { tz: 'Asia/Tokyo' })).toBe('00:00:00')
      expect(format(midnightTokyo, 'h:mm A', { tz: 'Asia/Tokyo' })).toBe('12:00 AM')
    })

    it('formats noon in target timezone', () => {
      // Noon in Tokyo = 03:00 UTC
      const noonTokyo = new Date('2024-03-15T03:00:00Z')
      expect(format(noonTokyo, 'HH:mm', { tz: 'Asia/Tokyo' })).toBe('12:00')
      expect(format(noonTokyo, 'h:mm A', { tz: 'Asia/Tokyo' })).toBe('12:00 PM')
    })

    it('includes correct Z offset for UTC', () => {
      expect(format(utcDate, 'Z', { tz: 'UTC' })).toBe('+0000')
    })

    it('includes correct Z offset for fixed-offset timezone', () => {
      const z = format(utcDate, 'Z', { tz: 'Asia/Tokyo' })
      expect(z).toBe('+0900')
    })

    it('formats full datetime in a target timezone', () => {
      expect(format(utcDate, 'YYYY-MM-DD HH:mm:ss Z', { tz: 'UTC' })).toBe('2024-03-15 14:30:45 +0000')
    })

    it('formats weekday and month names in target timezone', () => {
      expect(format(utcDate, 'dddd', { tz: 'UTC' })).toBe('Friday')
      expect(format(utcDate, 'MMMM', { tz: 'UTC' })).toBe('March')
    })

    it('formats weekday correctly when day changes across timezone', () => {
      // 2024-03-15 (Friday) 23:00 UTC = 2024-03-16 (Saturday) in Tokyo
      const fri = new Date('2024-03-15T23:00:00Z')
      expect(format(fri, 'dddd', { tz: 'UTC' })).toBe('Friday')
      expect(format(fri, 'dddd', { tz: 'Asia/Tokyo' })).toBe('Saturday')
    })
  })

  describe('format with tz and locale', () => {
    it('formats month name in German', () => {
      const result = format(utcDate, 'MMMM', { tz: 'UTC', locale: 'de' })
      expect(result).toBe('März')
    })

    it('formats weekday in French', () => {
      const result = format(utcDate, 'dddd', { tz: 'UTC', locale: 'fr' })
      expect(result).toBe('vendredi')
    })

    it('formats month name in Japanese', () => {
      const result = format(utcDate, 'M', { tz: 'Asia/Tokyo', locale: 'ja' })
      expect(result).toBe('3')
    })
  })

  describe('DST transitions', () => {
    it('handles US spring-forward correctly', () => {
      // 2024-03-10 is US DST spring-forward (2:00 AM -> 3:00 AM ET)
      // At 2024-03-10T06:30:00Z, ET is already EDT (UTC-4) = 02:30 AM
      // At 2024-03-10T07:30:00Z, ET is EDT (UTC-4) = 03:30 AM
      const beforeSpring = new Date('2024-03-10T06:30:00Z')
      const afterSpring = new Date('2024-03-10T07:30:00Z')
      expect(format(beforeSpring, 'HH:mm', { tz: 'America/New_York' })).toBe('01:30')
      expect(format(afterSpring, 'HH:mm', { tz: 'America/New_York' })).toBe('03:30')
    })

    it('handles US fall-back correctly', () => {
      // 2024-11-03 is US DST fall-back (2:00 AM -> 1:00 AM ET)
      // Before: EDT (UTC-4), After: EST (UTC-5)
      const beforeFall = new Date('2024-11-03T05:30:00Z') // 01:30 EDT
      const afterFall = new Date('2024-11-03T06:30:00Z') // 01:30 EST
      expect(format(beforeFall, 'HH:mm', { tz: 'America/New_York' })).toBe('01:30')
      expect(format(afterFall, 'HH:mm', { tz: 'America/New_York' })).toBe('01:30')
    })

    it('handles EU spring-forward (last Sunday of March)', () => {
      // 2024-03-31 is EU DST spring-forward
      // Before: CET (UTC+1), After: CEST (UTC+2)
      const before = new Date('2024-03-31T00:30:00Z') // 01:30 CET
      const after = new Date('2024-03-31T01:30:00Z') // 03:30 CEST
      expect(format(before, 'HH:mm', { tz: 'Europe/Berlin' })).toBe('01:30')
      expect(format(after, 'HH:mm', { tz: 'Europe/Berlin' })).toBe('03:30')
    })
  })

  describe('parse with timezone offset (Z token)', () => {
    it('parses UTC offset (+0000)', () => {
      const d = parse('2024-03-15 14:30:00 +0000', 'YYYY-MM-DD HH:mm:ss Z')
      expect(d.toISOString()).toBe('2024-03-15T14:30:00.000Z')
    })

    it('parses positive offset (+0900)', () => {
      // 14:30 in +0900 = 05:30 UTC
      const d = parse('2024-03-15 14:30:00 +0900', 'YYYY-MM-DD HH:mm:ss Z')
      expect(d.toISOString()).toBe('2024-03-15T05:30:00.000Z')
    })

    it('parses negative offset (-0500)', () => {
      // 14:30 in -0500 = 19:30 UTC
      const d = parse('2024-03-15 14:30:00 -0500', 'YYYY-MM-DD HH:mm:ss Z')
      expect(d.toISOString()).toBe('2024-03-15T19:30:00.000Z')
    })

    it('parses India Standard Time (+0530)', () => {
      // 14:30 in +0530 = 09:00 UTC
      const d = parse('2024-03-15 14:30:00 +0530', 'YYYY-MM-DD HH:mm:ss Z')
      expect(d.toISOString()).toBe('2024-03-15T09:00:00.000Z')
    })

    it('parses Chatham Islands (+1345)', () => {
      // 14:30 in +1345 = 00:45 UTC
      const d = parse('2024-03-15 14:30:00 +1345', 'YYYY-MM-DD HH:mm:ss Z')
      expect(d.toISOString()).toBe('2024-03-15T00:45:00.000Z')
    })

    it('parses midnight UTC', () => {
      const d = parse('2024-03-15 00:00:00 +0000', 'YYYY-MM-DD HH:mm:ss Z')
      expect(d.toISOString()).toBe('2024-03-15T00:00:00.000Z')
    })

    it('parses end of day with offset', () => {
      // 23:59:59 in +0900 = 14:59:59 UTC
      const d = parse('2024-03-15 23:59:59 +0900', 'YYYY-MM-DD HH:mm:ss Z')
      expect(d.toISOString()).toBe('2024-03-15T14:59:59.000Z')
    })

    it('offset causes date to roll backward', () => {
      // 02:00 in +0900 = 17:00 UTC previous day
      const d = parse('2024-03-15 02:00:00 +0900', 'YYYY-MM-DD HH:mm:ss Z')
      expect(d.toISOString()).toBe('2024-03-14T17:00:00.000Z')
    })

    it('offset causes date to roll forward', () => {
      // 22:00 in -0500 = 03:00 UTC next day
      const d = parse('2024-03-15 22:00:00 -0500', 'YYYY-MM-DD HH:mm:ss Z')
      expect(d.toISOString()).toBe('2024-03-16T03:00:00.000Z')
    })

    it('without Z token, constructs local time', () => {
      const d = parse('2024-03-15 14:30:00', 'YYYY-MM-DD HH:mm:ss')
      // Should be local, not UTC
      expect(d.getHours()).toBe(14)
      expect(d.getMinutes()).toBe(30)
    })
  })

  describe('format → parse roundtrip with timezone', () => {
    it('roundtrips through UTC', () => {
      const original = new Date('2024-06-15T18:30:00Z')
      const formatted = format(original, 'YYYY-MM-DD HH:mm:ss Z', { tz: 'UTC' })
      expect(formatted).toBe('2024-06-15 18:30:00 +0000')
      const parsed = parse(formatted, 'YYYY-MM-DD HH:mm:ss Z')
      expect(parsed.toISOString()).toBe('2024-06-15T18:30:00.000Z')
    })

    it('roundtrips through Asia/Tokyo', () => {
      const original = new Date('2024-06-15T18:30:00Z')
      const formatted = format(original, 'YYYY-MM-DD HH:mm:ss Z', { tz: 'Asia/Tokyo' })
      // 18:30 UTC = 03:30+1d JST
      expect(formatted).toBe('2024-06-16 03:30:00 +0900')
      const parsed = parse(formatted, 'YYYY-MM-DD HH:mm:ss Z')
      expect(parsed.toISOString()).toBe('2024-06-15T18:30:00.000Z')
    })

    it('roundtrips through America/New_York (summer EDT)', () => {
      const original = new Date('2024-06-15T18:30:00Z')
      const formatted = format(original, 'YYYY-MM-DD HH:mm:ss Z', { tz: 'America/New_York' })
      // 18:30 UTC = 14:30 EDT
      expect(formatted).toBe('2024-06-15 14:30:00 -0400')
      const parsed = parse(formatted, 'YYYY-MM-DD HH:mm:ss Z')
      expect(parsed.toISOString()).toBe('2024-06-15T18:30:00.000Z')
    })

    it('roundtrips through America/New_York (winter EST)', () => {
      const original = new Date('2024-01-15T18:30:00Z')
      const formatted = format(original, 'YYYY-MM-DD HH:mm:ss Z', { tz: 'America/New_York' })
      // 18:30 UTC = 13:30 EST
      expect(formatted).toBe('2024-01-15 13:30:00 -0500')
      const parsed = parse(formatted, 'YYYY-MM-DD HH:mm:ss Z')
      expect(parsed.toISOString()).toBe('2024-01-15T18:30:00.000Z')
    })

    it('preserves instant across multiple timezones', () => {
      const original = new Date('2024-08-20T12:00:00Z')
      const timezones = ['UTC', 'Asia/Tokyo', 'America/New_York', 'Europe/London', 'Australia/Sydney', 'Pacific/Auckland']
      const fmt = 'YYYY-MM-DD HH:mm:ss Z'

      for (const tz of timezones) {
        const formatted = format(original, fmt, { tz })
        const parsed = parse(formatted, fmt)
        expect(parsed.toISOString()).toBe(original.toISOString())
      }
    })
  })

  describe('half-hour and quarter-hour offsets', () => {
    it('handles India +0530 roundtrip', () => {
      const original = new Date('2024-03-15T12:00:00Z')
      const formatted = format(original, 'YYYY-MM-DD HH:mm:ss Z', { tz: 'Asia/Kolkata' })
      expect(formatted).toBe('2024-03-15 17:30:00 +0530')
      const parsed = parse(formatted, 'YYYY-MM-DD HH:mm:ss Z')
      expect(parsed.toISOString()).toBe('2024-03-15T12:00:00.000Z')
    })

    it('handles Nepal +0545 roundtrip', () => {
      const original = new Date('2024-03-15T12:00:00Z')
      const formatted = format(original, 'YYYY-MM-DD HH:mm:ss Z', { tz: 'Asia/Kathmandu' })
      expect(formatted).toBe('2024-03-15 17:45:00 +0545')
      const parsed = parse(formatted, 'YYYY-MM-DD HH:mm:ss Z')
      expect(parsed.toISOString()).toBe('2024-03-15T12:00:00.000Z')
    })
  })

  describe('edge: new year across timezone', () => {
    it('formats NYE that crosses into next year in positive offset', () => {
      // 2024-12-31 20:00 UTC = 2025-01-01 05:00 JST
      const nye = new Date('2024-12-31T20:00:00Z')
      expect(format(nye, 'YYYY-MM-DD', { tz: 'Asia/Tokyo' })).toBe('2025-01-01')
      expect(format(nye, 'YYYY-MM-DD', { tz: 'UTC' })).toBe('2024-12-31')
    })

    it('formats new year that is still previous year in negative offset', () => {
      // 2025-01-01 03:00 UTC = 2024-12-31 22:00 EST
      const newYear = new Date('2025-01-01T03:00:00Z')
      expect(format(newYear, 'YYYY-MM-DD', { tz: 'America/New_York' })).toBe('2024-12-31')
      expect(format(newYear, 'YYYY-MM-DD', { tz: 'UTC' })).toBe('2025-01-01')
    })
  })

  describe('edge: leap day across timezone', () => {
    it('formats Feb 29 correctly in different timezones', () => {
      // 2024-02-29 23:00 UTC = 2024-03-01 08:00 JST
      const leapDay = new Date('2024-02-29T23:00:00Z')
      expect(format(leapDay, 'YYYY-MM-DD', { tz: 'UTC' })).toBe('2024-02-29')
      expect(format(leapDay, 'YYYY-MM-DD', { tz: 'Asia/Tokyo' })).toBe('2024-03-01')
    })

    it('formats Mar 1 UTC as Feb 29 in negative offset', () => {
      // 2024-03-01 03:00 UTC = 2024-02-29 22:00 EST
      const marchFirst = new Date('2024-03-01T03:00:00Z')
      expect(format(marchFirst, 'YYYY-MM-DD', { tz: 'America/New_York' })).toBe('2024-02-29')
    })
  })
})
