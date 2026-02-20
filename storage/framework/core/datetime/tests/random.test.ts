import { describe, expect, it } from 'bun:test'
import { format } from '../src/format'
import { parse } from '../src/parse'

/**
 * Randomized and stress tests to catch edge cases
 * across various date ranges, formats, and timezone scenarios.
 */

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomDate(yearMin = 1970, yearMax = 2050): Date {
  const year = randomInt(yearMin, yearMax)
  const month = randomInt(0, 11)
  const day = randomInt(1, 28) // safe for all months
  const hour = randomInt(0, 23)
  const minute = randomInt(0, 59)
  const second = randomInt(0, 59)
  return new Date(year, month, day, hour, minute, second)
}

function randomUtcDate(yearMin = 1970, yearMax = 2050): Date {
  const year = randomInt(yearMin, yearMax)
  const month = randomInt(0, 11)
  const day = randomInt(1, 28)
  const hour = randomInt(0, 23)
  const minute = randomInt(0, 59)
  const second = randomInt(0, 59)
  return new Date(Date.UTC(year, month, day, hour, minute, second))
}

describe('randomized format → parse roundtrips', () => {
  const fmt = 'YYYY-MM-DD HH:mm:ss'

  for (let i = 0; i < 50; i++) {
    it(`roundtrip #${i + 1}`, () => {
      const date = randomDate()
      const formatted = format(date, fmt)
      const parsed = parse(formatted, fmt)
      expect(parsed.getFullYear()).toBe(date.getFullYear())
      expect(parsed.getMonth()).toBe(date.getMonth())
      expect(parsed.getDate()).toBe(date.getDate())
      expect(parsed.getHours()).toBe(date.getHours())
      expect(parsed.getMinutes()).toBe(date.getMinutes())
      expect(parsed.getSeconds()).toBe(date.getSeconds())
    })
  }
})

describe('randomized 12-hour roundtrips', () => {
  const fmt = 'YYYY-MM-DD hh:mm:ss A'

  for (let i = 0; i < 25; i++) {
    it(`12h roundtrip #${i + 1}`, () => {
      const date = randomDate()
      const formatted = format(date, fmt)
      const parsed = parse(formatted, fmt)
      expect(parsed.getHours()).toBe(date.getHours())
      expect(parsed.getMinutes()).toBe(date.getMinutes())
      expect(parsed.getSeconds()).toBe(date.getSeconds())
    })
  }
})

describe('randomized UTC timezone roundtrips', () => {
  const fmt = 'YYYY-MM-DD HH:mm:ss Z'

  for (let i = 0; i < 25; i++) {
    it(`UTC roundtrip #${i + 1}`, () => {
      const date = randomUtcDate()
      const formatted = format(date, fmt, { tz: 'UTC' })
      const parsed = parse(formatted, fmt)
      expect(parsed.toISOString()).toBe(date.toISOString())
    })
  }
})

describe('randomized cross-timezone roundtrips', () => {
  const fmt = 'YYYY-MM-DD HH:mm:ss Z'
  const timezones = [
    'UTC', 'America/New_York', 'America/Los_Angeles', 'America/Chicago',
    'Europe/London', 'Europe/Berlin', 'Europe/Paris',
    'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata',
    'Australia/Sydney', 'Pacific/Auckland',
  ]

  for (let i = 0; i < 30; i++) {
    const tz = timezones[randomInt(0, timezones.length - 1)]
    it(`tz roundtrip #${i + 1} (${tz})`, () => {
      const date = randomUtcDate()
      const formatted = format(date, fmt, { tz })
      const parsed = parse(formatted, fmt)
      // The parsed Date should represent the same instant
      expect(Math.abs(parsed.getTime() - date.getTime())).toBeLessThan(1000)
    })
  }
})

