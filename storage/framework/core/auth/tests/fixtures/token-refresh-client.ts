import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_TOKEN_REFRESH_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-token-refresh-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_token_refresh_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, migrateAuthTables, resetDatabaseConnection } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect,
  connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  }, queryLogging: { enabled: false },
} })
const { createClient, createToken, findClient, findToken, refreshToken, revokeClient, tokens, validateRefreshToken } = await import('../../src/tokens')

async function credentialSnapshot() {
  return {
    access: await db.selectFrom('oauth_access_tokens').selectAll().orderBy('id').get(),
    refresh: await db.selectFrom('oauth_refresh_tokens').selectAll().orderBy('id').get(),
  }
}

try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY)').execute()
  await db.insertInto('users').values({ id: 42 }).execute()
  assert.equal((await migrateAuthTables()).success, true)
  const original = await createToken(42, 'disabled application', ['read'])
  const rotated = await refreshToken(original.refreshToken!)
  assert(await findToken(rotated.plainTextToken), 'an active client must refresh successfully')
  assert.equal(await validateRefreshToken(original.refreshToken!), false, 'rotation must consume the original refresh token')
  await revokeClient(rotated.accessToken.clientId)
  assert.equal((await findClient(rotated.accessToken.clientId))?.revoked, true)
  assert.equal(await validateRefreshToken(rotated.refreshToken!), false, 'validation must reject a revoked client too')
  const before = await tokens(42)
  const credentials = await credentialSnapshot()
  await assert.rejects(refreshToken(rotated.refreshToken!), error => {
    assert.equal((error as Error).message, 'Invalid or expired refresh token')
    assert.equal((error as { status: number }).status, 401, String(error))
    return true
  }, 'a revoked client must not mint another token pair')
  assert.deepEqual(await tokens(42), before, 'a rejected exchange must not rotate existing credentials')
  assert.deepEqual(await credentialSnapshot(), credentials, 'rejection must leave both credential tables unchanged')

  const bystander = await createClient({ name: 'active application', redirect: 'https://example.test/callback', personalAccessClient: true })
  const active = await createToken(42, 'active application', ['read'])
  assert.equal(Number(active.accessToken.clientId), Number(bystander.client.id))
  const renewed = await refreshToken(active.refreshToken!)
  assert(await findToken(renewed.plainTextToken), 'another active client must remain usable')
  assert.equal(await validateRefreshToken(active.refreshToken!), false)

  // The framework auth schema permits legacy orphan credentials. Losing the
  // client must not make its surviving refresh token an independent issuer.
  await db.deleteFrom('oauth_clients').where('id', '=', bystander.client.id).execute()
  assert.equal(await findClient(bystander.client.id), null)
  const orphaned = await credentialSnapshot()
  assert(orphaned.refresh.some(row => Number(row.access_token_id) === Number(renewed.accessToken.id)))
  assert.equal(await validateRefreshToken(renewed.refreshToken!), false)
  await assert.rejects(refreshToken(renewed.refreshToken!), /Invalid or expired refresh token/)
  assert.deepEqual(await credentialSnapshot(), orphaned)
  console.log('token refresh client validity OK')
}
finally { resetDatabaseConnection() }
