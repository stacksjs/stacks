import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buddyOptionArgs } from '@stacksjs/cli'
const { db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database: process.env.DB_DATABASE_PATH } }, queryLogging: { enabled: false } } })
// Minimal owned queue fixtures; no application or production schema is touched.
await db.unsafe('CREATE TABLE jobs (id INTEGER PRIMARY KEY, queue TEXT, payload TEXT, attempts INTEGER DEFAULT 0, reserved_at INTEGER, available_at INTEGER, created_at TEXT, updated_at TEXT)').execute()
await db.unsafe('CREATE TABLE failed_jobs (id INTEGER PRIMARY KEY, uuid TEXT, connection TEXT, queue TEXT, payload TEXT, exception TEXT, failed_at TEXT, created_at TEXT, updated_at TEXT)').execute()
await db.unsafe('CREATE TABLE queue_circuit_state (queue_name TEXT PRIMARY KEY, failure_count INTEGER DEFAULT 0, success_count INTEGER DEFAULT 0, window_start TEXT, paused_at TEXT, resume_at TEXT)').execute()
const queue = '01=mail queue'
await db.insertInto('jobs').values([{ id: 1, queue, payload: '{}' }, { id: 2, queue: 'unrelated', payload: '{}' }]).execute()
const setup = join(process.cwd(), 'queue-setup.ts')
const databaseModule = import.meta.resolve('@stacksjs/database')
await writeFile(setup, `const { ensureDatabaseConfigLoaded, initializeDbConfig } = await import(${JSON.stringify(databaseModule)}); await ensureDatabaseConfigLoaded(); initializeDbConfig({app:{env:'test'},database:{default:'sqlite',connections:{sqlite:{database:process.env.DB_DATABASE_PATH}},queryLogging:{enabled:false}}});`)
async function action(name: string, options: Record<string, unknown>) {
  const file = new URL(`../../src/queue/${name}.ts`, import.meta.url).pathname
  const child = Bun.spawn([process.execPath, '--no-env-file', '--config=/dev/null', '--preload', setup, file, ...buddyOptionArgs(options)], { cwd: process.cwd(), env: process.env, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  return { code, output: stdout + stderr }
}
let result = await action('pause', { queue, for: 120 }); assert.equal(result.code, 0, result.output)
let circuit = await db.selectFrom('queue_circuit_state').selectAll().where('queue_name', '=', queue).executeTakeFirst()
assert(circuit?.paused_at); assert(circuit?.resume_at)
result = await action('resume', { queue }); assert.equal(result.code, 0, result.output)
circuit = await db.selectFrom('queue_circuit_state').selectAll().where('queue_name', '=', queue).executeTakeFirst()
assert.equal(circuit?.paused_at, null)
for (const name of ['list', 'status']) {
  result = await action(name, { queue }); assert.equal(result.code, 0, result.output)
  assert(result.output.includes(queue)); assert(!result.output.includes('unrelated'))
}
result = await action('inspect', { id: 1 }); assert.equal(result.code, 0, result.output)
result = await action('clear', { queue, force: true }); assert.equal(result.code, 0, result.output)
assert.deepEqual((await db.selectFrom('jobs').select(['id']).execute()).map(row => Number(row.id)), [2])
result = await action('clear', { queue: 'unrelated', force: 'false' }); assert.notEqual(result.code, 0)
assert.equal((await db.selectFrom('jobs').selectAll().execute()).length, 1)
await db.insertInto('failed_jobs').values({ id: 3, uuid: 'failed-fixture', connection: 'database', queue, payload: JSON.stringify({ jobName: 'RecoveredJob', payload: {}, options: { queue }, envelopeVersion: 1 }), exception: 'fixture', failed_at: new Date().toISOString() }).execute()
await db.insertInto('failed_jobs').values({ id: 4, uuid: 'unrelated-failure', connection: 'database', queue: 'unrelated', payload: '{}', exception: 'unrelated failure', failed_at: new Date().toISOString() }).execute()
result = await action('failed', { queue }); assert.equal(result.code, 0, result.output)
assert(result.output.includes(queue)); assert(!result.output.includes('unrelated failure'))
result = await action('inspect', { id: 3, failed: true }); assert.equal(result.code, 0, result.output)
result = await action('flush', { queue: 'unrelated', force: true }); assert.equal(result.code, 0, result.output)
assert.deepEqual((await db.selectFrom('failed_jobs').select(['id']).execute()).map(row => Number(row.id)), [3])
result = await action('retry', { id: 3 }); assert.equal(result.code, 0, result.output)
assert.equal((await db.selectFrom('failed_jobs').selectAll().execute()).length, 0)
const jobs = await db.selectFrom('jobs').selectAll().execute()
assert(jobs.some(row => row.queue === 'unrelated')); assert(jobs.some(row => row.queue === queue))
console.log('scoped queue controls preserve unrelated jobs')
