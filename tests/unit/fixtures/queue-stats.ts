/**
 * Runs `readQueueCounts` against a disposable database of the given dialect,
 * with `jobs` and `failed_jobs` built from their models, and checks it against
 * the loop over every row it replaced (stacksjs/stacks#3200).
 */

import assert from 'node:assert/strict'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_QUEUE_STATS_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-queue-stats-'))
if (dialect === 'sqlite') {
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
}
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_queue_stats_'))
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
const plan = buildMigrationPlan(await loadModels({ modelsDir: join(import.meta.dir, '../../../storage/framework/defaults/app/Models') }), { dialect })
plan.tables = plan.tables.filter(table => table.table === 'jobs' || table.table === 'failed_jobs')
assert.equal(plan.tables.length, 2)
for (const table of plan.tables) {
  for (const column of table.columns)
    delete column.references
}

const { readQueueCounts } = await import('../../../storage/framework/defaults/app/Actions/Dashboard/Queue/queue-stats')
const { queuedJobState } = await import('@stacksjs/queue')

/** The loop this replaced, over every row, as QueueStatsAction ran it. */
function reference(jobs: Array<Record<string, unknown>>, failedJobs: Array<Record<string, unknown>>) {
  const failedByQueue = new Map<string, number>()
  for (const f of failedJobs) {
    const name = String(f.queue || 'default')
    failedByQueue.set(name, (failedByQueue.get(name) ?? 0) + 1)
  }
  const queueMap: Record<string, { pending: number, active: number, total: number }> = {}
  for (const j of jobs) {
    const name = String(j.queue || 'default')
    const bucket = queueMap[name] ??= { pending: 0, active: 0, total: 0 }
    bucket.total++
    if (queuedJobState({ reserved_at: j.reserved_at, available_at: j.available_at }) === 'processing')
      bucket.active++
    else
      bucket.pending++
  }
  for (const name of failedByQueue.keys())
    queueMap[name] ??= { pending: 0, active: 0, total: 0 }
  return Object.entries(queueMap).map(([name, data]) => ({ name, pending: data.pending, active: data.active, failed: failedByQueue.get(name) ?? 0, total: data.total }))
}

try {
  for (const statement of generateSql(plan))
    await db.unsafe(statement).execute()

  const now = Math.floor(Date.now() / 1000)
  // Queues in the order their first job arrives; '' and 'default' are one
  // queue (the column is NOT NULL). reserved_at set, 0, and NULL;
  // available_at past and future.
  const QUEUES = ['emails', '', 'reports', 'default', 'emails', 'reports', '']
  let id = 0
  for (let round = 0; round < 6; round++) {
    for (const queue of QUEUES) {
      id++
      const reserved = id % 3 === 0 ? now - 30 : id % 3 === 1 ? null : 0
      await db.insertInto('jobs').values({ id, queue, payload: '{"jobName":"Probe"}', attempts: 0, available_at: id % 4 === 0 ? now + 600 : now - 600, reserved_at: reserved } as any).execute()
    }
  }
  const FAILED = ['emails', 'emails', '', 'default', 'ghost']
  for (const [index, queue] of FAILED.entries())
    await db.insertInto('failed_jobs').values({ id: index + 1, uuid: crypto.randomUUID(), connection: 'database', queue, payload: '{}', exception: 'Error: probe' } as any).execute()

  const jobs = await db.unsafe('SELECT id, queue, reserved_at, available_at FROM jobs ORDER BY id').execute() as Array<Record<string, unknown>>
  const failedJobs = await db.unsafe('SELECT id, queue FROM failed_jobs ORDER BY id').execute() as Array<Record<string, unknown>>
  const expected = reference(jobs, failedJobs)

  // The seed must reach each case, or the comparison passes on nothing.
  assert(expected.some(queue => queue.active > 0 && queue.pending > 0), 'active and pending in one queue')
  assert(jobs.some(job => job.reserved_at === 0 || job.reserved_at === '0'), 'a reserved_at of 0')
  assert(expected.some(queue => queue.name === 'ghost' && queue.failed === 1 && queue.total === 0), 'a queue with only failures stays visible')

  assert.deepEqual(await readQueueCounts(), expected, `${dialect}: per-queue counts`)
  console.log('queue stats OK')
}
finally { resetDatabaseConnection() }
