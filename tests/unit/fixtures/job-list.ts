/**
 * Runs `readJobPage` against a disposable database of the given dialect, with
 * `jobs` and `failed_jobs` built from their models, and checks every page
 * against merging, filtering and slicing every row in memory, which is what
 * the Jobs list did (stacksjs/stacks#3201).
 */

import assert from 'node:assert/strict'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_JOB_LIST_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-job-list-'))
if (dialect === 'sqlite') {
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
}
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_job_list_'))
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
plan.tables = plan.tables.filter(table => table.table === 'jobs' || table.table === 'failed_jobs')
assert.equal(plan.tables.length, 2)
for (const table of plan.tables) {
  for (const column of table.columns)
    delete column.references
}

const { formatDate, FailedJob, Job, ormReady } = await import('@stacksjs/orm')
await ormReady
const { readJobPage } = await import('../../../storage/framework/defaults/app/Actions/Dashboard/Jobs/job-list')
const { matchesJobSearch, normalizeActiveJob, normalizeFailedJob } = await import('../../../storage/framework/defaults/app/Actions/Dashboard/Jobs/job-records')
type Query = Parameters<typeof readJobPage>[0]

const QUEUES = ['emails', 'reports', 'default']
const HOUR = 3_600_000
const START = Date.UTC(2026, 3, 1)

try {
  for (const statement of generateSql(plan))
    await db.unsafe(statement).execute()

  const now = Math.floor(Date.now() / 1000)
  for (let index = 0; index < 40; index++) {
    const id = index + 1
    const name = id % 6 === 0 ? 'SendNeedleDigest' : id % 2 ? 'SendWelcomeMail' : 'BuildReport'
    await db.insertInto('jobs').values({
      id,
      queue: QUEUES[id % 3],
      // Half name themselves by displayName, so their payload does not contain
      // "job" and only their `job-<id>` reference matches that search.
      payload: JSON.stringify(id % 2 ? { jobName: name, options: { tries: 3 } } : { displayName: name }),
      attempts: 0,
      available_at: now - 60,
      reserved_at: id % 4 === 0 ? now - 5 : null,
      created_at: formatDate(new Date(START + index * 2 * HOUR)),
    } as any).execute()
  }
  for (let index = 0; index < 30; index++) {
    const id = index + 1
    await db.insertInto('failed_jobs').values({
      id,
      uuid: crypto.randomUUID(),
      connection: id % 5 === 0 ? 'redis' : 'database',
      queue: QUEUES[(id + 1) % 3],
      payload: JSON.stringify({ jobName: id % 7 === 0 ? 'SendNeedleDigest' : 'ChargeCard' }),
      exception: id % 4 === 0 ? 'Error: Timeout after waiting' : 'Error: card declined',
      attempts: 3,
      max_attempts: 3,
      created_at: formatDate(new Date(START + index * 2 * HOUR + HOUR)),
    } as any).execute()
  }

  // What the list did: every row of both, merged newest first (a waiting job
  // before a failure at the same moment, then the higher id), filtered, sliced.
  const everything = [
    ...(await Job.orderByDesc('id').get()).map(normalizeActiveJob),
    ...(await FailedJob.orderByDesc('id').get()).map(normalizeFailedJob),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  function answer(query: Query) {
    return everything.filter(job => (!query.queue || job.queue === query.queue)
      && (!query.status || job.status === query.status)
      && matchesJobSearch(job, query.search))
  }

  async function check(label: string, query: Query): Promise<void> {
    const all = answer(query)
    const page = Math.min(query.page, Math.max(1, Math.ceil(all.length / query.perPage)))
    const result = await readJobPage(query)
    assert.equal(result.total, all.length, `${dialect} ${label}: total`)
    assert.equal(result.page, page, `${dialect} ${label}: page`)
    assert.deepEqual(result.data.map(job => job.id), all.slice((page - 1) * query.perPage, page * query.perPage).map(job => job.id), `${dialect} ${label}: rows`)
  }

  const base: Query = { page: 1, perPage: 25, queue: '', status: '', search: '' }
  // The seed must reach each case, or a check below passes on nothing.
  assert(answer({ ...base, status: 'processing' }).length > 0 && answer({ ...base, status: 'queued' }).length > 0)
  assert(answer({ ...base, search: 'needle' }).some(job => job.source === 'failed') && answer({ ...base, search: 'needle' }).some(job => job.source === 'job'))
  assert(everything.some(job => job.source === 'job' && !JSON.stringify(job.payload).toLowerCase().includes('job')), 'a waiting job whose payload does not say "job"')

  await check('first page across both tables', base)
  await check('a middle page', { ...base, page: 2 })
  await check('the last page', { ...base, page: 3 })
  await check('a page past the end moves back to the last', { ...base, page: 9 })
  for (const status of ['queued', 'processing', 'failed'] as const)
    await check(`status ${status}`, { ...base, status, perPage: 10 })
  await check('queue', { ...base, queue: 'reports' })
  await check('queue and status', { ...base, queue: 'emails', status: 'failed' })
  for (const search of ['needle', 'redis', 'timeout', 'emails', 'job', 'failed', 'processing', 'queued', 'job-12', 'failed-7'])
    await check(`search "${search}"`, { ...base, search, perPage: 50 })
  await check('search within a status', { ...base, search: 'needle', status: 'failed' })
  await check('no match', { ...base, search: 'nothing like this' })

  const { queues } = await readJobPage(base)
  assert.deepEqual(queues, [...new Set(everything.map(job => job.queue))].sort(), `${dialect}: every queue, for the filter`)

  console.log('jobs list OK')
}
finally { resetDatabaseConnection() }
