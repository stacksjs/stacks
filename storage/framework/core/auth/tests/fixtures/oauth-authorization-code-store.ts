import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_OAUTH_CODE_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-oauth-codes-'))
if (dialect === 'sqlite')
  assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_oauth_codes_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
  assert(process.env.DB_PORT && !['5432', '3306'].includes(process.env.DB_PORT))
}

const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const {
  db,
  ensureDatabaseConfigLoaded,
  initializeDbConfig,
  migrateAuthTables,
  resetDatabaseConnection,
  sqlDateTime,
} = await import('@stacksjs/database')
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
if (dialect === 'sqlite')
  configureOrm({ database: process.env.DB_DATABASE_PATH })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const {
  createOAuthGrant,
  createS256CodeChallenge,
  exchangeAuthorizationCode,
  findToken,
  issueAuthorizationCode,
  refreshToken,
  revokeOAuthGrant,
  validateRefreshToken,
  withAuthorizationCode,
} = await import('../../src')

const verifier = 'v'.repeat(43)
const codeChallenge = await createS256CodeChallenge(verifier)

try {
  assert.equal((await migrateAuthTables()).success, true)
  assert.equal((await migrateAuthTables()).success, true)
  await db.unsafe('CREATE TABLE issued_markers (marker VARCHAR(255) PRIMARY KEY)').execute()
  const client = await db.selectFrom('oauth_clients')
    .where('personal_access_client', '=', true)
    .where('revoked', '=', false)
    .select('id')
    .executeTakeFirstOrThrow()

  const grant = await createOAuthGrant({
    clientId: Number(client.id),
    subjectType: 'users',
    subjectId: 42,
    scopes: ['issues:read'],
    resources: ['bughq'],
    audiences: ['https://api.bughq.example'],
    workspaceId: 'workspace-1',
  })
  const base = {
    grantId: grant.id,
    clientId: grant.clientId,
    subjectType: grant.subjectType,
    subjectId: grant.subjectId,
    redirectUri: 'https://client.example.com/callback',
    scopes: grant.scopes,
    resources: grant.resources,
    audiences: grant.audiences,
    workspaceId: grant.workspaceId,
    codeChallenge,
    lifetimeMs: 60_000,
  }
  const expected = {
    clientId: base.clientId,
    redirectUri: base.redirectUri,
    codeVerifier: verifier,
  }

  const plain = await issueAuthorizationCode(base)
  const stored = await db.selectFrom('oauth_auth_codes').selectAll().executeTakeFirstOrThrow() as Record<string, unknown>
  assert.equal(stored.code_hash, createHash('sha256').update(plain).digest('hex'))
  assert.equal(stored.grant_id, grant.id)
  assert.equal('code' in stored, false)

  const first = await withAuthorizationCode(plain, expected, async grant => grant)
  assert.equal(first.ok, true)
  if (first.ok) {
    assert.equal(first.value.grantId, grant.id)
    assert.equal(first.value.clientId, Number(client.id))
    assert.equal(first.value.subjectType, 'users')
    assert.equal(first.value.subjectId, 42)
    assert.deepEqual(first.value.scopes, ['issues:read'])
    assert.deepEqual(first.value.resources, ['bughq'])
    assert.deepEqual(first.value.audiences, ['https://api.bughq.example'])
    assert.equal(first.value.workspaceId, 'workspace-1')
  }
  assert.deepEqual(await withAuthorizationCode(plain, expected, async grant => grant), { ok: false, reason: 'invalid_grant' })

  for (const invalid of [
    { ...expected, clientId: 8 },
    { ...expected, redirectUri: `${expected.redirectUri}/` },
    { ...expected, codeVerifier: 'x'.repeat(43) },
  ]) {
    const code = await issueAuthorizationCode(base)
    assert.deepEqual(await withAuthorizationCode(code, invalid, async grant => grant), { ok: false, reason: 'invalid_grant' })
    assert.equal((await withAuthorizationCode(code, expected, async grant => grant)).ok, true)
  }

  const concurrentCode = await issueAuthorizationCode(base)
  const concurrent = await Promise.all(Array.from({ length: 8 }, () =>
    withAuthorizationCode(concurrentCode, expected, async grant => grant.subjectId)))
  assert.equal(concurrent.filter(result => result.ok).length, 1)
  assert.equal(concurrent.filter(result => !result.ok).length, 7)

  const rollbackCode = await issueAuthorizationCode(base)
  await assert.rejects(withAuthorizationCode(rollbackCode, expected, async () => {
    await db.insertInto('issued_markers').values({ marker: 'must-roll-back' }).execute()
    throw new Error('synthetic token mint failure')
  }), /synthetic token mint failure/)
  assert.equal((await db.selectFrom('issued_markers').selectAll().get()).length, 0)
  assert.equal((await withAuthorizationCode(rollbackCode, expected, async grant => grant.clientId)).ok, true)

  const expiredCode = await issueAuthorizationCode(base)
  await db.updateTable('oauth_auth_codes')
    .set({ expires_at: sqlDateTime(new Date(Date.now() - 1000)) } as never)
    .where('code_hash', '=', createHash('sha256').update(expiredCode).digest('hex'))
    .execute()
  assert.deepEqual(await withAuthorizationCode(expiredCode, expected, async grant => grant), { ok: false, reason: 'invalid_grant' })

  const revokedGrant = await createOAuthGrant({
    clientId: Number(client.id),
    subjectType: 'users',
    subjectId: 42,
    scopes: ['profile:read'],
    resources: [],
    audiences: [],
  })
  const revokedBase = {
    ...base,
    grantId: revokedGrant.id,
    clientId: revokedGrant.clientId,
    scopes: revokedGrant.scopes,
    resources: revokedGrant.resources,
    audiences: revokedGrant.audiences,
    workspaceId: revokedGrant.workspaceId,
  }
  const outstanding = await issueAuthorizationCode(revokedBase)
  assert.equal(await revokeOAuthGrant(revokedGrant.id), true)
  assert.deepEqual(await withAuthorizationCode(outstanding, {
    ...expected,
    clientId: revokedGrant.clientId,
  }, async active => active), { ok: false, reason: 'invalid_grant' })
  await assert.rejects(issueAuthorizationCode(revokedBase), /grant is not active/)
  await assert.rejects(createOAuthGrant({
    clientId: 999_999,
    subjectType: 'users',
    subjectId: 42,
    scopes: ['profile:read'],
    resources: [],
    audiences: [],
  }), /client is not active/)

  const exchangeCode = await issueAuthorizationCode(base)
  const exchanged = await exchangeAuthorizationCode({
    code: exchangeCode,
    ...expected,
    accessTokenLifetimeMs: 60_000,
    refreshTokenLifetimeMs: 120_000,
  })
  assert.equal(exchanged.ok, true)
  if (exchanged.ok) {
    const tokenRow = await db.selectFrom('oauth_access_tokens')
      .where('oauth_grant_id', '=', grant.id)
      .selectAll()
      .executeTakeFirstOrThrow() as Record<string, unknown>
    assert.equal(tokenRow.token, createHash('sha256').update(exchanged.value.accessToken).digest('hex'))
    assert.notEqual(tokenRow.token, exchanged.value.accessToken)
    assert.equal(String(tokenRow.oauth_client_id), String(grant.clientId))
    assert.equal(String(tokenRow.tokenable_id), String(grant.subjectId))
    assert.equal(tokenRow.tokenable_type, grant.subjectType)
    assert.deepEqual(JSON.parse(String(tokenRow.scopes)), grant.scopes)
    assert.deepEqual(JSON.parse(String(tokenRow.resources)), grant.resources)
    assert.deepEqual(JSON.parse(String(tokenRow.audiences)), grant.audiences)
    assert.equal(tokenRow.workspace_id, grant.workspaceId)

    const refreshRow = await db.selectFrom('oauth_refresh_tokens')
      .where('access_token_id', '=', tokenRow.id as number)
      .selectAll()
      .executeTakeFirstOrThrow() as Record<string, unknown>
    assert.equal(refreshRow.token, createHash('sha256').update(exchanged.value.refreshToken).digest('hex'))
    assert.notEqual(refreshRow.token, exchanged.value.refreshToken)
    assert.equal(await validateRefreshToken(exchanged.value.refreshToken), false)
    await assert.rejects(refreshToken(exchanged.value.refreshToken), /Invalid or expired refresh token/)
    assert(await db.selectFrom('oauth_refresh_tokens').where('id', '=', refreshRow.id as number).where('revoked', '=', false).executeTakeFirst())
  }
  assert.deepEqual(await exchangeAuthorizationCode({
    code: exchangeCode,
    ...expected,
    accessTokenLifetimeMs: 60_000,
    refreshTokenLifetimeMs: 120_000,
  }), { ok: false, reason: 'invalid_grant' })

  const concurrentExchangeCode = await issueAuthorizationCode(base)
  const tokensBefore = await db.selectFrom('oauth_access_tokens').where('oauth_grant_id', '=', grant.id).select('id').get()
  const concurrentExchanges = await Promise.all(Array.from({ length: 8 }, () => exchangeAuthorizationCode({
    code: concurrentExchangeCode,
    ...expected,
    accessTokenLifetimeMs: 60_000,
    refreshTokenLifetimeMs: 120_000,
  })))
  assert.equal(concurrentExchanges.filter(result => result.ok).length, 1)
  assert.equal(concurrentExchanges.filter(result => !result.ok).length, 7)
  const tokensAfter = await db.selectFrom('oauth_access_tokens').where('oauth_grant_id', '=', grant.id).select('id').get()
  assert.equal(tokensAfter.length, tokensBefore.length + 1, 'one consumed code must mint exactly one access token')
  const newTokenIds = tokensAfter.filter(token => !tokensBefore.some(previous => String(previous.id) === String(token.id))).map(token => token.id)
  const newRefreshTokens = await db.selectFrom('oauth_refresh_tokens').where('access_token_id', 'in', newTokenIds).select('id').get()
  assert.equal(newRefreshTokens.length, 1, 'one consumed code must mint exactly one refresh token')
  if (exchanged.ok) {
    assert(await findToken(exchanged.value.accessToken))
    assert.equal(await revokeOAuthGrant(grant.id), true)
    assert.equal(await findToken(exchanged.value.accessToken), null, 'revoking consent must invalidate its access tokens')
  }

  console.log('oauth authorization code store OK')
}
finally {
  await releaseOrm()
  await resetDatabaseConnection()
}
