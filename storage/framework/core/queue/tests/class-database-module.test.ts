import { config } from '@stacksjs/config'
import { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } from '@stacksjs/database'
import { Database } from 'bun:sqlite'
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Job } from '../src/action'
import { restore } from '../src/testing'

const schema = 'CREATE TABLE jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, queue TEXT, payload TEXT, attempts INTEGER, reserved_at INTEGER, available_at INTEGER, created_at TEXT)'
let unlock: (() => void) | undefined
let previousDriver: string | undefined

function useDatabase(database = ':memory:'): void {
  resetDatabaseConnection()
  initializeDbConfig({ app: { env: 'production' }, database: { default: 'sqlite', connections: { sqlite: { database } }, queryLogging: { enabled: false } } })
}

beforeAll(async () => {
  unlock = await acquireDbConfigLock()
  await ensureDatabaseConfigLoaded()
})

beforeEach(async () => {
  previousDriver = process.env.QUEUE_DRIVER
  process.env.QUEUE_DRIVER = 'database'
  restore()
  useDatabase()
  await db.unsafe(schema).execute()
})

afterEach(() => {
  restore()
  if (previousDriver === undefined) delete process.env.QUEUE_DRIVER
  else process.env.QUEUE_DRIVER = previousDriver
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

test('warm ordinary and delayed enqueues retain their payload and option timing', async () => {
  const job = new Job({ name: 'DatabaseTiming', queue: 'before', tries: 3, timeout: 20, backoff: [5, 10] })
  await job.dispatch({ value: 0 })
  const ordinaryPayload = { value: 1 }
  const ordinary = job.dispatch(ordinaryPayload)
  ordinaryPayload.value = 2
  job.queue = 'ordinary'
  await ordinary

  job.queue = 'delayed-envelope'
  const delayedPayload = { value: 3 }
  const earliest = Math.floor(Date.now() / 1000)
  const delayed = job.dispatchAfter(60, delayedPayload)
  delayedPayload.value = 4
  job.queue = 'delayed-row'
  job.timeout = 40
  await delayed
  const latest = Math.floor(Date.now() / 1000)
  const rows = await db.selectFrom('jobs').orderBy('id', 'asc').selectAll().execute()
  expect(rows).toHaveLength(3)
  expect(JSON.parse(rows[1]!.payload)).toMatchObject({ payload: { value: 2 }, options: { queue: 'ordinary', tries: 3, timeout: 20, backoff: [5, 10] } })
  expect(rows[1]!.queue).toBe('ordinary')
  // Delayed dispatch serializes immediately, then awaits before reading the row queue.
  expect(JSON.parse(rows[2]!.payload)).toMatchObject({ payload: { value: 3 }, options: { queue: 'delayed-envelope', tries: 3, timeout: 20, backoff: [5, 10] } })
  expect(rows[2]!.queue).toBe('delayed-row')
  expect(rows[2]!.attempts).toBe(0)
  expect(rows[2]!.reserved_at).toBeNull()
  expect(Number(rows[2]!.available_at)).toBeGreaterThanOrEqual(earliest + 60)
  expect(Number(rows[2]!.available_at)).toBeLessThanOrEqual(latest + 60)
})

test('warm database dispatch propagates SQL and serialization errors and recovers', async () => {
  const job = new Job({ name: 'DatabaseErrors' })
  await job.dispatch({ value: 0 })
  await db.unsafe("CREATE TRIGGER block_jobs BEFORE INSERT ON jobs BEGIN SELECT RAISE(ABORT, 'blocked enqueue'); END").execute()
  await expect(job.dispatch({ value: 1 })).rejects.toThrow('blocked enqueue')
  await expect(job.dispatchAfter(60, { value: 2 })).rejects.toThrow('blocked enqueue')
  await db.unsafe('DROP TRIGGER block_jobs').execute()
  await expect(job.dispatch({ value: 1n })).rejects.toThrow('BigInt')
  await expect(job.dispatchAfter(60, { value: 2n })).rejects.toThrow('BigInt')
  expect(await db.selectFrom('jobs').selectAll().execute()).toHaveLength(1)
  await job.dispatchAfter(60, { value: 3 })
  const rows = await db.selectFrom('jobs').orderBy('id', 'asc').selectAll().execute()
  expect(rows.map(row => JSON.parse(row.payload).payload.value)).toEqual([0, 3])
})

test('warm delayed dispatch defers SQL and both entrypoints observe database replacement', async () => {
  const fixture = mkdtempSync(join(tmpdir(), 'stacks-class-database-'))
  const firstPath = join(fixture, 'first.sqlite')
  const secondPath = join(fixture, 'second.sqlite')
  const first = new Database(firstPath)
  const second = new Database(secondPath)
  try {
    first.exec(schema)
    second.exec(schema)
    useDatabase(firstPath)
    const job = new Job({ name: 'DatabaseReplacement' })
    await job.dispatch({ value: 0 })
    const delayed = job.dispatchAfter(60, { value: 1 })
    expect(first.query('SELECT COUNT(*) AS n FROM jobs').get()).toEqual({ n: 1 })
    useDatabase(secondPath)
    await delayed
    expect(first.query('SELECT COUNT(*) AS n FROM jobs').get()).toEqual({ n: 1 })
    expect(second.query("SELECT json_extract(payload, '$.payload.value') AS value FROM jobs").all()).toEqual([{ value: 1 }])
    const ordinary = job.dispatch({ value: 2 })
    useDatabase(firstPath)
    await ordinary
    expect(first.query("SELECT json_extract(payload, '$.payload.value') AS value FROM jobs ORDER BY id").all()).toEqual([{ value: 0 }, { value: 2 }])
    expect(second.query('SELECT COUNT(*) AS n FROM jobs').get()).toEqual({ n: 1 })
  }
  finally {
    resetDatabaseConnection()
    first.close()
    second.close()
    rmSync(fixture, { recursive: true, force: true })
  }
})
