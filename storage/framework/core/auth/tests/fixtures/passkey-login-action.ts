import assert from 'node:assert/strict'
import { mock, setSystemTime } from 'bun:test'
import { releaseOrm } from 'bun-query-builder'

const user = { id: 7, email: 'passkey@example.com', name: 'Passkey User' }
let verified = true
let newCounter = 2
let expectedStoredCounter = 1
const challenge = new Uint8Array([1, 2, 3])
const database = process.env.DB_DATABASE_PATH
assert(database)

const { config, overridesReady } = await import('@stacksjs/config')
await overridesReady
config.auth.browserSession = {
  baselineLifetime: 2 * 60 * 1000,
  rememberedLifetime: 5 * 60 * 1000,
  withRefreshToken: false,
}

const {
  closeDatabaseConnection,
  db,
  ensureDatabaseConfigLoaded,
  initializeDbConfig,
  parseSqlDateTime,
  sqlDateTime,
} = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({
  app: { env: 'test' },
  database: {
    default: 'sqlite',
    connections: { sqlite: { database } },
    queryLogging: { enabled: false },
  },
})

const { configureOrm } = await import('bun-query-builder')
configureOrm({ database })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
const realAuth = { ...await import('@stacksjs/auth') }

mock.module('@stacksjs/auth', () => ({
  ...realAuth,
  verifyAuthenticationResponse: async (
    _credential: unknown,
    expectedChallenge: Uint8Array,
    expectedOrigin: string,
    expectedRPID: string,
    publicKey: ArrayBuffer,
    counter: number,
  ) => {
    assert.deepEqual([...expectedChallenge], [...challenge])
    assert.equal(expectedOrigin, 'https://app.example')
    assert.equal(expectedRPID, 'app.example')
    assert.deepEqual(new Uint8Array(publicKey), new Uint8Array([4, 5, 6]))
    assert.equal(counter, expectedStoredCounter)
    return { verified, authenticationInfo: { newCounter } }
  },
}))

const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const { findToken, storeWebAuthnChallenge } = realAuth
const VerifyAuthenticationAction = (await import('../../../../defaults/app/Actions/Auth/VerifyAuthenticationAction')).default
const request = {
  all: () => ({ res: { id: 'credential-1' } }),
  get: (key: string) => key === 'email' ? user.email : undefined,
} as any

async function accessTokenCount(): Promise<number> {
  const rows = await db.primary.selectFrom('oauth_access_tokens').select('id').execute()
  return rows.length
}

try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email VARCHAR(255), password TEXT, created_at TIMESTAMP, updated_at TIMESTAMP)').execute()
  await ensureFrameworkAuthTables()
  await db.insertInto('users').values({ ...user, password: 'unused', created_at: sqlDateTime() }).execute()
  await db.insertInto('passkeys').values({
    id: 'credential-1',
    cred_public_key: JSON.stringify({ 0: 4, 1: 5, 2: 6 }),
    user_id: user.id,
    webauthn_user_id: user.email,
    counter: 1,
    credential_type: 'public-key',
    device_type: 'singleDevice',
    backup_eligible: false,
    backup_status: false,
    transports: JSON.stringify(['internal']),
    last_used_at: sqlDateTime(),
  }).execute()

  const issuedAt = new Date('2030-01-02T03:04:05.000Z')
  setSystemTime(issuedAt)
  await storeWebAuthnChallenge(user.id, challenge, 'authentication')
  const success = await VerifyAuthenticationAction.handle(request) as Response
  assert.equal(success.status, 200)
  const body = await success.json() as Record<string, unknown>
  assert.equal(body.verified, true)
  assert.equal(body.access_token, body.token)
  assert.equal(body.token_type, 'Bearer')
  assert.equal(body.expires_in, 120)
  assert.equal(body.refresh_token, undefined)
  assert.deepEqual(body.user, user)
  const cookie = success.headers.get('Set-Cookie') ?? ''
  assert.match(cookie, /^auth-token=/)
  assert.match(cookie, /Max-Age=120/)
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /SameSite=Lax/)
  assert.match(cookie, /Secure/)
  assert(await findToken(String(body.access_token)))
  const storedToken = await db.primary.selectFrom('oauth_access_tokens')
    .select(['expires_at']).executeTakeFirstOrThrow()
  assert.equal(parseSqlDateTime(storedToken.expires_at)?.getTime(), issuedAt.getTime() + 120_000)
  assert.equal(await accessTokenCount(), 1)
  assert.equal((await db.primary.selectFrom('oauth_refresh_tokens').select('id').execute()).length, 0)
  assert.equal((await db.primary.selectFrom('webauthn_challenges').select('id').execute()).length, 0)

  const replay = await VerifyAuthenticationAction.handle(request) as Response
  assert.equal(replay.status, 401)
  assert.equal(replay.headers.get('Set-Cookie'), null)
  assert.equal(await accessTokenCount(), 1)

  expectedStoredCounter = 2
  await storeWebAuthnChallenge(user.id, challenge, 'authentication')
  const cloned = await VerifyAuthenticationAction.handle(request) as Response
  assert.equal(cloned.status, 401)
  assert.equal(cloned.headers.get('Set-Cookie'), null)
  assert.equal(await accessTokenCount(), 1)

  newCounter = 3
  verified = false
  await storeWebAuthnChallenge(user.id, challenge, 'authentication')
  const rejected = await VerifyAuthenticationAction.handle(request) as Response
  assert.equal(rejected.status, 401)
  assert.equal(rejected.headers.get('Set-Cookie'), null)
  assert.equal(await accessTokenCount(), 1)

  console.log('passkey login action OK')
}
finally {
  setSystemTime()
  releaseOrm()
  await closeDatabaseConnection()
}
