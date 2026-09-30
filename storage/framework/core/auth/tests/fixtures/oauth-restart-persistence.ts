import assert from 'node:assert/strict'

const phase = process.env.STACKS_OAUTH_RESTART_PHASE
assert(['seed', 'exchange', 'verify'].includes(phase ?? ''), 'unknown OAuth restart fixture phase')
const database = process.env.DB_DATABASE_PATH
assert(database)
assert.equal(process.env.STACKS_OAUTH_RESTART_CONFIG?.includes('stacks-oauth-restart-'), true)

const { config, overridesReady } = await import('@stacksjs/config')
const { db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } = await import('@stacksjs/database')
await overridesReady
await ensureDatabaseConfigLoaded()
initializeDbConfig({
  app: { env: 'test' },
  database: {
    default: 'sqlite',
    connections: { sqlite: { database } },
    queryLogging: { enabled: false },
  },
})

const { configureOrm, releaseOrm } = await import('bun-query-builder')
configureOrm({ database })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const {
  authorizeOAuthDelegatedToken,
  createOAuthGrant,
  createS256CodeChallenge,
  exchangeOAuthAuthorizationCode,
  issueAuthorizationCode,
  refreshOAuthDelegatedToken,
  registerOAuthClient,
  resolveOAuthProviderConfig,
} = await import('../../src')

const redirectUri = 'https://restart.example.test/callback'
const verifier = 'r'.repeat(43)
const provider = resolveOAuthProviderConfig({
  enabled: true,
  issuer: 'https://id.example.test',
  scopes: { 'issues:read': { description: 'Read issues', resources: ['bughq'] } },
  resources: { bughq: { audience: 'https://api.example.test/issues' } },
})
assert(provider)
config.auth.oauthProvider = provider

try {
  if (phase === 'seed') {
    await db.unsafe(`CREATE TABLE users (
      id INTEGER PRIMARY KEY, email TEXT NOT NULL, password TEXT NOT NULL,
      password_changed_at TIMESTAMP, created_at TIMESTAMP, updated_at TIMESTAMP
    )`).execute()
    await db.insertInto('users').values({
      id: 1,
      email: 'oauth-restart@example.test',
      password: 'not-used',
    }).execute()
    await ensureFrameworkAuthTables()
    const client = await registerOAuthClient(provider, 1, {
      name: 'OAuth restart client',
      type: 'public',
      tokenEndpointAuthMethod: 'none',
      redirectUris: [redirectUri],
      grantTypes: ['authorization_code', 'refresh_token'],
      scopes: ['issues:read'],
      resources: ['bughq'],
    })
    const grant = await createOAuthGrant({
      clientId: client.client.id,
      subjectType: 'users',
      subjectId: 1,
      scopes: ['issues:read'],
      resources: ['bughq'],
      audiences: ['https://api.example.test/issues'],
    })
    const code = await issueAuthorizationCode({
      grantId: grant.id,
      redirectUri,
      codeChallenge: await createS256CodeChallenge(verifier),
      lifetimeMs: 60_000,
    })
    console.log('SEED', JSON.stringify({ clientId: client.client.id, code }))
  }

  if (phase === 'exchange') {
    const result = await exchangeOAuthAuthorizationCode({
      clientId: Number(process.env.STACKS_OAUTH_RESTART_CLIENT_ID),
      code: process.env.STACKS_OAUTH_RESTART_CODE!,
      redirectUri,
      codeVerifier: verifier,
      accessTokenLifetimeMs: 60_000,
      refreshTokenLifetimeMs: 120_000,
    })
    assert(result.ok)
    assert(result.value.refreshToken)
    console.log('EXCHANGED', JSON.stringify({
      accessToken: result.value.accessToken,
      refreshToken: result.value.refreshToken,
    }))
  }

  if (phase === 'verify') {
    const clientId = Number(process.env.STACKS_OAUTH_RESTART_CLIENT_ID)
    const accessToken = process.env.STACKS_OAUTH_RESTART_ACCESS_TOKEN!
    const refreshToken = process.env.STACKS_OAUTH_RESTART_REFRESH_TOKEN!
    const authorized = await authorizeOAuthDelegatedToken(accessToken, {
      scopes: ['issues:read'],
      resource: 'bughq',
      audience: 'https://api.example.test/issues',
      workspaceId: null,
      isSubjectEligible: subject => subject.type === 'users' && subject.id === 1,
    })
    assert(authorized.ok, 'a persisted access token must survive restart')
    const rotated = await refreshOAuthDelegatedToken({
      clientId,
      refreshToken,
      accessTokenLifetimeMs: 60_000,
      refreshTokenLifetimeMs: 120_000,
      isSubjectEligible: subject => subject.type === 'users' && subject.id === 1,
    })
    assert(rotated.ok)
    assert(rotated.value.refreshToken)
    const replay = await refreshOAuthDelegatedToken({
      clientId,
      refreshToken,
      accessTokenLifetimeMs: 60_000,
      refreshTokenLifetimeMs: 120_000,
    })
    assert.equal(replay.ok, false)
    const revokedDescendant = await authorizeOAuthDelegatedToken(rotated.value.accessToken, {
      scopes: ['issues:read'],
      resource: 'bughq',
      audience: 'https://api.example.test/issues',
      workspaceId: null,
    })
    assert.equal(revokedDescendant.ok, false, 'refresh replay must revoke the persisted family')
    console.log('PASS OAuth restart persistence')
  }
}
finally {
  await releaseOrm()
  await resetDatabaseConnection()
}
