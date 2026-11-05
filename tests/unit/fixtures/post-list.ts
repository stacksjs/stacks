/**
 * Runs `readPostPage` against a disposable database of the given dialect,
 * with `posts` built from the Post model, and checks every answer against one
 * computed here from the seed (stacksjs/stacks#3191).
 */

import assert from 'node:assert/strict'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_POST_LIST_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-post-list-'))
if (dialect === 'sqlite') {
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
}
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_post_list_'))
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
const plan = buildMigrationPlan(await loadModels({ modelsDir: join(import.meta.dir, '../../../storage/framework/defaults/app/Models/Content') }), { dialect })
plan.tables = plan.tables.filter(table => table.table === 'posts')
assert.equal(plan.tables.length, 1)
for (const column of plan.tables[0]!.columns)
  delete column.references

const { formatDate } = await import('@stacksjs/orm')
const { POST_PREVIEW_LENGTH, readPostPage } = await import('../../../storage/framework/defaults/app/Actions/Dashboard/Content/post-list')
type Query = Parameters<typeof readPostPage>[0]

const STATUSES = ['draft', 'published', 'archived'] as const
const COUNT = 60

interface Seed { id: number, title: string, excerpt: string | null, content: string, status: string, views: number, created_at: number }

// Titles in mixed case so a case-sensitive sort would show; "needle" is in
// the title of some posts, the excerpt of others and only deep in the body of
// others, past where the preview stops.
const seeds: Seed[] = Array.from({ length: COUNT }, (_, index) => {
  const id = index + 1
  const where = id % 5
  return {
    id,
    title: `${id % 2 ? 'alpha' : 'Beta'} post ${String(id).padStart(2, '0')}${where === 1 ? ' NEEDLE' : ''}`,
    excerpt: id % 3 === 0 ? null : `Excerpt ${id}${where === 2 ? ' with a Needle' : ''}`,
    content: `Body ${id} ${'x'.repeat(300)}${where === 3 ? ' needle at the end' : ''}`,
    status: STATUSES[id % 3]!,
    views: (id * 37) % 101,
    created_at: Date.UTC(2026, 0, 1) + id * 3_600_000,
  }
})

const base: Query = { page: 1, perPage: 25, search: '', status: 'all', sort: 'created_at', direction: 'desc' }

function expected(query: Query): Seed[] {
  const term = query.search.toLowerCase()
  const rows = seeds.filter(seed => (query.status === 'all' || seed.status === query.status)
    && (!term || [seed.title, seed.excerpt ?? '', seed.content].some(value => value.toLowerCase().includes(term))))
  const rank = { published: 0, draft: 1, archived: 2 } as Record<string, number>
  const key = (seed: Seed): number | string => query.sort === 'title' ? seed.title.toLowerCase()
    : query.sort === 'status' ? rank[seed.status]!
    : query.sort === 'views' ? seed.views : seed.created_at
  const sign = query.direction === 'asc' ? 1 : -1
  return rows.sort((a, b) => {
    const x = key(a)
    const y = key(b)
    return x < y ? -sign : x > y ? sign : b.id - a.id
  })
}

async function check(label: string, query: Query, expectedPage = query.page): Promise<void> {
  const result = await readPostPage(query)
  const all = expected(query)
  const page = Math.min(query.page, Math.max(1, Math.ceil(all.length / query.perPage)))
  assert.equal(page, expectedPage, `${dialect} ${label}: page`)
  assert.equal(result.total, all.length, `${dialect} ${label}: total`)
  assert.equal(result.page, page, `${dialect} ${label}: page returned`)
  const ids = all.slice((page - 1) * query.perPage, page * query.perPage).map(seed => seed.id)
  assert.deepEqual(result.rows.map(row => Number(row.id)), ids, `${dialect} ${label}: rows`)
  for (const row of result.rows) {
    assert(!('content' in row), `${dialect} ${label}: a row carries no body`)
    const seed = seeds.find(candidate => candidate.id === Number(row.id))!
    assert.equal(row.preview, seed.content.slice(0, POST_PREVIEW_LENGTH), `${dialect} ${label}: preview`)
  }
}

try {
  for (const statement of generateSql(plan))
    await db.unsafe(statement).execute()

  for (const seed of seeds) {
    await db.insertInto('posts').values({
      id: seed.id,
      uuid: crypto.randomUUID(),
      title: seed.title,
      excerpt: seed.excerpt,
      content: seed.content,
      status: seed.status,
      views: seed.views,
      created_at: formatDate(new Date(seed.created_at)),
    } as any).execute()
  }

  // The seed must reach each case, or a check below passes on nothing.
  assert(expected({ ...base, search: 'needle' }).length >= 30)
  assert(expected({ ...base, search: 'needle', status: 'draft' }).length > 0)

  await check('first page', base)
  await check('last page', { ...base, page: 3 })
  await check('a page past the end moves back to the last', { ...base, page: 9 }, 3)
  await check('status', { ...base, status: 'draft' })
  // Title, excerpt, and a body match beyond the preview; any case.
  await check('search', { ...base, search: 'nEeDlE', perPage: 50 })
  // The search is grouped: without its parentheses the OR would escape the
  // status filter and bring other statuses back.
  await check('search within a status', { ...base, search: 'needle', status: 'draft', perPage: 50 })
  await check('no match', { ...base, search: 'nothing like this' }, 1)
  await check('title, ignoring case', { ...base, sort: 'title', direction: 'asc' })
  await check('status, in its declared order', { ...base, sort: 'status', direction: 'asc', perPage: 50 })
  await check('views', { ...base, sort: 'views', direction: 'desc' })

  const counts = await readPostPage({ ...base, search: 'needle', status: 'draft' })
  assert.deepEqual({
    allCount: counts.allCount,
    publishedCount: counts.publishedCount,
    draftCount: counts.draftCount,
    archivedCount: counts.archivedCount,
    totalViews: counts.totalViews,
  }, {
    allCount: COUNT,
    publishedCount: seeds.filter(seed => seed.status === 'published').length,
    draftCount: seeds.filter(seed => seed.status === 'draft').length,
    archivedCount: seeds.filter(seed => seed.status === 'archived').length,
    totalViews: seeds.reduce((sum, seed) => sum + seed.views, 0),
  }, `${dialect}: the cards count every post, whatever the search`)

  console.log('posts list OK')
}
finally { resetDatabaseConnection() }
