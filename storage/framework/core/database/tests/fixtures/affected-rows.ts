import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_AFFECTED_ROWS_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-affected-rows-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_affected_rows_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, mutationCount, resetDatabaseConnection } = await import('../../src')
await ensureDatabaseConfigLoaded()
const connection = dialect === 'sqlite' ? { database: process.env.DB_DATABASE_PATH } : {
  name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
}
initializeDbConfig({ app: { env: 'test' }, database: { default: dialect, connections: { [dialect]: connection }, queryLogging: { enabled: false } } })

const failures: string[] = []
const param = (n: number) => dialect === 'postgres' ? `$${n}` : '?'
async function rows(): Promise<number> {
  const [row] = await db.unsafe('SELECT COUNT(*) AS n FROM rc') as unknown as Array<{ n: number | string }>
  return Number(row?.n)
}
async function seed() {
  await db.unsafe('DELETE FROM rc')
  await db.unsafe('INSERT INTO rc (id, v) VALUES (1, 10), (2, 10), (3, 30)')
}
async function check(name: string, run: () => Promise<void>) {
  await seed()
  try { await run(); console.log(`PASS ${name}`) }
  catch (error) { failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`) }
}

try {
  await db.unsafe('CREATE TABLE rc (id INTEGER PRIMARY KEY, v INTEGER NOT NULL)').execute()

  // Deletes and inserts are checked against the table itself, not an expected
  // number: the count must equal the rows that really left or arrived.
  await check('db.unsafe DELETE reports the rows it removed', async () => {
    const before = await rows()
    const result = await db.unsafe('DELETE FROM rc WHERE v = 10')
    assert.equal(mutationCount(result), before - await rows())
    assert.equal(mutationCount(result), 2)
  })
  await check('db.unsafe DELETE matching nothing reports zero', async () => {
    assert.equal(mutationCount(await db.unsafe('DELETE FROM rc WHERE v = 999')), 0)
  })
  await check('db.unsafe DELETE with a bound parameter', async () => {
    const before = await rows()
    const result = await db.unsafe(`DELETE FROM rc WHERE v = ${param(1)}`, [10])
    assert.equal(mutationCount(result), before - await rows())
  })
  await check('db.unsafe INSERT reports the rows it added', async () => {
    const before = await rows()
    const result = await db.unsafe('INSERT INTO rc (id, v) VALUES (7, 1), (8, 1)')
    assert.equal(mutationCount(result), await rows() - before)
  })
  await check('db.unsafe UPDATE that changes values', async () => {
    assert.equal(mutationCount(await db.unsafe('UPDATE rc SET v = 11 WHERE v = 10')), 2)
  })
  await check('trx.unsafe write read inside the transaction callback', async () => {
    let inside: unknown
    await db.transaction(async (trx: any) => { inside = await trx.unsafe('DELETE FROM rc WHERE v = 10') })
    assert.equal(mutationCount(inside), 2)
  })
  await check('fluent updateTable().execute()', async () => {
    assert.equal(mutationCount(await db.updateTable('rc').set({ v: 12 }).where('v', '=', 10).execute()), 2)
  })
  await check('fluent deleteFrom().executeTakeFirst()', async () => {
    assert.equal(mutationCount(await db.deleteFrom('rc').where('v', '=', 10).executeTakeFirst()), 2)
  })

  // Pinned, not endorsed. MySQL counts rows a statement CHANGED; PostgreSQL and
  // SQLite count rows it MATCHED. No field reveals matched rows on MySQL, so
  // callers must not treat 0 after an UPDATE as "row not found".
  await check('an UPDATE writing the value a row already holds', async () => {
    const result = await db.unsafe('UPDATE rc SET v = 10 WHERE v = 10')
    assert.equal(mutationCount(result), dialect === 'mysql' ? 0 : 2)
  })

  assert.deepEqual(failures, [], `${dialect}: every write must report its real affected-row count`)
  console.log('affected rows OK')
}
finally {
  try { await db.unsafe('DROP TABLE IF EXISTS rc').execute() }
  catch {}
  resetDatabaseConnection()
}
