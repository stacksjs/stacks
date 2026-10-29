import assert from 'node:assert/strict'
import { applyTestSchema } from '../../src/schema'

const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
const dialect = process.env.DB_CONNECTION === 'postgres' ? 'postgres' : 'sqlite'
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect,
  connections: { sqlite: { database: process.env.DB_DATABASE_PATH }, postgres: { name: process.env.DB_DATABASE!, host: process.env.DB_HOST!, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME!, password: process.env.DB_PASSWORD! } },
  queryLogging: { enabled: false },
} })
try {
  if (dialect === 'sqlite') await db.unsafe('PRAGMA foreign_keys = ON').execute()
  await applyTestSchema([
    'CREATE TABLE schema_parent (id INTEGER PRIMARY KEY, label TEXT)',
    'CREATE TABLE schema_child (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES schema_parent(id))',
    "INSERT INTO schema_parent (id, label) VALUES (1, 'semicolon; and -- comment text') -- trailing comment",
    'INSERT INTO schema_child (id, parent_id) VALUES (1, 1)',
  ])
  assert.equal((await db.selectFrom('schema_parent').select(['label']).executeTakeFirstOrThrow()).label, 'semicolon; and -- comment text')
  await assert.rejects(() => db.insertInto('schema_child').values({ id: 2, parent_id: 999 }).execute(), 'schema setup retains foreign-key enforcement')
  await assert.rejects(() => applyTestSchema([
    'CREATE TABLE schema_rollback (id INTEGER PRIMARY KEY)',
    "INSERT INTO schema_parent (id, label) VALUES (2, 'must roll back')",
    'ALTER TABLE schema_missing ADD COLUMN impossible INTEGER',
  ]))
  assert.equal((await db.selectFrom('schema_parent').select(['id']).execute()).length, 1, 'a failed schema batch rolls back earlier data changes')
  await assert.rejects(() => db.selectFrom('schema_rollback').selectAll().execute(), 'a failed schema batch rolls back its created tables')
  await applyTestSchema([])
  await applyTestSchema(['CREATE TABLE schema_after_failure (id INTEGER PRIMARY KEY)'])
  await db.insertInto('schema_after_failure').values({ id: 1 }).execute()
  assert.equal((await db.selectFrom('schema_after_failure').selectAll().execute()).length, 1, 'a failed batch leaves the connection usable')
  process.stdout.write('atomic test schema OK\n')
}
finally { await resetDatabaseConnection() }
