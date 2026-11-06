/**
 * Runs the Models page's search predicate through the ORM against a
 * disposable database of the given dialect (stacksjs/stacks#3202).
 */

import assert from 'node:assert/strict'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_MODEL_SEARCH_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-model-search-'))
if (dialect === 'sqlite') {
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
}
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_model_search_'))
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

if (dialect === 'sqlite') {
  const { configureOrm } = await import('@stacksjs/query-builder')
  configureOrm({ database: process.env.DB_DATABASE_PATH })
}

const { buildMigrationPlan, generateSql, loadModels } = await import('bun-query-builder')
const plan = buildMigrationPlan(await loadModels({ modelsDir: join(import.meta.dir, '../../../storage/framework/defaults/app/Models') }), { dialect })
plan.tables = plan.tables.filter(table => table.table === 'jobs')
assert.equal(plan.tables.length, 1)

const { searchModelRows } = await import('../../../storage/framework/defaults/app/Actions/Dashboard/Search/GlobalSearchAction')
const { Job, ormReady } = await import('@stacksjs/orm')
await ormReady

/** The predicate ModelShowAction builds, over the columns it would search. */
async function matches(term: string): Promise<number> {
  return Number(await (Job as any).query().whereGroup((group: any) => {
    let chain = group
    for (const [index, column] of ['queue', 'payload'].entries()) {
      const match = `LOWER(${column}) LIKE LOWER(?)`
      chain = index === 0 ? chain.whereRaw(match, `%${term}%`) : chain.orWhereRaw(match, `%${term}%`)
    }
    return chain
  }).count())
}

try {
  for (const statement of generateSql(plan))
    await db.unsafe(statement).execute()
  await db.insertInto('jobs').values({ id: 1, queue: 'Emails', payload: '{"jobName":"SendWelcome"}', attempts: 0, available_at: 0 } as any).execute()
  await db.insertInto('jobs').values({ id: 2, queue: 'reports', payload: '{"jobName":"BuildReport"}', attempts: 0, available_at: 0 } as any).execute()

  for (const term of ['Emails', 'emails', 'EMAILS', 'welcome', 'WELCOME'])
    assert.equal(await matches(term), 1, `${dialect}: "${term}" finds the one job, whatever its case`)
  // The control: a predicate that matched every row would pass the above.
  assert.equal(await matches('nothing like this'), 0, `${dialect}: no match`)
  assert.equal(await matches('e'), 2, `${dialect}: a term in both`)

  for (const term of ['Emails', 'emails', 'EMAILS', 'welcome', 'WELCOME']) {
    const rows = await searchModelRows(Job, ['queue', 'payload'], 'id', term)
    assert.equal(rows.length, 1, `${dialect}: global search uses the configured connection`)
    assert.deepEqual(Object.keys(rows[0]!).sort(), ['id', 'payload', 'queue'])
  }
  assert.equal((await searchModelRows(Job, ['queue'], 'id', "' OR 1=1 --")).length, 0, 'search values are bound')
  assert.equal((await searchModelRows(Job, ['queue'], 'id', 'e', 1)).length, 1, 'search limit is applied in SQL')
  await assert.rejects(searchModelRows(Job, ['queue; DROP TABLE jobs'], 'id', 'x'), /model identifiers/)
  console.log('model search OK')
}
finally { resetDatabaseConnection() }
