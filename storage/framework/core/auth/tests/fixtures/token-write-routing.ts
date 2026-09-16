import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_TOKEN_ROUTING_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-token-routing-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_token_routing_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, migrateAuthTables, resetDatabaseConnection, withRoutingContext, contextHasWritten } = await import('@stacksjs/database')
await ensureDatabaseConfigLoaded()
let replicaConnections = 0
// A deliberately unavailable replica makes accidental routing deterministic.
// The write and successful read-back still use a real database server.
const replica = dialect === 'sqlite' ? undefined : Bun.listen({ hostname: '127.0.0.1', port: 0, socket: {
  open(socket) { replicaConnections++; socket.end() },
  data() {},
} })
function configureRouting(enabled = false) {
  initializeDbConfig({ app: { env: 'test' }, database: {
    default: dialect,
    connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
      [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
      replicas: enabled ? [{ host: '127.0.0.1', port: replica!.port }] : [], pool: { acquireTimeoutMs: 1000 } },
    }, reads: { autoRoute: true }, queryLogging: { enabled: false },
  } })
}
configureRouting()
const { createToken, findToken, refreshToken, revokeAllTokens, revokeRefreshToken, revokeAllRefreshTokens, createClient, revokeClient, deleteExpiredTokens, deleteRevokedTokens, deleteExpiredRefreshTokens, deleteRevokedRefreshTokens } = await import('../../src/tokens')
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY)').execute()
  await db.insertInto('users').values({ id: 42 }).execute()
  assert.equal((await migrateAuthTables()).success, true)
  const original = await createToken(42, 'routing fixture', ['read'])
  configureRouting(true)
  await withRoutingContext(async () => {
    assert.equal(contextHasWritten(), false)
    const rotated = await refreshToken(original.refreshToken!)
    assert(await findToken(rotated.plainTextToken), 'refresh must commit its new token on the primary')
    console.log('PASS refresh committed and primary lookup found new token')
    const row = await db.selectFrom('oauth_access_tokens').where('id', '=', rotated.accessToken.id).selectAll().executeTakeFirst()
    assert(row, 'the writing request must read back its committed refresh')
    assert.equal(contextHasWritten(), true, 'refresh must pin subsequent request reads')
  })
  assert.equal(replicaConnections, 0, 'post-refresh reads must not reach a replica')
  const bulk = await createToken(42, 'bulk routing fixture', ['read'])
  await withRoutingContext(async () => {
    assert.equal(contextHasWritten(), false)
    await revokeAllTokens(42)
    assert.equal(await findToken(bulk.plainTextToken), null, 'bulk revocation must commit on primary')
    console.log('PASS bulk revocation committed on primary')
    const row = await db.selectFrom('oauth_access_tokens').where('id', '=', bulk.accessToken.id).selectAll().executeTakeFirst()
    assert.equal(Boolean(row?.revoked), true, 'the revoking request must read back its own mutation')
    assert.equal(contextHasWritten(), true, 'bulk revocation must pin subsequent request reads')
  })
  assert.equal(replicaConnections, 0, 'post-revocation reads must not reach a replica')
  const failures: string[] = []
  async function verifyMutation(name: string, mutate: () => Promise<unknown>, readBack: () => Promise<void>) {
    try {
      await withRoutingContext(async () => {
        assert.equal(contextHasWritten(), false)
        await mutate()
        await readBack()
        assert.equal(contextHasWritten(), true, `${name} must pin later request reads`)
      })
    }
    catch (error) { failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`) }
  }
  for (const bulkRefresh of [false, true]) {
    const sample = await createToken(42, 'refresh revocation routing', ['read'])
    await verifyMutation(bulkRefresh ? 'revokeAllRefreshTokens' : 'revokeRefreshToken',
      () => bulkRefresh ? revokeAllRefreshTokens(42) : revokeRefreshToken(sample.refreshToken!),
      async () => {
        const row = await db.selectFrom('oauth_refresh_tokens').where('access_token_id', '=', sample.accessToken.id).selectAll().executeTakeFirst()
        assert.equal(Boolean(row?.revoked), true)
      })
  }
  const client = await createClient({ name: 'routing fixture', redirect: 'https://example.test/callback' })
  await verifyMutation('revokeClient', () => revokeClient(client.client.id), async () => {
    const row = await db.selectFrom('oauth_clients').where('id', '=', client.client.id).selectAll().executeTakeFirst()
    assert.equal(Boolean(row?.revoked), true)
  })
  // The pruning helpers write through `db.unsafe` too. Each case seeds rows the
  // helper will really delete and asserts a non-zero count, so a helper that
  // matched nothing cannot satisfy this vacuously.
  // Seed through the real write path rather than stamping columns afterwards,
  // so the stored timestamp format is whatever the source itself writes on each
  // dialect. Backdating by hand wrote a value Postgres and MySQL then did not
  // match, and every prune silently deleted nothing.
  async function seedPrunable(mode: 'expired' | 'revoked') {
    const seeded = await createToken(42, 'prune routing fixture', ['read'], mode === 'expired'
      ? { expiresAt: new Date(Date.now() - 86_400_000), refreshExpiresInDays: -1 }
      : {})
    if (mode === 'revoked')
      await revokeAllTokens(42)
    return seeded
  }
  // Count the rows rather than asserting on the helper's return value. This
  // test is about routing, so it proves a write really happened from the table
  // itself; whether each helper reports that count correctly is
  // token-prune-counts.test.ts's job.
  async function tokenRowCount() {
    const access = await db.selectFrom('oauth_access_tokens').selectAll().execute()
    const refresh = await db.selectFrom('oauth_refresh_tokens').selectAll().execute()
    return (access as unknown[]).length + (refresh as unknown[]).length
  }
  async function verifyPrune(name: string, mode: 'expired' | 'revoked', prune: () => Promise<number>) {
    let before = 0
    // Seeding writes, which pins this context, so the baseline read is served
    // by the primary rather than the deliberately unavailable replica.
    await withRoutingContext(async () => {
      await seedPrunable(mode)
      before = await tokenRowCount()
    })
    try {
      await withRoutingContext(async () => {
        assert.equal(contextHasWritten(), false)
        await prune()
        assert.equal(contextHasWritten(), true, `${name} must pin later request reads`)
        assert(await tokenRowCount() < before, `${name} deleted nothing, so this case would prove nothing`)
      })
    }
    catch (error) { failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`) }
  }
  await verifyPrune('deleteExpiredRefreshTokens', 'expired', () => deleteExpiredRefreshTokens())
  await verifyPrune('deleteRevokedRefreshTokens', 'revoked', () => deleteRevokedRefreshTokens(-1))
  await verifyPrune('deleteExpiredTokens', 'expired', () => deleteExpiredTokens())
  await verifyPrune('deleteRevokedTokens', 'revoked', () => deleteRevokedTokens(-1))
  assert.deepEqual(failures, [], 'every auth mutation must read back its committed state')
  assert.equal(replicaConnections, 0, 'auth mutation read-backs must not reach a replica')
  await withRoutingContext(async () => {
    assert.equal(contextHasWritten(), false, 'one request must not pin unrelated readers')
    await assert.rejects(refreshToken(original.refreshToken!), { status: 401 })
    assert.equal(contextHasWritten(), false, 'a rejected refresh must not mark the request as a writer')
    if (replica)
      await assert.rejects(db.selectFrom('oauth_access_tokens').selectAll().get())
  })
  if (replica) assert(replicaConnections > 0, 'the read-only control must actually attempt the configured replica')
  // Partial success. The two sequential prunes issue their statements with no
  // transaction around them, so the refresh delete can commit while the
  // access-token delete fails. A trigger forces exactly that. The call throws,
  // but a write has committed, so the request must still be pinned to primary.
  const partial = await seedPrunable('expired')
  const guards = dialect === 'postgres'
    ? ['CREATE FUNCTION prune_guard() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION \'blocked\'; END; $$ LANGUAGE plpgsql',
        'CREATE TRIGGER prune_guard BEFORE DELETE ON oauth_access_tokens FOR EACH ROW EXECUTE FUNCTION prune_guard()']
    : dialect === 'mysql'
      ? ['CREATE TRIGGER prune_guard BEFORE DELETE ON oauth_access_tokens FOR EACH ROW SIGNAL SQLSTATE \'45000\' SET MESSAGE_TEXT = \'blocked\'']
      : ['CREATE TRIGGER prune_guard BEFORE DELETE ON oauth_access_tokens BEGIN SELECT RAISE(ABORT, \'blocked\'); END']
  for (const statement of guards)
    await db.unsafe(statement).execute()
  try {
    await withRoutingContext(async () => {
      assert.equal(contextHasWritten(), false)
      await assert.rejects(deleteExpiredTokens(), 'the guarded access-token delete must fail')
      const orphan = await db.selectFrom('oauth_refresh_tokens').where('access_token_id', '=', partial.accessToken.id).selectAll().executeTakeFirst()
      assert(!orphan, 'the first delete must have committed before the second failed')
      assert.equal(contextHasWritten(), true, 'a partially committed prune must still pin the request')
    })
    console.log('PASS partially committed prune still pins the request')
  }
  finally {
    const drops = dialect === 'postgres'
      ? ['DROP TRIGGER IF EXISTS prune_guard ON oauth_access_tokens', 'DROP FUNCTION IF EXISTS prune_guard()']
      : ['DROP TRIGGER IF EXISTS prune_guard']
    for (const statement of drops)
      await db.unsafe(statement).execute()
  }
  console.log('token write routing OK')
}
finally { replica?.stop(true); resetDatabaseConnection() }
