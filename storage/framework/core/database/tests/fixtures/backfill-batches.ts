import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres')
const configPath = process.env.STACKS_BACKFILL_BATCHES_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-backfill-batches-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_backfill_batches_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { backfillInBatches, db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('../../src')
await ensureDatabaseConfigLoaded()
const connection = dialect === 'sqlite' ? { database: process.env.DB_DATABASE_PATH } : {
  name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
}
initializeDbConfig({ app: { env: 'test' }, database: { default: dialect, connections: { [dialect]: connection }, queryLogging: { enabled: false } } })

async function nulls(): Promise<number> {
  const [row] = await db.unsafe('SELECT COUNT(*) AS n FROM bf WHERE label IS NULL') as unknown as Array<{ n: number | string }>
  return Number(row?.n)
}

try {
  await db.unsafe('CREATE TABLE bf (id INTEGER PRIMARY KEY, label VARCHAR(32))')
  // Seven NULL rows and a batch of three: three batches, the last one partial.
  // One row already has a value and must keep it.
  await db.unsafe(`INSERT INTO bf (id, label) VALUES (1, NULL), (2, NULL), (3, NULL), (4, 'kept'), (5, NULL), (6, NULL), (7, NULL), (8, NULL)`)

  await backfillInBatches(db, 'bf', 'label', 'filled', 3)
  assert.equal(await nulls(), 0, `${dialect}: backfillInBatches must fill every batch, not just the first`)
  const [kept] = await db.unsafe('SELECT label FROM bf WHERE id = 4') as unknown as Array<{ label: string }>
  assert.equal(kept?.label, 'kept')

  // Backfilling NULL matches the same rows on every pass and changes none. It
  // has to return rather than loop until the watchdog kills it.
  await db.unsafe('UPDATE bf SET label = NULL WHERE id IN (1, 2)')
  await backfillInBatches(db, 'bf', 'label', null, 3)
  assert.equal(await nulls(), 2)

  console.log('backfill batches OK')
}
finally { resetDatabaseConnection() }
