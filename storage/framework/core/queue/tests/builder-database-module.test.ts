import { config } from '@stacksjs/config'
import { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } from '@stacksjs/database'
import { withTraceId } from '@stacksjs/router'
import { Database } from 'bun:sqlite'
import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { job } from '../src/job'
import { restore } from '../src/testing'

const schema = `
CREATE TABLE jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, queue TEXT, payload TEXT, attempts INTEGER, reserved_at INTEGER, available_at INTEGER, created_at TEXT);
CREATE TABLE job_quarantine (id INTEGER PRIMARY KEY, job_name TEXT, payload_hash TEXT, quarantined_at TEXT);
CREATE TABLE job_idempotency (idempotency_key TEXT PRIMARY KEY, job_name TEXT, queue TEXT, dispatched_at TEXT);
`

function useDatabase(database: string): void {
  resetDatabaseConnection()
  initializeDbConfig({ app: { env: 'production' }, database: { default: 'sqlite', connections: { sqlite: { database } }, queryLogging: { enabled: false } } })
}

test('warm builder database dispatch yields after serialization and retains live configuration and SQL compensation', async () => {
  const fixture = mkdtempSync(join(tmpdir(), 'stacks-builder-database-'))
  const firstPath = join(fixture, 'first.sqlite')
  const secondPath = join(fixture, 'second.sqlite')
  const previousDriver = process.env.QUEUE_DRIVER
  const unlock = await acquireDbConfigLock()
  let first: Database | undefined
  let second: Database | undefined
  try {
    await ensureDatabaseConfigLoaded()
    first = new Database(firstPath)
    second = new Database(secondPath)
    first.exec(schema)
    second.exec(schema)
    useDatabase(firstPath)
    process.env.QUEUE_DRIVER = 'database'
    restore()
    await job('Inspire', { value: 0 }).dispatch()
    const observed: unknown[] = []
    const payload = {
      toJSON(key: string) {
        // JSON calls this with an empty key for the poison hash, then with
        // "payload" for the envelope. Schedule work from serialization itself.
        if (key === 'payload') {
          queueMicrotask(() => {
            observed.push(first!.query('SELECT COUNT(*) AS n FROM jobs').get())
            useDatabase(secondPath)
            builder.onQueue('after-serialization').timeout(40)
          })
        }
        return { value: 1 }
      },
    }
    const builder = job('Inspire', payload).onQueue('before-serialization').tries(3).timeout(20).delay(60)
    const earliest = Math.floor(Date.now() / 1000)
    await withTraceId('builder-database-trace', () => builder.dispatch())
    const latest = Math.floor(Date.now() / 1000)
    expect(observed).toEqual([{ n: 1 }])
    expect(first.query('SELECT COUNT(*) AS n FROM jobs').get()).toEqual({ n: 1 })
    const rows = await db.selectFrom('jobs').selectAll().execute()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.queue).toBe('after-serialization')
    expect(JSON.parse(rows[0]!.payload)).toMatchObject({ payload: { value: 1 }, traceId: 'builder-database-trace', options: { queue: 'before-serialization', tries: 3, timeout: 20 } })
    expect(Number(rows[0]!.available_at)).toBeGreaterThanOrEqual(earliest + 60)
    expect(Number(rows[0]!.available_at)).toBeLessThanOrEqual(latest + 60)
    expect(rows[0]!.attempts).toBe(0)
    expect(rows[0]!.reserved_at).toBeNull()

    second.exec("CREATE TRIGGER block_jobs BEFORE INSERT ON jobs BEGIN SELECT RAISE(ABORT, 'blocked builder enqueue'); END")
    await expect(job('Inspire', { value: 2 }).withIdempotencyKey('retry-key').dispatch()).rejects.toThrow('blocked builder enqueue')
    expect(second.query('SELECT COUNT(*) AS n FROM job_idempotency').get()).toEqual({ n: 0 })
    second.exec('DROP TRIGGER block_jobs')
    await job('Inspire', { value: 3 }).withIdempotencyKey('retry-key').dispatch()
    expect(second.query("SELECT json_extract(payload, '$.payload.value') AS value FROM jobs ORDER BY id").all()).toEqual([{ value: 1 }, { value: 3 }])
    expect(second.query('SELECT COUNT(*) AS n FROM job_idempotency').get()).toEqual({ n: 1 })
    useDatabase(firstPath)
    await job('Inspire', { value: 4 }).dispatch()
    expect(first.query("SELECT json_extract(payload, '$.payload.value') AS value FROM jobs ORDER BY id").all()).toEqual([{ value: 0 }, { value: 4 }])
  }
  finally {
    try {
      restore()
      resetDatabaseConnection()
      initializeDbConfig(config)
      if (previousDriver === undefined) delete process.env.QUEUE_DRIVER
      else process.env.QUEUE_DRIVER = previousDriver
      first?.close()
      second?.close()
      rmSync(fixture, { recursive: true, force: true })
    }
    finally {
      unlock()
    }
  }
})
