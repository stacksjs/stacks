import assert from 'node:assert/strict'
const { config, overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: process.env.DB_CONNECTION, connections: { sqlite: { database: process.env.DB_DATABASE_PATH }, postgres: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD } }, queryLogging: { enabled: false },
} })
const { configureOrm, releaseOrm } = await import('bun-query-builder')
if (process.env.DB_CONNECTION === 'sqlite') configureOrm({ database: process.env.DB_DATABASE_PATH })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const { Auth } = await import('../../src/authentication')
const { createToken } = await import('../../src/tokens')
const { migrateImpersonationTables } = await import('../../src/impersonation-store')
const { requestImpersonation } = await import('../../src/impersonation-auth')
const { enhanceRequest, runWithRequest } = await import('@stacksjs/router')
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, password TEXT, created_at TEXT, updated_at TEXT)').execute()
  await db.insertInto('users').values([{ id: 1, name: 'Admin', email: 'admin@example.invalid', password: 'unused' }, { id: 2, name: 'Member', email: 'member@example.invalid', password: 'unused' }]).execute()
  await db.unsafe('CREATE TABLE roles (id INTEGER PRIMARY KEY, name TEXT, guard_name TEXT, description TEXT, created_at TEXT, updated_at TEXT)').execute()
  await db.unsafe('CREATE TABLE user_roles (user_id INTEGER, role_id INTEGER, created_at TEXT)').execute()
  await db.insertInto('roles').values({ id: 1, name: 'super-admin', guard_name: 'platform' }).execute()
  await db.insertInto('user_roles').values({ user_id: 1, role_id: 1 }).execute()
  await ensureFrameworkAuthTables()
  await migrateImpersonationTables()
  config.auth.impersonation = { enabled: true, eligible: async id => Boolean(await db.primary.selectFrom('users').select('id').where('id', '=', id).executeTakeFirst()) }
  config.auth.impersonation.workspaceId = async (request, subjectId) => {
    assert.equal(new URL(request.url).pathname, '/api/health')
    return subjectId === 2 ? 'workspace-55' : null
  }
  const actor = await createToken(1, 'admin', ['*'], { withRefreshToken: false })
  const other = await createToken(1, 'other admin session', ['*'], { withRefreshToken: false })
  const restricted = await createToken(1, 'restricted integration', ['profile:read'], { withRefreshToken: false })
  const req = (bearer: string, method = 'GET', context?: string) => enhanceRequest(new Request('https://hq.invalid/api/health', {
    method, headers: { authorization: `Bearer ${bearer}`, ...(context ? { 'x-stacks-impersonation': context } : {}) },
  }))
  const issued = await runWithRequest(req(actor.plainTextToken), () => Auth.startImpersonation(2, 'Investigate missing workout'))
  await assert.rejects(() => runWithRequest(req(restricted.plainTextToken), () => Auth.startImpersonation(2, 'Investigate missing workout')), /full administrator session/)
  await runWithRequest(req(actor.plainTextToken, 'GET', issued.credential), async () => {
    assert.equal(Number((await Auth.getUserFromToken(actor.plainTextToken))?.id), 2)
    assert.equal(requestImpersonation()?.actorId, 1)
    await assert.rejects(() => Auth.startImpersonation(2, 'Attempt a nested session'))
  })
  assert.equal(await runWithRequest(req(actor.plainTextToken, 'POST', issued.credential), () => Auth.getUserFromToken(actor.plainTextToken)), undefined)
  assert.equal(await runWithRequest(req(actor.plainTextToken, 'HEAD', issued.credential), () => Auth.getUserFromToken(actor.plainTextToken)), undefined)
  assert.equal(await runWithRequest(req(other.plainTextToken, 'GET', issued.credential), () => Auth.getUserFromToken(other.plainTextToken)), undefined)
  await db.updateTable('auth_impersonations').set({ expires_at: Date.now() }).where('id', '=', issued.session.id).execute()
  assert.equal(await runWithRequest(req(actor.plainTextToken, 'GET', issued.credential), () => Auth.getUserFromToken(actor.plainTextToken)), undefined)
  await db.updateTable('auth_impersonations').set({ expires_at: issued.session.expiresAt }).where('id', '=', issued.session.id).execute()
  config.auth.impersonation.enabled = false
  assert.equal(await runWithRequest(req(actor.plainTextToken, 'GET', issued.credential), () => Auth.getUserFromToken(actor.plainTextToken)), undefined)
  config.auth.impersonation.enabled = true
  const eligible = config.auth.impersonation.eligible
  config.auth.impersonation.eligible = id => id !== 2
  assert.equal(await runWithRequest(req(actor.plainTextToken, 'GET', issued.credential), () => Auth.getUserFromToken(actor.plainTextToken)), undefined)
  config.auth.impersonation.eligible = eligible
  await db.unsafe('ALTER TABLE auth_privileged_audits RENAME TO unavailable_audits').execute()
  await assert.rejects(() => runWithRequest(req(actor.plainTextToken, 'GET', issued.credential), () => Auth.getUserFromToken(actor.plainTextToken)))
  await db.unsafe('ALTER TABLE unavailable_audits RENAME TO auth_privileged_audits').execute()
  await db.deleteFrom('user_roles').where('user_id', '=', 1).execute()
  assert.equal(await runWithRequest(req(actor.plainTextToken, 'GET', issued.credential), () => Auth.getUserFromToken(actor.plainTextToken)), undefined)
  await db.insertInto('user_roles').values({ user_id: 1, role_id: 1 }).execute()
  await db.updateTable('oauth_access_tokens').set({ revoked: true }).where('id', '=', actor.accessToken.id).execute()
  assert.equal(await runWithRequest(req(actor.plainTextToken, 'GET', issued.credential), () => Auth.getUserFromToken(actor.plainTextToken)), undefined)
  const audit = await db.selectFrom('auth_privileged_audits').select('event').where('event', '=', 'accessed').execute()
  assert.equal(audit.length, 1, 'denied requests never acquire a subject identity')
  const detail = await db.selectFrom('auth_privileged_audits').select('details').where('event', '=', 'accessed').executeTakeFirst()
  assert.equal(JSON.parse(String(detail?.details)).workspaceId, 'workspace-55')
  console.log('impersonation authentication OK')
}
finally { await releaseOrm(); await resetDatabaseConnection() }
