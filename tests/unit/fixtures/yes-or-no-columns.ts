/**
 * Four shipped yes-or-no fields as booleans, against a disposable database
 * of the given dialect (stacksjs/stacks#3300): the tables as the models now
 * define them, the dashboard's own create, edit and filter, and the values
 * the other writers of those columns produce.
 */

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_YES_OR_NO_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-yes-or-no-'))
if (dialect === 'sqlite') {
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
}
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_yes_or_no_'))
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

// The three tables as the models define them, for this dialect.
const TABLES = ['comments', 'email_lists', 'posts']
const { buildMigrationPlan, generateSql, loadModels } = await import('bun-query-builder')
const plan = buildMigrationPlan(await loadModels({ modelsDir: join(import.meta.dir, '../../../storage/framework/defaults/app/Models') }), { dialect })
plan.tables = plan.tables.filter(table => TABLES.includes(table.table))
assert.deepEqual(plan.tables.map(table => table.table).sort(), TABLES)
const columnTypes: Record<string, string> = {}
for (const table of plan.tables) {
  for (const column of table.columns) {
    delete column.references
    columnTypes[`${table.table}.${column.name}`] = String(column.type)
  }
}
// The models say yes or no, which is what the column is made as.
for (const column of ['email_lists.is_public', 'email_lists.double_opt_in', 'comments.is_approved', 'posts.is_featured'])
  assert.equal(columnTypes[column], 'boolean', column)

// generateSql also writes migration files under the working directory.
const scratch = mkdtempSync(join(tmpdir(), 'stacks-yes-or-no-sql-'))
writeFileSync(join(scratch, 'package.json'), '{}')
const cwd = process.cwd()
let statements: string[]
try {
  process.chdir(scratch)
  statements = generateSql(plan)
}
finally {
  process.chdir(cwd)
  rmSync(scratch, { recursive: true, force: true })
}

const orm = await import('@stacksjs/orm') as Record<string, any>
await orm.ormReady
// The server injects models as globals; the dashboard resolves them there.
;(globalThis as Record<string, unknown>).EmailList = orm.EmailList

const actions = '../../../storage/framework/defaults/app/Actions/Dashboard'
const { default: ModelStoreAction } = await import(`${actions}/Models/ModelStoreAction`)
const { default: ModelUpdateAction } = await import(`${actions}/Models/ModelUpdateAction`)
const { default: ModelShowAction } = await import(`${actions}/Models/ModelShowAction`)
const { marketingListWriteData } = await import(`${actions}/Marketing/marketing-list-records`)
const { emailListCreateData } = await import('../../../storage/framework/core/newsletter/src/lists')

interface Outcome { status: number, body: any }
async function answer(result: unknown): Promise<Outcome> {
  if (result instanceof Response)
    return { status: result.status, body: await result.json().catch(() => null) }
  return { status: 200, body: result }
}
const request = (params: Record<string, string>, body: Record<string, unknown>) => ({
  getParam: (key: string) => params[key],
  get: (key: string, fallback?: unknown) => body[key] ?? fallback,
  all: () => body,
  query: body,
}) as never

/** A stored yes or no, whatever the driver hands back for one: true, 1 or '1'. */
const yes = (value: unknown): boolean => value === true || value === 1 || value === '1'
async function list(id: number): Promise<{ is_public: boolean, double_opt_in: boolean }> {
  const row = await db.selectFrom('email_lists').select(['is_public', 'double_opt_in'] as never).where('id', '=', id).executeTakeFirst() as Record<string, unknown>
  return { is_public: yes(row.is_public), double_opt_in: yes(row.double_opt_in) }
}
async function listed(filters: unknown): Promise<number[]> {
  const query = { sort: 'id', dir: 'asc', filters: JSON.stringify(filters) }
  const shown = await answer(await ModelShowAction.handle(request({ slug: 'email-list' }, query)))
  assert.equal(shown.status, 200, JSON.stringify(shown.body))
  return (shown.body.rows as Array<{ id: number }>).map(row => Number(row.id))
}

