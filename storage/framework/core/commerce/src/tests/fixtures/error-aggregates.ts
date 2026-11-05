/**
 * The Errors page's stats, timeline and grouped list must answer what they
 * did when each one loaded the whole `errors` table, every stack included,
 * and aggregated it in memory (stacksjs/stacks#3181).
 *
 * The reference below is that in-memory algorithm, run over `fetchAll()`, so
 * a difference is a change in what the page shows rather than a fixture that
 * drifted. The table is built from the Error model, and the seed has more
 * groups than one stack batch holds, so the batched stack read is exercised.
 */

import assert from 'node:assert/strict'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_COMMERCE_ERROR_AGGREGATES_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-commerce-error-aggregates-'))
if (dialect === 'sqlite') {
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
}
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_error_aggregates_'))
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
const modelsDir = join(import.meta.dir, '../../../../../defaults/app/Models')
const plan = buildMigrationPlan(await loadModels({ modelsDir }), { dialect })
plan.tables = plan.tables.filter(table => table.table === 'errors')
assert.equal(plan.tables.length, 1)

const { formatDate } = await import('@stacksjs/orm')
const errors = await import('../../errors/fetch')
type ErrorRecord = Awaited<ReturnType<typeof errors.fetchAll>>[number]

function referenceStats(rows: ErrorRecord[], now: Date) {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)
  const last24h = rows.filter(e => new Date(e.created_at) >= yesterday).length
  const previous24h = rows.filter(e => new Date(e.created_at) >= twoDaysAgo && new Date(e.created_at) < yesterday).length
  return {
    total: rows.length,
    unresolved: rows.filter(e => (e.resolution ?? 'unresolved') === 'unresolved').length,
    resolved: rows.filter(e => e.resolution === 'resolved').length,
    ignored: rows.filter(e => e.resolution === 'ignored').length,
    last_24h: last24h,
    trend: previous24h === 0 ? (last24h > 0 ? 100 : 0) : Math.round(((last24h - previous24h) / previous24h) * 100),
  }
}

function referenceTimeline(rows: ErrorRecord[], now: Date) {
  const timeline: { hour: string, count: number }[] = []
  for (let i = 23; i >= 0; i--) {
    const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000)
    hourStart.setMinutes(0, 0, 0)
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)
    timeline.push({ hour: hourStart.toISOString(), count: rows.filter(e => new Date(e.created_at) >= hourStart && new Date(e.created_at) < hourEnd).length })
  }
  return timeline
}

