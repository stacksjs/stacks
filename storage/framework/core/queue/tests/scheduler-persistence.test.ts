import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { hasUnfinishedRun, loadPersistedLastRun, overlapPayloadPattern, persistLastRun } from '../src/scheduler-persistence'

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

// stacksjs/stacks#1984 — `preventOverlapping` / `withoutOverlapping` consulted
// an in-memory `isRunning` flag the scheduler set immediately before the
// enqueue and cleared immediately after, so it described the enqueue rather
// than the execution and was always false again by the next tick. Neither
// guard ever fired. They now ask whether the dispatched queue row is still
// present, which is what "previous execution still running" means.
describe('scheduler overlap guard (#1984)', () => {
  describe('overlapPayloadPattern', () => {
    it('anchors on the closing quote so a prefix name does not match', () => {
      const pattern = overlapPayloadPattern('backup')
      expect(pattern).toBe('%"jobName":"backup"%')
      // The row a sibling job would write. Without the closing quote in the
      // pattern, `backup` would match `backup-daily` and silently suppress it.
      expect('{"jobName":"backup-daily","payload":{}}').not.toContain('"jobName":"backup"')
    })

    it('escapes LIKE metacharacters, since `_` is legal in a job name', () => {
      // Unescaped, `_` matches any single character, so `backup_daily` would
      // also match a queued `backupXdaily`.
      expect(overlapPayloadPattern('backup_daily')).toBe('%"jobName":"backup\\_daily"%')
      expect(overlapPayloadPattern('50%_off')).toBe('%"jobName":"50\\%\\_off"%')
      expect(overlapPayloadPattern('a\\b')).toBe('%"jobName":"a\\\\b"%')
    })

    // The third assertion here read `utils.ts` and required it to literally
    // contain `JSON.stringify({\n jobName: name,`, to catch the payload shape
    // drifting away from the pattern above. It could not survive any refactor
    // of that call, correct ones included, and #2282 item 6 is exactly such a
    // refactor: `buildScheduledJobRow` now goes through `createEnvelope`,
    // because the hand-built object was the pre-#1884 v0 shape and every
    // scheduled dispatch was landing stamped `dispatchedAt: 1970-01-01`.
    //
    // Replaced rather than dropped. `envelope-json-contract.test.ts` asserts
    // the same protection against real `buildScheduledJobRow` output instead of
    // against the source text: that the LIKE pattern still matches the row, that
    // a prefix name does not match a sibling, and that underscores stay literal.
  })

  it('degrades to "not running" rather than throwing when the DB is unavailable', async () => {
    // A scheduler that cannot reach the database must keep dispatching, not
    // wedge itself shut.
    expect(await hasUnfinishedRun('__no_such_scheduled_job__')).toBe(false)
  })

  describe('scheduler wiring', () => {
    const sched = src('scheduler.ts')

    it('asks the queue, not the in-memory flag', () => {
      expect(sched).toContain('await hasUnfinishedRun(name)')
    })

    it('gates both the global and the per-job flag on that same check', () => {
      expect(sched).toMatch(
        /const overlapGuarded = schedulerState\.config\.preventOverlapping \|\| state\.job\.config\.withoutOverlapping/,
      )
      expect(sched).toContain('if (overlapGuarded && await hasUnfinishedRun(name))')
    })

    it('only queries when a guard is actually enabled', () => {
      // The default path must not pay a query per job per minute.
      const guard = sched.slice(sched.indexOf('const overlapGuarded'))
      expect(guard.indexOf('overlapGuarded &&')).toBeLessThan(guard.indexOf('hasUnfinishedRun(name)'))
    })
  })
})