try {
  for (const statement of statements)
    await db.unsafe(statement).execute()

  // 1. The form is told both are yes or no, and the list offers them as such.
  const shown = await answer(await ModelShowAction.handle(request({ slug: 'email-list' }, {})))
  assert.equal(shown.status, 200, JSON.stringify(shown.body))
  const field = (name: string) => shown.body.createFields.find((entry: any) => entry.name === name)
  assert.deepEqual([field('isPublic').type, field('isPublic').defaultValue], ['boolean', true])
  assert.deepEqual([field('doubleOptIn').type, field('doubleOptIn').defaultValue], ['boolean', true])
  const kinds = Object.fromEntries(shown.body.filterable.map((filter: any) => [filter.name, filter.kind]))
  assert.deepEqual([kinds.is_public, kinds.double_opt_in], ['boolean', 'boolean'])
  console.log(`PASS ${dialect}: the form and the list are told yes or no`)

  // 2. Created from the dashboard's own form, as a switch sends it.
  const created = await answer(await ModelStoreAction.handle(request({ slug: 'email-list' }, { fields: { name: 'Product news', slug: 'product-news', status: 'active', isPublic: true, doubleOptIn: false } })))
  assert.equal(created.status, 200, JSON.stringify(created.body))
  const first = Number(created.body.id)
  assert.deepEqual(await list(first), { is_public: true, double_opt_in: false })
  // Left out, each takes the model's default: yes.
  const defaulted = await answer(await ModelStoreAction.handle(request({ slug: 'email-list' }, { fields: { name: 'Staff', slug: 'staff', status: 'active' } })))
  assert.equal(defaulted.status, 200, JSON.stringify(defaulted.body))
  const second = Number(defaulted.body.id)
  assert.deepEqual(await list(second), { is_public: true, double_opt_in: true })
  console.log(`PASS ${dialect}: a list is created with its switches`)

  // 3. Edited: one switch turned, the other left as it was.
  const edited = await answer(await ModelUpdateAction.handle(request({ slug: 'email-list', id: String(first) }, { fields: { isPublic: false } })))
  assert.equal(edited.status, 200, JSON.stringify(edited.body))
  assert.deepEqual(await list(first), { is_public: false, double_opt_in: false })
  console.log(`PASS ${dialect}: a switch is turned from the edit form`)

  // 4. Filtered by yes and by no.
  assert.deepEqual(await listed({ is_public: 'true' }), [second])
  assert.deepEqual(await listed({ is_public: 'false' }), [first])
  assert.deepEqual(await listed({ double_opt_in: 'true', is_public: 'true' }), [second])
  console.log(`PASS ${dialect}: the list is narrowed by yes and by no`)

  // 5. What the other writers of these columns produce is taken as it is.
  // Each used to store a 1 or a 0 (and a featured post, the current time).
  const made = emailListCreateData({ name: 'Beta testers', isPublic: false })
  assert.deepEqual([made.is_public, made.double_opt_in], [false, true])
  await db.insertInto('email_lists').values({ ...made, uuid: crypto.randomUUID() } as never).execute()
  const written = marketingListWriteData({ name: 'Launch', isPublic: 1, double_opt_in: 'true' })
  assert.deepEqual([written.isPublic, written.doubleOptIn], [true, true])
  await db.insertInto('email_lists').values({ name: written.name, slug: written.slug, status: written.status, is_public: written.isPublic, double_opt_in: written.doubleOptIn, uuid: crypto.randomUUID() } as never).execute()
  assert.deepEqual(await listed({ is_public: 'false' }), [first, second + 1])

  await db.insertInto('comments').values({ author_name: 'Ava', author_email: 'ava@example.com', content: 'A first comment.', status: 'pending', is_approved: false } as never).execute()
  await db.updateTable('comments').set({ status: 'approved', is_approved: true } as never).where('author_email', '=', 'ava@example.com').execute()
  const comment = await db.selectFrom('comments').select(['is_approved'] as never).where('author_email', '=', 'ava@example.com').executeTakeFirst() as Record<string, unknown>
  assert.equal(yes(comment.is_approved), true)

  await db.insertInto('posts').values({ title: 'A featured post', content: 'Long enough to be content.', status: 'draft', views: 0, is_featured: true } as never).execute()
  await db.insertInto('posts').values({ title: 'An ordinary post', content: 'Long enough to be content.', status: 'draft', views: 0, is_featured: false } as never).execute()
  const posts = await db.selectFrom('posts').select(['title', 'is_featured'] as never).orderBy('title', 'asc').execute() as Array<Record<string, unknown>>
  assert.deepEqual(posts.map(post => yes(post.is_featured)), [true, false])
  console.log(`PASS ${dialect}: the other writers' values are stored`)

  // 6. The control. PostgreSQL refuses a number for a boolean column, which is
  // why the writers had to change; the others take it, which is why nothing
  // failed where most tests run.
  const number = db.insertInto('comments').values({ author_name: 'Ben', author_email: 'ben@example.com', content: 'A second comment.', status: 'approved', is_approved: 1 } as never)
  if (dialect === 'postgres')
    await assert.rejects(async () => { await number.execute() }, /boolean|integer/i)
  else
    await number.execute()
  console.log(`PASS ${dialect}: a number is ${dialect === 'postgres' ? 'refused' : 'still taken'}`)

  console.log('yes-or-no columns OK')
}
finally { resetDatabaseConnection() }