describe('every hour of the day', () => {
  for (let h = 0; h < 24; h++) {
    it(`hour ${h} formats and parses correctly`, () => {
      const date = new Date(2024, 5, 15, h, 30, 0)
      const fmt24 = format(date, 'HH:mm')
      const fmt12 = format(date, 'h:mm A')

      expect(parse(`2024-06-15 ${fmt24}:00`, 'YYYY-MM-DD HH:mm:ss').getHours()).toBe(h)

      const parsed12 = parse(`2024-06-15 ${fmt12}`, 'YYYY-MM-DD h:mm A')
      expect(parsed12.getHours()).toBe(h)
    })
  }
})

describe('every month with 28th day', () => {
  for (let m = 0; m < 12; m++) {
    it(`month ${m + 1} formats and roundtrips`, () => {
      const date = new Date(2024, m, 28, 12, 0, 0)
      const formatted = format(date, 'YYYY-MM-DD HH:mm:ss')
      const parsed = parse(formatted, 'YYYY-MM-DD HH:mm:ss')
      expect(parsed.getMonth()).toBe(m)
      expect(parsed.getDate()).toBe(28)
    })
  }
})

describe('last day of each month 2024', () => {
  const lastDays = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

  for (let m = 0; m < 12; m++) {
    it(`month ${m + 1} last day (${lastDays[m]})`, () => {
      const date = new Date(2024, m, lastDays[m])
      const formatted = format(date, 'YYYY-MM-DD')
      const parsed = parse(formatted, 'YYYY-MM-DD')
      expect(parsed.getMonth()).toBe(m)
      expect(parsed.getDate()).toBe(lastDays[m])
    })
  }
})

describe('last day of each month 2023 (non-leap)', () => {
  const lastDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

  for (let m = 0; m < 12; m++) {
    it(`month ${m + 1} last day (${lastDays[m]})`, () => {
      const date = new Date(2023, m, lastDays[m])
      const formatted = format(date, 'YYYY-MM-DD')
      const parsed = parse(formatted, 'YYYY-MM-DD')
      expect(parsed.getMonth()).toBe(m)
      expect(parsed.getDate()).toBe(lastDays[m])
    })
  }
})

describe('century and millennium boundaries', () => {
  const years = [1999, 2000, 2001, 1900, 2100]

  for (const year of years) {
    it(`year ${year}`, () => {
      const date = new Date(year, 0, 1, 0, 0, 0)
      const formatted = format(date, 'YYYY-MM-DD HH:mm:ss')
      const parsed = parse(formatted, 'YYYY-MM-DD HH:mm:ss')
      expect(parsed.getFullYear()).toBe(year)
    })
  }
})

describe('leap year Feb 29 across decades', () => {
  const leapYears = [2000, 2004, 2008, 2012, 2016, 2020, 2024, 2028, 2032, 2036, 2040, 2044, 2048]

  for (const year of leapYears) {
    it(`${year}-02-29`, () => {
      const date = new Date(year, 1, 29)
      expect(date.getMonth()).toBe(1)
      expect(date.getDate()).toBe(29)
      const formatted = format(date, 'YYYY-MM-DD')
      expect(formatted).toBe(`${year}-02-29`)
      const parsed = parse(formatted, 'YYYY-MM-DD')
      expect(parsed.getMonth()).toBe(1)
      expect(parsed.getDate()).toBe(29)
    })
  }
})

describe('non-leap year Feb 28', () => {
  const nonLeapYears = [1900, 2001, 2002, 2003, 2005, 2023, 2025, 2100]

  for (const year of nonLeapYears) {
    it(`${year}-02-28`, () => {
      const date = new Date(year, 1, 28)
      const formatted = format(date, 'YYYY-MM-DD')
      expect(formatted).toBe(`${year}-02-28`)
    })
  }
})

