import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { log } from '@stacksjs/cli'

// stacksjs/stacks#1877 Cr-4 — pins the runMissed catchup contract.
// The helper walks the cron expression forward from `since` and
// invokes the task for each missed slot up to Date.now(), capped at
// `max`. Interval-based schedules (everySecond) don't have missed
// slots and return 0 + warn.

const ORIGINAL_DATE_NOW = Date.now.bind(Date)

afterEach(() => {
  // Restore mocked Date.now between tests so other suites aren't affected.
  Date.now = ORIGINAL_DATE_NOW
})

describe('Schedule.runMissed (stacksjs/stacks#1877 Cr-4)', () => {
  test('fires the task once per missed minute when "since" is N minutes ago', async () => {
    // Pin "now" to a known time so the cron walk is deterministic.
    const NOW = new Date('2026-06-15T10:05:30Z').getTime()
    Date.now = () => NOW

    let calls = 0
    const { Schedule } = await import('../src/schedule')
    const sched = new Schedule(() => { calls++ })
    // Don't call any .everyX() chain method — manually set the
    // cron pattern via the public accessor `withName` + reflection
    // would be ugly. The test just exercises runMissed against a
    // pre-set pattern; we set it directly.
    ;(sched as unknown as { cronPattern: string }).cronPattern = '* * * * *'

    // "since" = 5 minutes ago, so 5 slots are missed (10:01..10:05).
    const since = new Date(NOW - 5 * 60_000)
    const fired = await sched.runMissed({ since, max: 10 })

    expect(fired).toBe(5)
    expect(calls).toBe(5)
  })

  test('caps catch-up at `max` and warns when slots exceed it', async () => {
    const NOW = new Date('2026-06-15T10:00:00Z').getTime()
    Date.now = () => NOW

    let calls = 0
    const { Schedule } = await import('../src/schedule')
    const sched = new Schedule(() => { calls++ })
    ;(sched as unknown as { cronPattern: string }).cronPattern = '* * * * *'

    // "since" = 100 minutes ago, max = 5 — only the most recent 5 fire.
    const since = new Date(NOW - 100 * 60_000)
    const fired = await sched.runMissed({ since, max: 5 })

    expect(fired).toBe(5)
    expect(calls).toBe(5)
  })

  test('returns 0 when "since" is already in the future', async () => {
    const NOW = new Date('2026-06-15T10:00:00Z').getTime()
    Date.now = () => NOW

    let calls = 0
    const { Schedule } = await import('../src/schedule')
    const sched = new Schedule(() => { calls++ })
    ;(sched as unknown as { cronPattern: string }).cronPattern = '* * * * *'

    const since = new Date(NOW + 60_000)
    const fired = await sched.runMissed({ since })
    expect(fired).toBe(0)
    expect(calls).toBe(0)
  })

  test('returns 0 with a warn for interval-based schedules', async () => {
    const { Schedule } = await import('../src/schedule')
    const sched = new Schedule(() => {})
    ;(sched as unknown as { intervalMs: number, cronPattern: string }).intervalMs = 1000
    ;(sched as unknown as { intervalMs: number, cronPattern: string }).cronPattern = ''

    const fired = await sched.runMissed({ since: new Date(Date.now() - 60_000) })
    expect(fired).toBe(0)
  })

  test('continues firing remaining slots even when one throws', async () => {
    const NOW = new Date('2026-06-15T10:05:00Z').getTime()
    Date.now = () => NOW

    let calls = 0
    let errorObserved = 0
    const { Schedule } = await import('../src/schedule')
    const sched = new Schedule(() => {
      calls++
      if (calls === 2) throw new Error('mid-catchup blow-up')
    })
    sched.withErrorHandler(() => { errorObserved++ })
    ;(sched as unknown as { cronPattern: string }).cronPattern = '* * * * *'

    const since = new Date(NOW - 3 * 60_000)
    const fired = await sched.runMissed({ since })

    // 3 slots attempted; 2 succeeded (calls 1 + 3); the throwing 2nd
    // was caught and reported via the error handler.
    expect(calls).toBe(3)
    expect(fired).toBe(2)
    expect(errorObserved).toBe(1)
  })

  test('runs the most recent `max` slots, and reports the real number missed', async () => {
    const NOW = new Date('2026-06-15T10:00:00Z').getTime()
    Date.now = () => NOW

    // Every slot fails, so each one names itself in the error log - the
    // only place the slot a run stood for is visible.
    const errors = spyOn(log, 'error').mockImplementation(() => {})
    const warns = spyOn(log, 'warn').mockImplementation(() => {})
    try {
      const { Schedule } = await import('../src/schedule')
      const sched = new Schedule(() => { throw new Error('down') })
      sched.withErrorHandler(() => {})
      ;(sched as unknown as { cronPattern: string }).cronPattern = '* * * * *'

      // Ten minutes down (09:51..10:00), room for three.
      await sched.runMissed({ since: new Date(NOW - 10 * 60_000), max: 3 })

      const ran = errors.mock.calls.map(([message]) => String(message).match(/slot (\S+) failed/)?.[1])
      expect(ran).toEqual(['2026-06-15T09:58:00.000Z', '2026-06-15T09:59:00.000Z', '2026-06-15T10:00:00.000Z'])

      const warning = warns.mock.calls.map(([message]) => String(message)).find(message => message.includes('runMissed'))
      expect(warning).toContain('more than 3 missed slots')

      // Reaching back to `since`, the count is exact.
      errors.mockClear()
      warns.mockClear()
      await sched.runMissed({ since: new Date(NOW - 5 * 60_000), max: 4 })
      expect(errors.mock.calls).toHaveLength(4)
      expect(warns.mock.calls.map(([message]) => String(message)).find(message => message.includes('runMissed'))).toContain(': 5 missed slots')
    }
    finally {
      errors.mockRestore()
      warns.mockRestore()
    }
  })

  test('a long outage costs time in proportion to `max`, not to the outage', async () => {
    const NOW = new Date('2026-06-15T10:00:00Z').getTime()
    Date.now = () => NOW

    let calls = 0
    const { Schedule } = await import('../src/schedule')
    const sched = new Schedule(() => { calls++ })
    ;(sched as unknown as { cronPattern: string }).cronPattern = '* * * * *'

    // A year of minutes is 525,600 slots; walking them all took ~25s.
    const started = performance.now()
    const fired = await sched.runMissed({ since: new Date(NOW - 365 * 86_400_000), max: 10 })

    expect(fired).toBe(10)
    expect(calls).toBe(10)
    expect(performance.now() - started).toBeLessThan(1_000)
  })

  test('walks the slots in the task\'s own timezone', async () => {
    // 09:00 in Tokyo is 00:00 UTC, and 17:00 the day before in Los Angeles.
    const NOW = new Date('2026-06-15T00:30:00Z').getTime()
    Date.now = () => NOW

    let calls = 0
    const { Schedule } = await import('../src/schedule')
    const sched = new Schedule(() => { calls++ })
    ;(sched as unknown as { cronPattern: string }).cronPattern = '0 9 * * *'
    sched.setTimeZone('Asia/Tokyo')

    // The last hour holds Tokyo's 09:00 and nobody else's.
    const fired = await sched.runMissed({ since: new Date(NOW - 60 * 60_000) })

    expect(fired).toBe(1)
    expect(calls).toBe(1)
  })
})
