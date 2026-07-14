import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// stacksjs/stacks#1984 — the dead-letter queue and quarantine features were
// fully implemented but had ZERO runtime callers, so repeat-failing jobs
// looped forever and `queue:quarantine` did nothing. This wires them into the
// dispatch + terminal-failure paths. Those paths need a live DB across
// multiple tables (jobs/failed_jobs/dead_letter_jobs/job_quarantine) to
// exercise end-to-end, so — matching the repo convention for DB-heavy paths —
// the wiring is pinned as source-shape checks against silent reversion.

const src = (rel: string) => readFileSync(resolve(__dirname, '..', 'src', rel), 'utf-8')

describe('DLQ + quarantine wiring (#1984)', () => {
  it('isQuarantined matches the class-wide "*" wildcard, not just the exact hash', () => {
    const poison = src('poison.ts')
    expect(poison).toContain(`.where('payload_hash', 'in', [payloadHash, '*'])`)
  })

  describe('dispatch routes quarantined jobs to the DLQ', () => {
    const job = src('job.ts')
    const start = job.indexOf('private async runDispatchPipeline')
    const pipeline = job.slice(start, job.indexOf('async dispatchIf', start))

    it('checks quarantine before selecting a driver', () => {
      const quarantineCheck = pipeline.indexOf('await isQuarantined(this.name, this.payload)')
      const driverSelect = pipeline.indexOf('const driver = getQueueDriver()')
      expect(quarantineCheck).toBeGreaterThan(-1)
      expect(quarantineCheck).toBeLessThan(driverSelect)
    })

    it('routes a quarantined job to moveToDeadLetter and returns (does not enqueue)', () => {
      expect(pipeline).toContain('moveToDeadLetter(')
      expect(pipeline).toMatch(/if \(moved\)\s*\n\s*return/)
    })
  })

  describe('a job re-failing after an operator retry dead-letters instead of looping', () => {
    const worker = src('worker.ts')

    it('retryFailedJob marks the re-queued payload', () => {
      expect(worker).toContain('env._retriedFromFailed = true')
    })

    it('terminal failure routes a marked job to the DLQ (repeat-failure), else falls back to failed_jobs', () => {
      expect(worker).toContain(`parsedPayload?._retriedFromFailed === true`)
      expect(worker).toMatch(/moveToDeadLetter\([\s\S]*?'repeat-failure'/)
      // fallback to failed_jobs when not marked or DLQ unavailable
      expect(worker).toContain('persisted = await moveToFailedJobs(job, jobError)')
    })
  })
})
