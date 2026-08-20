import type { BatchRecord, PersistentBatchHandler } from '../src/batch'
import { describe, expect, test } from 'bun:test'
import { batchRecordFromHash, batchRecordToHash } from '../src/batch'

// Regression coverage for the persistent terminal handlers (stacksjs/stacks#1883).
//
// The `.thenHandler()` / `.catchHandler()` / `.finallyHandler()` builders
// serialized their handler into the BatchRecord, and the completion path read
// `record.then_handler` back — but neither store ever wrote the three columns,
// so a handler registered at dispatch was always `null` by the time the
// winning worker looked for it. The feature was inert on every driver.
//
// These tests pin the Redis hash codec, which is the driver that carries the
// full record shape unconditionally (no schema to migrate).

const thenHandler: PersistentBatchHandler = { kind: 'job', name: 'NotifyComplete', payload: { reportId: 7 } }
const catchHandler: PersistentBatchHandler = { kind: 'module', module: './handlers', export: 'onBatchFailed' }

function makeRecord(overrides: Partial<BatchRecord> = {}): BatchRecord {
  return {
    id: 'batch-1',
    name: 'Process Podcasts',
    total_jobs: 3,
    pending_jobs: 3,
    failed_jobs: 0,
    failed_job_ids: '[]',
    options: '{"allowFailures":false}',
    cancelled_at: null,
    created_at: '2026-07-26 10:00:00',
    finished_at: null,
    ...overrides,
  }
}

describe('batch persistent handlers - Redis hash codec', () => {
  test('a registered handler survives the encode/decode round trip', () => {
    const record = makeRecord({
      then_handler: JSON.stringify(thenHandler),
      catch_handler: JSON.stringify(catchHandler),
      finally_handler: null,
    })

    const decoded = batchRecordFromHash(batchRecordToHash(record))

    expect(JSON.parse(decoded!.then_handler!)).toEqual(thenHandler)
    expect(JSON.parse(decoded!.catch_handler!)).toEqual(catchHandler)
    expect(decoded!.finally_handler).toBeNull()
  })

  test('an unset handler decodes to null, never an empty string', () => {
    // `parsePersistentHandler` treats '' as absent too, but a record that
    // reports `then_handler: ''` would still be lying about its shape.
    const decoded = batchRecordFromHash(batchRecordToHash(makeRecord()))

    expect(decoded!.then_handler).toBeNull()
    expect(decoded!.catch_handler).toBeNull()
    expect(decoded!.finally_handler).toBeNull()
  })

  test('the rest of the record round trips unchanged', () => {
    // The decoder always populates the handler slots, so an input that leaves
    // them off comes back with explicit nulls — hence they are named here.
    const record = makeRecord({
      failed_jobs: 2,
      failed_job_ids: '["j1","j2"]',
      finished_at: '2026-07-26 10:05:00',
      then_handler: null,
      catch_handler: null,
      finally_handler: null,
    })

    expect(batchRecordFromHash(batchRecordToHash(record))).toEqual(record)
  })

  test('a hash written before the handler fields existed still decodes', () => {
    // Hashes written by an older release carry no handler keys at all.
    const legacy = batchRecordToHash(makeRecord())
    delete legacy.then_handler
    delete legacy.catch_handler
    delete legacy.finally_handler

    const decoded = batchRecordFromHash(legacy)

    expect(decoded!.id).toBe('batch-1')
    expect(decoded!.then_handler).toBeNull()
  })

  test('a hash with no id is treated as absent', () => {
    expect(batchRecordFromHash({})).toBeNull()
    expect(batchRecordFromHash(null)).toBeNull()
  })
})
