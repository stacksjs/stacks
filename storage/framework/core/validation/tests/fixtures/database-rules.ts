import assert from 'node:assert/strict'
import { exists, unique } from '../../src/validator'
import { db, ensureDatabaseConfigLoaded, initializeDbConfig } from '../../../database/src/runtime'
import { resetConnection } from '@stacksjs/query-builder'
await ensureDatabaseConfigLoaded()
resetConnection()
initializeDbConfig({ database: { default: 'sqlite', connections: { sqlite: { database: ':memory:' } } } })
await db.unsafe('CREATE TABLE validation_accounts (id INTEGER PRIMARY KEY, email TEXT)').execute()
await db.unsafe("INSERT INTO validation_accounts VALUES (0, 'zero@example.test'), (1, 'existing@example.test')").execute()
assert.equal(await unique('validation_accounts', 'email')('new@example.test', {}), true)
assert.equal(typeof await unique('validation_accounts', 'email')('existing@example.test', {}), 'string')
assert.equal(await unique('validation_accounts', 'email', 1)('existing@example.test', {}), true)
assert.equal(await unique('validation_accounts', 'email', 0)('zero@example.test', {}), true)
assert.equal(await exists('validation_accounts', 'id')(1, {}), true)
assert.equal(typeof await exists('validation_accounts', 'id')(99, {}), 'string')
for (const rule of [exists('missing_validation_table', 'id'), unique('missing_validation_table', 'id')]) await assert.rejects(async () => rule(1, {}))
const server = Bun.serve({ port: 0, hostname: '127.0.0.1', async fetch() {
  try { await exists('missing_validation_table', 'id')(1, {}); return Response.json({ approved: true }) }
  catch { return Response.json({ approved: false }, { status: 500 }) }
} })
try {
  const response = await fetch(`http://127.0.0.1:${server.port}/`)
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { approved: false })
}
finally { server.stop(true) }
console.log('database validation rules OK')
