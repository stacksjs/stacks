/**
 * Runs `readPageListPage` against a disposable database of the given dialect,
 * with `pages` built from the Page model, and checks every answer against one
 * computed here from the seed (stacksjs/stacks#3192).
 */

import assert from 'node:assert/strict'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_PAGE_LIST_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-page-list-'))
if (dialect === 'sqlite') {
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
}
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_page_list_'))
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
plan.tables = plan.tables.filter(table => table.table === 'pages')
assert.equal(plan.tables.length, 1)
for (const column of plan.tables[0]!.columns)
  delete column.references

const { formatDate } = await import('@stacksjs/orm')
const { readPageListPage } = await import('../../../storage/framework/defaults/app/Actions/Dashboard/Content/page-list')
type Query = Parameters<typeof readPageListPage>[0]

const COUNT = 60
const TEMPLATES = ['default', 'Landing', 'docs']

interface Seed { id: number, title: string, template: string, views: number, conversions: number, published_at: number | null, created_at: number }

// Mixed-case titles and templates; "needle" in some titles and one template.
const seeds: Seed[] = Array.from({ length: COUNT }, (_, index) => {
  const id = index + 1
  return {
    id,
    title: `${id % 2 ? 'about' : 'Contact'} page ${String(id).padStart(2, '0')}${id % 7 === 0 ? ' NEEDLE' : ''}`,
    template: id % 11 === 0 ? 'Needle-template' : TEMPLATES[id % 3]!,
    views: (id * 31) % 97,
    conversions: id % 5,
    published_at: id % 4 === 0 ? null : Date.UTC(2026, 1, 1) + ((id * 7) % 60) * 86_400_000,
    created_at: Date.UTC(2026, 0, 1) + id * 3_600_000,
  }
})

const base: Query = { page: 1, perPage: 25, search: '', sort: 'created_at', direction: 'desc' }

function expected(query: Query): Seed[] {
  const term = query.search.toLowerCase()
  const rows = seeds.filter(seed => !term || [seed.title, seed.template].some(value => value.toLowerCase().includes(term)))
  const sign = query.direction === 'asc' ? 1 : -1
  const compare = (x: number | string, y: number | string): number => (x < y ? -sign : x > y ? sign : 0)
  return rows.sort((a, b) => {
    let order = 0
    if (query.sort === 'title')
      order = compare(a.title.toLowerCase(), b.title.toLowerCase())
    else if (query.sort === 'published')
      order = compare(a.published_at === null ? 0 : 1, b.published_at === null ? 0 : 1) || (a.published_at !== null && b.published_at !== null ? compare(a.published_at, b.published_at) : 0)
    else
      order = compare(a.created_at, b.created_at)
    return order || b.id - a.id
  })
}

async function check(label: string, query: Query, expectedPage = query.page): Promise<void> {
  const result = await readPageListPage(query)
  const all = expected(query)
  const page = Math.min(query.page, Math.max(1, Math.ceil(all.length / query.perPage)))
  assert.equal(page, expectedPage, `${dialect} ${label}: page`)
  assert.equal(result.total, all.length, `${dialect} ${label}: total`)
  assert.equal(result.page, page, `${dialect} ${label}: page returned`)
  assert.deepEqual(result.rows.map(row => Number(row.id)), all.slice((page - 1) * query.perPage, page * query.perPage).map(seed => seed.id), `${dialect} ${label}: rows`)
  for (const row of result.rows)
    assert(!('blocks' in row) && !('path' in row), `${dialect} ${label}: a row carries only the listed columns`)
}

try {
  for (const statement of generateSql(plan))
    await db.unsafe(statement).execute()

  for (const seed of seeds) {
    await db.insertInto('pages').values({
      id: seed.id,
      uuid: crypto.randomUUID(),
      title: seed.title,
      slug: `page-${seed.id}`,
      template: seed.template,
      views: seed.views,
      conversions: seed.conversions,
      published_at: seed.published_at === null ? null : formatDate(new Date(seed.published_at)),
      created_at: formatDate(new Date(seed.created_at)),
    } as any).execute()
  }

  // The seed must reach each case, or a check below passes on nothing.
  assert(expected({ ...base, search: 'needle' }).some(seed => !seed.title.includes('NEEDLE')), 'a template-only match')
  assert(seeds.some(seed => seed.published_at === null) && seeds.some(seed => seed.published_at !== null))

  await check('first page', base)
  await check('last page', { ...base, page: 3 })
  await check('a page past the end moves back to the last', { ...base, page: 7 }, 3)
  await check('search, title or template, any case', { ...base, search: 'nEeDlE' })
  await check('no match', { ...base, search: 'nothing like this' }, 1)
  await check('title, ignoring case', { ...base, sort: 'title', direction: 'asc' })
  await check('drafts first, then by publish date', { ...base, sort: 'published', direction: 'asc', perPage: 50 })
  await check('published first, newest publish date first', { ...base, sort: 'published', direction: 'desc', perPage: 50 })

  const totals = await readPageListPage({ ...base, search: 'needle' })
  assert.deepEqual({
    allCount: totals.allCount,
    totalViews: totals.totalViews,
    totalConversions: totals.totalConversions,
    newestTitle: totals.newestTitle,
  }, {
    allCount: COUNT,
    totalViews: seeds.reduce((sum, seed) => sum + seed.views, 0),
    totalConversions: seeds.reduce((sum, seed) => sum + seed.conversions, 0),
    newestTitle: seeds[COUNT - 1]!.title,
  }, `${dialect}: the cards count every page, whatever the search`)

  console.log('pages list OK')
}
finally { resetDatabaseConnection() }
