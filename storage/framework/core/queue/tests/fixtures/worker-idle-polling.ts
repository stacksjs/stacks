import assert from 'node:assert/strict'

const dialect = process.env.DB_CONNECTION === 'postgres' ? 'postgres' : 'sqlite'
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: dialect, connections: { sqlite: { database: process.env.DB_DATABASE_PATH }, postgres: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD } }, queryLogging: { enabled: false } } })
const id = dialect === 'postgres' ? 'BIGSERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'
await db.unsafe(`CREATE TABLE jobs (id ${id}, queue TEXT, payload TEXT, attempts INTEGER, reserved_at BIGINT, available_at BIGINT, created_at TEXT)`).execute()
await db.unsafe(`CREATE TABLE failed_jobs (id ${id}, uuid TEXT, connection TEXT, queue TEXT, payload TEXT, exception TEXT, attempts INTEGER, max_attempts INTEGER, duration_ms BIGINT, failed_at TEXT, created_at TEXT, updated_at TEXT)`).execute()
const { storeJob } = await import('../../src/utils')
const { startProcessor, stopProcessor } = await import('../../src/worker')
const handled: number[] = []
Object.assign(globalThis, { recordQuickJob: (index: number) => { handled.push(index) } })
for (let index = 0; index < 3; index++) await storeJob('QuickJob', { queue: 'default', maxTries: 1, payload: { index } })
await storeJob('QuickJob', { queue: 'default', maxTries: 1, delay: 3600, payload: { index: 99 } })
const originalSetTimeout = globalThis.setTimeout
const prematureIdle: number[] = []
let observeIdle!: () => void
const idle = new Promise<void>(resolve => { observeIdle = resolve })
// Observe the real clock boundary without shortening or skipping any wait.
globalThis.setTimeout = ((callback: any, ms?: number, ...args: any[]) => {
  if (ms === 1000) {
    if (handled.length > 0 && handled.length < 3) prematureIdle.push(handled.length)
    if (handled.length === 3) observeIdle()
  }
  return originalSetTimeout(callback, ms, ...args)
}) as typeof setTimeout
let deadline: ReturnType<typeof setTimeout> | undefined
void startProcessor('default', { concurrency: 1 })
try {
  const expired = Promise.withResolvers<never>()
  deadline = originalSetTimeout(() => expired.reject(Error('Worker did not reach its real idle boundary')), 15000)
  await Promise.race([idle, expired.promise])
  assert.deepEqual(handled, [0, 1, 2], 'every runnable job must run, while the delayed job remains waiting')
  assert.deepEqual(prematureIdle, [], 'idle polling must not throttle a runnable backlog')
  assert.equal((await db.selectFrom('jobs').select('id').execute()).length, 1, 'draining runnable jobs must preserve delayed availability')
  console.log('worker idle polling OK')
}
finally {
  clearTimeout(deadline)
  globalThis.setTimeout = originalSetTimeout
  await stopProcessor({ graceMs: 1000 })
  resetDatabaseConnection()
}
