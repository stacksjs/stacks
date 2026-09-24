import assert from 'node:assert/strict'
import { setSystemTime } from 'bun:test'
import { SQL } from 'bun'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_BEARER_ROTATION_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-bearer-rotation-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_bearer_rotation_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
  assert(process.env.DB_PORT && !['5432', '3306'].includes(process.env.DB_PORT))
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
const { configureOrm, releaseOrm } = await import('bun-query-builder')
if (dialect === 'sqlite') configureOrm({ database: process.env.DB_DATABASE_PATH })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const { createToken, findToken, refreshToken, tokens, validateRefreshToken } = await import('../../src/tokens')
const { Auth } = await import('../../src/authentication')
const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  try { await run(); console.log(`PASS ${name}`) }
  catch (error) { failures.push(`${name}: ${error}`) }
}
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, password_changed_at TIMESTAMP)').execute()
  await db.insertInto('users').values({ id: 42 }).execute()
  assert.equal((await migrateAuthTables()).success, true)
  for (const legacy of [false, true]) {
    await check(`${legacy ? 'legacy' : 'raw'} parallel callers consume once`, async () => {
      // MySQL's auth schema stores whole seconds, so choose a deadline all
      // three schemas can represent exactly for the preservation assertion.
      const expiresAt = new Date(Math.floor(Date.now() / 1000) * 1000 + 3_600_000)
      const original = await createToken(42, 'rotating session', ['read'], { expiresAt })
      const bystander = await createToken(42, 'unrelated session', ['write'])
      const bearer = original.plainTextToken + (legacy ? ':legacy-suffix' : '')
      const results = await Promise.all(Array.from({ length: 8 }, () => Auth.rotateToken(bearer)))
      const winners = results.filter((value): value is NonNullable<typeof value> => value !== null)
      assert.equal(winners.length, 1, 'one bearer must create exactly one successor')
      const successor = await findToken(winners[0]!)
      assert(successor)
      assert.equal(Number(successor.userId), 42)
      assert.equal(successor.name, original.accessToken.name)
      assert.deepEqual(successor.scopes, ['read'])
      assert.equal(successor.expiresAt?.getTime(), original.accessToken.expiresAt?.getTime())
      assert.equal(await findToken(original.plainTextToken), null)
      assert.equal(await validateRefreshToken(original.refreshToken!), false)
      assert.equal(await Auth.rotateToken(bearer), null)
      assert(Boolean(await findToken(bystander.plainTextToken)))
      assert.equal(await validateRefreshToken(bystander.refreshToken!), true)
    })
  }
  if (dialect === 'postgres') {
    await check('a token that expires waiting for the lock cannot rotate', async () => {
      const deadline = new Date(Date.now() + 60_000)
      const original = await createToken(42, 'expires while blocked', ['read'], { expiresAt: deadline })
      const observer = new SQL({ adapter: 'postgres', hostname: process.env.DB_HOST,
        port: Number(process.env.DB_PORT), database: process.env.DB_DATABASE,
        username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD })
      const blocker = await observer.reserve()
      let held = false
      let pending: Promise<string | null> | undefined
      try {
        await blocker.unsafe('BEGIN')
        held = true
        await blocker.unsafe('UPDATE oauth_access_tokens SET name = name WHERE id = $1', [original.accessToken.id])
        pending = Auth.rotateToken(original.plainTextToken)
        const timeout = performance.now() + 5000
        let blocked = false
        while (performance.now() < timeout) {
          const rows = await observer.unsafe("SELECT COUNT(*) AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'")
          if (Number(rows[0].count) > 0) { blocked = true; break }
          await Bun.sleep(10)
        }
        assert(blocked, 'rotation must reach a real row lock before advancing time')
        setSystemTime(deadline)
        await blocker.unsafe('COMMIT')
        held = false
        assert.equal((await pending) === null, true, 'expiry must be checked after acquiring the row lock')
      }
      finally {
        if (held) await blocker.unsafe('ROLLBACK')
        await pending?.catch(() => {})
        blocker.release()
        await observer.close()
        setSystemTime()
      }
    })
  }
  await check('failed replacement rolls back revocation of the original pair', async () => {
    const original = await createToken(42, 'insert failure', ['read'])
    const before = (await tokens(42)).length
    if (dialect === 'postgres') {
      await db.unsafe("CREATE FUNCTION reject_rotation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture rotation insert denied'; END; $$").execute()
      await db.unsafe('CREATE TRIGGER reject_rotation BEFORE INSERT ON oauth_access_tokens FOR EACH ROW EXECUTE FUNCTION reject_rotation()').execute()
    }
    else if (dialect === 'mysql')
      await db.unsafe("CREATE TRIGGER reject_rotation BEFORE INSERT ON oauth_access_tokens FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixture rotation insert denied'").execute()
    else
      await db.unsafe("CREATE TRIGGER reject_rotation BEFORE INSERT ON oauth_access_tokens BEGIN SELECT RAISE(ABORT, 'fixture rotation insert denied'); END").execute()
    try {
      await assert.rejects(Auth.rotateToken(original.plainTextToken), /fixture rotation insert denied/)
      assert(Boolean(await findToken(original.plainTextToken)), 'failed rotation must preserve the old access token')
      assert.equal(await validateRefreshToken(original.refreshToken!), true)
      assert.equal((await tokens(42)).length, before)
    }
    finally {
      await db.unsafe(`DROP TRIGGER reject_rotation${dialect === 'postgres' ? ' ON oauth_access_tokens' : ''}`).execute()
      if (dialect === 'postgres') await db.unsafe('DROP FUNCTION reject_rotation()').execute()
    }
  })
  await check('outer rollback restores the pair and discards its replacement', async () => {
    const original = await createToken(42, 'outer rollback', ['read'])
    let replacement: string | null = null
    await assert.rejects(db.transaction(async () => {
      replacement = await Auth.rotateToken(original.plainTextToken)
      assert(replacement)
      throw new Error('fixture outer rollback')
    }), /fixture outer rollback/)
    assert(Boolean(await findToken(original.plainTextToken)))
    assert.equal(await validateRefreshToken(original.refreshToken!), true)
    assert.equal(await findToken(replacement!), null)
  })
  for (const [table, method] of ['oauth_access_tokens', 'oauth_refresh_tokens'].flatMap(table => ['bearer', 'refresh'].map(method => [table, method] as const))) {
    await check(`a suppressed ${table} revocation cannot complete a ${method} exchange`, async () => {
      const original = await createToken(42, 'suppressed revoke', ['read'])
      const before = (await tokens(42)).length
      if (dialect === 'postgres') {
        await db.unsafe('CREATE FUNCTION suppress_rotation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END; $$').execute()
        await db.unsafe(`CREATE TRIGGER suppress_rotation BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION suppress_rotation()`).execute()
      }
      else if (dialect === 'mysql')
        await db.unsafe(`CREATE TRIGGER suppress_rotation BEFORE UPDATE ON ${table} FOR EACH ROW SET NEW.revoked = OLD.revoked`).execute()
      else
        await db.unsafe(`CREATE TRIGGER suppress_rotation BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(IGNORE); END`).execute()
      try {
        await assert.rejects(method === 'bearer' ? Auth.rotateToken(original.plainTextToken) : refreshToken(original.refreshToken!),
          'suppressed revocation must fail the exchange')
        assert(Boolean(await findToken(original.plainTextToken)))
        assert.equal(await validateRefreshToken(original.refreshToken!), true, 'a failed exchange must roll back its refresh revocation too')
        assert.equal((await tokens(42)).length, before)
      }
      finally {
        await db.unsafe(`DROP TRIGGER suppress_rotation${dialect === 'postgres' ? ` ON ${table}` : ''}`).execute()
        if (dialect === 'postgres') await db.unsafe('DROP FUNCTION suppress_rotation()').execute()
      }
    })
  }
  await check('an absent owner returns null without partially revoking the pair', async () => {
    const original = await createToken(42, 'missing owner', ['read'])
    await db.deleteFrom('users').where('id', '=', 42).execute()
    assert.equal(await Auth.rotateToken(original.plainTextToken), null)
    assert(Boolean(await findToken(original.plainTextToken)))
    assert.equal(await validateRefreshToken(original.refreshToken!), true)
  })
  assert.deepEqual(failures, [])
  console.log('bearer rotation atomicity OK')
}
finally { await releaseOrm(); resetDatabaseConnection() }
