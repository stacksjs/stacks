import { describe, expect, it } from 'bun:test'
import { addDays, daysBetween, isCalendarDate, isTimeZone, minutesUntil, startOfIsoWeek, todayIn } from '../src'

describe('isCalendarDate', () => {
  it('accepts real YYYY-MM-DD dates only', () => {
    expect(isCalendarDate('2026-10-18')).toBe(true)
    expect(isCalendarDate('2028-02-29')).toBe(true)
    expect(isCalendarDate('2026-02-29')).toBe(false)
    expect(isCalendarDate('2026-02-31')).toBe(false)
    expect(isCalendarDate('2026-13-01')).toBe(false)
    expect(isCalendarDate('2026-2-3')).toBe(false)
    expect(isCalendarDate('2026-10-18T00:00:00Z')).toBe(false)
    expect(isCalendarDate(new Date())).toBe(false)
    expect(isCalendarDate(null)).toBe(false)
  })
})

describe('isTimeZone', () => {
  it('knows IANA zones and refuses the rest', () => {
    expect(isTimeZone('Europe/Berlin')).toBe(true)
    expect(isTimeZone('UTC')).toBe(true)
    expect(isTimeZone('Mars/Olympus_Mons')).toBe(false)
    expect(isTimeZone('')).toBe(false)
    expect(isTimeZone(' ')).toBe(false)
    expect(isTimeZone(42)).toBe(false)
  })
})

describe('todayIn', () => {
  const instant = new Date('2026-10-18T12:30:00Z')

  it('is the date where the zone is, not where the server is', () => {
    expect(todayIn('UTC', instant)).toBe('2026-10-18')
    expect(todayIn('Pacific/Auckland', instant)).toBe('2026-10-19')
    expect(todayIn('Pacific/Honolulu', new Date('2026-10-18T05:00:00Z'))).toBe('2026-10-17')
  })

  it('throws for an unknown zone or instant', () => {
    expect(() => todayIn('Nowhere/Special', instant)).toThrow(RangeError)
    expect(() => todayIn('UTC', new Date(Number.NaN))).toThrow(RangeError)
  })
})

describe('addDays', () => {
  it('rolls over month, year and leap-day boundaries', () => {
    expect(addDays('2026-10-18', 1)).toBe('2026-10-19')
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-10-18', 0)).toBe('2026-10-18')
    expect(addDays('2026-10-18', -365)).toBe('2025-10-18')
  })

  it('is a calendar day across a DST change, whatever the server zone', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25')
  })

  it('refuses impossible input', () => {
    expect(() => addDays('2026-02-31', 1)).toThrow(RangeError)
    expect(() => addDays('2026-10-18', 1.5)).toThrow(RangeError)
    expect(() => addDays('9999-12-31', 1)).toThrow(RangeError)
  })
})

describe('daysBetween', () => {
  it('counts whole calendar days, signed', () => {
    expect(daysBetween('2026-10-18', '2026-10-25')).toBe(7)
    expect(daysBetween('2026-10-25', '2026-10-18')).toBe(-7)
    expect(daysBetween('2026-10-18', '2026-10-18')).toBe(0)
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365)
    expect(daysBetween('2028-01-01', '2029-01-01')).toBe(366)
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
  })
})

describe('startOfIsoWeek', () => {
  it('is the Monday on or before the date', () => {
    expect(startOfIsoWeek('2026-10-19')).toBe('2026-10-19') // Monday
    expect(startOfIsoWeek('2026-10-18')).toBe('2026-10-12') // Sunday belongs to the week before
    expect(startOfIsoWeek('2026-10-21')).toBe('2026-10-19')
    expect(startOfIsoWeek('2027-01-01')).toBe('2026-12-28') // across a year end
    expect(startOfIsoWeek('1970-01-01')).toBe('1969-12-29') // before the epoch
  })
})

describe('minutesUntil', () => {
  it('counts real minutes to a wall-clock time in a zone', () => {
    expect(minutesUntil('2026-10-18', '18:00', 'Europe/Berlin', new Date('2026-10-18T15:00:00Z'))).toBe(60)
    expect(minutesUntil('2026-10-18', '18:00:30', 'Europe/Berlin', new Date('2026-10-18T15:00:00Z'))).toBe(60.5)
    expect(minutesUntil('2026-10-18', '06:00', 'America/New_York', new Date('2026-10-18T12:00:00Z'))).toBe(-120)
  })

  it('is right across the EU fall-back night', () => {
    // 22:00Z on the 24th is midnight CEST; 09:00 CET on the 25th is 08:00Z. Ten hours, not nine.
    expect(minutesUntil('2026-10-25', '09:00', 'Europe/Berlin', new Date('2026-10-24T22:00:00Z'))).toBe(600)
  })

  it('is right across the US spring-forward night', () => {
    // Midnight EST is 05:00Z; 09:00 EDT is 13:00Z. Eight hours, not nine.
    expect(minutesUntil('2026-03-08', '09:00', 'America/New_York', new Date('2026-03-08T05:00:00Z'))).toBe(480)
  })

  it('refuses malformed input', () => {
    expect(() => minutesUntil('2026-02-31', '09:00', 'UTC')).toThrow(RangeError)
    expect(() => minutesUntil('2026-10-18', '9:00', 'UTC')).toThrow(RangeError)
    expect(() => minutesUntil('2026-10-18', '24:00', 'UTC')).toThrow(RangeError)
    expect(() => minutesUntil('2026-10-18', '09:00', 'Nowhere/Special')).toThrow(RangeError)
  })
})
