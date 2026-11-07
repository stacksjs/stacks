import assert from 'node:assert/strict'
import { captureProcessLeaseOwner } from '../../src/process-owner'

const { db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: { default: 'sqlite', connections: { sqlite: { database: process.env.DB_DATABASE_PATH } }, queryLogging: { enabled: false } } })
await db.unsafe('CREATE TABLE jobs (id INTEGER PRIMARY KEY, queue TEXT, payload TEXT, attempts INTEGER, reserved_at INTEGER, available_at INTEGER, created_at TEXT)').execute()
const owner = captureProcessLeaseOwner()!
assert(owner)
const now = Math.floor(Date.now() / 1000)
const owners = [{ ...owner, birth: `${BigInt(owner.birth) + 1n}` }, owner, { ...owner, host: 'another-host' }, undefined]
for (const [index, value] of owners.entries()) await db.insertInto('jobs').values({
  id: index + 1, queue: 'default', payload: JSON.stringify({ jobName: 'RecoveredJob', payload: {}, options: { tries: 3 }, envelopeVersion: 1, _queueProcessOwner: value }),
  attempts: 1, reserved_at: now, available_at: now, created_at: new Date().toISOString(),
}).execute()
let handled = 0
Object.assign(globalThis, { recoveredJob: () => { handled++ } })
const { startProcessor, stopProcessor } = await import('../../src/worker')
const worker = startProcessor('default')
try {
  const until = Date.now() + 5000
  while (Date.now() < until && !handled) await Bun.sleep(20)
  assert.equal(handled, 1)
  await stopProcessor({ graceMs: 1000 })
  await worker
  const rows = await db.selectFrom('jobs').select(['id', 'reserved_at', 'attempts']).orderBy('id', 'asc').execute()
  assert.deepEqual(rows.map(row => Number(row.id)), [2, 3, 4])
  for (const row of rows) { assert.equal(Number(row.reserved_at), now); assert.equal(Number(row.attempts), 1) }
  console.log('dead owner recovered; live, foreign and legacy reservations preserved')
}
finally { await stopProcessor({ graceMs: 1000 }); await worker }
