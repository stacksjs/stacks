import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_QUEUE_ROW_COUNTS_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-queue-row-counts-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_queue_row_counts_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect,
  connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  },
  queryLogging: { enabled: false },
} })
const { moveToDeadLetter, purgeDeadLetterJobs } = await import('../../src/dead-letter')
const { updatedRowCount } = await import('../../src/utils')

// The table as createJobsMigration builds it for each dialect.
const table = {
  sqlite: `CREATE TABLE dead_letter_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT NOT NULL, connection TEXT NOT NULL, queue TEXT NOT NULL, payload TEXT NOT NULL, exception TEXT NOT NULL, reason TEXT NOT NULL, total_failures INTEGER NOT NULL DEFAULT 1, first_failed_at DATETIME, last_failed_at DATETIME, dead_lettered_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  postgres: `CREATE TABLE dead_letter_jobs (id SERIAL PRIMARY KEY, uuid VARCHAR(255) NOT NULL, connection VARCHAR(255) NOT NULL, queue VARCHAR(255) NOT NULL, payload TEXT NOT NULL, exception TEXT NOT NULL, reason VARCHAR(64) NOT NULL, total_failures INTEGER NOT NULL DEFAULT 1, first_failed_at TIMESTAMP, last_failed_at TIMESTAMP, dead_lettered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
  mysql: `CREATE TABLE dead_letter_jobs (id INT AUTO_INCREMENT PRIMARY KEY, uuid VARCHAR(255) NOT NULL, connection VARCHAR(255) NOT NULL, queue VARCHAR(255) NOT NULL, payload LONGTEXT NOT NULL, exception LONGTEXT NOT NULL, reason VARCHAR(64) NOT NULL, total_failures INT NOT NULL DEFAULT 1, first_failed_at TIMESTAMP NULL, last_failed_at TIMESTAMP NULL, dead_lettered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
}[dialect]

async function rows(): Promise<number> {
  return (await db.selectFrom('dead_letter_jobs').selectAll().execute() as unknown[]).length
}

try {
  await db.unsafe(table).execute()

  // Two rows past the retention window and one inside it, so a count of
  // "everything" cannot pass for a count of "what was purged".
  for (const uuid of ['old-1', 'old-2', 'fresh'])
    assert.equal(await moveToDeadLetter({ uuid, exception: 'boom' }, 'repeat-failure'), true)
  await db.updateTable('dead_letter_jobs').set({ dead_lettered_at: '2020-01-01 00:00:00' }).where('uuid', 'in', ['old-1', 'old-2']).execute()

  const before = await rows()
  const returned = await purgeDeadLetterJobs(30)
  const removed = before - await rows()
  assert.equal(removed, 2, 'purgeDeadLetterJobs(30) should remove exactly the two backdated rows')
  assert.equal(returned, removed, `${dialect}: purgeDeadLetterJobs returned ${returned} but removed ${removed} rows`)

  // Nothing left to purge is a real 0, not a missing count.
  assert.equal(await purgeDeadLetterJobs(30), 0)

  // updatedRowCount guards the worker and batch compare-and-set claims. It has
  // to read both fluent result shapes, not just the one today's callers pass.
  // Each write sets a new value, because MySQL does not count an unchanged row.
  const touch = (failures: number) => db.updateTable('dead_letter_jobs').set({ total_failures: failures }).where('uuid', '=', 'fresh')
  assert.equal(updatedRowCount(await touch(5).executeTakeFirst()), 1, `${dialect}: updatedRowCount(executeTakeFirst())`)
  assert.equal(updatedRowCount(await touch(6).execute()), 1, `${dialect}: updatedRowCount(execute())`)
  assert.equal(updatedRowCount(await db.updateTable('dead_letter_jobs').set({ total_failures: 7 }).where('uuid', '=', 'missing').execute()), 0)
  console.log('queue row counts OK')
}
finally { resetDatabaseConnection() }
