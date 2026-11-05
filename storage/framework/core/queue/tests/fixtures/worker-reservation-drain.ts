import assert from 'node:assert/strict'
import { mock } from 'bun:test'

const dialect = process.env.DB_CONNECTION === 'postgres' ? 'postgres' : 'sqlite'
const boundary = process.env.DRAIN_BOUNDARY
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const runtime = await import('@stacksjs/database/runtime')
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: dialect, connections: { sqlite: { database: process.env.DB_DATABASE_PATH }, postgres: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD } }, queryLogging: { enabled: false } } })
const id = dialect === 'postgres' ? 'BIGSERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'
await db.unsafe(`CREATE TABLE jobs (id ${id}, queue TEXT, payload TEXT, attempts INTEGER, reserved_at BIGINT, available_at BIGINT, created_at TEXT)`).execute()
await db.unsafe(`CREATE TABLE failed_jobs (id ${id}, uuid TEXT, connection TEXT, queue TEXT, payload TEXT, exception TEXT, attempts INTEGER, max_attempts INTEGER, duration_ms BIGINT, failed_at TEXT, created_at TEXT, updated_at TEXT)`).execute()
const { storeJob } = await import('../../src/utils')
await storeJob('DrainJob', { queue: 'default', maxTries: 1 })
const reached = Promise.withResolvers<void>()
const release = Promise.withResolvers<void>()
let held = false
// Preserve real SQL and pause only the return from the selected database call.
// The reservation case has already committed its CAS when shutdown arrives.
function observeBuilder(builder: any, operation: string, reserved = false): any {
  return new Proxy(Object.create(builder), { get(targetObject, key) {
    const target = Object.getPrototypeOf(targetObject)
    const value = Reflect.get(target, key)
    if (typeof value !== 'function') return value
    return (...args: any[]) => {
      const result = Reflect.apply(value, target, args)
      if (key === 'executeTakeFirst') return (async () => {
        const row = await result
        if (!held && row && ((boundary === 'selection' && operation === 'select') || (boundary === 'reservation' && reserved))) {
          held = true
          reached.resolve()
          await release.promise
        }
        return row
      })()
      return result && typeof result === 'object' ? observeBuilder(result, operation, reserved || (key === 'set' && args[0]?.reserved_at != null)) : result
    }
  } })
}
const observed = new Proxy(Object.create(db), { get(targetObject, key) {
  const target = Object.getPrototypeOf(targetObject)
  const value = Reflect.get(target, key)
  if (key === 'selectFrom' || key === 'updateTable') return (...args: any[]) => {
    const builder = Reflect.apply(value, target, args)
    return args[0] === 'jobs' ? observeBuilder(builder, key === 'selectFrom' ? 'select' : 'update') : builder
  }
  return typeof value === 'function' ? value.bind(target) : value
} })
mock.module('@stacksjs/database/runtime', () => ({ ...runtime, db: observed }))
const { startProcessor, stopProcessor } = await import('../../src/worker')
let handled = 0
Object.assign(globalThis, { recordDrainedJob: () => { handled++ } })
let deadline: ReturnType<typeof setTimeout> | undefined
const worker = startProcessor('default')
let stopped: Promise<void> | undefined
try {
  const expired = Promise.withResolvers<never>()
  deadline = setTimeout(() => expired.reject(Error('Worker never reached the controlled database boundary')), 5000)
  await Promise.race([reached.promise, expired.promise])
  let returned = false
  stopped = stopProcessor({ graceMs: 2000 }).then(() => { returned = true })
  // Keep the actual SQL response blocked while observing shutdown's promise.
  await Bun.sleep(50)
  assert.equal(returned, false, 'shutdown returned while a database claim could still reserve work')
  release.resolve()
  await stopped
  await worker
  const remaining = await db.selectFrom('jobs').selectAll().execute()
  if (boundary === 'reservation') {
    assert.equal(handled, 1, 'an already committed reservation must finish within the drain')
    assert.equal(remaining.length, 0, 'shutdown must leave no committed reservation stranded')
  }
  else {
    assert.equal(handled, 0, 'shutdown must not start a new reservation after selection returns')
    assert.equal(remaining.length, 1)
    assert.equal(remaining[0]!.reserved_at, null)
    assert.equal(Number(remaining[0]!.attempts), 0)
  }
  console.log('worker reservation drain OK')
}
finally {
  release.resolve()
  clearTimeout(deadline)
  await stopped
  await stopProcessor({ graceMs: 2000 })
  await worker
  resetDatabaseConnection()
}
