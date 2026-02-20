import { describe, expect, it } from 'bun:test'
import { DateTime, now } from '../src/now'

describe('now() helper', () => {
  it('returns a DateTime instance', () => {
    const dt = now()
    expect(dt).toBeInstanceOf(DateTime)
  })

  it('represents the current time', () => {
    const before = Date.now()
    const dt = now()
    const after = Date.now()
    expect(dt.timestamp).toBeGreaterThanOrEqual(before)
    expect(dt.timestamp).toBeLessThanOrEqual(after)
  })

  it('isToday returns true', () => {
    expect(now().isToday()).toBe(true)
  })
})

describe('DateTime factory methods', () => {
  it('DateTime.now() returns current time', () => {
    const before = Date.now()
    const dt = DateTime.now()
    const after = Date.now()
    expect(dt.timestamp).toBeGreaterThanOrEqual(before)
    expect(dt.timestamp).toBeLessThanOrEqual(after)
  })

  it('DateTime.create() builds a date from parts', () => {
    const dt = DateTime.create(2024, 3, 15, 10, 30, 45)
    expect(dt.year).toBe(2024)
    expect(dt.month).toBe(3)
    expect(dt.day).toBe(15)
    expect(dt.hour).toBe(10)
    expect(dt.minute).toBe(30)
    expect(dt.second).toBe(45)
  })

  it('DateTime.create() defaults to Jan 1 midnight', () => {
    const dt = DateTime.create(2024)
    expect(dt.month).toBe(1)
    expect(dt.day).toBe(1)
    expect(dt.hour).toBe(0)
    expect(dt.minute).toBe(0)
    expect(dt.second).toBe(0)
  })

  it('DateTime.fromDate() wraps a native Date', () => {
    const native = new Date(2024, 2, 15, 10, 30, 0)
    const dt = DateTime.fromDate(native)
    expect(dt.year).toBe(2024)
    expect(dt.month).toBe(3)
    expect(dt.day).toBe(15)
    expect(dt.hour).toBe(10)
  })

  it('DateTime.fromDate() creates an independent copy', () => {
    const native = new Date(2024, 2, 15)
    const dt = DateTime.fromDate(native)
    native.setFullYear(2000)
    expect(dt.year).toBe(2024)
  })

  it('DateTime.parse() with format string', () => {
    const dt = DateTime.parse('2024-03-15 10:30:00', 'YYYY-MM-DD HH:mm:ss')
    expect(dt.year).toBe(2024)
    expect(dt.month).toBe(3)
    expect(dt.day).toBe(15)
    expect(dt.hour).toBe(10)
    expect(dt.minute).toBe(30)
    expect(dt.second).toBe(0)
  })

  it('DateTime.parse() without format string (ISO)', () => {
    const dt = DateTime.parse('2024-03-15')
    expect(dt.year).toBe(2024)
    expect(dt.month).toBe(3)
    expect(dt.day).toBe(15)
  })
})

describe('DateTime formatting', () => {
  const dt = DateTime.create(2024, 8, 3, 9, 5, 7)

  it('format() with custom format string', () => {
    expect(dt.format('YYYY-MM-DD')).toBe('2024-08-03')
    expect(dt.format('HH:mm:ss')).toBe('09:05:07')
    expect(dt.format('M/D/YYYY')).toBe('8/3/2024')
  })

  it('toDateString()', () => {
    expect(dt.toDateString()).toBe('2024-08-03')
  })

  it('toTimeString()', () => {
    expect(dt.toTimeString()).toBe('09:05:07')
  })

  it('toDateTimeString()', () => {
    expect(dt.toDateTimeString()).toBe('2024-08-03 09:05:07')
  })

  it('toISOString() returns valid ISO', () => {
    const iso = dt.toISOString()
    expect(iso).toContain('2024-08-0')
    expect(iso).toContain('T')
    expect(iso).toContain('Z')
  })

  it('toString() returns dateTime string', () => {
    expect(dt.toString()).toBe('2024-08-03 09:05:07')
  })

  it('format with timezone option', () => {
    const utcDt = DateTime.parse('2024-07-04T00:00:00.000Z')
    const formatted = utcDt.format('YYYY-MM-DD HH:mm:ss', { tz: 'UTC' })
    expect(formatted).toBe('2024-07-04 00:00:00')
  })
})

