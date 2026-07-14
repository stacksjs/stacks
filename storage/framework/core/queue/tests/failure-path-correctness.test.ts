import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// stacksjs/stacks#1957 queue sweep — three correctness fixes on the job/batch
// FAILURE paths. These paths need a live DB + concurrent workers to exercise
// end-to-end, so (like migrate-guarantees-ordering.test.ts) the invariants are
// pinned as source-shape checks that guard against silent reversion.

const src = (rel: string) => readFileSync(resolve(__dirname, '..', 'src', rel), 'utf-8')

describe('queue failure-path correctness (#1957)', () => {
  describe('worker: no silent job loss on failed_jobs persistence error', () => {
    const worker = src('worker.ts')

    it('moveToFailedJobs signals success/failure instead of swallowing', () => {
      expect(worker).toContain('async function moveToFailedJobs(job: any, error: Error): Promise<boolean>')
      // both outcomes are reported back to the caller
      expect(worker).toMatch(/\.execute\(\)\s*\n\s*return true/)
      expect(worker).toMatch(/log\.error\('Failed to log failed job:'[^)]*\)\s*\n\s*return false/)
    })

    it('deleteJob only runs once the job is durably persisted', () => {
      // the delete is guarded by the persistence result, not unconditional
      expect(worker).toContain('persisted = await moveToFailedJobs(job, jobError)')
      expect(worker).toMatch(/if \(persisted\) \{[\s\S]*?await deleteJob\(jobId\)/)
      // the not-persisted branch keeps the row (no data loss)
      expect(worker).toContain('leaving it in the queue to avoid data loss')
    })
  })

  describe('worker: retry backoff is clamped to a finite non-negative delay', () => {
    const worker = src('worker.ts')
    it('rejects NaN / negative backoff values instead of an immediate re-run', () => {
      expect(worker).toContain('retryDelay = Number(retryDelay)')
      expect(worker).toContain('if (!Number.isFinite(retryDelay) || retryDelay < 0)')
    })
  })

  describe('batch: recordBatchJobFailure is atomic (no lost-update / double-finalize)', () => {
    const batch = src('batch.ts')
    // isolate the failure function body
    const fnStart = batch.indexOf('export async function recordBatchJobFailure')
    const fnEnd = batch.indexOf('export ', fnStart + 1)
    const fn = batch.slice(fnStart, fnEnd === -1 ? undefined : fnEnd)

    it('decrements/increments counters with atomic SQL, not a read-modify-write', () => {
      expect(fn).toContain('GREATEST(pending_jobs - 1, 0)')
      expect(fn).toContain('failed_jobs + 1')
      // the old absolute-value write is gone
      expect(fn).not.toContain('pending_jobs: newPending')
    })

    it('finalizes exactly once via a finished_at IS NULL guard', () => {
      expect(fn).toContain(`.where('finished_at', 'is', null)`)
      expect(fn).toContain('updatedRowCount(finalizeResult)')
    })

    it('fires persistent (#1883) handlers on the failure-terminated path too', () => {
      expect(fn).toContain('firePersistentHandler')
    })
  })
})
