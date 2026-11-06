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
const configPath = process.env.STACKS_OBSERVABILITY_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-dashboard-observability-'))
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

const { persistWorkerSnapshot, readWorkerSnapshots, workerSnapshotState, aggregateWorkerMetrics, pruneWorkerSnapshots, WORKER_RETENTION_MS } = await import('../../../storage/framework/core/queue/src/worker-monitor')
const { createDatabaseErrorReporter } = await import('../../../storage/framework/core/database/src/error-reporter')
const { captureError, flushErrorReporters } = await import('../../../storage/framework/core/error-handling/src/reporters')

if (process.env.STACKS_OBSERVABILITY_READ === '1') {
  const workers = await readWorkerSnapshots()
  assert.equal(workers.length, 2)
  assert.equal(workers.find(row => row.worker.id === 'probe-live')!.worker.status, 'active')
  assert.equal(workers.find(row => row.worker.id === 'probe-stale')!.worker.status, 'stopped')
  const metrics = aggregateWorkerMetrics(workers)
  assert.equal(metrics.counts.completed, 5)
  assert.equal(metrics.throughputPerMinute, 2)
  assert.equal(metrics.averageDuration, 150)
  const action = (await import('../../../storage/framework/defaults/app/Actions/Dashboard/Queue/QueueWorkersAction')).default
  const result = await action.handle() as any
  assert.equal(result.worker_running, true)
  assert.equal(result.active_jobs, 1)
  assert.equal(result.data.find((row: any) => row.id === 'probe-live').jobs_processed, 3)
  const errors = await db.unsafe('SELECT * FROM errors').execute() as Array<Record<string, unknown>>
  assert.equal(errors.length, 1, 'the same error identity is stored once')
  assert.equal(errors[0]!.message, 'observability probe')
  assert.equal(Number(errors[0]!.status), 503)
  assert.equal(errors[0]!.resolution, 'unresolved')
  assert.deepEqual(JSON.parse(String(errors[0]!.additional_info)), { requestId: 'probe-request', status: 503 })
  console.log('reader OK')
  resetDatabaseConnection()
}
else {
  const { buildMigrationPlan, generateSql, loadModels } = await import('bun-query-builder')
  const plan = buildMigrationPlan(await loadModels({ modelsDir: join(import.meta.dir, '../../../storage/framework/defaults/app/Models') }), { dialect })
  plan.tables = plan.tables.filter(table => ['queue_workers', 'errors', 'categorizables', 'categorizable_models'].includes(table.table))
  assert.equal(plan.tables.length, 4)
  for (const table of plan.tables) for (const column of table.columns) delete column.references
  try {
    for (const statement of generateSql(plan)) await db.unsafe(statement).execute()
    const CategoryStore = (await import('../../../storage/framework/defaults/app/Actions/Dashboard/Content/CategoryStoreAction')).default
    const CategoryIndex = (await import('../../../storage/framework/defaults/app/Actions/Dashboard/Content/CategoryIndexAction')).default
    const CategoryDestroy = (await import('../../../storage/framework/defaults/app/Actions/Dashboard/Content/CategoryDestroyAction')).default
    const created = await CategoryStore.handle({ get: (key: string) => ({ name: 'Training', description: 'CMS category', slug: 'training' })[key] } as any) as Response
    assert.equal(created.status, 201, await created.clone().text())
    const category = await created.json() as { id: number }
    const index = await CategoryIndex.handle() as { categories: Array<{ id: number }> }
    assert.equal(index.categories.length, 1)
    const deleted = await CategoryDestroy.handle({ getParam: () => category.id } as any) as Response
    assert.equal(deleted.status, 200)
    assert.equal((await CategoryIndex.handle() as { categories: unknown[] }).categories.length, 0)
    const now = Date.now()
    const makeSnapshot = (id: string, heartbeatAt: number) => ({
      worker: { id, status: 'active' as const, queue: 'health-sync', processedCount: 3, failedCount: 1, startedAt: new Date(now - 120000).toISOString(), lastActivityAt: new Date(now).toISOString() },
      heartbeatAt, activeJobs: 1, metrics: { completed: 3, failed: 1, throughputPerMinute: 2, averageDuration: 150 },
    })
    const live = makeSnapshot('probe-live', now)
    await persistWorkerSnapshot(live)
    await persistWorkerSnapshot(live)
    await persistWorkerSnapshot({ ...makeSnapshot('probe-stale', now - 120000), metrics: { completed: 2, failed: 0, throughputPerMinute: 7, averageDuration: 999 } })
    await persistWorkerSnapshot(makeSnapshot('probe-expired', now - WORKER_RETENTION_MS - 1))
    await pruneWorkerSnapshots(now)
    assert.equal((await readWorkerSnapshots(now)).length, 2, 'upserts do not duplicate workers and retention prunes old sessions')
    const stopped = workerSnapshotState({ ...live, worker: { ...live.worker, status: 'stopped' } }, now)
    assert.equal(stopped.activeJobs, 0)
    assert.equal(stopped.metrics.throughputPerMinute, 0)
    const overrides = (globalThis as any)[Symbol.for('@stacksjs/config:overrides')]
    overrides.monitoring = { enabled: true, reporters: [createDatabaseErrorReporter()] }
    const error = new Error('observability probe')
    captureError(error, { requestId: 'probe-request', status: 503, authorization: 'secret-must-not-be-stored', body: { password: 'private' } })
    captureError(error)
    await flushErrorReporters()
    const child = Bun.spawn([process.execPath, `--config=${configPath}`, '--no-env-file', import.meta.path], {
      env: { ...process.env, STACKS_OBSERVABILITY_READ: '1' }, stdout: 'pipe', stderr: 'pipe',
    })
    const [code, output, errors] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    assert.equal(code, 0, output + errors)
    assert(output.includes('reader OK'))
    console.log('dashboard observability OK')
  }
  finally { resetDatabaseConnection() }
}
