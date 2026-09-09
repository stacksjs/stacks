import { config } from '@stacksjs/config'
import { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } from '@stacksjs/database'
import { withTraceId } from '@stacksjs/router'
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'bun:test'
import { transaction } from '../../orm/src/transaction'
import { job } from '../src/job'
import { quarantineJob, unquarantineJob } from '../src/poison'
import { fake, restore } from '../src/testing'

let unlock: (() => void) | undefined
let previousDriver: string | undefined

beforeAll(async () => {
  unlock = await acquireDbConfigLock()
  await ensureDatabaseConfigLoaded()
  resetDatabaseConnection()
  initializeDbConfig({ app: { env: 'production' }, database: { default: 'sqlite', connections: { sqlite: { database: ':memory:' } }, queryLogging: { enabled: false } } })
  await db.unsafe('CREATE TABLE jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, queue TEXT, payload TEXT, attempts INTEGER, reserved_at INTEGER, available_at INTEGER, created_at TEXT)').execute()
  await db.unsafe('CREATE TABLE job_idempotency (idempotency_key TEXT PRIMARY KEY, job_name TEXT, queue TEXT, dispatched_at TEXT)').execute()
  await db.unsafe('CREATE TABLE job_quarantine (id INTEGER PRIMARY KEY, job_name TEXT, payload_hash TEXT, failure_count INTEGER, window_start TEXT, quarantined_at TEXT, UNIQUE(job_name, payload_hash))').execute()
  await db.unsafe('CREATE TABLE dead_letter_jobs (id INTEGER PRIMARY KEY, uuid TEXT, connection TEXT, queue TEXT, payload TEXT, exception TEXT, reason TEXT, total_failures INTEGER, first_failed_at TEXT, last_failed_at TEXT, dead_lettered_at TEXT)').execute()
})

beforeEach(() => {
  previousDriver = process.env.QUEUE_DRIVER
  process.env.QUEUE_DRIVER = 'database'
  restore()
})

afterEach(async () => {
  restore()
  if (previousDriver === undefined) delete process.env.QUEUE_DRIVER
  else process.env.QUEUE_DRIVER = previousDriver
  await db.unsafe('DELETE FROM jobs').execute()
  await db.unsafe('DELETE FROM job_idempotency').execute()
  await db.unsafe('DELETE FROM job_quarantine').execute()
  await db.unsafe('DELETE FROM dead_letter_jobs').execute()
})

afterAll(() => {
  try {
    resetDatabaseConnection()
    initializeDbConfig(config)
  }
  finally {
    unlock?.()
  }
})

test('warm builder dispatch observes fake replacement and same-tick restoration and payload changes', async () => {
  await job('Inspire', { value: 0 }).dispatch()
  const pending = job('Inspire', { value: 1 }).onQueue('emails').tries(3).dispatch()
  const first = fake()
  await pending
  expect(first.dispatched()).toEqual([expect.objectContaining({ data: { value: 1 }, queue: 'emails', options: { queue: 'emails', tries: 3 } })])
  const second = fake()
  await job('Inspire', { value: 2 }).dispatch()
  expect(first.dispatched()).toHaveLength(1)
  expect(second.dispatched()).toEqual([expect.objectContaining({ data: { value: 2 } })])
  const payload = { value: 3 }
  const restoring = job('Inspire', payload).dispatch()
  restore()
  payload.value = 4
  await restoring
  const rows = await db.selectFrom('jobs').orderBy('id', 'asc').selectAll().execute()
  expect(rows.map(row => JSON.parse(row.payload).payload.value)).toEqual([0, 4])
})

test('builder dispatch keeps idempotency live and releases a claim after serialization fails', async () => {
  await job('Inspire', { value: 1 }).withIdempotencyKey('live-key').dispatch()
  await job('Inspire', { value: 2 }).withIdempotencyKey('live-key').dispatch()
  expect(await db.selectFrom('jobs').selectAll().execute()).toHaveLength(1)
  await db.deleteFrom('job_idempotency').where('idempotency_key', '=', 'live-key').execute()
  await job('Inspire', { value: 3 }).withIdempotencyKey('live-key').dispatch()
  await expect(job('Inspire', { value: 1n }).withIdempotencyKey('retry-key').dispatch()).rejects.toThrow('BigInt')
  expect(await db.selectFrom('job_idempotency').where('idempotency_key', '=', 'retry-key').selectAll().execute()).toHaveLength(0)
  await job('Inspire', { value: 4 }).withIdempotencyKey('retry-key').dispatch()
  const rows = await db.selectFrom('jobs').orderBy('id', 'asc').selectAll().execute()
  expect(rows.map(row => JSON.parse(row.payload).payload.value)).toEqual([1, 3, 4])
})

test('builder dispatch sees driver changes and live quarantine and preserves trace and options', async () => {
  await job('Inspire', { value: 0 }).dispatch()
  const pending = job('Inspire', { value: 1 }).dispatch()
  process.env.QUEUE_DRIVER = 'unknown-driver'
  await expect(pending).rejects.toThrow('Unknown QUEUE_DRIVER')
  process.env.QUEUE_DRIVER = 'database'
  await quarantineJob('Inspire')
  await job('Inspire', { value: 2 }).dispatch()
  const dead = await db.selectFrom('dead_letter_jobs').selectAll().execute()
  expect(dead).toHaveLength(1)
  expect(JSON.parse(dead[0]!.payload).payload.value).toBe(2)
  await unquarantineJob('Inspire')
  await withTraceId('builder-cache-trace', () => job('Inspire', { value: 3 }).onQueue('emails').tries(3).timeout(20).backoff([5, 10]).dispatch())
  const rows = await db.selectFrom('jobs').orderBy('id', 'asc').selectAll().execute()
  expect(rows).toHaveLength(2)
  expect(JSON.parse(rows[1]!.payload)).toMatchObject({ payload: { value: 3 }, traceId: 'builder-cache-trace', options: { queue: 'emails', tries: 3, timeout: 20, backoff: [5, 10] } })
})

test('builder dispatch remains buffered until ORM transaction commit and discarded on rollback', async () => {
  await job('Inspire', { value: 0 }).dispatch()
  await transaction(async (tx) => {
    await job('Inspire', { value: 1 }).dispatch()
    expect(await tx.selectFrom('jobs').selectAll().execute()).toHaveLength(1)
  })
  expect(await db.selectFrom('jobs').selectAll().execute()).toHaveLength(2)
  const failure = new Error('rollback dispatch')
  await expect(transaction(async () => {
    await job('Inspire', { value: 2 }).dispatch()
    throw failure
  })).rejects.toBe(failure)
  const rows = await db.selectFrom('jobs').orderBy('id', 'asc').selectAll().execute()
  expect(rows.map(row => JSON.parse(row.payload).payload.value)).toEqual([0, 1])
})
