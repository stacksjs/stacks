import assert from 'node:assert/strict'
const { db, initializeDbConfig, ensureDatabaseConfigLoaded, acquireDbConfigLock, resetDatabaseConnection } = await import('@stacksjs/database/runtime')
const release = await acquireDbConfigLock()
try {
  await ensureDatabaseConfigLoaded()
  initializeDbConfig({ app: { env: 'test' }, database: { default: process.env.DB_CONNECTION, connections: {
    sqlite: { database: process.env.DB_DATABASE_PATH },
    postgres: { name: process.env.DB_DATABASE!, host: process.env.DB_HOST!, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME!, password: process.env.DB_PASSWORD! },
    mysql: { name: process.env.DB_DATABASE!, host: process.env.DB_HOST!, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME!, password: process.env.DB_PASSWORD! },
  }, queryLogging: { enabled: false } } })
}
finally { release() }
const { withLockedRow } = await import('../../src/locked-row')
const { rowToken, RowTokenNotFoundError } = await import('../../src/row-token')
const { transaction } = await import('../../src/transaction')
await db.unsafe('CREATE TABLE locked_records (id INTEGER PRIMARY KEY, tenant_id INTEGER, quantity INTEGER NOT NULL, token TEXT, updated_at TEXT)').execute()
await db.insertInto('locked_records').values([{ id: 1, tenant_id: 7, quantity: 10, token: null }, { id: 2, tenant_id: 8, quantity: 20, token: null }]).execute()
const scope = { id: 1, tenant_id: 7 }
assert.equal(await withLockedRow('locked_records', { id: 1, tenant_id: 8 }, async () => 'wrong tenant'), null)
await assert.rejects(() => withLockedRow('locked_records', {}, async () => true), /requires a scope/)
const results = await Promise.all(Array.from({ length: 8 }, () => withLockedRow('locked_records', scope, async (row, tx) => {
  const next = Number(row.quantity) + 1
  await tx.updateTable('locked_records').set({ quantity: next }).where('id', '=', 1).execute()
  return next
})))
assert.deepEqual(results.sort((a, b) => Number(a) - Number(b)), [11, 12, 13, 14, 15, 16, 17, 18])
const owner = { table: 'locked_records', scope, column: 'token' }
const enabled = await Promise.all([rowToken({ ...owner, action: 'enable' }), rowToken({ ...owner, action: 'enable' })])
assert.equal(enabled[0], enabled[1])
assert.match(enabled[0]!, /^[a-f0-9]{64}$/)
assert.equal(await rowToken({ ...owner, action: 'read' }), enabled[0])
const rotated = await rowToken({ ...owner, action: 'rotate' })
assert.notEqual(rotated, enabled[0])
await assert.rejects(() => transaction(async (tx) => {
  await rowToken({ ...owner, action: 'disable', tx })
  assert.equal(await rowToken({ ...owner, action: 'read', tx }), null)
  throw new Error('rollback token')
}), /rollback token/)
assert.equal(await rowToken({ ...owner, action: 'read' }), rotated)
await rowToken({ ...owner, action: 'disable' })
assert.equal(await rowToken({ ...owner, action: 'read' }), null)
await assert.rejects(() => rowToken({ ...owner, scope: { id: 1, tenant_id: 8 }, action: 'enable' }), RowTokenNotFoundError)
assert.equal((await db.selectFrom('locked_records').selectAll().where('id', '=', 2).executeTakeFirst())!.token, null)
await db.unsafe('CREATE TABLE timeless_tokens (id TEXT PRIMARY KEY, tenant_id INTEGER, token TEXT, changed_at TEXT)').execute()
await db.insertInto('timeless_tokens').values([{ id: 'one', tenant_id: null, token: null }, { id: 'two', tenant_id: null, token: null }]).execute()
const timeless = { table: 'timeless_tokens', scope: { id: 'one', tenant_id: null }, column: 'token', timestampColumn: false as const }
const noTimestamp = await rowToken({ ...timeless, action: 'enable' })
assert.equal(await rowToken({ ...timeless, action: 'read' }), noTimestamp)
await rowToken({ ...timeless, timestampColumn: 'changed_at', action: 'rotate' })
assert.match(String((await db.selectFrom('timeless_tokens').selectAll().where('id', '=', 'one').executeTakeFirst())!.changed_at), /^\d{4}-/)
await assert.rejects(() => rowToken({ ...timeless, scope: { tenant_id: null }, action: 'read' }), /unique owner scope/)
await assert.rejects(() => rowToken({ ...timeless, scope: { tenant_id: null }, action: 'enable' }), /unique scope/)
const mixed = await Promise.all([rowToken({ ...owner, action: 'enable' }), rowToken({ ...owner, action: 'rotate' }), rowToken({ ...owner, action: 'disable' })])
const finalToken = await rowToken({ ...owner, action: 'read' })
assert(mixed.includes(finalToken), 'the final state belongs to a completed serialized operation')
resetDatabaseConnection()
console.log('locked rows OK')
