import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_PASSWORD_STAMP_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-password-stamp-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_password_stamp_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
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
const { createToken, findToken, refreshToken, getPasswordChangedAt } = await import('../../src/tokens')
const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  try { await run() }
  catch (error) { failures.push(`${name}: ${String(error)}`) }
}

try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, password_changed_at TIMESTAMP)').execute()
  await db.insertInto('users').values({ id: 1 }).execute()
  await ensureFrameworkAuthTables()
  const original = await createToken(1, 'password-stamp fixture', ['read'])
  assert(await findToken(original.plainTextToken), 'a null password stamp is valid legacy state')

  // An unrelated schema/query failure is not evidence that the optional
  // password stamp is absent. Test through public access and refresh paths.
  await db.unsafe('ALTER TABLE users RENAME COLUMN id TO hidden_id').execute()
  await check('access lookup failure', () => assert.rejects(() => findToken(original.plainTextToken)))
  await check('refresh lookup failure', () => assert.rejects(() => refreshToken(original.refreshToken!)))
  await db.unsafe('ALTER TABLE users RENAME COLUMN hidden_id TO id').execute()
  await check('failed verification must not rotate', async () => {
    assert.equal((await db.primary.selectFrom('oauth_access_tokens').selectAll().execute()).length, 1)
    assert.equal((await db.primary.selectFrom('oauth_refresh_tokens').selectAll().execute()).length, 1)
    assert(await findToken(original.plainTextToken))
  })

  // Inject operational failures at the explicitly supported query-runner
  // seam. None may be converted into the legacy null-stamp result.
  for (const message of ['connection reset', 'permission denied', 'query timed out', 'no such table: other_credentials', 'relation "other_credentials" does not exist']) {
    await check(message, async () => {
      const error = new Error(message)
      await assert.rejects(() => getPasswordChangedAt(1, { unsafe() { throw error } }), candidate => candidate === error)
    })
  }

  await db.unsafe('ALTER TABLE users RENAME COLUMN password_changed_at TO hidden_stamp').execute()
  assert.equal(await getPasswordChangedAt(1), null, 'an actually absent optional stamp remains supported')
  await db.transaction(async trx => {
    assert.equal(await getPasswordChangedAt(1, trx), null)
    assert.equal((await db.primary.selectFrom('users').selectAll().execute()).length, 1, 'legacy lookup must not abort the transaction')
  })
  await db.unsafe('DROP TABLE users').execute()
  assert.equal(await getPasswordChangedAt(1), null, 'an absent legacy owner table remains supported')
  assert.deepEqual(failures, [])
  console.log('password stamp failures OK')
}
finally { await closeDatabaseConnection() }
