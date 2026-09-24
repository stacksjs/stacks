import assert from 'node:assert/strict'
import { SQL } from 'bun'
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
  if (dialect !== 'sqlite') {
    for (const change of ['revoke', 'delete'] as const) {
      const racingClient = await createClient({ name: 'client update during exchange', redirect: 'https://race.invalid', personalAccessClient: true })
      const pair = await createToken(42, 'waiting exchange', ['read'])
      assert.equal(Number(pair.accessToken.clientId), Number(racingClient.client.id))
      const beforeRace = await credentialSnapshot()
      const observer = new SQL({ adapter: dialect, hostname: process.env.DB_HOST,
        port: Number(process.env.DB_PORT), database: process.env.DB_DATABASE,
        username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
        tls: process.env.DB_SSL === 'true' ? 'require' : 'disable' })
      const blocker = await observer.reserve()
      let held = false
      let done = false
      let pending: ReturnType<typeof refreshToken> | undefined
      try {
        await blocker.unsafe('BEGIN'); held = true
        await blocker.unsafe(`SELECT id FROM oauth_access_tokens WHERE id = ${dialect === 'postgres' ? '$1' : '?'} FOR UPDATE`, [pair.accessToken.id])
        pending = refreshToken(pair.refreshToken!).finally(() => { done = true })
        void pending.catch(() => {})
        let waiting = false
        const deadline = performance.now() + 5000
        while (!done && !waiting && performance.now() < deadline) {
          const rows = await observer.unsafe(dialect === 'postgres'
            ? "SELECT COUNT(*) AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid != pg_backend_pid()"
            : "SELECT COUNT(*) AS count FROM performance_schema.data_locks WHERE OBJECT_SCHEMA = DATABASE() AND LOCK_STATUS = 'WAITING'")
          waiting = Number(rows[0].count) > 0
          if (!waiting) await Bun.sleep(10)
        }
        assert(waiting && !done, 'refresh must have entered its locking statement before client revocation')
        // Commit the client update while the exchange's earlier query snapshot
        // still sees the active client. The grant itself has not been consumed.
        await observer.unsafe(`${change === 'revoke' ? 'UPDATE oauth_clients SET revoked = TRUE' : 'DELETE FROM oauth_clients'} WHERE id = ${dialect === 'postgres' ? '$1' : '?'}`, [racingClient.client.id])
        await blocker.unsafe('COMMIT'); held = false
        await assert.rejects(pending, /Invalid or expired refresh token/)
        assert.deepEqual(await credentialSnapshot(), beforeRace, 'a client revoked during the wait must prevent rotation')
      }
      finally {
        if (held) await blocker.unsafe('ROLLBACK')
        await pending?.catch(() => {})
        blocker.release()
        await observer.close()
      }
    }

    await db.insertInto('users').values({ id: 43 }).execute()
    const sharedClient = await createClient({ name: 'shared refresh client', redirect: 'https://shared.invalid', personalAccessClient: true })
    const firstPair = await createToken(42, 'first independent user', ['read'])
    const secondPair = await createToken(43, 'second independent user', ['read'])
    assert.equal(Number(firstPair.accessToken.clientId), Number(sharedClient.client.id))
    assert.equal(Number(secondPair.accessToken.clientId), Number(sharedClient.client.id))
    let startSecond!: () => void
    const ready = new Promise<void>((resolve) => { startSecond = resolve })
    // The continuation must capture the context outside the first transaction.
    const second = (async () => { await ready; return refreshToken(secondPair.refreshToken!) })()
    void second.catch(() => {})
    try {
      await assert.rejects(db.transaction(async () => {
        const first = await refreshToken(firstPair.refreshToken!)
        assert(await findToken(first.plainTextToken))
        startSecond()
        let timeout: ReturnType<typeof setTimeout> | undefined
        try {
          const result = await Promise.race([second, new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(new Error('shared client serialized unrelated refreshes')), 5000)
          })])
          assert(result)
        }
        finally { clearTimeout(timeout) }
        throw new Error('rollback first refresh')
      }), /rollback first refresh/)
      assert(await findToken(firstPair.plainTextToken), 'outer rollback restores the first pair')
      assert.equal(await validateRefreshToken(firstPair.refreshToken!), true)
      const committedSecond = await second
      assert(await findToken(committedSecond.plainTextToken), 'the independent second exchange remains committed')
      assert.equal(await validateRefreshToken(secondPair.refreshToken!), false)
    }
    finally { startSecond(); await second.catch(() => {}) }
  }
  if (dialect === 'mysql') {
    const pair = await createToken(42, 'gap lock target', ['read'])
    const other = await createToken(43, 'gap lock bystander', ['read'])
    // One hash makes its preceding range explicit. The synthetic insertion
    // below is inside that range but belongs to a different access token.
    await db.deleteFrom('oauth_refresh_tokens').where('access_token_id', '!=', pair.accessToken.id).execute()
    const observer = new SQL({ adapter: 'mysql', hostname: process.env.DB_HOST,
      port: Number(process.env.DB_PORT), database: process.env.DB_DATABASE,
      username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
      tls: process.env.DB_SSL === 'true' ? 'require' : 'disable' })
    const blocker = await observer.reserve()
    let held = false
    let pending: ReturnType<typeof refreshToken> | undefined
    let insertion: Promise<unknown> | undefined
    try {
      await blocker.unsafe('BEGIN'); held = true
      await blocker.unsafe('SELECT id FROM oauth_access_tokens WHERE id = ? FOR UPDATE', [pair.accessToken.id])
      pending = refreshToken(pair.refreshToken!)
      void pending.catch(() => {})
      let waiting = false
      const deadline = performance.now() + 5000
      while (!waiting && performance.now() < deadline) {
        const rows = await observer.unsafe("SELECT COUNT(*) AS count FROM performance_schema.data_locks WHERE OBJECT_SCHEMA = DATABASE() AND LOCK_STATUS = 'WAITING'")
        waiting = Number(rows[0].count) > 0
        if (!waiting) await Bun.sleep(10)
      }
      assert(waiting, 'target exchange must hold its refresh selection while waiting for the access row')
      let inserted = false
      insertion = Promise.resolve(observer.unsafe('INSERT INTO oauth_refresh_tokens (access_token_id, token, revoked) VALUES (?, ?, FALSE)',
        [other.accessToken.id, '0'.repeat(64)])).then(() => { inserted = true })
      void insertion.catch(() => {})
      let gapWait = false
      const insertDeadline = performance.now() + 5000
      while (!inserted && !gapWait && performance.now() < insertDeadline) {
        const rows = await observer.unsafe("SELECT COUNT(*) AS count FROM performance_schema.data_locks WHERE OBJECT_SCHEMA = DATABASE() AND INDEX_NAME = 'idx_oauth_refresh_tokens_token' AND LOCK_STATUS = 'WAITING'")
        gapWait = Number(rows[0].count) > 0
        if (!inserted && !gapWait) await Bun.sleep(10)
      }
      assert(inserted && !gapWait, 'refresh lookup must not lock unrelated token-hash gaps')
      await insertion
    }
    finally {
      if (held) await blocker.unsafe('ROLLBACK')
      await Promise.allSettled([pending, insertion])
      blocker.release()
      await observer.close()
    }
    assert(await findToken((await pending!).plainTextToken))
  }
  console.log('token refresh client validity OK')
}
finally { resetDatabaseConnection() }
