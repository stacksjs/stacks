import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { configureOrm, getDatabase, releaseOrm } from 'bun-query-builder'

configureOrm({ database: ':memory:' })
const { enableFeature, disableFeature } = await import('../../../config/src/features')
enableFeature('cms')
disableFeature('commerce')
const { Post, Categorizable, Category, ormReady } = await import('../../src')
await ormReady
assert.equal(Categorizable.getDefinition().table, 'categorizables')
assert.equal(Category.getDefinition, undefined)

try {
  const db = getDatabase()
  db.run('CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT)')
  db.run('CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT)')
  db.exec(readFileSync(new URL('../../../../../../database/migrations/0000000116-create-categorizables-table.sql', import.meta.url), 'utf8'))
  db.exec(readFileSync(new URL('../../../../../../database/migrations/0000000117-create-categorizable_models-table.sql', import.meta.url), 'utf8'))
  db.exec(readFileSync(new URL('../../../../../../database/migrations/0000000121-alter-categorizable_models-add-categorizable_id.sql', import.meta.url), 'utf8'))
  const { traitTableColumnGuarantees, sqlHelpers } = await import('@stacksjs/database')
  for (const { table, column, definition } of traitTableColumnGuarantees(sqlHelpers('sqlite'))) {
    if (table === 'categorizables')
      db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }
  const { buildDatabaseSchema } = await import('../../src/generate-database-schema')
  const schema = await buildDatabaseSchema({
    modelsDir: new URL('../../../../defaults/app/Models/Content', import.meta.url).pathname,
    defaultsDir: new URL('./no-default-models', import.meta.url).pathname,
    migrationsDir: false,
    dialect: 'sqlite',
    dryRun: true,
  })
  assert.deepEqual(schema.errors, [])
  const columns = schema.tables.find(table => table.table === 'categorizables')?.columns
  assert.ok(columns)
  assert.equal(columns.categorizable_id, 'number')
  assert.equal(columns.description, 'string | null')
  assert.equal(columns.is_active, 'number')
  for (const column of db.query<{ name: string }, []>('PRAGMA table_info(categorizables)').all())
    assert.ok(column.name in columns, `Model omitted existing column ${column.name}`)
  db.run("INSERT INTO posts VALUES (1, 'Post')")
  db.run("INSERT INTO categories VALUES (7, 'Commerce')")
  db.run("INSERT INTO categorizables (id, name, slug, categorizable_type) VALUES (7, 'Editorial', 'editorial', 'posts')")
  db.run("INSERT INTO categorizable_models (category_id, categorizable_id, categorizable_type) VALUES (7, 1, 'posts')")

  const post = await Post.with('categories').where('id', 1).first()
  const result = JSON.parse(JSON.stringify(post))
  assert.deepEqual(result.categories.map((category: { name: string }) => category.name), ['Editorial'])

  // Commerce can be disabled entirely without breaking CMS eager loading.
  db.run('DROP TABLE categories')
  const withoutCommerce = await Post.with('categories').where('id', 1).first()
  assert.deepEqual(JSON.parse(JSON.stringify(withoutCommerce)).categories, result.categories)
  console.log('post categories: passed')
}
finally {
  releaseOrm()
}
