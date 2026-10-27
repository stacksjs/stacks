/**
 * Explicit timestamps written through a model reach the database in a form
 * every dialect accepts (stacksjs/stacks#3014). Run by
 * ../trait-timestamp-writes.test.ts in its own process per dialect.
 */

import assert from 'node:assert/strict'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')

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

const { buildMigrationPlan, generateSql } = await import('bun-query-builder')
const { defineModel } = await import('@stacksjs/orm')
const { schema } = await import('@stacksjs/validation')

const definitions = {
  // Declares a validated attribute, so its writes pass through validation.
  Journal: {
    name: 'Journal',
    table: 'journals',
    primaryKey: 'id',
    autoIncrement: true,
    traits: { useTimestamps: true, useSoftDeletes: true },
    attributes: { title: { fillable: true, validation: { rule: schema.string().max(100) } } },
  },
  // Declares no rule at all.
  Memo: {
    name: 'Memo',
    table: 'memos',
    primaryKey: 'id',
    autoIncrement: true,
    traits: { useTimestamps: true },
    attributes: { title: { fillable: true } },
  },
} as const

const Journal = defineModel(definitions.Journal) as any
const Memo = defineModel(definitions.Memo) as any

const backdated = '2026-01-02T03:04:05.000Z'
const later = '2026-02-03T04:05:06.000Z'

async function stored(table: string, id: unknown, column: string): Promise<string> {
  const row = await db.selectFrom(table).selectAll().where('id', '=', id).executeTakeFirst() as Record<string, any> | undefined
  assert(row, `${dialect}: no ${table} row ${id}`)
  const value = row[column]
  return value instanceof Date ? value.toISOString() : String(value)
}

const failures: string[] = []
async function check(label: string, run: () => Promise<void>): Promise<void> {
  try { await run() }
  catch (error) { failures.push(`${label}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`) }
}

try {
  for (const statement of generateSql(buildMigrationPlan(definitions as any, { dialect })))
    await db.unsafe(statement).execute()

  for (const [label, Model, table] of [['validated', Journal, 'journals'], ['unvalidated', Memo, 'memos']] as const) {
    await check(`${label} create`, async () => {
      const created = await Model.create({ title: 'backdated', created_at: backdated })
      assert.match(await stored(table, created.id, 'created_at'), /^2026-01-02[T ]03:04:05/)
    })
    await check(`${label} createMany`, async () => {
      await Model.createMany([{ title: 'many', created_at: backdated }])
    })
    await check(`${label} update`, async () => {
      const created = await Model.create({ title: 'to update' })
      await Model.update(created.id, { created_at: later })
      assert.match(await stored(table, created.id, 'created_at'), /^2026-02-03[T ]04:05:06/)
    })
    await check(`${label} updateOrCreate`, async () => {
      const created = await Model.updateOrCreate({ title: `upsert ${label}` }, { created_at: backdated })
      assert.match(await stored(table, created.id, 'created_at'), /^2026-01-02[T ]03:04:05/)
    })
  }
  await check('soft-deleting update', async () => {
    const created = await Journal.create({ title: 'trashed' })
    await Journal.update(created.id, { deleted_at: later })
    assert.match(await stored('journals', created.id, 'deleted_at'), /^2026-02-03[T ]04:05:06/)
  })

  assert.deepEqual(failures, [], `${dialect}:\n  ${failures.join('\n  ')}`)
  console.log(`trait timestamps OK on ${dialect}`)
}
finally {
  await resetDatabaseConnection()
}
