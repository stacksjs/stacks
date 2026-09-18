import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_SAFE_MIGRATIONS_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-safe-migrations-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_safe_migrations_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { addColumnSafely, backfillInBatches, db, ensureDatabaseConfigLoaded, initializeDbConfig, renameColumnSafely, resetDatabaseConnection } = await import('../../src')
await ensureDatabaseConfigLoaded()
const connection = dialect === 'sqlite' ? { database: process.env.DB_DATABASE_PATH } : {
  name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
}
initializeDbConfig({ app: { env: 'test' }, database: { default: dialect, connections: { [dialect]: connection }, queryLogging: { enabled: false } } })

const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  try {
    await run()
    console.log(`PASS ${name}`)
  }
  catch (error) { failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`) }
}

async function rows(table: string, select = '*'): Promise<Array<Record<string, unknown>>> {
  return await db.unsafe(`SELECT ${select} FROM ${table}`) as unknown as Array<Record<string, unknown>>
}
async function count(table: string, where: string): Promise<number> {
  const [row] = await db.unsafe(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`) as unknown as Array<{ n: number | string }>
  return Number(row?.n)
}
async function columnExists(table: string, column: string): Promise<boolean> {
  try {
    await db.unsafe(`SELECT ${column} FROM ${table}`)
    return true
  }
  catch { return false }
}
async function rejects(run: () => Promise<unknown>): Promise<boolean> {
  try {
    await run()
    return false
  }
  catch { return true }
}

const AUTO_ID = { sqlite: 'INTEGER PRIMARY KEY AUTOINCREMENT', postgres: 'SERIAL PRIMARY KEY', mysql: 'INT AUTO_INCREMENT PRIMARY KEY' }[dialect]

try {
  await check('backfillInBatches fills every batch', async () => {
    await db.unsafe(`CREATE TABLE bf (id ${AUTO_ID}, label VARCHAR(32))`).execute()
    // Seven NULL rows and a batch of three: three batches, the last partial.
    // One row already has a value and must keep it.
    await db.unsafe(`INSERT INTO bf (id, label) VALUES (1, NULL), (2, NULL), (3, NULL), (4, 'kept'), (5, NULL), (6, NULL), (7, NULL), (8, NULL)`).execute()

    await backfillInBatches(db, 'bf', 'label', 'filled', 3)
    assert.equal(await count('bf', 'label IS NULL'), 0, 'every batch runs, not just the first')
    assert.equal(await count('bf', `label = 'kept'`), 1, 'an existing value is left alone')

    // Backfilling NULL matches the same rows on every pass and changes none,
    // so it has to return rather than loop until the watchdog kills it.
    await db.unsafe('UPDATE bf SET label = NULL WHERE id IN (1, 2)').execute()
    await backfillInBatches(db, 'bf', 'label', null, 3)
    assert.equal(await count('bf', 'label IS NULL'), 2)
  })

  await check('backfillInBatches works on a table with no id column', async () => {
    await db.unsafe(`CREATE TABLE bf_uuid (uuid VARCHAR(36) PRIMARY KEY, label VARCHAR(32))`).execute()
    for (const uuid of ['a', 'b', 'c'])
      await db.unsafe(`INSERT INTO bf_uuid (uuid, label) VALUES ('${uuid}', NULL)`).execute()

    await backfillInBatches(db, 'bf_uuid', 'label', 'filled', 2)
    assert.equal(await count('bf_uuid', 'label IS NULL'), 0)
  })

  await check('addColumnSafely adds a nullable column', async () => {
    await db.unsafe(`CREATE TABLE ac_plain (id ${AUTO_ID}, name VARCHAR(32))`).execute()
    await db.unsafe(`INSERT INTO ac_plain (name) VALUES ('one'), ('two')`).execute()

    await addColumnSafely(db, 'ac_plain', 'note', { type: 'varchar(32)' })
    assert.equal(await columnExists('ac_plain', 'note'), true)
    assert.equal(await count('ac_plain', 'note IS NULL'), 2)
  })

  await check('addColumnSafely adds a NOT NULL column with a default', async () => {
    await db.unsafe(`CREATE TABLE ac_nn (id ${AUTO_ID}, name VARCHAR(32))`).execute()
    await db.unsafe(`INSERT INTO ac_nn (name) VALUES ('one'), ('two')`).execute()

    // The JSDoc example for this helper.
    await addColumnSafely(db, 'ac_nn', 'state', { type: 'varchar(16)', defaultValue: 'active', notNull: true })

    assert.equal(await count('ac_nn', `state = 'active'`), 2, 'existing rows are filled')
    assert.equal(await rejects(() => db.unsafe(`INSERT INTO ac_nn (name, state) VALUES ('three', NULL)`).execute()), true, 'the column is NOT NULL')
    // MySQL's MODIFY COLUMN restates the definition, and dropping the default
    // there would make this insert fail instead.
    await db.unsafe(`INSERT INTO ac_nn (name) VALUES ('four')`).execute()
    assert.equal(await count('ac_nn', `state = 'active'`), 3, 'the default survives the NOT NULL step')
  })

  await check('addColumnSafely refuses a NOT NULL column with no default on SQLite', async () => {
    await db.unsafe(`CREATE TABLE ac_guard (id ${AUTO_ID}, name VARCHAR(32))`).execute()
    await db.unsafe(`INSERT INTO ac_guard (name) VALUES ('one')`).execute()

    if (dialect === 'sqlite') {
      await assert.rejects(
        () => addColumnSafely(db, 'ac_guard', 'state', { type: 'varchar(16)', notNull: true }),
        /SQLite/,
        'SQLite cannot add the constraint afterwards, so it has to refuse before touching the table',
      )
      assert.equal(await columnExists('ac_guard', 'state'), false, 'the table is untouched')
      return
    }
    // The server dialects can add the constraint in a second statement, but
    // only where no row violates it: a table with rows and no default cannot.
    assert.equal(await rejects(() => addColumnSafely(db, 'ac_guard', 'state', { type: 'varchar(16)', notNull: true })), true)
  })

  await check('renameColumnSafely copies into the new column, and renames atomically', async () => {
    await db.unsafe(`CREATE TABLE rn (id ${AUTO_ID}, title VARCHAR(64))`).execute()
    await db.unsafe(`INSERT INTO rn (title) VALUES ('first'), ('second')`).execute()

    await renameColumnSafely(db, 'rn', 'title', 'name', { type: 'varchar(64)' })
    assert.deepEqual((await rows('rn', 'name')).map(row => row.name).sort(), ['first', 'second'], 'values are copied across')
    assert.equal(await columnExists('rn', 'title'), true, 'the old column stays until a later migration drops it')

    await db.unsafe(`CREATE TABLE rn_atomic (id ${AUTO_ID}, title VARCHAR(64))`).execute()
    await db.unsafe(`INSERT INTO rn_atomic (title) VALUES ('kept')`).execute()
    await renameColumnSafely(db, 'rn_atomic', 'title', 'heading', { type: 'varchar(64)', atomic: true })
    assert.equal(await columnExists('rn_atomic', 'title'), false)
    assert.deepEqual((await rows('rn_atomic', 'heading')).map(row => row.heading), ['kept'])
  })

  assert.deepEqual(failures, [], `${dialect}: the safe migration helpers must run`)
  console.log('safe migrations OK')
}
finally { resetDatabaseConnection() }
