import { config } from '@stacksjs/config'
import { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } from '@stacksjs/database'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { Job } from '../src/action'
import { jobDefaults } from '../src/job'
import { restore } from '../src/testing'

/**
 * A job's own retry settings reach the worker.
 *
 * - A numeric `backoff` - `backoff: 3`, which the bundled ExampleJob uses -
 *   was dropped from the envelope because only arrays were kept.
 * - A job dispatched by name carried none of its declared `tries`, `backoff`
 *   or `timeout`, and the worker defaulted to one attempt: `mail.queue()`
 *   sent SendEmailJob, declared as three tries with 10/30/60s backoff, to
 *   failed_jobs on its first transient SMTP error. The worker now falls back
 *   to `jobDefaults()`.
 */
const schema = 'CREATE TABLE jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, queue TEXT, payload TEXT, attempts INTEGER, reserved_at INTEGER, available_at INTEGER, created_at TEXT)'
let unlock: (() => void) | undefined
let previousDriver: string | undefined

beforeAll(async () => {
  unlock = await acquireDbConfigLock()
  await ensureDatabaseConfigLoaded()
})

beforeEach(async () => {
  previousDriver = process.env.QUEUE_DRIVER
  process.env.QUEUE_DRIVER = 'database'
  restore()
  resetDatabaseConnection()
  initializeDbConfig({ app: { env: 'production' }, database: { default: 'sqlite', connections: { sqlite: { database: ':memory:' } }, queryLogging: { enabled: false } } })
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

describe('declared retry settings', () => {
  it('keeps a numeric backoff on dispatch', async () => {
    await new Job({ name: 'NumericBackoff', tries: 3, backoff: 3, handle: () => {} }).dispatch({})

    const rows = await db.unsafe('SELECT payload FROM jobs').execute() as Array<{ payload: string }>
    const options = JSON.parse(rows[0]!.payload).options
    expect(options.backoff).toBe(3)
    expect(options.tries).toBe(3)
  })

  it('reads what a job file declares, for a dispatch that said nothing', async () => {
    expect(await jobDefaults('SendEmailJob')).toEqual({ tries: 3, backoff: [10, 30, 60], timeout: undefined })
  })

  it('says nothing about a job that does not exist', async () => {
    expect(await jobDefaults('NoSuchJobAnywhere')).toEqual({})
  })
})
