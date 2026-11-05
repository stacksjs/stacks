/**
 * Runs `readCommentPage` against a disposable database of the given dialect,
 * with `comments` and `posts` built from their models and `commentables` from
 * the trait's own DDL, and checks every answer against one computed here from
 * the seed (stacksjs/stacks#3193).
 */

import assert from 'node:assert/strict'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_COMMENT_LIST_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-comment-list-'))
if (dialect === 'sqlite') {
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
}
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_comment_list_'))
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

const { buildMigrationPlan, generateSql, loadModels } = await import('bun-query-builder')
const { commentablesTableSql, sqlHelpers } = await import('@stacksjs/database')
const modelsDir = join(import.meta.dir, '../../../storage/framework/defaults/app/Models')
const models = { ...(await loadModels({ modelsDir })), ...(await loadModels({ modelsDir: join(modelsDir, 'Content') })) }
const plan = buildMigrationPlan(models, { dialect })
plan.tables = plan.tables.filter(table => table.table === 'comments' || table.table === 'posts')
assert.equal(plan.tables.length, 2)
for (const table of plan.tables) {
  for (const column of table.columns)
    delete column.references
}

const { formatDate } = await import('@stacksjs/orm')
const { readCommentPage } = await import('../../../storage/framework/defaults/app/Actions/Dashboard/Content/comment-list')
type Query = Parameters<typeof readCommentPage>[0]

const LEGACY_STATUSES = ['pending', 'approved', 'spam', 'trash'] as const
// Stored by the trait, with the case it does not promise, and how each shows.
const TRAIT_STATUSES = [['pending', 'pending'], ['Approved', 'approved'], ['rejected', 'spam'], ['approved', 'approved']] as const

interface Expected { key: string, author: string, email: string, content: string, owner: string, status: string, at: number }

const HOUR = 3_600_000
const START = Date.UTC(2026, 0, 5)
const posts = Array.from({ length: 4 }, (_, index) => ({ id: index + 1, title: index === 2 ? 'A post about Needles' : `Post ${index + 1}` }))
const expected: Expected[] = []

try {
  for (const statement of generateSql(plan))
    await db.unsafe(statement).execute()
  await db.unsafe(commentablesTableSql(sqlHelpers(dialect))).execute()

  for (const post of posts)
    await db.insertInto('posts').values({ id: post.id, uuid: crypto.randomUUID(), title: post.title, content: 'Body of the post', status: 'published' } as any).execute()

  // 40 CMS comments and 32 trait comments, a day and a few hours apart and
  // interleaved, so the weekday of each differs and the two tables alternate.
  for (let index = 0; index < 40; index++) {
    const id = index + 1
    const at = START + index * 26 * HOUR
    const status = LEGACY_STATUSES[index % 4]!
    const content = `CMS comment ${id}${id % 6 === 0 ? ' with a needle' : ''}`
    const author = id % 9 === 0 ? 'Needle Fan' : `Reader ${id}`
    await db.insertInto('comments').values({ id, uuid: crypto.randomUUID(), author_name: author, author_email: `reader${id}@example.com`, content, status, post_title: `Post ${(id % 4) + 1}`, created_at: formatDate(new Date(at)) } as any).execute()
    expected.push({ key: `comments:${id}`, author, email: `reader${id}@example.com`, content, owner: `Post ${(id % 4) + 1}`, status, at })
  }
  for (let index = 0; index < 32; index++) {
    const id = index + 1
    const at = START + index * 26 * HOUR + 13 * HOUR
    const [stored, shown] = TRAIT_STATUSES[index % 4]!
    const post = posts[index % 4]!
    const body = `Trait comment ${id}${id % 7 === 0 ? ' NEEDLE inside' : ''}`
    // The trait writes ISO timestamps with a T; the CMS writes a space.
    await db.unsafe(`INSERT INTO commentables (id, title, body, status, commentables_id, commentables_type, author_name, author_email, created_at) VALUES (${id}, '', '${body}', '${stored}', ${post.id}, 'posts', 'Guest ${id}', 'guest${id}@example.com', '${new Date(at).toISOString().slice(0, 19)}')`).execute()
    expected.push({ key: `commentables:${id}`, author: `Guest ${id}`, email: `guest${id}@example.com`, content: body, owner: post.title, status: shown, at })
  }

  const newest = (a: Expected, b: Expected) => b.at - a.at || b.key.localeCompare(a.key)
  function answer(query: Query): Expected[] {
    const term = query.search.toLowerCase()
    return expected
      .filter(row => (query.status === 'all' || row.status === query.status)
        && (!term || [row.content, row.author, row.email, row.owner].some(value => value.toLowerCase().includes(term))))
      .sort(newest)
  }

  async function check(label: string, query: Query, expectedPage = query.page): Promise<void> {
    const result = await readCommentPage(query)
    const all = answer(query)
    const page = Math.min(query.page, Math.max(1, Math.ceil(all.length / query.perPage)))
    assert.equal(page, expectedPage, `${dialect} ${label}: page`)
    assert.equal(result.total, all.length, `${dialect} ${label}: total`)
    assert.equal(result.page, page, `${dialect} ${label}: page returned`)
    assert.deepEqual(result.rows.map(row => row.key), all.slice((page - 1) * query.perPage, page * query.perPage).map(row => row.key), `${dialect} ${label}: rows`)
    for (const row of result.rows) {
      const seed = expected.find(candidate => candidate.key === row.key)!
      assert.equal(row.post_title, seed.owner, `${dialect} ${label}: what ${row.key} was left on`)
      assert.equal(row.status, seed.status, `${dialect} ${label}: the status ${row.key} shows`)
    }
  }

  const base: Query = { page: 1, perPage: 25, search: '', sort: 'created_at', direction: 'desc', status: 'all' }

  // The seed must reach each case, or a check below passes on nothing.
  assert(answer({ ...base, search: 'needle' }).some(row => row.key.startsWith('commentables:') && !row.content.toLowerCase().includes('needle')), 'a match on the owner title alone')
  assert(answer({ ...base, search: 'needle' }).some(row => row.key.startsWith('comments:') && row.author === 'Needle Fan'), 'a match on the author alone')

  await check('first page, both tables newest first', base)
  await check('a middle page', { ...base, page: 2 })
  await check('the last page', { ...base, page: 3 })
  await check('a page past the end moves back to the last', { ...base, page: 8 }, 3)
  for (const status of ['pending', 'approved', 'spam', 'trash'] as const)
    await check(`status ${status}`, { ...base, status, perPage: 10 })
  await check('search: body, author or what it was left on, any case', { ...base, search: 'nEeDlE' })
  await check('search within a status', { ...base, search: 'needle', status: 'approved' })
  await check('no match', { ...base, search: 'nothing like this' }, 1)

  const { counts } = await readCommentPage({ ...base, search: 'needle', status: 'spam' })
  const shown = (status: string) => expected.filter(row => row.status === status).length
  assert.deepEqual(counts, { all: expected.length, pending: shown('pending'), approved: shown('approved'), spam: shown('spam'), trash: shown('trash') }, `${dialect}: the cards count every comment, whatever the search`)

  console.log('comments list OK')
}
finally { resetDatabaseConnection() }
