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
  createS256CodeChallenge,
  issueAuthorizationCode,
  withAuthorizationCode,
} = await import('../../src')

const verifier = 'v'.repeat(43)
const codeChallenge = await createS256CodeChallenge(verifier)
const base = {
  clientId: 7,
  subjectType: 'users',
  subjectId: 42,
  redirectUri: 'https://client.example.com/callback',
  scopes: ['issues:read'],
  resources: ['bughq'],
  audiences: ['https://api.bughq.example'],
  workspaceId: 'workspace-1',
  codeChallenge,
  lifetimeMs: 60_000,
}
const expected = {
  clientId: base.clientId,
  redirectUri: base.redirectUri,
  codeVerifier: verifier,
}

try {
  assert.equal((await migrateAuthTables()).success, true)
  assert.equal((await migrateAuthTables()).success, true)
  await db.unsafe('CREATE TABLE issued_markers (marker VARCHAR(255) PRIMARY KEY)').execute()

  const plain = await issueAuthorizationCode(base)
  const stored = await db.selectFrom('oauth_auth_codes').selectAll().executeTakeFirstOrThrow() as Record<string, unknown>
  assert.equal(stored.code_hash, createHash('sha256').update(plain).digest('hex'))
  assert.equal('code' in stored, false)

  const first = await withAuthorizationCode(plain, expected, async grant => grant)
  assert.equal(first.ok, true)
  if (first.ok) {
    assert.equal(first.value.clientId, 7)
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

  console.log('oauth authorization code store OK')
}
finally {
  await releaseOrm()
  await resetDatabaseConnection()
}
