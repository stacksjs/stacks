import { afterEach, describe, expect, test } from 'bun:test'

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
})
