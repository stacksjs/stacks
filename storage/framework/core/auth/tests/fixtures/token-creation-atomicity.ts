import assert from 'node:assert/strict'
import { setSystemTime } from 'bun:test'
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
  assert(process.env.DB_PORT && !['5432', '3306'].includes(process.env.DB_PORT))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, migrateAuthTables, resetDatabaseConnection, withRoutingContext, contextHasWritten, parseSqlDateTime } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect,
  connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  }, queryLogging: { enabled: false },
} })
const { createClient, createToken, findToken, refreshToken, validateRefreshToken } = await import('../../src/tokens')
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
  await db.insertInto('users').values({ id: 43 }).execute()
  assert.equal((await migrateAuthTables()).success, true)
  const existing = await createToken(42, 'existing session', ['read'])
  const otherClient = await createClient({ name: 'other client', redirect: 'https://other.invalid', passwordClient: true })
  for (const method of ['create', 'access-only', 'refresh'] as const) {
    for (const fault of ['owner', 'owner type', 'legacy owner', 'client', 'scopes', 'revoked', 'unbounded expiry', 'extended expiry']) {
      await check(`${method} rejects altered access ${fault} and preserves all existing grants`, async () => {
        const original = await createToken(42, 'access replacement source', ['read'])
        const before = await snapshot()
        const assignment = fault === 'owner' ? 'tokenable_id = 43'
          : fault === 'owner type' ? "tokenable_type = 'authors'"
            : fault === 'legacy owner' ? 'user_id = 43'
              : fault === 'client' ? `oauth_client_id = ${Number(otherClient.client.id)}`
                : fault === 'scopes' ? `scopes = '["*"]'`
                  : fault === 'revoked' ? `revoked = ${dialect === 'postgres' ? 'true' : '1'}`
                    : fault === 'unbounded expiry' ? 'expires_at = NULL' : "expires_at = '2037-01-01 00:00:00'"
        if (dialect === 'postgres') {
          await db.unsafe(`CREATE FUNCTION alter_access_creation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.${assignment.replace(' = ', ' := ')}; RETURN NEW; END; $$`).execute()
          await db.unsafe('CREATE TRIGGER alter_access_creation BEFORE INSERT ON oauth_access_tokens FOR EACH ROW EXECUTE FUNCTION alter_access_creation()').execute()
        }
        else if (dialect === 'mysql')
          await db.unsafe(`CREATE TRIGGER alter_access_creation BEFORE INSERT ON oauth_access_tokens FOR EACH ROW SET NEW.${assignment}`).execute()
        else
          await db.unsafe(`CREATE TRIGGER alter_access_creation AFTER INSERT ON oauth_access_tokens BEGIN UPDATE oauth_access_tokens SET ${assignment} WHERE id = NEW.id; END`).execute()
        try {
          await assert.rejects(method === 'refresh' ? refreshToken(original.refreshToken!)
            : createToken(42, 'requested access grant', ['read'], { withRefreshToken: method !== 'access-only' }),
          /Failed to persist the requested access token/)
          assert.deepEqual(await snapshot(), before, 'mismatched issuance must roll back its new rows and any old-pair revocation')
          assert(await findToken(original.plainTextToken))
          assert.equal(await validateRefreshToken(original.refreshToken!), true)
          assert(await findToken(existing.plainTextToken))
          assert.equal(await validateRefreshToken(existing.refreshToken!), true)
        }
        finally {
          await db.unsafe(`DROP TRIGGER alter_access_creation${dialect === 'postgres' ? ' ON oauth_access_tokens' : ''}`).execute()
          if (dialect === 'postgres') await db.unsafe('DROP FUNCTION alter_access_creation()').execute()
        }
      })
    }
  }
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
  for (const method of ['create', 'refresh'] as const) {
    for (const fault of ['revoked', 'wrong pair', 'unbounded expiry', ...(dialect === 'mysql' ? [] : ['suppressed'])]) {
      await check(`${method} rejects a ${fault} refresh insert and rolls back the whole pair`, async () => {
        const original = await createToken(42, 'replacement source', ['read'])
        const before = await snapshot()
        const assignment = fault === 'revoked' ? `revoked = ${dialect === 'postgres' ? 'true' : '1'}`
          : fault === 'wrong pair' ? `access_token_id = ${Number(existing.accessToken.id)}` : 'expires_at = NULL'
        if (dialect === 'postgres') {
          const body = fault === 'suppressed' ? 'RETURN NULL;' : `NEW.${assignment.replace(' = ', ' := ')}; RETURN NEW;`
          await db.unsafe(`CREATE FUNCTION alter_refresh_creation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ${body} END; $$`).execute()
          await db.unsafe('CREATE TRIGGER alter_refresh_creation BEFORE INSERT ON oauth_refresh_tokens FOR EACH ROW EXECUTE FUNCTION alter_refresh_creation()').execute()
        }
        else if (dialect === 'mysql')
          await db.unsafe(`CREATE TRIGGER alter_refresh_creation BEFORE INSERT ON oauth_refresh_tokens FOR EACH ROW SET NEW.${assignment}`).execute()
        else if (fault === 'suppressed')
          await db.unsafe('CREATE TRIGGER alter_refresh_creation BEFORE INSERT ON oauth_refresh_tokens BEGIN SELECT RAISE(IGNORE); END').execute()
        else
          await db.unsafe(`CREATE TRIGGER alter_refresh_creation AFTER INSERT ON oauth_refresh_tokens BEGIN UPDATE oauth_refresh_tokens SET ${assignment} WHERE id = NEW.id; END`).execute()
        try {
          await withRoutingContext(async () => {
            await assert.rejects(method === 'create' ? createToken(42, 'incomplete pair', ['read']) : refreshToken(original.refreshToken!),
              'a reported pair must contain the requested refresh credential')
            assert.deepEqual(await snapshot(), before)
            if (method === 'create') assert.equal(contextHasWritten(), false)
          })
          assert(await findToken(original.plainTextToken))
          assert.equal(await validateRefreshToken(original.refreshToken!), true)
          assert(await findToken(existing.plainTextToken))
          assert.equal(await validateRefreshToken(existing.refreshToken!), true)
        }
        finally {
          await db.unsafe(`DROP TRIGGER alter_refresh_creation${dialect === 'postgres' ? ' ON oauth_refresh_tokens' : ''}`).execute()
          if (dialect === 'postgres') await db.unsafe('DROP FUNCTION alter_refresh_creation()').execute()
        }
      })
    }
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
  await check('refresh insert verification accepts exact expired deadlines without extending them', async () => {
    const now = new Date(Math.floor(Date.now() / 1000) * 1000 + 800)
    setSystemTime(now)
    try {
      for (const days of [-1, 0, 30]) {
        const expected = new Date(now)
        expected.setDate(expected.getDate() + days)
        if (dialect === 'mysql') expected.setMilliseconds(0)
        for (const method of ['create', 'refresh']) {
          const result = method === 'create'
            ? await createToken(42, 'explicit refresh deadline', ['read'], { refreshExpiresInDays: days })
            : await refreshToken((await createToken(42)).refreshToken!, { refreshExpiresInDays: days })
          const rows = await db.selectFrom('oauth_refresh_tokens').where('access_token_id', '=', result.accessToken.id).selectAll().get()
          assert.equal(rows.length, 1)
          assert.equal(parseSqlDateTime(rows[0]!.expires_at)?.getTime(), expected.getTime())
          assert.equal(await validateRefreshToken(result.refreshToken!), days > 0)
        }
      }
    }
    finally { setSystemTime() }
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
