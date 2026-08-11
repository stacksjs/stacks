import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migration = readFileSync(
  resolve('database/migrations/1785502251833-create-queue-support-tables.sql'),
  'utf8',
)
const scaffold = readFileSync(
  resolve('storage/framework/core/database/src/custom/jobs.ts'),
  'utf8',
)

const supportTables = [
  'job_batches',
  'dead_letter_jobs',
  'job_quarantine',
  'queue_circuit_state',
  'job_idempotency',
]

describe('queue support migration contract', () => {
  test('provisions every native queue safeguard for existing applications', () => {
    for (const table of supportTables)
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`)
    expect(migration).toContain('"then_handler" TEXT')
    expect(migration).toContain('"job_idempotency_key_unique"')
    expect(migration).toContain('"jobs_queue_availability_index"')
  })

  test('keeps fresh queue scaffolds complete on every database driver', () => {
    expect(scaffold.match(/CREATE TABLE IF NOT EXISTS job_idempotency/g)?.length).toBe(6)
    expect(scaffold).toContain('async function ensureQueueSupportTables(driver: string)')
    expect(scaffold).toContain('await ensureQueueSupportTables(driver)')
  })
})
