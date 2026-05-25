import { describe, expect, test } from 'bun:test'

const { Schedule, schedule } = await import('../src/schedule')

// stacksjs/stacks#930 — schedule.notification() factory.

describe('Schedule.notification', () => {
  test('exposes a static factory', () => {
    expect(typeof Schedule.notification).toBe('function')
  })

  test('returns a chainable Schedule instance', () => {
    const job = Schedule.notification(
      { email: 'team@example.com' },
      { subject: 'Daily', text: 'Hello' },
      ['email'],
    )
    expect(job).toBeDefined()
    // Every cadence helper should be present on the returned chain
    expect(typeof (job as any).daily).toBe('function')
    expect(typeof (job as any).hourly).toBe('function')
    expect(typeof (job as any).everyMinute).toBe('function')
  })

  test('accepts the same signature shape as notify()', () => {
    // recipient + payload + channels + options — all four positional args
    expect(() =>
      Schedule.notification(
        { email: 'a@b.com', userId: 1 },
        { subject: 's', text: 't' },
        ['email', 'sms'],
        { ignorePreferences: true, category: 'system' },
      ),
    ).not.toThrow()
  })

  test('schedule singleton mirrors the static surface', () => {
    expect(typeof (schedule as any).notification).toBe('function')
  })
})
