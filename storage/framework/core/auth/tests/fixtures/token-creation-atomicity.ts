import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_TOKEN_CREATION_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-token-creation-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_token_creation_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, migrateAuthTables, resetDatabaseConnection, withRoutingContext, contextHasWritten } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect,
  connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  }, queryLogging: { enabled: false },
} })
const { createToken, findToken, validateRefreshToken } = await import('../../src/tokens')
const failures: string[] = []
async function check(name: string, run: () => Promise<void>): Promise<void> {
  try { await run(); console.log(`PASS ${name}`) }
  catch (error) { failures.push(`${name}: ${error}`) }
}
async function snapshot() {
  return {
    access: await db.selectFrom('oauth_access_tokens').selectAll().orderBy('id').get(),
    refresh: await db.selectFrom('oauth_refresh_tokens').selectAll().orderBy('id').get(),
  }
}
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY)').execute()
  await db.insertInto('users').values({ id: 42 }).execute()
  assert.equal((await migrateAuthTables()).success, true)
  const existing = await createToken(42, 'existing session', ['read'])
  for (const table of ['oauth_access_tokens', 'oauth_refresh_tokens'] as const) {
    await check(`rejected ${table} insert leaves no partial session`, async () => {
      const before = await snapshot()
      if (dialect === 'postgres') {
        await db.unsafe("CREATE FUNCTION reject_token_creation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture token insert rejected'; END; $$").execute()
        await db.unsafe(`CREATE TRIGGER reject_token_creation BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION reject_token_creation()`).execute()
      }
      else if (dialect === 'mysql')
        await db.unsafe(`CREATE TRIGGER reject_token_creation BEFORE INSERT ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixture token insert rejected'`).execute()
      else
        await db.unsafe(`CREATE TRIGGER reject_token_creation BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'fixture token insert rejected'); END`).execute()
      try {
        await withRoutingContext(async () => {
          assert.equal(contextHasWritten(), false)
          await assert.rejects(createToken(42, 'rejected session', ['read']), /fixture token insert rejected/)
          assert.deepEqual(await snapshot(), before, 'rejected creation must not persist either half or change existing sessions')
          assert.equal(contextHasWritten(), false, 'failed creation must not mark a successful request write')
        })
        assert(await findToken(existing.plainTextToken))
        assert.equal(await validateRefreshToken(existing.refreshToken!), true)
      }
      finally {
        await db.unsafe(`DROP TRIGGER reject_token_creation${dialect === 'postgres' ? ` ON ${table}` : ''}`).execute()
        if (dialect === 'postgres') await db.unsafe('DROP FUNCTION reject_token_creation()').execute()
      }
    })
  }
  await check('successful paired and access-only creation pin subsequent request reads', async () => {
    for (const withRefreshToken of [false, true]) {
      await withRoutingContext(async () => {
        assert.equal(contextHasWritten(), false)
        const before = await snapshot()
        const result = await createToken(42, 'successful session', ['read'], {
          withRefreshToken, tokenableType: 'authors', userAgent: 'creation fixture', ipAddress: '127.0.0.1',
        })
        assert.equal(contextHasWritten(), true)
        const after = await snapshot()
        assert.equal(after.access.length, before.access.length + 1)
        assert.equal(after.refresh.length, before.refresh.length + Number(withRefreshToken))
        const row = after.access.find(row => Number(row.id) === Number(result.accessToken.id))!
        assert.equal(row.tokenable_type, 'authors')
        assert.equal(Number(row.tokenable_id), 42)
        assert.equal(row.user_agent, 'creation fixture')
        assert.equal(row.ip_address, '127.0.0.1')
        assert(await findToken(result.plainTextToken))
        if (withRefreshToken) assert.equal(await validateRefreshToken(result.refreshToken!), true)
        else assert.equal(result.refreshToken, undefined)
      })
    }
  })
  await check('outer rollback removes both rows from nested creation', async () => {
    const before = await snapshot()
    await assert.rejects(db.transaction(async () => {
      const pair = await createToken(42, 'nested session', ['read'])
      assert(await findToken(pair.plainTextToken), 'the caller must see its uncommitted token')
      assert.equal(await validateRefreshToken(pair.refreshToken!), true)
      throw new Error('fixture outer rollback')
    }), /fixture outer rollback/)
    assert.deepEqual(await snapshot(), before)
  })
  await check('concurrent successful creations retain distinct complete pairs', async () => {
    const before = await snapshot()
    const results = await Promise.all(Array.from({ length: 8 }, (_, index) => createToken(42, `concurrent ${index}`, ['read'])))
    assert.equal(new Set(results.map(result => result.plainTextToken)).size, 8)
    const after = await snapshot()
    assert.equal(after.access.length, before.access.length + 8)
    assert.equal(after.refresh.length, before.refresh.length + 8)
    for (const pair of results) {
      assert(await findToken(pair.plainTextToken))
      assert.equal(await validateRefreshToken(pair.refreshToken!), true)
    }
  })
  assert.deepEqual(failures, [], failures.join('\n'))
  console.log('token creation atomicity OK')
}
finally { resetDatabaseConnection() }
