import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { claimDispatchKey, releaseDispatchKey } from '../src/idempotency'

// stacksjs/stacks#1984 — job dispatch idempotency was check-then-act
// (hasDispatchedKey SELECT → dispatch → recordDispatchedKey INSERT), so two
// concurrent dispatches under the same key both passed the SELECT and both
// enqueued. Replaced with an atomic claim-then-compensate: INSERT the key up
// front (UNIQUE constraint is the gate); release it if the dispatch fails.
// The DB-backed race needs a live job_idempotency table + concurrency to
// exercise, so the wiring is pinned as source-shape checks (repo convention).

const src = (rel: string) => readFileSync(resolve(__dirname, '..', 'src', rel), 'utf-8')

describe('dispatch idempotency: claim-then-compensate (#1984)', () => {
  it('exposes claim/release primitives', () => {
    expect(typeof claimDispatchKey).toBe('function')
    expect(typeof releaseDispatchKey).toBe('function')
  })

  it('claimDispatchKey INSERTs up front and maps UNIQUE → duplicate, missing-table → unenforced', () => {
    const idem = src('idempotency.ts')
    const start = idem.indexOf('export async function claimDispatchKey')
    const fn = idem.slice(start, idem.indexOf('export async function releaseDispatchKey'))
    expect(fn).toContain('.insertInto(\'job_idempotency\')')
    expect(fn).toContain(`return 'claimed'`)
    expect(fn).toMatch(/UNIQUE constraint[\s\S]*?return 'duplicate'/)
    expect(fn).toMatch(/isMissingTableError[\s\S]*?return 'unenforced'/)
  })

  describe('runDispatchPipeline claims before dispatch and compensates on failure', () => {
    const job = src('job.ts')
    const start = job.indexOf('private async runDispatchPipeline')
    const pipeline = job.slice(start, job.indexOf('async dispatchIf', start))

    it('claims up front and skips on duplicate (no check-then-act)', () => {
      expect(pipeline).toContain('claimDispatchKey(this.options.idempotencyKey')
      expect(pipeline).toMatch(/if \(claim === 'duplicate'\)\s*\n\s*return/)
      // the old check-then-act primitives are gone from the hot path
      expect(pipeline).not.toContain('hasDispatchedKey')
      expect(pipeline).not.toContain('recordDispatchedKey')
    })

    it('releases the claimed key if the dispatch throws', () => {
      expect(pipeline).toMatch(/catch \(err\)[\s\S]*?releaseDispatchKey\(this\.options\.idempotencyKey\)[\s\S]*?throw err/)
    })
  })
})
