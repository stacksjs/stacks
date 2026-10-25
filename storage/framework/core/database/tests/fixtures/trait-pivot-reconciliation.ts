import assert from 'node:assert/strict'
import { join } from 'node:path'
import { migrateTraitTables } from '../../src/trait-tables'
import { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } from '../../src/utils'

const root = process.env.STACKS_TRAIT_FIXTURE_ROOT
const mode = process.env.STACKS_TRAIT_FIXTURE_MODE
assert(root && mode && ['tag-empty', 'category-empty', 'tag-populated', 'category-populated', 'canonical'].includes(mode))
await ensureDatabaseConfigLoaded()
resetDatabaseConnection()
const databasePath = join(root, 'fixture.sqlite')
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database: databasePath } }, queryLogging: { enabled: false } } })
try {
  const connections = await db.unsafe('PRAGMA database_list').execute() as Array<{ name: string, file: string }>
  assert.equal(connections.find(row => row.name === 'main')?.file, databasePath, 'admit actual native database before fixture writes')
  const tag = mode.startsWith('tag')
  const table = tag ? 'taggable_models' : 'categorizable_models'
  const catalogue = tag ? 'tag_id' : 'category_id'
  const owner = tag ? 'taggable_id' : 'categorizable_id'
  const type = tag ? 'taggable_type' : 'categorizable_type'
  if (mode !== 'canonical') {
    await db.unsafe(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY, ${catalogue} BIGINT NOT NULL, ${type} VARCHAR(255) NOT NULL, created_at TEXT, updated_at TEXT)`).execute()
    if (mode.endsWith('populated'))
      await db.unsafe(`INSERT INTO ${table} (id, ${catalogue}, ${type}, created_at) VALUES (7, 3, 'posts', '2026-01-01')`).execute()
  }
  const before = mode.endsWith('populated') ? await db.unsafe(`SELECT * FROM ${table}`).execute() : []
  const result = await migrateTraitTables()
  if (mode.endsWith('populated')) {
    assert.equal(result.success, false)
    assert.match(result.error ?? '', /cannot infer|cannot recover/i)
    assert((result.error ?? '').includes(`${table}.${owner}`))
    assert.deepEqual(await db.unsafe(`SELECT * FROM ${table}`).execute(), before, 'ambiguous owners must never be fabricated')
    const columns = await db.unsafe(`PRAGMA table_info(${table})`).execute() as Array<{ name: string }>
    assert.equal(columns.some(column => column.name === owner), false)
  }
  else {
    assert.equal(result.success, true, result.error)
    for (const [pivot, ownerColumn, tagColumn, ownerType] of [
      ['taggable_models', 'taggable_id', 'tag_id', 'taggable_type'],
      ['categorizable_models', 'categorizable_id', 'category_id', 'categorizable_type'],
    ]) {
      const columns = await db.unsafe(`PRAGMA table_info(${pivot})`).execute() as Array<{ name: string, notnull: number, dflt_value: unknown }>
      const column = columns.find(column => column.name === ownerColumn)
      assert(column, 'native owner column exists')
      assert.equal(column.notnull, 1)
      assert.equal(column.dflt_value, null, 'no zero or guessed owner default')
      await assert.rejects(db.unsafe(`INSERT INTO ${pivot} (id, ${tagColumn}, ${ownerType}) VALUES (1, 3, 'posts')`).execute())
      await db.unsafe(`INSERT INTO ${pivot} (id, ${tagColumn}, ${ownerColumn}, ${ownerType}) VALUES (2, 3, 9, 'posts')`).execute()
      await assert.rejects(db.unsafe(`INSERT INTO ${pivot} (id, ${tagColumn}, ${ownerColumn}, ${ownerType}) VALUES (3, 3, 9, 'posts')`).execute(), /unique/i)
    }
    assert.equal((await migrateTraitTables()).success, true, 'replay remains native and idempotent')
    for (const pivot of ['taggable_models', 'categorizable_models'])
      assert.equal((await db.unsafe(`SELECT * FROM ${pivot}`).execute() as unknown[]).length, 1, 'valid rows survive replay')
  }
  console.log(`native trait pivot ${mode} OK`)
}
finally { resetDatabaseConnection() }
