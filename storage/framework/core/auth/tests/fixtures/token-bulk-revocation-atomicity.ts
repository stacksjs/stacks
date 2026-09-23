import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_BULK_REVOKE_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-bulk-revoke-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_bulk_revoke_'))
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
const { configureOrm, releaseOrm } = await import('bun-query-builder')
if (dialect === 'sqlite') configureOrm({ database: process.env.DB_DATABASE_PATH })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const { createToken, findToken, validateRefreshToken, revokeAllTokens, revokeOtherTokens } = await import('../../src/tokens')
const { Auth } = await import('../../src/authentication')
const { enhanceRequest } = await import('@stacksjs/router')
const { runWithRequest } = await import('../../../router/src/request-context')
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  try { await run(); console.log(`PASS ${name}`) }
  catch (error) { failures.push(`${name}: ${error}`) }
}
async function live(pair: Awaited<ReturnType<typeof createToken>>, expected: boolean) {
  assert.equal(Boolean(await findToken(pair.plainTextToken)), expected)
  assert.equal(await validateRefreshToken(pair.refreshToken!), expected)
}
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, password_changed_at TIMESTAMP)').execute()
  await db.insertInto('users').values({ id: 42 }).execute()
  await ensureFrameworkAuthTables()
  for (const mode of ['raw-all', 'auth-all', 'raw-other', 'auth-other']) {
    for (const table of ['oauth_access_tokens', 'oauth_refresh_tokens']) {
      await check(`${mode} suppressed ${table} write rolls back the entire sweep`, async () => {
        await db.deleteFrom('oauth_refresh_tokens').execute()
        await db.deleteFrom('oauth_access_tokens').execute()
        const current = await createToken(42, 'current', ['read'])
        const other = await createToken(42, 'other', ['read'])
        const unrelated = await createToken(43, 'unrelated', ['read'])
        const differentOwner = await createToken(42, 'author', ['read'], { tokenableType: 'authors' })
        const revoke = () => runWithRequest(enhanceRequest(new Request('https://example.invalid/logout', {
          headers: { authorization: `Bearer ${current.plainTextToken}` },
        })), () => {
          if (mode === 'raw-all') return revokeAllTokens(42)
          if (mode === 'auth-all') return Auth.revokeAllTokens(42)
          if (mode === 'raw-other') return revokeOtherTokens(42)
          return Auth.revokeOtherTokens(42)
        })
        if (dialect === 'postgres') {
          await db.unsafe('CREATE FUNCTION suppress_bulk_revoke() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END; $$').execute()
          await db.unsafe(`CREATE TRIGGER suppress_bulk_revoke BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION suppress_bulk_revoke()`).execute()
        }
        else if (dialect === 'mysql')
          await db.unsafe(`CREATE TRIGGER suppress_bulk_revoke BEFORE UPDATE ON ${table} FOR EACH ROW SET NEW.revoked = OLD.revoked`).execute()
        else
          await db.unsafe(`CREATE TRIGGER suppress_bulk_revoke BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(IGNORE); END`).execute()
        try {
          await assert.rejects(revoke(), 'bulk revocation must not silently leave half of a pair live')
          await live(current, true)
          await live(other, true)
          await live(unrelated, true)
          await live(differentOwner, true)
        }
        finally {
          await db.unsafe(`DROP TRIGGER suppress_bulk_revoke${dialect === 'postgres' ? ` ON ${table}` : ''}`).execute()
          if (dialect === 'postgres') await db.unsafe('DROP FUNCTION suppress_bulk_revoke()').execute()
        }
        await revoke()
        await live(current, mode.endsWith('other'))
        await live(other, false)
        await live(unrelated, true)
        await live(differentOwner, true)
        await revoke()
      })
    }
  }
  assert.deepEqual(failures, [])
  console.log('bulk revocation atomicity OK')
}
finally {
  releaseOrm()
  await closeDatabaseConnection()
}
