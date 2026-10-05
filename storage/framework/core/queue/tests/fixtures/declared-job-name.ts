/**
 * Dispatches a job under the name it declares, runs the real worker, and
 * reports what happened. The job lives in the temp project this runs inside:
 * app/Jobs/NightlyReport.ts declares `name: 'Nightly Report'`.
 * For declared-job-name.test.ts.
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

const { Job } = await import('../../src/action')
const { startProcessor, stopProcessor } = await import('../../src/worker')

// What `export default new Job({ name: 'Nightly Report', ... })` dispatches:
// the envelope carries the declared name, not the file's.
await new Job({ name: 'Nightly Report', handle: () => {} }).dispatch({ day: '2026-10-05' } as never)
const envelope = await db.unsafe('SELECT payload FROM jobs').execute() as Array<{ payload: string }>

void startProcessor('default')
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

const failures = await db.unsafe('SELECT exception FROM failed_jobs').execute() as Array<{ exception: string }>
const { received } = await import(`${process.cwd()}/app/Jobs/NightlyReport.ts`)
console.log(JSON.stringify({ ...state, received: received(), envelopeName: JSON.parse(envelope[0]!.payload).jobName, failures: failures.map(row => row.exception.split('\n')[0]) }))
process.exit(0)
