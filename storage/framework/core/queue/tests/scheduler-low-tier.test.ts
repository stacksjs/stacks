import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { calculateNextRun, getCronParts } from '../src/scheduler'

// stacksjs/stacks#1984 low tier: real calculateNextRun (was a now+60s stub),
// drift-corrected scheduler tick, and the redis per-attempt backoff array.

const src = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf-8')

describe('calculateNextRun computes the real next fire time (#1984)', () => {
  it('finds the next daily run at the configured minute/hour', () => {
    const next = calculateNextRun('30 9 * * *')
    expect(next).not.toBeNull()
    expect(next!.getMinutes()).toBe(30)
    expect(next!.getHours()).toBe(9)
    expect(next!.getTime()).toBeGreaterThan(Date.now())
  })

  it('handles step expressions (next quarter hour)', () => {
    const next = calculateNextRun('*/15 * * * *')
    expect(next).not.toBeNull()
    expect(next!.getMinutes() % 15).toBe(0)
  })

  it('respects the configured timezone', () => {
    const next = calculateNextRun('0 9 * * *', 'America/New_York')
    expect(next).not.toBeNull()
    // the next fire is 09:00 wall-clock in New York
    const ny = getCronParts(next!, 'America/New_York')
    expect(ny.hour).toBe(9)
    expect(ny.minute).toBe(0)
  })

  it('returns null for an invalid expression', () => {
    expect(calculateNextRun('nope')).toBeNull()
    expect(calculateNextRun('* *')).toBeNull()
  })
})

describe('scheduler tick + redis backoff wiring (#1984)', () => {
  it('scheduler re-arms a minute-aligned timer instead of a drifting setInterval', () => {
    const sched = src('../src/scheduler.ts')
    expect(sched).toContain('const scheduleNextTick = ()')
    expect(sched).toContain('interval - (Date.now() % interval)')
    // the drifting setInterval tick is gone
    expect(sched).not.toContain('setInterval(() => {')
  })

  it('redis driver passes the per-attempt backoff array through (no fixed collapse)', () => {
    const redis = src('../src/drivers/redis.ts')
    expect(redis).toContain('options.backoff.map(s => (Number(s) || 1) * 1000)')
    expect(redis).not.toContain(`{ type: 'fixed', delay: (options.backoff[0]`)
  })
})
