/**
 * Dispatches a job by name with no options, runs the real worker, and reports
 * what happened to it. The job lives in the temp project this runs inside:
 * app/Jobs/FlakyJob.ts declares `tries: 2` and fails on its first run.
 * For worker-declared-retries.test.ts.
 */
import process from 'node:process'

const database = process.env.STACKS_QUEUE_FIXTURE_DB!
const { db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database } }, queryLogging: { enabled: false } } })

await db.unsafe('CREATE TABLE jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, queue TEXT, payload TEXT, attempts INTEGER, reserved_at INTEGER, available_at INTEGER, created_at TEXT)').execute()
await db.unsafe(`CREATE TABLE failed_jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT NOT NULL, connection TEXT NOT NULL, queue TEXT NOT NULL,
  payload TEXT NOT NULL, exception TEXT NOT NULL, attempts INTEGER, max_attempts INTEGER, duration_ms INTEGER,
  failed_at DATETIME DEFAULT CURRENT_TIMESTAMP, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME)`).execute()

const { buildMigrationPlan, generateSql, loadModels } = await import('bun-query-builder')
const plan = buildMigrationPlan(await loadModels({ modelsDir: new URL('../../../../defaults/app/Models', import.meta.url).pathname }), { dialect: 'sqlite' })
plan.tables = plan.tables.filter(table => table.table === 'queue_workers')
for (const statement of generateSql(plan)) await db.unsafe(statement).execute()

const { job } = await import('../../src/job')
const { startProcessor, stopProcessor } = await import('../../src/worker')

await job('FlakyJob' as never, {} as never).dispatch()

const processing = startProcessor('default')
const deadline = Date.now() + 15_000
let state = { jobs: 1, failed: 0 }
while (Date.now() < deadline) {
  await Bun.sleep(250)
  const jobs = await db.unsafe('SELECT COUNT(*) AS n FROM jobs').execute() as Array<{ n: number }>
  const failed = await db.unsafe('SELECT COUNT(*) AS n FROM failed_jobs').execute() as Array<{ n: number }>
  state = { jobs: Number(jobs[0]!.n), failed: Number(failed[0]!.n) }
  if (state.jobs === 0)
    break
}
await stopProcessor({ graceMs: 1000 })
await processing
const { readWorkerSnapshots } = await import('../../src/worker-monitor')
const snapshots = await readWorkerSnapshots()
const assert = (await import('node:assert/strict')).default
assert.equal(snapshots.length, 1)
assert.equal(snapshots[0]!.worker.status, 'stopped')
assert.equal(snapshots[0]!.metrics.completed, 1)
assert.equal(snapshots[0]!.metrics.failed, 1)
assert.equal(snapshots[0]!.activeJobs, 0)

const { runs } = await import(`${process.cwd()}/app/Jobs/FlakyJob.ts`)
console.log(JSON.stringify({ ...state, runs: runs() }))
process.exit(0)
