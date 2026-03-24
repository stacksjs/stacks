import { describe, expect, test } from 'bun:test'

// ---------------------------------------------------------------------------
// Import the real Schedule class directly — no mocks.
// The Schedule constructor sets a setTimeout(0) to auto-start, but since we
// only test cron pattern generation (synchronous), the timer fires after
// our assertions. The start() method may fail due to missing deps at runtime,
// but that's fine — we only care about the pattern property.
// ---------------------------------------------------------------------------

const { Schedule } = await import('../src/schedule')

/**
 * We test the Schedule class pattern generation without triggering
 * the auto-start side effect. We create a Schedule instance via a
 * thin wrapper that exposes the cron pattern before setTimeout fires.
 */
function patternOf(configureFn: (s: Schedule) => void): string {
  const s = new Schedule(() => {})
  configureFn(s)
  return s.pattern
}

describe('@stacksjs/scheduler - cron patterns', () => {
  test('daily() creates "0 0 * * *"', () => {
    expect(patternOf(s => s.daily())).toBe('0 0 * * *')
  })

  test('hourly() creates "0 * * * *"', () => {
    expect(patternOf(s => s.hourly())).toBe('0 * * * *')
  })

  test('weekly() creates "0 0 * * 0"', () => {
    expect(patternOf(s => s.weekly())).toBe('0 0 * * 0')
  })

  test('monthly() creates "0 0 1 * *"', () => {
    expect(patternOf(s => s.monthly())).toBe('0 0 1 * *')
  })

  test('yearly() creates "0 0 1 1 *"', () => {
    expect(patternOf(s => s.yearly())).toBe('0 0 1 1 *')
  })

  test('at("14:30") creates "30 14 * * *"', () => {
    expect(patternOf(s => s.at('14:30'))).toBe('30 14 * * *')
  })

  test('at("00:00") creates "0 0 * * *"', () => {
    expect(patternOf(s => s.at('00:00'))).toBe('0 0 * * *')
  })

  test('at("23:59") creates "59 23 * * *"', () => {
    expect(patternOf(s => s.at('23:59'))).toBe('59 23 * * *')
  })

  test('at() validates hour out of range', () => {
    expect(() => patternOf(s => s.at('25:00'))).toThrow()
  })

  test('at() validates minute out of range', () => {
    expect(() => patternOf(s => s.at('12:60'))).toThrow()
  })

  test('at() validates invalid format', () => {
    expect(() => patternOf(s => s.at('abc'))).toThrow()
  })

  test('everyMinute() creates "* * * * *"', () => {
    expect(patternOf(s => s.everyMinute())).toBe('* * * * *')
  })

  test('everyFiveMinutes() creates "*/5 * * * *"', () => {
    expect(patternOf(s => s.everyFiveMinutes())).toBe('*/5 * * * *')
  })

  test('everyTenMinutes() creates "*/10 * * * *"', () => {
    expect(patternOf(s => s.everyTenMinutes())).toBe('*/10 * * * *')
  })

  test('everyThirtyMinutes() creates "*/30 * * * *"', () => {
    expect(patternOf(s => s.everyThirtyMinutes())).toBe('*/30 * * * *')
  })

  test('setTimeZone returns this for chaining', () => {
    const s = new Schedule(() => {})
    const result = s.setTimeZone('America/New_York')
    expect(result).toBe(s)
  })

  test('Schedule stores callback', () => {
    const fn = () => {}
    const s = new Schedule(fn)
    expect(s).toBeDefined()
  })

  test('chaining daily().at()', () => {
    const s = new Schedule(() => {})
    s.daily()
    s.at('09:00')
    expect(s.pattern).toBe('0 9 * * *')
  })
})
