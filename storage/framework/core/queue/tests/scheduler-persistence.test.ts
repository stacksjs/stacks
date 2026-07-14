import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadPersistedLastRun, persistLastRun } from '../src/scheduler-persistence'

// stacksjs/stacks#1984 — the scheduler's `lastRun` marker lived only in memory
// and reset on restart, so a deploy within the same clock-minute a job fires
// could re-dispatch it. It's now persisted to a bounded `scheduled_job_runs`
// table and seeded on startup. The DB round-trip needs a live table to
// exercise (the queue test harness mocks the DB), so the round-trip is covered
// by the degrade-safety assertions here plus source-shape wiring checks.

const src = (rel: string) => readFileSync(resolve(__dirname, '..', 'src', rel), 'utf-8')

describe('scheduler run-marker persistence (#1984)', () => {
  describe('degrades gracefully when the DB/table is unavailable', () => {
    it('loadPersistedLastRun resolves (null or Date) without throwing', async () => {
      const result = await loadPersistedLastRun('__no_such_scheduled_job__')
      expect(result === null || result instanceof Date).toBe(true)
    })

    it('persistLastRun never throws', async () => {
      await expect(persistLastRun('__no_such_scheduled_job__', new Date(0))).resolves.toBeUndefined()
    })
  })

  describe('persistence module shape', () => {
    const mod = src('scheduler-persistence.ts')
    it('creates a bounded marker table with a portable VARCHAR primary key', () => {
      expect(mod).toContain('CREATE TABLE IF NOT EXISTS scheduled_job_runs')
      expect(mod).toContain('job_name VARCHAR(255) PRIMARY KEY')
    })
    it('upserts via portable delete-then-insert (no dialect-specific UPSERT)', () => {
      const fn = mod.slice(mod.indexOf('export async function persistLastRun'))
      expect(fn).toContain('.deleteFrom(\'scheduled_job_runs\')')
      expect(fn).toContain('.insertInto(\'scheduled_job_runs\')')
    })
  })

  describe('scheduler wiring', () => {
    const sched = src('scheduler.ts')
    it('seeds lastRun from persistence at registration (not hard-coded null)', () => {
      expect(sched).toContain('const lastRun = await loadPersistedLastRun(job.name)')
      expect(sched).toMatch(/schedulerState\.jobs\.set\(job\.name, \{[\s\S]*?lastRun,/)
    })
    it('persists the run marker when a job is dispatched', () => {
      expect(sched).toContain('await persistLastRun(name, state.lastRun)')
    })
  })
})
