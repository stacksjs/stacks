import assert from 'node:assert/strict'
import { SQL } from 'bun'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const config = process.env.STACKS_TOKEN_INDEXES_CONFIG
assert(config && basename(dirname(config)).startsWith('stacks-token-indexes-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(config))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_token_indexes_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
  assert(process.env.DB_PORT && !['5432', '3306'].includes(process.env.DB_PORT))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, initializeDbConfig, ensureDatabaseConfigLoaded, closeDatabaseConnection } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect, connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  }, queryLogging: { enabled: false },
} })
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const { createToken, revokeTokenById, revokeAllTokens, findToken, validateRefreshToken } = await import('../../src/tokens')
const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  try { await run(); console.log(`PASS ${name}`) }
  catch (error) { failures.push(`${name}: ${error}`) }
}
const indexes = [
  ['oauth_access_tokens', 'idx_oauth_access_tokens_owner', ['tokenable_type', 'tokenable_id']],
  ['oauth_refresh_tokens', 'idx_oauth_refresh_tokens_access_token_id', ['access_token_id']],
] as const
async function indexColumns(table: string, name: string): Promise<string[]> {
  if (dialect === 'sqlite') {
    const rows = await db.unsafe(`PRAGMA index_info('${name}')`).execute()
    return rows.map(row => String(row.name))
  }
  if (dialect === 'mysql') {
    const rows = await db.unsafe('SELECT COLUMN_NAME AS name FROM information_schema.statistics WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? ORDER BY SEQ_IN_INDEX', [table, name]).execute()
    return rows.map(row => String(row.name))
  }
  const rows = await db.unsafe(`SELECT a.attname AS name FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS key(attnum, position)
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = key.attnum
    WHERE c.relname = $1 ORDER BY key.position`, [name]).execute()
  return rows.map(row => String(row.name))
}
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, password_changed_at TIMESTAMP)').execute()
  await db.insertInto('users').values([{ id: 1 }, { id: 2 }]).execute()
  await ensureFrameworkAuthTables()
  await check('fresh and repeated migrations install both scope indexes', async () => {
    for (const [table, name, columns] of indexes) assert.deepEqual(await indexColumns(table, name), [...columns])
    await ensureFrameworkAuthTables()
    for (const [table, name, columns] of indexes) assert.deepEqual(await indexColumns(table, name), [...columns])
  })
  // Enough unrelated owners for the optimizer to choose the selective index.
  for (let id = 10; id < 60; id++) await createToken(id, 'synthetic unrelated', ['read'])
  for (const bulk of [false, true]) {
    await check(`${bulk ? 'bulk' : 'single'} revocation ignores an unrelated owner's locked row`, async () => {
      const target = await createToken(1, 'synthetic target', ['read'])
      const other = await createToken(2, 'synthetic bystander', ['read'])
      const revoke = () => bulk ? revokeAllTokens(1) : revokeTokenById(Number(target.accessToken.id))
      if (dialect !== 'mysql') await revoke()
      else {
        const observer = new SQL({ adapter: 'mysql', hostname: process.env.DB_HOST,
          port: Number(process.env.DB_PORT), database: process.env.DB_DATABASE,
          username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
          tls: process.env.DB_SSL === 'true' ? 'require' : 'disable' })
        const blocker = await observer.reserve()
        let held = false
        let done = false
        let pending: Promise<void> | undefined
        try {
          await blocker.unsafe('BEGIN'); held = true
          if (bulk) await blocker.unsafe('SELECT id FROM oauth_access_tokens WHERE id = ? FOR UPDATE', [other.accessToken.id])
          else {
            const rows = await observer.unsafe('SELECT id FROM oauth_refresh_tokens WHERE access_token_id = ?', [other.accessToken.id])
            await blocker.unsafe('SELECT id FROM oauth_refresh_tokens WHERE id = ? FOR UPDATE', [rows[0].id])
          }
          pending = revoke().finally(() => { done = true })
          void pending.catch(() => {})
          const deadline = performance.now() + 5000
          while (!done && performance.now() < deadline) {
            const waiting = await observer.unsafe("SELECT COUNT(*) AS count FROM performance_schema.data_locks WHERE OBJECT_SCHEMA = DATABASE() AND LOCK_STATUS = 'WAITING'")
            assert.equal(Number(waiting[0].count), 0, 'owner-scoped revocation must not wait on a bystander row')
            await Bun.sleep(10)
          }
          assert(done, 'target revocation must finish before the unrelated lock is released')
          await pending
        }
        finally {
          if (held) await blocker.unsafe('ROLLBACK')
          await pending?.catch(() => {})
          blocker.release()
          await observer.close()
        }
      }
      assert.equal(await findToken(target.plainTextToken), null)
      assert.equal(await validateRefreshToken(target.refreshToken!), false)
      assert(await findToken(other.plainTextToken))
      assert.equal(await validateRefreshToken(other.refreshToken!), true)
    })
  }
  await check('upgrading an existing schema adds indexes without changing token rows', async () => {
    const before = await db.primary.selectFrom('oauth_access_tokens').selectAll().orderBy('id').execute()
    for (const [table, name] of indexes) {
      const columns = await indexColumns(table, name)
      if (columns.length) await db.unsafe(`DROP INDEX ${name}${dialect === 'mysql' ? ` ON ${table}` : ''}`).execute()
    }
    await ensureFrameworkAuthTables()
    for (const [table, name, columns] of indexes) assert.deepEqual(await indexColumns(table, name), [...columns])
    assert.deepEqual(await db.primary.selectFrom('oauth_access_tokens').selectAll().orderBy('id').execute(), before)
  })
  assert.deepEqual(failures, [])
  console.log('token scope indexes OK')
}
finally { await closeDatabaseConnection() }
