import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_AUTH_SETUP_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-auth-setup-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_auth_setup_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection, sqlHelpers } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect,
  connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  }, queryLogging: { enabled: false },
} })
const { createToken, findToken, refreshToken, tokens } = await import('../../src/tokens')
const sql = sqlHelpers(dialect)
const legacyBearer = 'synthetic-pre-upgrade-bearer'
async function verifySetup(): Promise<void> {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY)').execute()
  await db.insertInto('users').values({ id: 42 }).execute()
  const mode = process.env.STACKS_AUTH_SETUP_MODE
  const duplicateTable = mode === 'reset-duplicates' ? 'password_resets' : mode === 'verification-duplicates' ? 'email_verifications' : undefined
  let duplicateRows: Record<string, unknown>[] | undefined
  if (duplicateTable) {
    await db.unsafe(`CREATE TABLE ${duplicateTable} (
      ${sql.pkColumn}, ${duplicateTable === 'password_resets' ? 'email VARCHAR(255)' : 'user_id INTEGER'} NOT NULL,
      token VARCHAR(255) NOT NULL, expires_at ${sql.nullableTimestamp}, created_at ${sql.datetime} DEFAULT ${sql.utcNow}
    )`).execute()
    for (const token of ['synthetic-first', 'synthetic-second']) {
      await db.insertInto(duplicateTable).values({ ...(duplicateTable === 'password_resets' ? { email: 'duplicate@example.invalid' } : { user_id: 42 }),
        token, expires_at: '2030-01-01 00:00:00' }).execute()
    }
    duplicateRows = await db.selectFrom(duplicateTable).selectAll().orderBy('id').get()
  }
  if (mode === 'invalid')
    await db.unsafe('CREATE TABLE oauth_clients (id INTEGER PRIMARY KEY)').execute()
  if (mode === 'invalid-token')
    await db.unsafe('CREATE TABLE oauth_access_tokens (id INTEGER PRIMARY KEY)').execute()
  if (mode === 'legacy' || mode === 'failed-backfill') {
    await db.unsafe(`CREATE TABLE oauth_clients (
      ${sql.pkColumn}, name VARCHAR(255) NOT NULL, secret VARCHAR(100), provider VARCHAR(255), redirect VARCHAR(2000) NOT NULL,
      personal_access_client BOOLEAN NOT NULL DEFAULT ${sql.boolFalse}, password_client BOOLEAN NOT NULL DEFAULT ${sql.boolFalse},
      revoked BOOLEAN NOT NULL DEFAULT ${sql.boolFalse}, created_at ${sql.datetime} DEFAULT ${sql.utcNow}, updated_at ${sql.nullableTimestamp}
    )`).execute()
    await db.insertInto('oauth_clients').values({ id: 37, name: 'existing client', secret: 'synthetic-existing-secret', provider: 'local',
      redirect: 'https://legacy.invalid', personal_access_client: true }).execute()
    await db.unsafe(`CREATE TABLE oauth_access_tokens (
      ${sql.pkColumn}, user_id INTEGER NOT NULL, oauth_client_id INTEGER NOT NULL,
      token TEXT NOT NULL, name VARCHAR(255), scopes TEXT,
      revoked BOOLEAN NOT NULL DEFAULT ${sql.boolFalse}, expires_at ${sql.nullableTimestamp},
      created_at ${sql.datetime} DEFAULT ${sql.utcNow}, updated_at ${sql.nullableTimestamp}
    )`).execute()
    await db.insertInto('oauth_access_tokens').values({ user_id: 42, oauth_client_id: 37,
      token: createHash('sha256').update(legacyBearer).digest('hex'), name: 'existing', scopes: '["read"]' }).execute()
  }
  if (mode === 'failed-backfill') {
    if (dialect === 'postgres') {
      await db.unsafe("CREATE FUNCTION reject_setup_backfill() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture backfill rejected'; END; $$").execute()
      await db.unsafe('CREATE TRIGGER reject_setup_backfill BEFORE UPDATE ON oauth_access_tokens FOR EACH ROW EXECUTE FUNCTION reject_setup_backfill()').execute()
    }
    else if (dialect === 'mysql')
      await db.unsafe("CREATE TRIGGER reject_setup_backfill BEFORE UPDATE ON oauth_access_tokens FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixture backfill rejected'").execute()
    else
      await db.unsafe("CREATE TRIGGER reject_setup_backfill BEFORE UPDATE ON oauth_access_tokens BEGIN SELECT RAISE(ABORT, 'fixture backfill rejected'); END").execute()
  }
  let clientBefore: Record<string, unknown> | undefined
  for (let run = 0; run < 2; run++) {
    const child = Bun.spawn([process.execPath, `--config=${configPath}`, '--no-env-file', `${import.meta.dir}/../../../actions/src/auth/setup.ts`], {
      env: process.env, stdout: 'pipe', stderr: 'pipe',
    })
    let timedOut = false
    const watchdog = setTimeout(() => { timedOut = true; child.kill() }, 10_000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      assert.equal(timedOut, false, 'auth:setup must finish without the fixture killing it')
      if (mode === 'invalid' || mode === 'invalid-token' || mode === 'failed-backfill' || duplicateTable) {
        assert.equal(code, 1, `setup must fail when the auth schema cannot be initialized: ${stdout}\n${stderr}`)
        assert.match(stdout + stderr, /Authentication setup failed/)
        assert(!stdout.includes('Authentication setup complete!'))
        if (duplicateTable)
          assert.deepEqual(await db.selectFrom(duplicateTable).selectAll().orderBy('id').get(), duplicateRows, 'setup must not discard duplicate credentials')
        if (mode === 'failed-backfill') {
          assert.match(stdout + stderr, /fixture backfill rejected/)
          const unchanged = await db.selectFrom('oauth_access_tokens').selectAll().executeTakeFirstOrThrow()
          assert.equal(unchanged.tokenable_id, null)
          assert.equal(unchanged.token, createHash('sha256').update(legacyBearer).digest('hex'))
        }
        return
      }
      assert.equal(code, 0, `auth:setup failed: ${stdout}\n${stderr}`)
    }
    finally { clearTimeout(watchdog); child.kill() }
    const clients = await db.selectFrom('oauth_clients').selectAll().get()
    assert.equal(clients.length, 1, 'setup must not duplicate or rotate the existing client')
    const client = clients[0]!
    if (mode === 'legacy') {
      assert.equal(Number(client.id), 37)
      assert.equal(client.secret, 'synthetic-existing-secret')
    }
    else
      assert(String(client.secret).startsWith('$2'), 'setup must keep hashing new client secrets')
    if (clientBefore) assert.deepEqual(client, clientBefore)
    clientBefore = client
  }
  if (mode === 'legacy') {
    const previous = await findToken(legacyBearer)
    assert(previous, 'existing access tokens must remain usable after setup')
    assert.deepEqual(previous.scopes, ['read'])
    assert((await tokens(42)).some(token => Number(token.id) === Number(previous.id)), 'existing tokens must receive their polymorphic owner backfill')
  }
  const pair = await createToken(42, 'after-setup', ['read'], { userAgent: 'setup-fixture', ipAddress: '127.0.0.1' })
  assert(await findToken(pair.plainTextToken))
  const replacement = await refreshToken(pair.refreshToken!)
  assert(await findToken(replacement.plainTextToken))
  const user = await db.selectFrom('users').where('id', '=', 42).select(['email_verified_at', 'password_changed_at', 'two_factor_enabled']).executeTakeFirstOrThrow()
  assert.equal(Boolean(user.two_factor_enabled), false)
  assert.equal(user.password_changed_at, null)
  const reset = { email: 'fixture@example.invalid', token: 'synthetic-reset', expires_at: '2030-01-01 00:00:00' }
  await db.insertInto('password_resets').values(reset).execute()
  await assert.rejects(db.insertInto('password_resets').values({ ...reset, token: 'synthetic-duplicate-reset' }).execute(), /unique|duplicate/i)
  const verification = { user_id: 42, token: 'synthetic-verification', expires_at: '2030-01-01 00:00:00' }
  await db.insertInto('email_verifications').values(verification).execute()
  await assert.rejects(db.insertInto('email_verifications').values({ ...verification, token: 'synthetic-duplicate-verification' }).execute(), /unique|duplicate/i)
}
try { await verifySetup(); console.log('auth setup schema OK') }
finally { resetDatabaseConnection() }