describe('DateTime getters', () => {
  const dt = DateTime.create(2024, 6, 15, 14, 30, 45)

  it('year', () => expect(dt.year).toBe(2024))
  it('month (1-based)', () => expect(dt.month).toBe(6))
  it('day', () => expect(dt.day).toBe(15))
  it('hour', () => expect(dt.hour).toBe(14))
  it('minute', () => expect(dt.minute).toBe(30))
  it('second', () => expect(dt.second).toBe(45))
  it('dayOfWeek (Saturday=6)', () => expect(dt.dayOfWeek).toBe(6))
  it('timestamp', () => {
    expect(dt.timestamp).toBe(new Date(2024, 5, 15, 14, 30, 45).getTime())
  })
})

describe('DateTime immutable setters', () => {
  const dt = DateTime.create(2024, 6, 15, 14, 30, 45)

  it('setYear returns new instance', () => {
    const result = dt.setYear(2025)
    expect(result.year).toBe(2025)
    expect(dt.year).toBe(2024) // original unchanged
  })

  it('setMonth returns new instance', () => {
    const result = dt.setMonth(12)
    expect(result.month).toBe(12)
    expect(dt.month).toBe(6)
  })

  it('setDay returns new instance', () => {
    const result = dt.setDay(1)
    expect(result.day).toBe(1)
    expect(dt.day).toBe(15)
  })

  it('setHour returns new instance', () => {
    const result = dt.setHour(0)
    expect(result.hour).toBe(0)
    expect(dt.hour).toBe(14)
  })

  it('setMinute returns new instance', () => {
    const result = dt.setMinute(0)
    expect(result.minute).toBe(0)
    expect(dt.minute).toBe(30)
  })

  it('setSecond returns new instance', () => {
    const result = dt.setSecond(0)
    expect(result.second).toBe(0)
    expect(dt.second).toBe(45)
  })
})

describe('DateTime add methods', () => {
  it('addSeconds', () => {
    const dt = DateTime.create(2024, 1, 1, 0, 0, 0)
    expect(dt.addSeconds(30).second).toBe(30)
    expect(dt.addSeconds(90).minute).toBe(1)
  })

  it('addMinutes', () => {
    const dt = DateTime.create(2024, 1, 1, 0, 0, 0)
    expect(dt.addMinutes(30).minute).toBe(30)
    expect(dt.addMinutes(90).hour).toBe(1)
  })

  it('addHours', () => {
    const dt = DateTime.create(2024, 1, 1, 0, 0, 0)
    expect(dt.addHours(5).hour).toBe(5)
    expect(dt.addHours(25).day).toBe(2)
  })

  it('addDays', () => {
    const dt = DateTime.create(2024, 1, 15, 12, 0, 0)
    expect(dt.addDays(5).day).toBe(20)
    expect(dt.addDays(20).month).toBe(2)
  })

  it('addWeeks', () => {
    const dt = DateTime.create(2024, 1, 1, 0, 0, 0)
    expect(dt.addWeeks(1).day).toBe(8)
    expect(dt.addWeeks(2).day).toBe(15)
  })

  it('addMonths', () => {
    const dt = DateTime.create(2024, 1, 15, 0, 0, 0)
    expect(dt.addMonths(1).month).toBe(2)
    expect(dt.addMonths(12).year).toBe(2025)
  })

  it('addMonths wraps year', () => {
    const dt = DateTime.create(2024, 11, 15, 0, 0, 0)
    const result = dt.addMonths(3)
    expect(result.year).toBe(2025)
    expect(result.month).toBe(2)
  })

  it('addYears', () => {
    const dt = DateTime.create(2024, 6, 15, 0, 0, 0)
    expect(dt.addYears(1).year).toBe(2025)
    expect(dt.addYears(10).year).toBe(2034)
  })
})

