import { afterEach, describe, expect, it } from 'bun:test'
import { parse, parseCron } from '../src'

/**
 * `parse()` without a `tz` promises UTC, and used to hand the expression to
 * `Bun.cron.parse` whenever it existed. That one answers in the process's local
 * time, as crontab does, so the same call meant midnight UTC on a UTC server and
 * midnight wherever the server happened to be otherwise. The scheduler's default,
 * UTC path calls it without a `tz`, so a UTC app on a New York box ran its daily
 * tasks at 05:00 UTC.
 *
 * `bun test` runs in UTC unless told otherwise, which is why nothing caught it.
 */
const hostZone = process.env.TZ
const base = new Date('2026-10-30T12:34:56Z')

afterEach(() => {
  if (hostZone === undefined)
    delete process.env.TZ
  else
    process.env.TZ = hostZone
})

describe('parse() on a host that is not on UTC', () => {
  it('still answers in UTC', () => {
    process.env.TZ = 'America/New_York'
    // The control: the host zone really changed for this process, so Bun's
    // local-time parser now disagrees with UTC. Without it the test is vacuous.
    if (typeof Bun.cron?.parse === 'function')
      expect(Bun.cron.parse('0 0 * * *', base)?.toISOString()).toBe('2026-10-31T04:00:00.000Z')

    expect(parse('0 0 * * *', base)?.toISOString()).toBe('2026-10-31T00:00:00.000Z')
    expect(parse('@weekly', base)?.toISOString()).toBe('2026-11-01T00:00:00.000Z')
    expect(parse('0 9 * * MON-FRI', base)?.toISOString()).toBe('2026-11-02T09:00:00.000Z')
  })

  it('agrees with parseCron, whatever the host', () => {
    for (const zone of ['UTC', 'Asia/Manila', 'America/Los_Angeles', 'Asia/Kolkata']) {
      process.env.TZ = zone
      for (const expression of ['0 0 * * *', '30 4 * * SUN', '0 0 1,15 * *', '*/7 */5 * * *'])
        expect(parse(expression, base)?.toISOString()).toBe(parseCron(expression, base)?.toISOString())
    }
  })
})
