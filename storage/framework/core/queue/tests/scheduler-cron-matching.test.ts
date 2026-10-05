import { afterEach, describe, expect, it, setSystemTime } from 'bun:test'
import { calculateNextRun, scheduledDispatchOptions, shouldRunNow } from '../src/scheduler'

/**
 * The queue scheduler's own cron matcher, replaced by @stacksjs/cron:
 *
 * - "already ran this minute" compared minute, hour and day only, so a
 *   monthly job's last run on the 1st at 00:00 blocked the next 1st at 00:00
 *   too - it ran once and never again, and the marker survives restarts;
 * - `-` was checked before `/`, so `0-30/10` matched every minute up to 30;
 * - list items were parsed as bare integers, so `1-5,30` meant `1,30`;
 * - day-of-month and day-of-week were ANDed, where cron ORs them.
 */
const UTC = 'UTC'

afterEach(() => setSystemTime())

function at(iso: string): void {
  setSystemTime(new Date(iso))
}

describe('shouldRunNow', () => {
  it('runs a monthly job again a month after its last run', () => {
    at('2026-10-01T00:00:30Z')
    expect(shouldRunNow('0 0 1 * *', new Date('2026-09-01T00:00:05Z'), UTC)).toBe(true)
  })

  it('still runs a job only once within the same minute', () => {
    at('2026-10-01T00:00:40Z')
    expect(shouldRunNow('0 0 1 * *', new Date('2026-10-01T00:00:05Z'), UTC)).toBe(false)
  })

  it('reads a range with a step', () => {
    at('2026-10-05T10:05:00Z')
    expect(shouldRunNow('0-30/10 * * * *', null, UTC)).toBe(false)
    at('2026-10-05T10:10:00Z')
    expect(shouldRunNow('0-30/10 * * * *', null, UTC)).toBe(true)
  })

  it('reads a list that contains a range', () => {
    at('2026-10-05T10:02:00Z')
    expect(shouldRunNow('1-5,30 * * * *', null, UTC)).toBe(true)
  })

  it('ORs day-of-month with day-of-week', () => {
    // Monday 2026-10-12, not the 15th.
    at('2026-10-12T12:00:00Z')
    expect(shouldRunNow('0 12 15 * 1', null, UTC)).toBe(true)
  })

  it('is false for an expression that cannot be parsed', () => {
    at('2026-10-05T10:00:00Z')
    expect(shouldRunNow('not a cron', null, UTC)).toBe(false)
  })
})

describe('calculateNextRun', () => {
  it('finds the next step in a stepped range', () => {
    at('2026-10-05T09:00:30Z')
    expect(calculateNextRun('0 9-17/4 * * *', UTC)?.toISOString()).toBe('2026-10-05T13:00:00.000Z')
  })
})

describe('scheduledDispatchOptions', () => {
  it('imposes no timeout the job did not declare', () => {
    expect(scheduledDispatchOptions({ tries: 2 }).timeout).toBeUndefined()
  })

  it('passes the job\'s own timeout, tries and backoff through', () => {
    expect(scheduledDispatchOptions({ queue: 'reports', tries: 5, timeout: 600, backoff: [30, 60] })).toEqual({
      queue: 'reports',
      payload: {},
      maxTries: 5,
      timeout: 600,
      backoff: [30, 60],
    })
    expect(scheduledDispatchOptions({ backoff: 3 }).backoff).toBe(3)
  })

  it('defaults to three tries on the default queue', () => {
    expect(scheduledDispatchOptions({})).toMatchObject({ queue: 'default', maxTries: 3 })
  })
})
