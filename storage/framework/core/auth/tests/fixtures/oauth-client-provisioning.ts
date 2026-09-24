import assert from 'node:assert/strict'
import { setSystemTime } from 'bun:test'
import { realpathSync } from 'node:fs'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_CLIENT_TEST_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-client-test-'))
assert.equal(realpathSync(process.cwd()), realpathSync(dirname(configPath)), 'CLI config must come from the disposable app, never the checkout')
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_client_test_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, migrateAuthTables, resetDatabaseConnection, sqlHelpers, withRoutingContext, contextHasWritten } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect,
  connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  }, queryLogging: { enabled: false },
} })
const sql = sqlHelpers(dialect)
async function verifyClients(): Promise<void> {
  if (['mismatched-token-driver', 'absent-token-driver'].includes(process.env.STACKS_CLIENT_TEST_MODE!)) {
    assert.equal((await migrateAuthTables()).success, true)
    await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, password_changed_at TIMESTAMP)').execute()
    await db.insertInto('users').values({ id: 42 }).execute()
    const previous = process.env.DB_CONNECTION
    if (process.env.STACKS_CLIENT_TEST_MODE === 'absent-token-driver') delete process.env.DB_CONNECTION
    else process.env.DB_CONNECTION = dialect === 'postgres' ? 'sqlite' : 'postgres'
    const now = new Date('2030-01-02T03:04:05.789Z')
    setSystemTime(now)
    try {
      const api = await import('../../src/tokens')
      const pair = await api.createToken(42, 'configured token driver', ['read'])
      const client = await api.findClient(pair.accessToken.clientId)
      assert(client && !client.revoked)
      assert.equal((await api.findToken(pair.plainTextToken))?.name, 'configured token driver')
      assert.equal((await api.tokens(42)).length, 1)
      assert.equal(await api.getPasswordChangedAt(42), null)
      assert.equal(await api.validateRefreshToken(pair.refreshToken!), true)
      const rotated = await api.refreshToken(pair.refreshToken!)
      assert.equal(await api.validateRefreshToken(pair.refreshToken!), false)
      assert.equal(await api.validateRefreshToken(rotated.refreshToken!), true)
      await api.revokeRefreshToken(rotated.refreshToken!)
      assert.equal(await api.validateRefreshToken(rotated.refreshToken!), false)
      const another = await api.createToken(42, 'bulk refresh revocation', ['read'])
      await api.revokeAllRefreshTokens(42)
      assert.equal(await api.validateRefreshToken(another.refreshToken!), false)
      assert.equal(await api.deleteRevokedRefreshTokens(-1), 3)
      assert.equal(await api.deleteExpiredRefreshTokens(), 0)
      await api.createToken(42, 'expired', ['read'], { expiresAt: new Date(now.getTime() - 1000), withRefreshToken: false })
      assert.equal(await api.deleteExpiredTokens(), 1)
      await api.revokeAllTokens(42)
      assert.equal(await api.deleteRevokedTokens(-1), 3)
      assert.deepEqual(await api.tokens(42), [])
      assert.deepEqual(await api.clients(42), [])
      await api.revokeClient(pair.accessToken.clientId)
      assert.equal((await api.findClient(pair.accessToken.clientId))?.revoked, true)
    }
    finally { process.env.DB_CONNECTION = previous; setSystemTime() }
    return
  }
  if (process.env.STACKS_CLIENT_TEST_MODE === 'replica-routing') {
    assert(dialect !== 'sqlite')
    assert.equal((await migrateAuthTables()).success, true)
    let replicaConnections = 0
    // A controlled unavailable replica must have no bearing on primary-only
    // provisioning. Count connections rather than depend on a timing race.
    const replica = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: {
      open(socket) { replicaConnections++; socket.end() },
      data() {},
    } })
    try {
      initializeDbConfig({ app: { env: 'test' }, database: {
        default: dialect, connections: { [dialect]: {
          name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME,
          password: process.env.DB_PASSWORD, replicas: [{ host: '127.0.0.1', port: replica.port }], pool: { acquireTimeoutMs: 1000 },
        } }, reads: { autoRoute: true }, queryLogging: { enabled: false },
      } })
      const { createClient } = await import('../../src/tokens')
      const result = await createClient({ name: 'CLI routing context', redirect: 'https://primary.invalid' })
      assert.equal(result.client.name, 'CLI routing context')
      await withRoutingContext(async () => {
        assert.equal(contextHasWritten(), false)
        const scoped = await createClient({ name: 'request routing context', redirect: 'https://primary.invalid' })
        assert.equal(contextHasWritten(), true, 'successful provisioning must pin subsequent request reads')
        assert(await db.selectFrom('oauth_clients').where('id', '=', scoped.client.id).selectAll().executeTakeFirst())
      })
      assert.equal(replicaConnections, 0, 'provisioning must never read its new client from a replica')
    }
    finally { replica.stop(true) }
    return
  }
  if (process.env.STACKS_CLIENT_TEST_MODE === 'mismatched-driver') {
    assert.equal((await migrateAuthTables()).success, true)
    const previous = process.env.DB_CONNECTION
    // Configuration above selected the real connection. Client creation must
    // not replace it with an absent/stale environment-derived SQL dialect.
    process.env.DB_CONNECTION = dialect === 'postgres' ? 'sqlite' : 'postgres'
    try {
      const { createClient } = await import('../../src/tokens')
      const result = await createClient({ name: 'configured driver', redirect: 'https://configured.invalid', userId: 42, passwordClient: true })
      const row = await db.selectFrom('oauth_clients').where('id', '=', result.client.id).selectAll().executeTakeFirstOrThrow()
      assert.equal(row.name, 'configured driver')
      assert.equal(Number(row.user_id), 42)
      assert.equal(Boolean(row.password_client), true)
    }
    finally { process.env.DB_CONNECTION = previous }
    return
  }
  const { createClient, clients, findClient, revokeClient } = await import('../../src/tokens')
  const { Auth } = await import('../../src/authentication')
  const { verifyHash } = await import('@stacksjs/security')
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
  const failures: string[] = []
  async function check(name: string, run: () => Promise<void>): Promise<void> {
    try { await run() }
    catch (error) { failures.push(`${name}: ${error}`) }
  }
  await check('API client secrets are hashed and usable', async () => {
    assert(String(row.secret).startsWith('$2'), 'new API secrets must use the supported bcrypt format')
    assert(row.secret !== owned.plainTextSecret, 'plaintext must only appear in the creation result')
    assert.equal(await verifyHash(owned.plainTextSecret, String(row.secret)), true)
    // Empty user credentials deliberately stop after public client validation.
    assert.equal(await Auth.requestToken({}, owned.client.id, owned.plainTextSecret), null)
    await assert.rejects(Auth.requestToken({}, owned.client.id, `${owned.plainTextSecret.slice(0, -1)}z`), /Invalid client credentials/)
  })
  if (process.env.STACKS_CLIENT_TEST_MODE === 'legacy') {
    await check('legacy client secrets remain usable', async () => {
      assert.equal(await Auth.requestToken({}, Number(initial[0]!.id), 'synthetic-legacy-secret'), null)
      await assert.rejects(Auth.requestToken({}, Number(initial[0]!.id), 'synthetic-wrong-secret'), /Invalid client credentials/)
    })
  }
  for (const password of [false, true]) {
    await check(`CLI provisions usable credentials (password: ${password})`, async () => {
      const name = `CLI fixture ${password}`
      const child = Bun.spawn([process.execPath, `--config=${configPath}`, '--no-env-file',
        `${import.meta.dir}/../../../actions/src/auth/client.ts`, `--name=${name}`, '--redirect=https://cli.invalid/callback?x=a=b',
        ...(password ? ['--password'] : []),
      ], { env: process.env, stdout: 'pipe', stderr: 'pipe' })
      let timedOut = false
      const watchdog = setTimeout(() => { timedOut = true; child.kill() }, 10_000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        assert.equal(timedOut, false, 'client creation must not hang')
        assert.equal(code, 0, 'CLI failed before delivering credentials')
        const output = (stdout + stderr).replace(/\x1B\[[0-9;]*m/g, '')
        const secrets = [...output.matchAll(/Client Secret \(save now, shown once\): ([^\r\n]+)/g)]
        assert.equal(secrets.length, 1, 'the CLI must deliver the new secret exactly once')
        const secret = secrets[0]![1]!
        assert.equal(output.split(secret).length - 1, 1, 'logs must not repeat the secret')
        const client = await db.selectFrom('oauth_clients').where('name', '=', name).selectAll().executeTakeFirstOrThrow()
        assert.equal(Number(/Client ID:\s*(\d+)/.exec(output)?.[1]), Number(client.id), 'the CLI must report the inserted ID, not an affected-row count')
        assert.equal(Boolean(client.password_client), password)
        assert.equal(client.redirect, 'https://cli.invalid/callback?x=a=b')
        assert(String(client.secret).startsWith('$2'), 'CLI secrets must use the supported bcrypt format')
        assert(client.secret !== secret)
        assert.equal(await Auth.requestToken({}, Number(client.id), secret), null)
        await assert.rejects(Auth.requestToken({}, Number(client.id), 'synthetic-wrong-secret'), /Invalid client credentials/)
      }
      finally { clearTimeout(watchdog); child.kill() }
    })
  }
  await revokeClient(owned.client.id)
  await assert.rejects(Auth.requestToken({}, owned.client.id, owned.plainTextSecret), /Invalid client credentials/)
  assert.deepEqual(await clients(ownerId), [])
  assert.equal((await findClient(explicitEmpty.client.id))!.revoked, false)
  assert.deepEqual(failures, [], failures.join('\n'))
}
try { await verifyClients(); console.log('client provisioning OK') }
finally { resetDatabaseConnection() }
