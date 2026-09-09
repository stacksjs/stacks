import { config } from '@stacksjs/config'
import { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } from '@stacksjs/database'
import { Database } from 'bun:sqlite'
import { afterAll, beforeAll, beforeEach, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { claimDispatchKey, hasDispatchedKey, recordDispatchedKey, releaseDispatchKey } from '../src/idempotency'

const schema = 'CREATE TABLE job_idempotency (idempotency_key TEXT PRIMARY KEY, job_name TEXT NOT NULL, queue TEXT NOT NULL, dispatched_at TEXT NOT NULL)'
let unlock: (() => void) | undefined

function useDatabase(database = ':memory:'): void {
  resetDatabaseConnection()
  initializeDbConfig({ app: { env: 'production' }, database: { default: 'sqlite', connections: { sqlite: { database } }, queryLogging: { enabled: false } } })
}

beforeAll(async () => {
  unlock = await acquireDbConfigLock()
  await ensureDatabaseConfigLoaded()
})

beforeEach(async () => {
  useDatabase()
  await db.unsafe(schema).execute()
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

test('concurrent claims keep one owner and warm helpers observe external row changes', async () => {
  const claims = await Promise.all(Array.from({ length: 32 }, () => claimDispatchKey('shared-key', 'Inspire', 'emails')))
  expect(claims.filter(claim => claim === 'claimed')).toHaveLength(1)
  expect(claims.filter(claim => claim === 'duplicate')).toHaveLength(31)
  expect(await hasDispatchedKey('shared-key')).toBe(true)
  await recordDispatchedKey('shared-key', 'OtherJob', 'other')
  const original = await db.selectFrom('job_idempotency').selectAll().execute()
  expect(original).toHaveLength(1)
  expect(original[0]).toMatchObject({ job_name: 'Inspire', queue: 'emails' })
  await db.deleteFrom('job_idempotency').where('idempotency_key', '=', 'shared-key').execute()
  expect(await hasDispatchedKey('shared-key')).toBe(false)
  await recordDispatchedKey('shared-key', 'OtherJob')
  expect(await hasDispatchedKey('shared-key')).toBe(true)
  expect(await db.selectFrom('job_idempotency').select(['queue']).executeTakeFirst()).toEqual({ queue: 'default' })
  await releaseDispatchKey('shared-key')
  expect(await hasDispatchedKey('shared-key')).toBe(false)
  expect(await claimDispatchKey('shared-key', 'Inspire')).toBe('claimed')
})

test('warm helpers preserve missing-table recovery, SQL errors, and best-effort release', async () => {
  await recordDispatchedKey('warmup', 'Inspire')
  await db.unsafe('DROP TABLE job_idempotency').execute()
  expect(await hasDispatchedKey('missing')).toBe(false)
  expect(await claimDispatchKey('missing', 'Inspire')).toBe('unenforced')
  await expect(recordDispatchedKey('missing', 'Inspire')).resolves.toBeUndefined()
  await expect(releaseDispatchKey('missing')).resolves.toBeUndefined()
  await db.unsafe(schema).execute()
  await db.unsafe("CREATE TRIGGER block_insert BEFORE INSERT ON job_idempotency BEGIN SELECT RAISE(ABORT, 'blocked claim'); END").execute()
  await expect(claimDispatchKey('blocked', 'Inspire')).rejects.toThrow('blocked claim')
  await expect(recordDispatchedKey('blocked', 'Inspire')).rejects.toThrow('blocked claim')
  await db.unsafe('DROP TRIGGER block_insert').execute()
  expect(await claimDispatchKey('recovered', 'Inspire')).toBe('claimed')
  await db.unsafe("CREATE TRIGGER block_delete BEFORE DELETE ON job_idempotency BEGIN SELECT RAISE(ABORT, 'blocked release'); END").execute()
  await expect(releaseDispatchKey('recovered')).resolves.toBeUndefined()
  expect(await hasDispatchedKey('recovered')).toBe(true)
  await db.unsafe('DROP TRIGGER block_delete').execute()
  await releaseDispatchKey('recovered')
  expect(await hasDispatchedKey('recovered')).toBe(false)
})

test('warm helpers defer database access and use the current database after replacement', async () => {
  const fixture = mkdtempSync(join(tmpdir(), 'stacks-idempotency-module-'))
  const firstPath = join(fixture, 'first.sqlite')
  const secondPath = join(fixture, 'second.sqlite')
  const first = new Database(firstPath)
  const second = new Database(secondPath)
  try {
    first.exec(schema)
    second.exec(schema)
    useDatabase(firstPath)
    await recordDispatchedKey('warmup', 'Inspire')
    const claim = claimDispatchKey('deferred-claim', 'Inspire')
    expect(first.query("SELECT COUNT(*) AS n FROM job_idempotency WHERE idempotency_key = 'deferred-claim'").get()).toEqual({ n: 0 })
    expect(await claim).toBe('claimed')
    const release = releaseDispatchKey('deferred-claim')
    expect(first.query("SELECT COUNT(*) AS n FROM job_idempotency WHERE idempotency_key = 'deferred-claim'").get()).toEqual({ n: 1 })
    await release
    const record = recordDispatchedKey('deferred-record', 'Inspire')
    expect(first.query("SELECT COUNT(*) AS n FROM job_idempotency WHERE idempotency_key = 'deferred-record'").get()).toEqual({ n: 0 })
    await record
    const lookup = hasDispatchedKey('external')
    first.run("INSERT INTO job_idempotency VALUES ('external', 'Inspire', 'default', '2026-09-08 00:00:00')")
    expect(await lookup).toBe(true)

    const switched = claimDispatchKey('switched', 'Inspire')
    useDatabase(secondPath)
    expect(await switched).toBe('claimed')
    expect(await hasDispatchedKey('warmup')).toBe(false)
    expect(second.query("SELECT COUNT(*) AS n FROM job_idempotency WHERE idempotency_key = 'switched'").get()).toEqual({ n: 1 })
    expect(first.query("SELECT COUNT(*) AS n FROM job_idempotency WHERE idempotency_key = 'switched'").get()).toEqual({ n: 0 })
    useDatabase(firstPath)
    expect(await hasDispatchedKey('warmup')).toBe(true)
    expect(await hasDispatchedKey('switched')).toBe(false)
  }
  finally {
    resetDatabaseConnection()
    first.close()
    second.close()
    rmSync(fixture, { recursive: true, force: true })
  }
})
