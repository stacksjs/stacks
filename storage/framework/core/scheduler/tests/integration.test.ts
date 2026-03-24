import { describe, expect, test } from 'bun:test'
import { Schedule, sendAt, timeout } from '../src/schedule'

// ---------------------------------------------------------------------------
// Schedule - cron patterns from timing methods
// ---------------------------------------------------------------------------
describe('Schedule cron patterns', () => {
  // We construct Schedule instances directly and check the pattern getter.
  // The constructor auto-starts via setTimeout(0), but that fires after our
  // sync assertions, so it is safe to read the pattern synchronously.

  test('daily() sets pattern to run at midnight', () => {
    const s = new Schedule(() => {})
    s.daily()
    expect(s.pattern).toBe('0 0 * * *')
  })

  test('hourly() sets pattern to run every hour', () => {
    const s = new Schedule(() => {})
    s.hourly()
    expect(s.pattern).toBe('0 * * * *')
  })

  test('weekly() sets pattern to run on Sunday at midnight', () => {
    const s = new Schedule(() => {})
    s.weekly()
    expect(s.pattern).toBe('0 0 * * 0')
  })

  test('monthly() sets pattern to run on 1st at midnight', () => {
    const s = new Schedule(() => {})
    s.monthly()
    expect(s.pattern).toBe('0 0 1 * *')
  })

  test('yearly() sets pattern to run Jan 1 at midnight', () => {
    const s = new Schedule(() => {})
    s.yearly()
    expect(s.pattern).toBe('0 0 1 1 *')
  })

  test('annually() is alias for yearly()', () => {
    const s = new Schedule(() => {})
    s.annually()
    expect(s.pattern).toBe('0 0 1 1 *')
  })

  test('everyMinute() sets pattern to every minute', () => {
    const s = new Schedule(() => {})
    s.everyMinute()
    expect(s.pattern).toBe('* * * * *')
  })

  test('everyFiveMinutes() sets correct pattern', () => {
    const s = new Schedule(() => {})
    s.everyFiveMinutes()
    expect(s.pattern).toBe('*/5 * * * *')
  })

  test('everyTenMinutes() sets correct pattern', () => {
    const s = new Schedule(() => {})
    s.everyTenMinutes()
    expect(s.pattern).toBe('*/10 * * * *')
  })

  test('everyThirtyMinutes() sets correct pattern', () => {
    const s = new Schedule(() => {})
    s.everyThirtyMinutes()
    expect(s.pattern).toBe('*/30 * * * *')
  })

  test('everyHour() sets correct pattern', () => {
    const s = new Schedule(() => {})
    s.everyHour()
    expect(s.pattern).toBe('0 * * * *')
  })

  test('everyDay() sets correct pattern', () => {
    const s = new Schedule(() => {})
    s.everyDay()
    expect(s.pattern).toBe('0 0 * * *')
  })
})

// ---------------------------------------------------------------------------
// at() validation
// ---------------------------------------------------------------------------
describe('at() time validation', () => {
  test('valid time "09:00" sets correct pattern', () => {
    const s = new Schedule(() => {})
    s.at('09:00')
    expect(s.pattern).toBe('0 9 * * *')
  })

  test('valid time "23:59" sets correct pattern', () => {
    const s = new Schedule(() => {})
    s.at('23:59')
    expect(s.pattern).toBe('59 23 * * *')
  })

  test('valid time "00:00" sets correct pattern', () => {
    const s = new Schedule(() => {})
    s.at('00:00')
    expect(s.pattern).toBe('0 0 * * *')
  })

  test('invalid time format throws', () => {
    const s = new Schedule(() => {})
    expect(() => s.at('9am')).toThrow('Invalid time format')
  })

  test('out-of-range hour throws', () => {
    const s = new Schedule(() => {})
    expect(() => s.at('25:00')).toThrow('Invalid time')
  })

  test('out-of-range minute throws', () => {
    const s = new Schedule(() => {})
    expect(() => s.at('12:60')).toThrow('Invalid time')
  })
})

// ---------------------------------------------------------------------------
// setTimeZone
// ---------------------------------------------------------------------------
describe('setTimeZone', () => {
  test('stores timezone without error', () => {
    const s = new Schedule(() => {})
    const result = s.setTimeZone('America/New_York')
    // setTimeZone returns this for chaining
    expect(result).toBe(s)
  })
})

// ---------------------------------------------------------------------------
// Chaining: daily().at()
// ---------------------------------------------------------------------------
describe('Chaining', () => {
  test('daily then at overrides pattern with at pattern', () => {
    const s = new Schedule(() => {})
    s.daily()
    expect(s.pattern).toBe('0 0 * * *')
    s.at('09:30')
    // at() overrides pattern to specific time
    expect(s.pattern).toBe('30 9 * * *')
  })

  test('onDays sets correct pattern', () => {
    const s = new Schedule(() => {})
    s.onDays([1, 3, 5])
    expect(s.pattern).toBe('0 0 * * 1,3,5')
  })
})

// ---------------------------------------------------------------------------
// sendAt / timeout helpers
// ---------------------------------------------------------------------------
describe('sendAt', () => {
  test('returns a Date for a valid cron expression', () => {
    const next = sendAt('* * * * *')
    expect(next).toBeInstanceOf(Date)
    // next run should be in the future
    expect(next!.getTime()).toBeGreaterThan(Date.now() - 1000)
  })

  test('returns the given Date if in the future', () => {
    const future = new Date(Date.now() + 60_000)
    expect(sendAt(future)).toEqual(future)
  })

  test('returns null for a Date in the past', () => {
    const past = new Date(Date.now() - 60_000)
    expect(sendAt(past)).toBeNull()
  })
})

describe('timeout', () => {
  test('returns positive ms for every-minute cron', () => {
    const ms = timeout('* * * * *')
    expect(ms).toBeGreaterThanOrEqual(0)
    expect(ms).toBeLessThanOrEqual(60_000)
  })
})
