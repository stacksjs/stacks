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
const { createToken, findToken, refreshToken } = await import('../../src/tokens')
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
  await withRoutingContext(async () => {
    assert.equal(contextHasWritten(), false, 'one request must not pin unrelated readers')
    await assert.rejects(refreshToken(original.refreshToken!), { status: 401 })
    assert.equal(contextHasWritten(), false, 'a rejected refresh must not mark the request as a writer')
    if (replica)
      await assert.rejects(db.selectFrom('oauth_access_tokens').selectAll().get())
  })
  if (replica) assert(replicaConnections > 0, 'the read-only control must actually attempt the configured replica')
  console.log('token write routing OK')
}
finally { replica?.stop(true); resetDatabaseConnection() }
