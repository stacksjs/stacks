/**
 * `between()`, `withInterval()`, `withProtection()` and `withContext()`.
 *
 * All four were declared on the public interface and documented in the
 * scheduler skill, and all four only stored their argument: nothing read
 * `options.startAt`, `stopAt`, `interval`, `protect` or `context`. A campaign
 * job scheduled `.between(launch, end)` ran from the moment it was registered
 * and kept running after the end; `.withProtection()` let a slow run overlap
 * the next tick; a task given `.withContext(x)` never saw `x`.
 *
 * The tests drive a registered task through `job.run()`, the same entry the
 * timer and `Schedule.runNow()` use.
 */

import type { ScheduledJob } from '../src/types'
import { afterAll, afterEach, describe, expect, it, setSystemTime } from 'bun:test'
import { fake, restore } from '@stacksjs/queue'
import { Schedule } from '../src/schedule'

let counter = 0

/** Register a task under a fresh name and hand back what the timer would drive. */
async function register(build: (schedule: Schedule) => unknown, task: (context?: any) => unknown): Promise<ScheduledJob> {
  const name = `schedule-options-${process.pid}-${++counter}`
  const schedule = new Schedule(task)
  build(schedule.withName(name))
  // The task starts once the chain has settled, on the next microtask.
  await Promise.resolve()
  const job = (Schedule as unknown as { jobs: Map<string, ScheduledJob> }).jobs.get(name)
  if (!job)
    throw new Error(`task ${name} did not register`)
  return job
}

afterEach(() => {
  setSystemTime()
})

afterAll(async () => {
  await Schedule.gracefulShutdown()
})

describe('between()', () => {
  it('skips runs before the window opens and waits for it in nextRun()', async () => {
    setSystemTime(new Date('2026-06-15T10:00:00Z'))
    let calls = 0
    const job = await register(s => s.everyMinute().setTimeZone('UTC').between('2026-06-20T00:00:00Z', '2026-06-21T00:00:00Z'), () => { calls++ })

    await job.run()

    expect(calls).toBe(0)
    expect(job.nextRun()?.toISOString()).toBe('2026-06-20T00:00:00.000Z')
  })

  it('runs inside the window', async () => {
    setSystemTime(new Date('2026-06-20T12:00:00Z'))
    let calls = 0
    const job = await register(s => s.everyMinute().setTimeZone('UTC').between(new Date('2026-06-20T00:00:00Z'), new Date('2026-06-21T00:00:00Z')), () => { calls++ })

    await job.run()

    expect(calls).toBe(1)
    expect(job.nextRun()?.toISOString()).toBe('2026-06-20T12:01:00.000Z')
  })

  it('stops for good once the window has closed', async () => {
    setSystemTime(new Date('2026-06-20T23:59:30Z'))
    let calls = 0
    const job = await register(s => s.everyMinute().setTimeZone('UTC').between('2026-06-20T00:00:00Z', '2026-06-21T00:00:00Z'), () => { calls++ })

    // The last slot is the window's own end; nothing after it.
    expect(job.nextRun()?.toISOString()).toBe('2026-06-21T00:00:00.000Z')
    setSystemTime(new Date('2026-06-21T00:00:30Z'))
    expect(job.nextRun()).toBeNull()

    await job.run()
    expect(calls).toBe(0)
  })

  it('refuses a window that is not one', () => {
    const schedule = new Schedule(() => {})
    expect(() => schedule.between('not a date', '2026-06-21')).toThrow('startAt is not a valid date')
    expect(() => schedule.between('2026-06-21', 'soon')).toThrow('stopAt is not a valid date')
    expect(() => schedule.between('2026-06-21', '2026-06-20')).toThrow('must be after startAt')
  })
})

describe('withInterval()', () => {
  it('skips a tick that comes sooner than the interval after the last run', async () => {
    setSystemTime(new Date('2026-06-15T10:00:00Z'))
    let calls = 0
    const job = await register(s => s.everyMinute().withInterval(90), () => { calls++ })

    await job.run()
    setSystemTime(new Date('2026-06-15T10:01:00Z'))
    await job.run()
    expect(calls).toBe(1)

    setSystemTime(new Date('2026-06-15T10:02:00Z'))
    await job.run()
    expect(calls).toBe(2)
  })

  it('refuses an interval that is not a positive number of seconds', () => {
    const schedule = new Schedule(() => {})
    expect(() => schedule.withInterval(0)).toThrow('positive number of seconds')
    expect(() => schedule.withInterval(Number.NaN)).toThrow('positive number of seconds')
  })
})

