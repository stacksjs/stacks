import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_ORM_PRUNE_COUNTS_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-orm-prune-counts-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_orm_prune_counts_'))
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

// The framework package and the copy vendored into apps both export it.
const copies = {
  'core/orm': await import('../../src/utils/prunable'),
  'vendored orm': await import('../../../../orm/src/utils/prunable'),
}

const table = {
  sqlite: 'CREATE TABLE prune_rows (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, created_at DATETIME NOT NULL)',
  postgres: 'CREATE TABLE prune_rows (id SERIAL PRIMARY KEY, kind VARCHAR(32) NOT NULL, created_at TIMESTAMP NOT NULL)',
  mysql: 'CREATE TABLE prune_rows (id INT AUTO_INCREMENT PRIMARY KEY, kind VARCHAR(32) NOT NULL, created_at DATETIME NOT NULL)',
}[dialect]

async function rows(): Promise<number> {
  return (await db.selectFrom('prune_rows').selectAll().execute() as unknown[]).length
}
// Two rows the prune should take and one it must leave, so neither "one" nor
// "everything" can pass for the real count.
async function seed() {
  await db.deleteFrom('prune_rows').execute()
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  for (const [kind, createdAt] of [['stale', '2020-01-01 00:00:00'], ['stale', '2020-01-02 00:00:00'], ['fresh', now]])
    await db.insertInto('prune_rows').values({ kind, created_at: createdAt }).execute()
}

const failures: string[] = []
async function check(name: string, expected: number, prune: () => Promise<number>) {
  await seed()
  try {
    const before = await rows()
    const returned = await prune()
    const removed = before - await rows()
    assert.equal(removed, expected, `${name} should delete ${expected} row(s)`)
    assert.equal(returned, removed, `${name} returned ${returned} but deleted ${removed} row(s)`)
    console.log(`PASS ${name}`)
  }
  catch (error) { failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`) }
}

try {
  await db.unsafe(table).execute()
  for (const [label, { prunable, massPrunable }] of Object.entries(copies)) {
    await check(`${label} prunable olderThanDays`, 2, () => prunable('prune_rows', { olderThanDays: 30 }))
    await check(`${label} massPrunable olderThanDays`, 2, () => massPrunable('prune_rows', { olderThanDays: 30 }))
    await check(`${label} prunable query`, 2, () => prunable('prune_rows', { query: qb => qb.where('kind', '=', 'stale') }))
    await check(`${label} prunable query matching nothing`, 0, () => prunable('prune_rows', { query: qb => qb.where('kind', '=', 'missing') }))
  }
  assert.deepEqual(failures, [], `${dialect}: prunable must return the rows it deleted`)
  console.log('orm prune counts OK')
}
finally { resetDatabaseConnection() }
