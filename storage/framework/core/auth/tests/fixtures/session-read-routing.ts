import assert from 'node:assert/strict'

const { DB_HOST: host, DB_DATABASE: name, DB_USERNAME: username, DB_PASSWORD: password, DB_PORT: port } = process.env
assert.equal(process.env.DB_CONNECTION, 'postgres')
assert(name?.startsWith('stacks_session_routing_'))
assert(host && ['127.0.0.1', 'localhost', '[::1]'].includes(host))
assert.equal(process.env.STACKS_SESSION_REPLICA_USER, name)
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, initializeDbConfig, ensureDatabaseConfigLoaded, closeDatabaseConnection, withRoutingContext, contextHasWritten, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: 'postgres', connections: { postgres: {
    name, host, port: Number(port), username, password,
    replicas: [{ host, port: Number(port), username: name, password: process.env.STACKS_SESSION_REPLICA_PASSWORD }],
  } }, reads: { autoRoute: true }, queryLogging: { enabled: false },
} })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const { releaseOrm } = await import('bun-query-builder')
const { SessionAuth } = await import('../../src/session-auth')
const failures: string[] = []

try {
  await db.unsafe('CREATE TABLE users (id BIGINT PRIMARY KEY, name TEXT, email TEXT, password TEXT, password_changed_at TIMESTAMP, created_at TIMESTAMP, updated_at TIMESTAMP)').execute()
  await db.insertInto('users').values({ id: 1, name: 'Session fixture', email: 'session@example.invalid' }).execute()
  await db.unsafe('CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id BIGINT, expires_at TIMESTAMP, last_activity BIGINT, ip_address TEXT, user_agent TEXT)').execute()
  await db.unsafe('CREATE SCHEMA lagged').execute()
  await db.unsafe('CREATE TABLE lagged.sessions (LIKE public.sessions INCLUDING ALL)').execute()
  await db.unsafe(`GRANT USAGE ON SCHEMA lagged TO "${name}"`).execute()
  await db.unsafe(`GRANT SELECT ON lagged.sessions TO "${name}"`).execute()
  const expiry = sqlDateTime(new Date(Date.now() + 60_000))
  await db.insertInto('sessions').values({ id: 'revoked', user_id: 1, expires_at: expiry, last_activity: 0 }).execute()
  await db.unsafe('INSERT INTO lagged.sessions SELECT * FROM public.sessions').execute()
  await SessionAuth.logout('revoked')
  await db.insertInto('sessions').values({ id: 'fresh', user_id: 1, expires_at: expiry, last_activity: 0 }).execute()

  // Prove the stale snapshot is reachable before testing auth, and ensure
  // the fix does not silently disable ordinary read routing for the app.
  async function assertLaggedRead() {
    const rows = await db.selectFrom('sessions').selectAll().execute()
    assert.deepEqual(rows.map(row => row.id), ['revoked'])
  }
  await withRoutingContext(assertLaggedRead)
  for (const id of ['revoked', 'fresh']) {
    for (const method of ['check', 'user', 'refresh'] as const) {
      try {
        await withRoutingContext(async () => {
          assert.equal(contextHasWritten(), false)
          assert.equal(Boolean(await SessionAuth[method](id)), id === 'fresh', `${method}: ${id} session must use primary state`)
          if (method !== 'refresh') {
            assert.equal(contextHasWritten(), false, 'auth reads must not pretend to write')
            await assertLaggedRead()
          }
        })
      }
      catch (error) { failures.push(String(error)) }
    }
  }
  assert.deepEqual(failures, [])
  await assert.rejects(db.transaction(async () => {
    await SessionAuth.logout('fresh')
    assert.equal(await SessionAuth.check('fresh'), false, 'primary reads must see this transaction\'s revocation')
    throw new Error('rollback session fixture')
  }), /rollback session fixture/)
  assert.equal(await SessionAuth.check('fresh'), true, 'rolled-back revocation must preserve the session')
  let escapedRead: (() => unknown) | undefined
  await db.transaction(async () => {
    const read = db.primary.selectFrom
    escapedRead = () => read('sessions').executeTakeFirst()
    assert(await read('sessions').where('id', '=', 'fresh').executeTakeFirst())
  })
  await assert.rejects(async () => escapedRead!(), /transaction/i, 'retained primary methods must not escape their transaction')
  await withRoutingContext(assertLaggedRead)
  console.log('session primary reads OK')
}
finally {
  await releaseOrm()
  await closeDatabaseConnection()
}
