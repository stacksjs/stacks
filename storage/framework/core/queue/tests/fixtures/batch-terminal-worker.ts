import assert from 'node:assert/strict'

assert.equal(process.env.DB_CONNECTION, 'postgres')
assert(['127.0.0.1', 'localhost'].includes(process.env.DB_HOST!))
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'postgres', connections: { postgres: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD } }, queryLogging: { enabled: false } } })
await db.unsafe('CREATE TABLE jobs (id BIGSERIAL PRIMARY KEY, queue TEXT, payload TEXT, attempts INTEGER, reserved_at BIGINT, available_at BIGINT, created_at TEXT)').execute()
await db.unsafe('CREATE TABLE failed_jobs (id BIGSERIAL PRIMARY KEY, uuid TEXT, connection TEXT, queue TEXT, payload TEXT, exception TEXT, attempts INTEGER, max_attempts INTEGER, duration_ms BIGINT, failed_at TEXT, created_at TEXT, updated_at TEXT)').execute()
await db.unsafe('CREATE TABLE job_batches (id TEXT PRIMARY KEY, name TEXT, total_jobs INTEGER, pending_jobs INTEGER, failed_jobs INTEGER, failed_job_ids TEXT, options TEXT, cancelled_at TEXT, created_at TEXT, finished_at TEXT, then_handler TEXT, catch_handler TEXT, finally_handler TEXT)').execute()
const { Job } = await import('../../src/action')
const { Batch } = await import('../../src/batch')
const { getActiveJobCount, startProcessor, stopProcessor } = await import('../../src/worker')
const outcome = process.env.BATCH_TERMINAL_OUTCOME
const fail = outcome !== 'success'
let progress = 0
const definition = (await import(`${process.cwd()}/app/Jobs/BatchMember.ts`)).default
const entries = [{ job: new Job(definition), payload: { fail, member: 'first', _batchTerminalHandler: true } }]
if (fail) entries.push({ job: new Job(definition), payload: { fail: false, member: 'later', _batchTerminalHandler: true } })
const pending = Batch.create(entries).onQueue('default').progress(() => { progress++ })
if (outcome === 'partial') pending.allowFailures()
if (fail) pending.finallyHandler({ kind: 'job', name: 'BatchTerminal', payload: { event: outcome, _batchTerminalHandler: false } })
else pending.thenHandler({ kind: 'job', name: 'BatchTerminal', payload: { event: outcome, _batchTerminalHandler: false } })
const batch = await pending.dispatch()
void startProcessor('default', { concurrency: 1 })
try {
  const deadline = Date.now() + 15_000
  // A member's queue row is removed before its completion hooks enqueue the handler.
  while (getActiveJobCount() || (await db.selectFrom('jobs').select('id').execute()).length) {
    assert(Date.now() < deadline, 'the standard worker did not drain its owned jobs')
    await Bun.sleep(100)
  }
  const result = Bun.file(process.env.BATCH_TERMINAL_RESULT!)
  assert(await result.exists(), 'a terminal job must execute even when its parent batch was cancelled')
  const receipt = await result.json()
  assert.equal(receipt._batchId, batch.id, 'terminal handlers retain their batch context')
  assert.equal(receipt.event, outcome)
  const members = (await Bun.file(process.env.BATCH_MEMBER_RESULT!).text()).trim().split('\n').map(line => JSON.parse(line).member)
  assert.deepEqual(members, outcome === 'partial' ? ['first', 'later'] : ['first'], 'ordinary members still obey cancellation; allowFailures reaches the healthy member')
  assert.equal(await batch.failedJobs(), fail ? 1 : 0)
  assert.equal(await batch.pendingJobs(), outcome === 'failure' ? 1 : 0)
  assert.equal(progress, outcome === 'failure' ? 0 : 1, 'terminal jobs are not additional member completions')
  console.log('batch terminal worker OK')
}
finally {
  await stopProcessor({ graceMs: 1000 })
  resetDatabaseConnection()
}
