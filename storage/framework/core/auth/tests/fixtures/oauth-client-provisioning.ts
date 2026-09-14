import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_CLIENT_TEST_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-client-test-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_client_test_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, migrateAuthTables, resetDatabaseConnection, sqlHelpers } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect,
  connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  }, queryLogging: { enabled: false },
} })
const { createClient, clients, findClient, revokeClient } = await import('../../src/tokens')
const sql = sqlHelpers(dialect)
try {
  if (process.env.STACKS_CLIENT_TEST_MODE === 'legacy') {
    await db.unsafe(`CREATE TABLE oauth_clients (
      ${sql.pkColumn}, name VARCHAR(255) NOT NULL, secret VARCHAR(100), provider VARCHAR(255),
      redirect VARCHAR(2000) NOT NULL, personal_access_client BOOLEAN NOT NULL DEFAULT ${sql.boolFalse},
      password_client BOOLEAN NOT NULL DEFAULT ${sql.boolFalse}, revoked BOOLEAN NOT NULL DEFAULT ${sql.boolFalse},
      created_at ${sql.datetime} DEFAULT ${sql.utcNow}, updated_at ${sql.nullableTimestamp}
    )`).execute()
    await db.insertInto('oauth_clients').values({ name: 'legacy client', secret: 'synthetic-legacy-secret', provider: 'local',
      redirect: 'https://legacy.invalid', personal_access_client: true }).execute()
  }
  assert.equal((await migrateAuthTables()).success, true)
  const initial = await db.selectFrom('oauth_clients').selectAll().get()
  assert.equal(initial.length, 1)
  assert.equal(initial[0]!.user_id, null, 'old clients remain ownerless')
  if (process.env.STACKS_CLIENT_TEST_MODE === 'legacy')
    assert.equal(initial[0]!.secret, 'synthetic-legacy-secret')

  const ownerId = 3_000_000_000
  const provider = "authors' -- literal provider"
  const owned = await createClient({ name: 'owned', redirect: 'https://owned.invalid/callback?x=a=b', userId: ownerId, provider, passwordClient: true })
  const row = await db.selectFrom('oauth_clients').where('id', '=', owned.client.id).selectAll().executeTakeFirstOrThrow()
  assert.equal(Number(row.user_id), ownerId)
  assert.equal(row.provider, provider)
  assert.equal(owned.client.provider, provider)
  assert.equal(owned.client.passwordClient, true)
  assert.equal(owned.client.redirect, 'https://owned.invalid/callback?x=a=b')
  const ownerless = await createClient({ name: 'ownerless', redirect: 'https://ownerless.invalid' })
  assert.equal(ownerless.client.provider, 'local')
  const explicitEmpty = await createClient({ name: 'empty provider', redirect: 'https://empty.invalid', userId: ownerId + 1, provider: '' })
  assert.equal(explicitEmpty.client.provider, '')
  assert.deepEqual((await clients(ownerId)).map(client => client.id), [owned.client.id])
  assert.deepEqual((await clients(ownerId + 1)).map(client => client.id), [explicitEmpty.client.id])
  assert.deepEqual(await clients(ownerId + 2), [])
  const snapshot = await db.selectFrom('oauth_clients').selectAll().orderBy('id').get()
  assert.equal((await migrateAuthTables()).success, true)
  assert.deepEqual(await db.selectFrom('oauth_clients').selectAll().orderBy('id').get(), snapshot)
  await revokeClient(owned.client.id)
  assert.deepEqual(await clients(ownerId), [])
  assert.equal((await findClient(explicitEmpty.client.id))!.revoked, false)
  console.log('client provisioning OK')
}
finally { resetDatabaseConnection() }
