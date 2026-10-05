/**
 * Dispatches a job with `.withContext(...)` on the database driver, runs the
 * real worker, and reports what the job's handle received. The job lives in
 * the temp project this runs inside: app/Jobs/ContextJob.ts.
 * For job-context.test.ts.
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

const { job } = await import('../../src/job')
const { startProcessor, stopProcessor } = await import('../../src/worker')

await job('ContextJob' as never, { orderId: 7 } as never).withContext({ tenant: 'acme', userId: 42 }).dispatch()

void startProcessor('default')
const deadline = Date.now() + 15_000
let remaining = 1
while (Date.now() < deadline && remaining > 0) {
  await Bun.sleep(250)
  const jobs = await db.unsafe('SELECT COUNT(*) AS n FROM jobs').execute() as Array<{ n: number }>
  remaining = Number(jobs[0]!.n)
}
await stopProcessor({ graceMs: 1000 })

const failures = await db.unsafe('SELECT exception FROM failed_jobs').execute() as Array<{ exception: string }>
const { calls } = await import(`${process.cwd()}/app/Jobs/ContextJob.ts`)
console.log(JSON.stringify({ remaining, calls: calls(), failures: failures.map(row => row.exception.split('\n')[0]) }))
process.exit(0)
