import { afterEach, describe, expect, test } from 'bun:test'
import { config } from '@stacksjs/config'
import { Schedule } from '../src/schedule'

// stacksjs/stacks#3080. Every task started in America/Los_Angeles and nothing
// read config.app.timezone, so a 09:00 task in a Berlin app ran at 17:00.

const app = (config as unknown as { app: { timezone?: string } }).app
const configured = app.timezone
const realNow = Date.now

afterEach(() => {
  app.timezone = configured
  Date.now = realNow
})

/** A task on `pattern` with no timers, as run-missed.test.ts builds one. */
function task(pattern: string, onRun: () => void = () => {}): Schedule {
  const sched = new Schedule(onRun)
  ;(sched as unknown as { cronPattern: string }).cronPattern = pattern
  return sched
}

function nextRun(sched: Schedule): Date | null {
  return (sched as unknown as { getNextRunTime: () => Date | null }).getNextRunTime()
}

describe('a task with no timezone of its own', () => {
  test('runs on config.app.timezone', async () => {
    app.timezone = 'Asia/Tokyo'
    // 09:00 in Tokyo is 00:00 UTC, and 17:00 the day before in Los Angeles.
    const NOW = new Date('2026-06-15T00:30:00Z').getTime()
    Date.now = () => NOW

    let calls = 0
    const sched = task('0 9 * * *', () => { calls++ })

    expect(await sched.runMissed({ since: new Date(NOW - 60 * 60_000) })).toBe(1)
    expect(calls).toBe(1)
    expect(nextRun(sched)?.toISOString()).toBe('2026-06-16T00:00:00.000Z')
  })

  test('runs on UTC when the app sets no timezone', async () => {
    app.timezone = undefined
    const NOW = new Date('2026-06-15T09:30:00Z').getTime()
    Date.now = () => NOW

    const sched = task('0 9 * * *')

    expect(await sched.runMissed({ since: new Date(NOW - 60 * 60_000) })).toBe(1)
    expect(nextRun(sched)?.toISOString()).toBe('2026-06-16T09:00:00.000Z')
  })
})

describe('a task with setTimeZone()', () => {
  test('keeps its own timezone over the app\'s', () => {
    app.timezone = 'Asia/Tokyo'
    Date.now = () => new Date('2026-06-15T00:30:00Z').getTime()

    const sched = task('0 9 * * *')
    sched.setTimeZone('Europe/Berlin')

    // 09:00 in Berlin in June is 07:00 UTC.
    expect(nextRun(sched)?.toISOString()).toBe('2026-06-15T07:00:00.000Z')
  })
})
