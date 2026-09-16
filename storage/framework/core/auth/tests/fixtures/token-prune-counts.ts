import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_TOKEN_PRUNE_COUNTS_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-token-prune-counts-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_token_prune_counts_'))
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
  },
  queryLogging: { enabled: false },
} })
const { createToken, revokeAllTokens, deleteExpiredTokens, deleteRevokedTokens, deleteExpiredRefreshTokens, deleteRevokedRefreshTokens } = await import('../../src/tokens')

async function rows(table: 'oauth_access_tokens' | 'oauth_refresh_tokens'): Promise<number> {
  return (await db.selectFrom(table).selectAll().execute() as unknown[]).length
}
// Two tokens the helper should prune, plus one it must leave alone, so a count
// of "everything" cannot pass for a count of "what was pruned".
async function seed(mode: 'expired' | 'revoked') {
  await db.deleteFrom('oauth_refresh_tokens').execute()
  await db.deleteFrom('oauth_access_tokens').execute()
  const prunable = mode === 'expired'
    ? { expiresAt: new Date(Date.now() - 86_400_000), refreshExpiresInDays: -1 }
    : {}
  await createToken(42, 'prune me', ['read'], prunable)
  await createToken(42, 'prune me too', ['read'], prunable)
  if (mode === 'revoked')
    await revokeAllTokens(42)
  await createToken(42, 'keep me', ['read'])
}

const failures: string[] = []
async function check(name: string, mode: 'expired' | 'revoked', table: 'oauth_access_tokens' | 'oauth_refresh_tokens', prune: () => Promise<number>) {
  await seed(mode)
  try {
    const before = await rows(table)
    const returned = await prune()
    const removed = before - await rows(table)
    assert.equal(removed, 2, `${name} should have pruned exactly the two seeded rows from ${table}`)
    assert.equal(returned, removed, `${name} returned ${returned} but removed ${removed} rows from ${table}`)
    console.log(`PASS ${name}`)
  }
  catch (error) { failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`) }
}

try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY)').execute()
  await db.insertInto('users').values({ id: 42 }).execute()
  assert.equal((await migrateAuthTables()).success, true)

  // Each helper's return value describes ONE table. deleteExpiredTokens and
  // deleteRevokedTokens also clear the matching refresh tokens first, but what
  // they return is the access-token delete.
  await check('deleteExpiredRefreshTokens', 'expired', 'oauth_refresh_tokens', () => deleteExpiredRefreshTokens())
  await check('deleteRevokedRefreshTokens', 'revoked', 'oauth_refresh_tokens', () => deleteRevokedRefreshTokens(-1))
  await check('deleteExpiredTokens', 'expired', 'oauth_access_tokens', () => deleteExpiredTokens())
  await check('deleteRevokedTokens', 'revoked', 'oauth_access_tokens', () => deleteRevokedTokens(-1))

  assert.deepEqual(failures, [], `${dialect}: every prune helper must return the rows it removed`)
  console.log('token prune counts OK')
}
finally { resetDatabaseConnection() }
