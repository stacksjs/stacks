import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'
import { mock } from 'bun:test'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_OAUTH_RECOVERY_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-oauth-recovery-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_oauth_recovery_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
  assert(process.env.DB_PORT && !['5432', '3306'].includes(process.env.DB_PORT))
}

let sent = 0
mock.module('@stacksjs/email', () => ({
  template: async () => ({ text: 'synthetic recovery notification' }),
  templateByName: async () => ({ text: 'synthetic recovery notification' }),
  mail: { sendOrFail: async () => { sent++ } },
}))

const { config, overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({
  app: { env: 'test' },
  database: {
    default: dialect,
    connections: dialect === 'sqlite'
      ? { sqlite: { database: process.env.DB_DATABASE_PATH } }
      : {
          [dialect]: {
            name: process.env.DB_DATABASE,
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT),
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
          },
        },
    queryLogging: { enabled: false },
  },
})
const { configureOrm, releaseOrm } = await import('bun-query-builder')
if (dialect === 'sqlite') configureOrm({ database: process.env.DB_DATABASE_PATH })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const { makeHash, verifyHash } = await import('@stacksjs/security')
const {
  createOAuthGrant,
  createS256CodeChallenge,
  exchangeAuthorizationCode,
  findToken,
  issueAuthorizationCode,
  registerOAuthClient,
  resolveOAuthProviderConfig,
  withAuthorizationCode,
} = await import('../../src')
const { passwordResets } = await import('../../src/password/reset')

const victimId = 42
const bystanderId = 7
const email = 'oauth-recovery@example.invalid'
const oldPassword = 'synthetic-old-password'
const newPassword = 'synthetic-new-password'
const resetToken = 'synthetic-oauth-recovery-token'
const resetHash = await makeHash(resetToken, { algorithm: 'bcrypt' })
const oldPasswordHash = await makeHash(oldPassword, { algorithm: 'bcrypt' })
const verifier = 'v'.repeat(43)
const codeChallenge = await createS256CodeChallenge(verifier)
const redirectUri = 'https://client.example.com/callback'

async function installFailureTrigger(): Promise<void> {
  if (dialect === 'postgres') {
    await db.unsafe("CREATE FUNCTION reject_oauth_recovery() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture oauth recovery revocation denied'; END; $$").execute()
    await db.unsafe('CREATE TRIGGER reject_oauth_recovery BEFORE UPDATE ON oauth_grants FOR EACH ROW EXECUTE FUNCTION reject_oauth_recovery()').execute()
  }
  else if (dialect === 'mysql')
    await db.unsafe("CREATE TRIGGER reject_oauth_recovery BEFORE UPDATE ON oauth_grants FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixture oauth recovery revocation denied'").execute()
  else
    await db.unsafe("CREATE TRIGGER reject_oauth_recovery BEFORE UPDATE ON oauth_grants BEGIN SELECT RAISE(ABORT, 'fixture oauth recovery revocation denied'); END").execute()
}

async function removeFailureTrigger(): Promise<void> {
  await db.unsafe(`DROP TRIGGER reject_oauth_recovery${dialect === 'postgres' ? ' ON oauth_grants' : ''}`).execute()
  if (dialect === 'postgres') await db.unsafe('DROP FUNCTION reject_oauth_recovery()').execute()
}

try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR(255), password TEXT, password_changed_at TIMESTAMP)').execute()
  await ensureFrameworkAuthTables()
  await db.insertInto('users').values([
    { id: victimId, email, password: oldPasswordHash },
    { id: bystanderId, email: 'bystander@example.invalid', password: oldPasswordHash },
  ] as never).execute()
  await db.insertInto('password_resets').values({
    email,
    token: resetHash,
    expires_at: sqlDateTime(new Date(Date.now() + 60_000)),
  } as never).execute()

  const provider = resolveOAuthProviderConfig({
    enabled: true,
    issuer: 'https://id.example.com',
    scopes: { 'issues:read': { description: 'Read issues', resources: ['bughq'] } },
    resources: { bughq: { audience: 'https://api.bughq.example' } },
  })!
  config.auth.oauthProvider = provider
  const registration = await registerOAuthClient(provider, victimId, {
    name: 'Recovery client',
    type: 'public',
    tokenEndpointAuthMethod: 'none',
    redirectUris: [redirectUri],
    grantTypes: ['authorization_code', 'refresh_token'],
    scopes: ['issues:read'],
    resources: ['bughq'],
  })
  const grantInput = {
    clientId: registration.client.id,
    subjectType: 'users',
    scopes: ['issues:read'],
    resources: ['bughq'],
    audiences: ['https://api.bughq.example'],
  }
  const victimGrant = await createOAuthGrant({ ...grantInput, subjectId: victimId })
  const bystanderGrant = await createOAuthGrant({ ...grantInput, subjectId: bystanderId })
  const victimCode = await issueAuthorizationCode({ grantId: victimGrant.id, redirectUri, codeChallenge, lifetimeMs: 60_000 })
  const victimExistingCode = await issueAuthorizationCode({ grantId: victimGrant.id, redirectUri, codeChallenge, lifetimeMs: 60_000 })
  const bystanderCode = await issueAuthorizationCode({ grantId: bystanderGrant.id, redirectUri, codeChallenge, lifetimeMs: 60_000 })
  const expected = { clientId: registration.client.id, redirectUri, codeVerifier: verifier }
  const existing = await exchangeAuthorizationCode({
    code: victimExistingCode,
    ...expected,
    accessTokenLifetimeMs: 60_000,
    refreshTokenLifetimeMs: 120_000,
  })
  assert(existing.ok)

  await installFailureTrigger()
  try {
    await assert.rejects(passwordResets(email).resetPassword(resetToken, newPassword), /fixture oauth recovery revocation denied/)
    const unchanged = await db.primary.selectFrom('users').where('id', '=', victimId).selectAll().executeTakeFirstOrThrow()
    assert(await verifyHash(oldPassword, String(unchanged.password)))
    assert(await db.primary.selectFrom('password_resets').where('email', '=', email).select('token').executeTakeFirst())
    assert(await findToken(existing.value.accessToken), 'failed recovery must preserve the delegated token')
    assert.equal(sent, 0)
  }
  finally {
    await removeFailureTrigger()
  }

  assert.equal((await passwordResets(email).resetPassword(resetToken, newPassword)).success, true)
  assert.equal(await findToken(existing.value.accessToken), null)
  assert.deepEqual(await withAuthorizationCode(victimCode, expected, async grant => grant), { ok: false, reason: 'invalid_grant' })
  await assert.rejects(issueAuthorizationCode({ grantId: victimGrant.id, redirectUri, codeChallenge, lifetimeMs: 60_000 }), /grant is not active/)
  assert.equal((await withAuthorizationCode(bystanderCode, expected, async grant => grant.subjectId)).ok, true)
  const victimStoredGrant = await db.primary.selectFrom('oauth_grants').where('id', '=', victimGrant.id).select('revoked_at').executeTakeFirstOrThrow()
  const bystanderStoredGrant = await db.primary.selectFrom('oauth_grants').where('id', '=', bystanderGrant.id).select('revoked_at').executeTakeFirstOrThrow()
  assert(victimStoredGrant.revoked_at)
  assert.equal(bystanderStoredGrant.revoked_at, null)
  assert.equal(sent, 1)

  console.log('oauth password recovery OK')
}
finally {
  releaseOrm()
}