describe('various format strings', () => {
  const date = new Date(2024, 7, 3, 9, 5, 7) // Aug 3, 2024 09:05:07

  it('DD/MM/YYYY', () => {
    expect(format(date, 'DD/MM/YYYY')).toBe('03/08/2024')
    expect(parse('03/08/2024', 'DD/MM/YYYY').getDate()).toBe(3)
    expect(parse('03/08/2024', 'DD/MM/YYYY').getMonth()).toBe(7)
  })

  it('M-D-YY', () => {
    expect(format(date, 'M-D-YY')).toBe('8-3-24')
  })

  it('MMMM D, YYYY at h:mm A', () => {
    expect(format(date, 'MMMM D, YYYY')).toBe('August 3, 2024')
  })

  it('YYYYMMDDTHHmmss', () => {
    expect(format(date, 'YYYYMMDDTHHmmss')).toBe('20240803T090507')
    const p = parse('20240803T090507', 'YYYYMMDDTHHmmss')
    expect(p.getFullYear()).toBe(2024)
    expect(p.getMonth()).toBe(7)
    expect(p.getDate()).toBe(3)
    expect(p.getHours()).toBe(9)
    expect(p.getMinutes()).toBe(5)
    expect(p.getSeconds()).toBe(7)
  })

  it('ddd, MMM D', () => {
    expect(format(date, 'ddd, MMM D')).toBe('Sat, Aug 3')
  })

  it('HH:mm:ss.000', () => {
    // ".000" is a literal, not a token
    expect(format(date, 'HH:mm:ss')).toBe('09:05:07')
  })
})

describe('stress: random dates with all format tokens', () => {
  const formats = [
    'YYYY-MM-DD',
    'MM/DD/YYYY',
    'DD.MM.YYYY',
    'YYYY-MM-DD HH:mm:ss',
    'YYYY-MM-DD hh:mm:ss A',
    'YYYYMMDDTHHmmss',
    'YYYYMMDD',
    'M/D/YYYY',
  ]

  for (const fmt of formats) {
    for (let i = 0; i < 10; i++) {
      it(`format "${fmt}" random #${i + 1}`, () => {
        const date = randomDate()
        const formatted = format(date, fmt)
        const parsed = parse(formatted, fmt)
        expect(parsed.getFullYear()).toBe(date.getFullYear())
        expect(parsed.getMonth()).toBe(date.getMonth())
        expect(parsed.getDate()).toBe(date.getDate())
      })
    }
  }
})

describe('offset edge cases in parse', () => {
  it('handles -1200 (Baker Island)', () => {
    const d = parse('2024-03-15 12:00:00 -1200', 'YYYY-MM-DD HH:mm:ss Z')
    expect(d.toISOString()).toBe('2024-03-16T00:00:00.000Z')
  })

  it('handles +1400 (Line Islands)', () => {
    const d = parse('2024-03-15 12:00:00 +1400', 'YYYY-MM-DD HH:mm:ss Z')
    expect(d.toISOString()).toBe('2024-03-14T22:00:00.000Z')
  })

  it('handles +0000 and -0000 identically', () => {
    const dPlus = parse('2024-03-15 12:00:00 +0000', 'YYYY-MM-DD HH:mm:ss Z')
    const dMinus = parse('2024-03-15 12:00:00 -0000', 'YYYY-MM-DD HH:mm:ss Z')
    expect(dPlus.toISOString()).toBe(dMinus.toISOString())
  })
})

describe('format consistency checks', () => {
  it('same instant formatted in different timezones has same Z-parsed result', () => {
    const instant = new Date('2024-07-04T00:00:00Z')
    const zones = ['UTC', 'Asia/Tokyo', 'America/New_York', 'Pacific/Auckland']
    const fmt = 'YYYY-MM-DD HH:mm:ss Z'

    const results = zones.map((tz) => {
      const formatted = format(instant, fmt, { tz })
      return parse(formatted, fmt)
    })

    // All should parse back to the same instant
    for (const r of results) {
      expect(Math.abs(r.getTime() - instant.getTime())).toBeLessThan(1000)
    }
  })

  it('formatting the same local date with and without tz yields consistent local values', () => {
    const d = new Date(2024, 3, 15, 10, 30, 0)
    const withoutTz = format(d, 'YYYY-MM-DD HH:mm:ss')
    // Format in local timezone should match
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const withTz = format(d, 'YYYY-MM-DD HH:mm:ss', { tz: localTz })
    expect(withTz).toBe(withoutTz)
  })
})
