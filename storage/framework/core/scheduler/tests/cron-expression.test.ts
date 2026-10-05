/**
 * `cron(expression)`, and the job `rate` values the runner hands to it.
 *
 * The runner turned a job's `rate` into a schedule through a switch over eleven
 * of the eighteen `Every` values and threw for the rest - `FifteenMinutes`,
 * `Weekday`, `Weekend`, the four seconds rates, and any hand-written cron
 * string, which `rate: string` allows. The throw was caught per job and
 * printed, so the job simply never ran.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'bun:test'
import { Every } from '@stacksjs/types'
import { Schedule } from '../src/schedule'

afterEach(async () => {
  await Schedule.gracefulShutdown()
})

type Inspectable = Schedule & { intervalMs: number | null }

describe('cron()', () => {
  it('takes every Every rate a job can declare', () => {
    for (const rate of Object.values(Every))
      expect(() => new Schedule(() => {}).cron(rate)).not.toThrow()
  })

  it('runs the minute-and-up rates on their own expression', () => {
    for (const rate of [Every.FifteenMinutes, Every.Weekday, Every.Weekend, Every.HalfHour, Every.Year]) {
      const schedule = new Schedule(() => {}).cron(rate) as Inspectable
      expect(schedule.pattern).toBe(rate)
      expect(schedule.intervalMs).toBeNull()
    }
  })

  it('runs the seconds rates every N seconds rather than once a minute', () => {
    const cases: Array<[string, number]> = [
      [Every.Second, 1_000],
      [Every.FiveSeconds, 5_000],
      [Every.TenSeconds, 10_000],
      [Every.ThirtySeconds, 30_000],
    ]
    for (const [rate, intervalMs] of cases)
      expect((new Schedule(() => {}).cron(rate) as Inspectable).intervalMs).toBe(intervalMs)
  })

  it('reads a seconds field of 0 as the five-field expression after it', () => {
    expect(new Schedule(() => {}).cron('0 30 9 * * 1-5').pattern).toBe('30 9 * * 1-5')
  })

  it('refuses seconds it cannot honour, instead of running at second 0', () => {
    expect(() => new Schedule(() => {}).cron('15 * * * * *')).toThrow('particular seconds')
    expect(() => new Schedule(() => {}).cron('*/7 * * * * *')).toThrow('particular seconds')
    expect(() => new Schedule(() => {}).cron('*/5 0 * * * *')).toThrow('particular seconds')
  })

  it('refuses what is not a cron expression, or never matches', () => {
    expect(() => new Schedule(() => {}).cron('every hour')).toThrow('expected 5 fields')
    expect(() => new Schedule(() => {}).cron('61 * * * *')).toThrow('not a valid cron expression')
    expect(() => new Schedule(() => {}).cron('0 0 31 2 *')).toThrow('never matches')
  })

  it('a later cron() replaces an earlier seconds interval', () => {
    const schedule = new Schedule(() => {}).cron(Every.FiveSeconds).cron(Every.Hour) as Inspectable
    expect(schedule.intervalMs).toBeNull()
    expect(schedule.pattern).toBe('0 * * * *')
  })

  it('schedules the task: the next run follows the expression', async () => {
    new Schedule(() => {}).cron(Every.Weekday).setTimeZone('UTC').withName(`weekday-${process.pid}`)
    await Promise.resolve()

    const job = Schedule.listJobs().find(entry => entry.name === `weekday-${process.pid}`)
    expect(job?.pattern).toBe('0 0 * * 1-5')
    const day = job?.nextRun?.getUTCDay()
    expect(day).toBeGreaterThanOrEqual(1)
    expect(day).toBeLessThanOrEqual(5)
  })
})

describe('runMissed() on a seconds schedule', () => {
  it('reports there is nothing to replay instead of failing to parse its marker', async () => {
    const schedule = new Schedule(() => {})
    schedule.everySecond()
    expect(await schedule.runMissed({ since: Date.now() - 60_000 })).toBe(0)
  })
})

describe('the runner', () => {
  it('schedules a job rate through cron(), so every rate is accepted', () => {
    const runner = readFileSync(join(import.meta.dir, '../src/run.ts'), 'utf8')
    expect(runner).toContain('schedule.job(jobName).cron(rate)')
    expect(runner).not.toContain('Unsupported rate')
  })
})
