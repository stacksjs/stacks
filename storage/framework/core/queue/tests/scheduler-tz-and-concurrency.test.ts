import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getCronParts } from '../src/scheduler'

// stacksjs/stacks#1984 — two next-tier queue fixes:
//  1. SchedulerConfig.timezone was documented but never applied; cron ran in
//     server-local time. getCronParts now extracts the wall-clock fields in the
//     configured zone (covered functionally below).
//  2. The DB driver reserved `--concurrency` jobs but ran them sequentially;
//     the batch is now processed concurrently (source-shape check).

describe('scheduler timezone-aware cron parts (#1984)', () => {
  // 2026-07-14T13:30:00Z. July → US Eastern is EDT (UTC-4).
  const instant = new Date('2026-07-14T13:30:00.000Z')

  it('converts a UTC instant to the configured timezone wall-clock', () => {
    const ny = getCronParts(instant, 'America/New_York')
    expect(ny.hour).toBe(9) // 13:30 UTC − 4h = 09:30 EDT
    expect(ny.minute).toBe(30)
    expect(ny.day).toBe(14)
    expect(ny.month).toBe(7)
    expect(ny.dayOfWeek).toBe(2) // 2026-07-14 is a Tuesday
  })

  it('a different zone yields different wall-clock hours from the same instant', () => {
    const tokyo = getCronParts(instant, 'Asia/Tokyo') // UTC+9
    expect(tokyo.hour).toBe(22) // 13:30 UTC + 9h = 22:30
    expect(tokyo.minute).toBe(30)
  })

  it('crosses the date/day-of-week boundary correctly', () => {
    // 2026-07-14T01:30:00Z in Honolulu (UTC-10) = 2026-07-13 15:30, a Monday
    const hnl = getCronParts(new Date('2026-07-14T01:30:00.000Z'), 'Pacific/Honolulu')
    expect(hnl.day).toBe(13)
    expect(hnl.dayOfWeek).toBe(1) // Monday
  })

  it('falls back to local time (no throw) for no zone / an invalid zone', () => {
    const local = getCronParts(instant)
    expect(local.hour).toBe(instant.getHours())
    expect(local.minute).toBe(instant.getMinutes())
    // an invalid zone must not throw — it degrades to local
    const bad = getCronParts(instant, 'Not/AZone')
    expect(bad.hour).toBe(instant.getHours())
  })
})

describe('DB driver processes the reserved batch concurrently (#1984)', () => {
  const worker = readFileSync(resolve(__dirname, '../src/worker.ts'), 'utf-8')
  it('uses Promise.all over the reserved jobs, not a sequential await loop', () => {
    expect(worker).toContain('await Promise.all(jobs.map(async (job) =>')
    // the old sequential shape is gone
    expect(worker).not.toContain('for (const job of jobs) {')
  })
})