describe('DateTime sub methods', () => {
  it('subSeconds', () => {
    const dt = DateTime.create(2024, 1, 1, 0, 1, 30)
    expect(dt.subSeconds(30).second).toBe(0)
  })

  it('subMinutes', () => {
    const dt = DateTime.create(2024, 1, 1, 1, 30, 0)
    expect(dt.subMinutes(30).minute).toBe(0)
  })

  it('subHours', () => {
    const dt = DateTime.create(2024, 1, 1, 5, 0, 0)
    expect(dt.subHours(3).hour).toBe(2)
  })

  it('subDays', () => {
    const dt = DateTime.create(2024, 1, 15, 0, 0, 0)
    expect(dt.subDays(5).day).toBe(10)
  })

  it('subWeeks', () => {
    const dt = DateTime.create(2024, 1, 15, 0, 0, 0)
    expect(dt.subWeeks(1).day).toBe(8)
  })

  it('subMonths', () => {
    const dt = DateTime.create(2024, 6, 15, 0, 0, 0)
    expect(dt.subMonths(3).month).toBe(3)
  })

  it('subMonths wraps year', () => {
    const dt = DateTime.create(2024, 2, 15, 0, 0, 0)
    const result = dt.subMonths(3)
    expect(result.year).toBe(2023)
    expect(result.month).toBe(11)
  })

  it('subYears', () => {
    const dt = DateTime.create(2024, 6, 15, 0, 0, 0)
    expect(dt.subYears(4).year).toBe(2020)
  })
})

describe('DateTime start/end of period', () => {
  const dt = DateTime.create(2024, 6, 15, 14, 30, 45)

  it('startOfDay', () => {
    const result = dt.startOfDay()
    expect(result.hour).toBe(0)
    expect(result.minute).toBe(0)
    expect(result.second).toBe(0)
    expect(result.day).toBe(15)
  })

  it('endOfDay', () => {
    const result = dt.endOfDay()
    expect(result.hour).toBe(23)
    expect(result.minute).toBe(59)
    expect(result.second).toBe(59)
    expect(result.day).toBe(15)
  })

  it('startOfMonth', () => {
    const result = dt.startOfMonth()
    expect(result.day).toBe(1)
    expect(result.hour).toBe(0)
    expect(result.minute).toBe(0)
    expect(result.month).toBe(6)
  })

  it('endOfMonth (June has 30 days)', () => {
    const result = dt.endOfMonth()
    expect(result.day).toBe(30)
    expect(result.hour).toBe(23)
    expect(result.minute).toBe(59)
    expect(result.month).toBe(6)
  })

  it('endOfMonth (Feb 2024 leap year)', () => {
    const feb = DateTime.create(2024, 2, 10)
    expect(feb.endOfMonth().day).toBe(29)
  })

  it('endOfMonth (Feb 2023 non-leap year)', () => {
    const feb = DateTime.create(2023, 2, 10)
    expect(feb.endOfMonth().day).toBe(28)
  })

  it('startOfYear', () => {
    const result = dt.startOfYear()
    expect(result.month).toBe(1)
    expect(result.day).toBe(1)
    expect(result.hour).toBe(0)
    expect(result.year).toBe(2024)
  })

  it('endOfYear', () => {
    const result = dt.endOfYear()
    expect(result.month).toBe(12)
    expect(result.day).toBe(31)
    expect(result.hour).toBe(23)
    expect(result.minute).toBe(59)
    expect(result.year).toBe(2024)
  })

  it('original is unchanged after start/endOfDay', () => {
    dt.startOfDay()
    dt.endOfDay()
    expect(dt.hour).toBe(14)
    expect(dt.minute).toBe(30)
  })
})