describe('withProtection()', () => {
  it('skips a tick while the previous run is still going, and reports it', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    let calls = 0
    const blocked: ScheduledJob[] = []
    const job = await register(s => s.everyMinute().withProtection(skipped => blocked.push(skipped)), async () => {
      calls++
      await gate
    })

    const first = job.run()
    await job.run()
    expect(calls).toBe(1)
    expect(blocked).toEqual([job])

    release()
    await first
    // Finished, so the next tick runs.
    await job.run()
    expect(calls).toBe(2)
  })

  it('without it, runs overlap', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    let calls = 0
    const job = await register(s => s.everyMinute(), async () => {
      calls++
      await gate
    })

    const runs = [job.run(), job.run()]
    expect(calls).toBe(2)
    release()
    await Promise.all(runs)
  })

  it('lets the next tick run after a failed one', async () => {
    let calls = 0
    const job = await register(s => s.everyMinute().withProtection().withErrorHandler(() => {}), () => {
      calls++
      throw new Error('boom')
    })

    await expect(job.run()).rejects.toThrow('boom')
    await expect(job.run()).rejects.toThrow('boom')
    expect(calls).toBe(2)
  })
})

describe('withContext()', () => {
  it('hands the context to the task on every run', async () => {
    const seen: unknown[] = []
    const context = { tenant: 'acme' }
    const job = await register(s => s.everyMinute().withContext(context), received => seen.push(received))

    await job.run()
    await job.run()

    expect(seen).toEqual([context, context])
  })

  it('and to every slot runMissed() replays', async () => {
    setSystemTime(new Date('2026-06-15T10:00:00Z'))
    const seen: unknown[] = []
    const schedule = new Schedule(received => seen.push(received))
    schedule.everyMinute().withContext('ctx')

    await schedule.runMissed({ since: Date.now() - 2 * 60_000 })

    expect(seen).toEqual(['ctx', 'ctx'])
  })
})

describe('dailyAt() and weekdays()', () => {
  it('dailyAt() is a daily time', () => {
    expect(new Schedule(() => {}).dailyAt('02:30').pattern).toBe('30 2 * * *')
  })

  it('weekdays() keeps the time of day, whichever side of at() it is on', () => {
    expect(new Schedule(() => {}).weekdays().pattern).toBe('0 0 * * 1-5')
    expect(new Schedule(() => {}).weekdays().at('09:00').pattern).toBe('0 9 * * 1-5')
    expect(new Schedule(() => {}).dailyAt('09:00').weekdays().pattern).toBe('0 9 * * 1-5')
    expect(new Schedule(() => {}).everyFiveMinutes().weekdays().pattern).toBe('*/5 * * * 1-5')
  })
})

describe('onQueue()', () => {
  it('dispatches the scheduled job to the queue, with its context, instead of running it', async () => {
    const queue = fake()
    try {
      const scheduled = Schedule.job('SendDailyReport' as never)
      scheduled.everyMinute().onQueue('reports').withContext({ tenant: 'acme' }).withName(`queued-${process.pid}`)
      await Promise.resolve()
      await Schedule.runNow(`queued-${process.pid}`)

      const dispatched = queue.dispatched('SendDailyReport')
      expect(dispatched).toHaveLength(1)
      expect(dispatched[0]?.queue).toBe('reports')
      expect(dispatched[0]?.options).toMatchObject({ queue: 'reports', context: { tenant: 'acme' } })
    }
    finally {
      restore()
    }
  })

  it('is refused on a schedule that has no job to dispatch', () => {
    expect(() => new Schedule(() => {}).onQueue('reports')).toThrow('schedule.job(...) only')
    expect(() => Schedule.action('Cleanup' as never).onQueue('reports')).toThrow('schedule.job(...) only')
    expect(() => Schedule.job('SendDailyReport' as never).onQueue('  ')).toThrow('takes a queue name')
  })
})