function referenceGrouped(rows: ErrorRecord[]) {
  const groups = new Map<string, ErrorRecord[]>()
  for (const row of rows) {
    const key = `${row.type}:${row.message}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return [...groups.values()].map((group) => {
    const times = group.map(e => new Date(e.created_at).getTime())
    return {
      id: Number(group[0]!.id),
      type: group[0]!.type,
      message: group[0]!.message,
      stack: group[0]!.stack,
      status: group[0]!.resolution ?? 'unresolved',
      count: group.length,
      first_seen: new Date(Math.min(...times)).toISOString(),
      last_seen: new Date(Math.max(...times)).toISOString(),
      error_ids: group.map(e => Number(e.id)),
    }
  }).sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime())
}

// Offsets in hours, none near a 24h or 48h edge, so the two reads of "now"
// cannot land a row on different sides of one.
const OFFSETS = [0.5, 3, 10, 30, 40, 60, 200]
const RESOLUTIONS = ['unresolved', 'resolved', 'ignored'] as const
const GROUPS = 600

try {
  for (const statement of generateSql(plan))
    await db.unsafe(statement).execute()

  const now = Date.now()
  let id = 0
  for (let group = 0; group < GROUPS; group++) {
    for (let copy = 0; copy < 2; copy++) {
      id++
      const hours = OFFSETS[(group + copy * 3) % OFFSETS.length]! + group / 1000
      await db.insertInto('errors').values({
        id,
        type: `Type${group % 7}`,
        message: `message ${group}`,
        // Longer than any varchar(255), and different per row.
        stack: `Error: message ${group}\n${`    at frame (file-${id}.ts:1:1)\n`.repeat(40)}`,
        status: 500,
        resolution: RESOLUTIONS[group % 3],
        additional_info: 'x'.repeat(2000),
        created_at: formatDate(new Date(now - hours * 60 * 60 * 1000)),
      }).execute()
    }
  }

  // Errors resolved and then seen again: the group's newest occurrence is
  // unresolved, so the group is, whatever its older rows say.
  for (let recurring = 0; recurring < 3; recurring++) {
    for (const [hours, resolution] of [[150, 'resolved'], [120, 'resolved'], [0.2 + recurring / 100, 'unresolved']] as const) {
      id++
      await db.insertInto('errors').values({
        id,
        type: 'Recurring',
        message: `recurs ${recurring}`,
        stack: `Error: recurs ${recurring}\n${'    at frame (recur.ts:1:1)\n'.repeat(20)} ${id}`,
        status: 500,
        resolution,
        additional_info: null,
        created_at: formatDate(new Date(now - hours * 60 * 60 * 1000)),
      }).execute()
    }
  }

  const all = await errors.fetchAll()
  assert.equal(all.length, GROUPS * 2 + 9)

  const stats = await errors.fetchStats()
  const expectedStats = referenceStats(all, new Date())
  assert(expectedStats.last_24h > 0 && expectedStats.resolved > 0 && expectedStats.ignored > 0, 'the seed must reach every count')
  assert.deepEqual(stats, expectedStats, `${dialect}: stats`)

  const timeline = await errors.fetchTimeline()
  const expectedTimeline = referenceTimeline(all, new Date())
  assert(expectedTimeline.some(bucket => bucket.count > 0), 'the seed must reach the timeline')
  assert.deepEqual(timeline, expectedTimeline, `${dialect}: timeline`)

  const grouped = (await errors.fetchGrouped()).map(group => ({ ...group, id: Number(group.id), error_ids: group.error_ids.map(Number) }))
  const expectedGrouped = referenceGrouped(all)
  assert.equal(grouped.length, GROUPS + 3)
  assert(grouped.every(group => group.stack && group.stack.length > 255), `${dialect}: every group carries its representative's full stack`)
  assert.deepEqual(grouped, expectedGrouped, `${dialect}: grouped`)

  // A page of groups is the same grouping, a page at a time
  // (stacksjs/stacks#3195), with the newest occurrence deciding the state.
  const summaries = expectedGrouped.map(({ error_ids: _ids, ...group }) => group)
  type Query = Parameters<typeof errors.fetchGroupedPage>[0]
  const base: Query = { page: 1, perPage: 50, search: '', status: 'all', type: '' }
  async function everyPage(query: Omit<Query, 'page'>): Promise<{ groups: unknown[], totals: number[] }> {
    const groups: unknown[] = []
    const totals: number[] = []
    for (let page = 1; ; page++) {
      const result = await errors.fetchGroupedPage({ ...query, page })
      assert.equal(result.page, Math.min(page, Math.max(1, Math.ceil(result.total / query.perPage))))
      totals.push(result.total)
      groups.push(...result.groups.map(group => ({ ...group, id: Number(group.id) })))
      if (page * query.perPage >= result.total)
        return { groups, totals }
    }
  }
  const pageCases: Array<[string, Omit<Query, 'page'>, (group: typeof summaries[number]) => boolean]> = [
    ['every group', base, () => true],
    ['unresolved, recurring groups included', { ...base, status: 'unresolved' }, group => group.status === 'unresolved'],
    ['resolved', { ...base, status: 'resolved' }, group => group.status === 'resolved'],
    ['ignored', { ...base, status: 'ignored', perPage: 25 }, group => group.status === 'ignored'],
    ['search, any case', { ...base, search: 'MESSAGE 12' }, group => `${group.type} ${group.message}`.toLowerCase().includes('message 12')],
    ['type', { ...base, type: 'Type3' }, group => group.type === 'Type3'],
    ['type within a state', { ...base, type: 'Recurring', status: 'resolved' }, () => false],
  ]
  // Sorted pages: the reference order, with the most recently seen first among
  // equals, as the query orders them.
  const rank = { unresolved: 0, resolved: 1, ignored: 2 } as Record<string, number>
  const sortCases: Array<[string, Omit<Query, 'page'>, (group: typeof summaries[number]) => number | string]> = [
    ['most occurrences first', { ...base, sort: 'count', direction: 'desc' }, group => group.count],
    ['type, ignoring case', { ...base, sort: 'type', direction: 'asc' }, group => group.type.toLowerCase()],
    ['state, in its declared order', { ...base, sort: 'status', direction: 'asc' }, group => rank[group.status]!],
    ['least recently seen first', { ...base, sort: 'last_seen', direction: 'asc' }, group => new Date(group.last_seen).getTime()],
  ]
  for (const [label, query, key] of sortCases) {
    const sign = query.direction === 'asc' ? 1 : -1
    const expected = [...summaries].sort((a, b) => {
      const x = key(a)
      const y = key(b)
      return (x < y ? -sign : x > y ? sign : 0)
        || new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
        || b.id - a.id
    })
    assert.deepEqual((await everyPage(query)).groups, expected, `${dialect} groups page, ${label}`)
  }

  for (const [label, query, keep] of pageCases) {
    const expected = summaries.filter(keep)
    const { groups, totals } = await everyPage(query)
    assert(totals.every(total => total === expected.length), `${dialect} groups page, ${label}: total`)
    assert.deepEqual(groups, expected, `${dialect} groups page, ${label}`)
  }
  assert.equal(summaries.filter(group => group.type === 'Recurring' && group.status === 'unresolved').length, 3, 'the seed must reach the recurring case')
  const past = await errors.fetchGroupedPage({ ...base, page: 99 })
  assert.equal(past.page, Math.ceil(summaries.length / base.perPage), `${dialect}: a page past the end moves back to the last`)
  assert.deepEqual(past.types, [...new Set(all.map(error => error.type))].sort(), `${dialect}: every type, for the filter`)

  console.log('commerce error aggregates OK')
}
finally { resetDatabaseConnection() }