describe('DateTime comparisons', () => {
  const earlier = DateTime.create(2024, 1, 1, 0, 0, 0)
  const later = DateTime.create(2024, 12, 31, 23, 59, 59)

  it('isBefore', () => {
    expect(earlier.isBefore(later)).toBe(true)
    expect(later.isBefore(earlier)).toBe(false)
  })

  it('isAfter', () => {
    expect(later.isAfter(earlier)).toBe(true)
    expect(earlier.isAfter(later)).toBe(false)
  })

  it('isSame', () => {
    const a = DateTime.create(2024, 6, 15, 10, 30, 0)
    const b = DateTime.create(2024, 6, 15, 10, 30, 0)
    expect(a.isSame(b)).toBe(true)
    expect(a.isSame(later)).toBe(false)
  })

  it('isSameDay', () => {
    const a = DateTime.create(2024, 6, 15, 0, 0, 0)
    const b = DateTime.create(2024, 6, 15, 23, 59, 59)
    const c = DateTime.create(2024, 6, 16, 0, 0, 0)
    expect(a.isSameDay(b)).toBe(true)
    expect(a.isSameDay(c)).toBe(false)
  })

  it('isSameDay with native Date', () => {
    const dt = DateTime.create(2024, 6, 15, 10, 0, 0)
    const native = new Date(2024, 5, 15, 20, 0, 0)
    expect(dt.isSameDay(native)).toBe(true)
  })

  it('isBetween', () => {
    const mid = DateTime.create(2024, 6, 15)
    expect(mid.isBetween(earlier, later)).toBe(true)
    expect(earlier.isBetween(mid, later)).toBe(false)
  })

  it('isBefore/isAfter with native Date', () => {
    const dt = DateTime.create(2024, 6, 15)
    const nativeBefore = new Date(2024, 0, 1)
    const nativeAfter = new Date(2024, 11, 31)
    expect(dt.isAfter(nativeBefore)).toBe(true)
    expect(dt.isBefore(nativeAfter)).toBe(true)
  })

  it('isPast', () => {
    const pastDt = DateTime.create(2000, 1, 1)
    expect(pastDt.isPast()).toBe(true)
  })

  it('isFuture', () => {
    const futureDt = DateTime.create(2099, 1, 1)
    expect(futureDt.isFuture()).toBe(true)
  })

  it('isToday', () => {
    const todayDt = DateTime.now()
    expect(todayDt.isToday()).toBe(true)
    const yesterday = DateTime.now().subDays(1)
    expect(yesterday.isToday()).toBe(false)
  })
})

describe('DateTime.isLeapYear', () => {
  it('2024 is a leap year', () => {
    expect(DateTime.create(2024).isLeapYear()).toBe(true)
  })

  it('2023 is not a leap year', () => {
    expect(DateTime.create(2023).isLeapYear()).toBe(false)
  })

  it('2000 is a leap year (divisible by 400)', () => {
    expect(DateTime.create(2000).isLeapYear()).toBe(true)
  })

  it('1900 is not a leap year (divisible by 100 but not 400)', () => {
    expect(DateTime.create(1900).isLeapYear()).toBe(false)
  })

  it('2100 is not a leap year', () => {
    expect(DateTime.create(2100).isLeapYear()).toBe(false)
  })
})

describe('DateTime difference methods', () => {
  it('diffInSeconds', () => {
    const a = DateTime.create(2024, 1, 1, 0, 0, 0)
    const b = DateTime.create(2024, 1, 1, 0, 0, 30)
    expect(b.diffInSeconds(a)).toBe(30)
    expect(a.diffInSeconds(b)).toBe(-30)
  })

  it('diffInMinutes', () => {
    const a = DateTime.create(2024, 1, 1, 0, 0, 0)
    const b = DateTime.create(2024, 1, 1, 0, 45, 0)
    expect(b.diffInMinutes(a)).toBe(45)
  })

  it('diffInHours', () => {
    const a = DateTime.create(2024, 1, 1, 0, 0, 0)
    const b = DateTime.create(2024, 1, 1, 5, 0, 0)
    expect(b.diffInHours(a)).toBe(5)
  })

  it('diffInDays', () => {
    const a = DateTime.create(2024, 1, 1)
    const b = DateTime.create(2024, 1, 15)
    expect(b.diffInDays(a)).toBe(14)
    expect(a.diffInDays(b)).toBe(-14)
  })

  it('diffInDays across months', () => {
    const a = DateTime.create(2024, 1, 1)
    const b = DateTime.create(2024, 3, 1)
    expect(b.diffInDays(a)).toBe(60) // 31 (Jan) + 29 (Feb 2024 leap)
  })

  it('diff with native Date', () => {
    const dt = DateTime.create(2024, 1, 10)
    const native = new Date(2024, 0, 1)
    expect(dt.diffInDays(native)).toBe(9)
  })
})

