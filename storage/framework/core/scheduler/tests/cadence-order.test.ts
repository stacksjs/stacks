import { describe, expect, test } from 'bun:test'

const { Schedule } = await import('../src/schedule')

function patternOf(configureFn: (s: Schedule) => void): string {
  const s = new Schedule(() => {})
  configureFn(s)
  return s.pattern
}

// A cron expression carries two independent axes: the time of day (minute,
// hour) and which days it falls on (day-of-month, month, day-of-week). Every
// cadence method owns one axis, so calling two of them in either order has to
// land on the same pattern. It did not: `at()` and `weekdays()` composed and
// the rest assigned outright, so `.at('09:00').onDays([2])` ran at midnight.
describe('@stacksjs/scheduler - cadence methods compose in either order', () => {
  const dayAxis: Array<[string, (s: Schedule) => void]> = [
    ['daily', s => s.daily()],
    ['everyDay', s => s.everyDay()],
    ['weekly', s => s.weekly()],
    ['monthly', s => s.monthly()],
    ['yearly', s => s.yearly()],
    ['annually', s => s.annually()],
    ['weekdays', s => s.weekdays()],
    ['onDays', s => s.onDays([2])],
  ]

  for (const [name, applyDays] of dayAxis) {
    test(`at() then ${name}() equals ${name}() then at()`, () => {
      const timeFirst = patternOf((s) => {
        s.at('09:00')
        applyDays(s)
      })
      const daysFirst = patternOf((s) => {
        applyDays(s)
        s.at('09:00')
      })
      expect(timeFirst).toBe(daysFirst)
    })

    test(`${name}() keeps a time of day already set`, () => {
      const pattern = patternOf((s) => {
        s.at('09:00')
        applyDays(s)
      })
      expect(pattern.split(' ').slice(0, 2)).toEqual(['0', '9'])
    })
  }

  // The sub-day cadences own the time axis, so they overwrite minute and hour
  // - but the days they run on are still the other axis, and dropping those
  // turned a Tuesday-only job into an every-day one.
  const timeAxis: Array<[string, (s: Schedule) => void, string]> = [
    ['everyMinute', s => s.everyMinute(), '* *'],
    ['everyFiveMinutes', s => s.everyFiveMinutes(), '*/5 *'],
    ['everyTenMinutes', s => s.everyTenMinutes(), '*/10 *'],
    ['everyThirtyMinutes', s => s.everyThirtyMinutes(), '*/30 *'],
    ['hourly', s => s.hourly(), '0 *'],
    ['everyHour', s => s.everyHour(), '0 *'],
  ]

  for (const [name, applyTime, expectedTime] of timeAxis) {
    test(`onDays() then ${name}() equals ${name}() then onDays()`, () => {
      const daysFirst = patternOf((s) => {
        s.onDays([2])
        applyTime(s)
      })
      const timeFirst = patternOf((s) => {
        applyTime(s)
        s.onDays([2])
      })
      expect(daysFirst).toBe(timeFirst)
      expect(daysFirst).toBe(`${expectedTime} * * 2`)
    })
  }

  // Each method still answers on its own exactly as it always has.
  test('the documented single-call patterns are unchanged', () => {
    expect(patternOf(s => s.daily())).toBe('0 0 * * *')
    expect(patternOf(s => s.weekly())).toBe('0 0 * * 0')
    expect(patternOf(s => s.monthly())).toBe('0 0 1 * *')
    expect(patternOf(s => s.yearly())).toBe('0 0 1 1 *')
    expect(patternOf(s => s.hourly())).toBe('0 * * * *')
    expect(patternOf(s => s.everyFiveMinutes())).toBe('*/5 * * * *')
    expect(patternOf(s => s.onDays([1, 3]))).toBe('0 0 * * 1,3')
    expect(patternOf(s => s.weekdays())).toBe('0 0 * * 1-5')
  })

  // start() reads intervalMs before cronPattern, so a seconds cadence left
  // behind outranks whatever pattern was set after it: .everySecond().daily()
  // kept ticking every second. Each cadence setter releases it.
  test('a cron cadence releases a seconds cadence set before it', () => {
    const cases: Array<[string, (s: Schedule) => void]> = [
      ['daily', s => s.daily()],
      ['weekly', s => s.weekly()],
      ['monthly', s => s.monthly()],
      ['yearly', s => s.yearly()],
      ['onDays', s => s.onDays([2])],
      ['weekdays', s => s.weekdays()],
      ['hourly', s => s.hourly()],
      ['everyMinute', s => s.everyMinute()],
      ['everyFiveMinutes', s => s.everyFiveMinutes()],
      ['at', s => s.at('09:00')],
    ]

    for (const [name, applyCron] of cases) {
      const s = new Schedule(() => {})
      s.everySecond()
      applyCron(s)
      const interval = (s as unknown as { intervalMs: number | null }).intervalMs
      expect({ [name]: interval }).toEqual({ [name]: null })
      expect({ [name]: s.pattern.split(/\s+/).length }).toEqual({ [name]: 5 })
    }
  })

  test('everySecond() on its own keeps its seconds cadence', () => {
    const s = new Schedule(() => {})
    s.everySecond()
    expect((s as unknown as { intervalMs: number | null }).intervalMs).toBe(1000)
    expect(s.pattern).toBe('@every_second')
  })

  // A cadence setter replaces the axis it owns rather than merging into it, so
  // the last day-selecting call wins instead of ORing with the one before.
  test('a later day cadence replaces the earlier one', () => {
    expect(patternOf(s => s.monthly().weekly())).toBe('0 0 * * 0')
    expect(patternOf(s => s.onDays([2]).monthly())).toBe('0 0 1 * *')
    expect(patternOf(s => s.yearly().daily())).toBe('0 0 * * *')
  })
})