describe('DateTime conversion methods', () => {
  it('toNativeDate returns a Date copy', () => {
    const dt = DateTime.create(2024, 6, 15, 10, 30, 0)
    const native = dt.toNativeDate()
    expect(native).toBeInstanceOf(Date)
    expect(native.getFullYear()).toBe(2024)
    // Modifying the native date should not affect the DateTime
    native.setFullYear(2000)
    expect(dt.year).toBe(2024)
  })

  it('toJSON returns ISO string', () => {
    const dt = DateTime.create(2024, 6, 15, 10, 30, 0)
    const json = dt.toJSON()
    expect(json).toContain('2024-06-15')
    expect(json).toContain('T')
  })

  it('valueOf returns timestamp', () => {
    const dt = DateTime.create(2024, 6, 15, 10, 30, 0)
    expect(dt.valueOf()).toBe(dt.timestamp)
  })

  it('JSON.stringify uses toJSON', () => {
    const dt = DateTime.create(2024, 6, 15)
    const json = JSON.stringify({ date: dt })
    expect(json).toContain('2024-06-15')
  })
})

describe('DateTime chaining', () => {
  it('multiple operations can be chained', () => {
    const result = DateTime.create(2024, 1, 1)
      .addMonths(5)
      .addDays(14)
      .setHour(10)
      .setMinute(30)
      .startOfDay()

    expect(result.year).toBe(2024)
    expect(result.month).toBe(6)
    expect(result.day).toBe(15)
    expect(result.hour).toBe(0)
    expect(result.minute).toBe(0)
  })

  it('chain with formatting', () => {
    const str = DateTime.create(2024, 3, 15)
      .addDays(1)
      .toDateString()
    expect(str).toBe('2024-03-16')
  })

  it('chain sub and add', () => {
    const dt = DateTime.create(2024, 6, 15, 12, 0, 0)
    const result = dt.addHours(3).subMinutes(30)
    expect(result.hour).toBe(14)
    expect(result.minute).toBe(30)
  })
})

describe('DateTime edge cases', () => {
  it('leap year Feb 29', () => {
    const dt = DateTime.create(2024, 2, 29)
    expect(dt.month).toBe(2)
    expect(dt.day).toBe(29)
    expect(dt.isLeapYear()).toBe(true)
  })

  it('midnight', () => {
    const dt = DateTime.create(2024, 1, 1, 0, 0, 0)
    expect(dt.hour).toBe(0)
    expect(dt.format('HH:mm:ss')).toBe('00:00:00')
  })

  it('end of day', () => {
    const dt = DateTime.create(2024, 1, 1, 23, 59, 59)
    expect(dt.format('HH:mm:ss')).toBe('23:59:59')
  })

  it('year boundary crossing forward', () => {
    const dt = DateTime.create(2024, 12, 31, 23, 0, 0)
    const result = dt.addHours(2)
    expect(result.year).toBe(2025)
    expect(result.month).toBe(1)
    expect(result.day).toBe(1)
  })

  it('year boundary crossing backward', () => {
    const dt = DateTime.create(2025, 1, 1, 1, 0, 0)
    const result = dt.subHours(2)
    expect(result.year).toBe(2024)
    expect(result.month).toBe(12)
    expect(result.day).toBe(31)
  })

  it('adding months to Jan 31 adjusts day', () => {
    const dt = DateTime.create(2024, 1, 31)
    const feb = dt.addMonths(1)
    // Feb 2024 has 29 days, so Jan 31 + 1 month = March 2 (JS Date behavior)
    // This is standard JS Date behavior
    expect(feb.month).toBeGreaterThanOrEqual(2)
  })

  it('endOfMonth handles all 12 months', () => {
    const expectedDays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] // 2024 leap year
    for (let m = 1; m <= 12; m++) {
      const dt = DateTime.create(2024, m, 1)
      expect(dt.endOfMonth().day).toBe(expectedDays[m - 1])
    }
  })

  it('constructor with no arguments is current time', () => {
    const before = Date.now()
    const dt = new DateTime()
    const after = Date.now()
    expect(dt.timestamp).toBeGreaterThanOrEqual(before)
    expect(dt.timestamp).toBeLessThanOrEqual(after)
  })
})
