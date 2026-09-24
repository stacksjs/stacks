import assert from 'node:assert/strict'
import { mock } from 'bun:test'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_TWOFACTOR_RECOVERY_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-twofactor-recovery-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_twofactor_recovery_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
  assert(process.env.DB_PORT && !['5432', '3306'].includes(process.env.DB_PORT))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, initializeDbConfig, ensureDatabaseConfigLoaded, closeDatabaseConnection, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect, connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  }, queryLogging: { enabled: false },
} })
const { configureOrm, releaseOrm } = await import('bun-query-builder')
if (dialect === 'sqlite') configureOrm({ database: process.env.DB_DATABASE_PATH! })
const { ormReady } = await import('@stacksjs/orm')
await ormReady
let sent = 0
const emailModule = { ...await import('@stacksjs/email') }
mock.module('@stacksjs/email', () => ({ ...emailModule,
  template: async () => ({ text: 'synthetic notification' }),
  mail: { sendOrFail: async () => { sent++ } },
}))
const { makeHash, verifyHash } = await import('@stacksjs/security')
const { createTwoFactorChallenge } = await import('../../src/two-factor')
const { generateTwoFactorSecret, generateTwoFactorToken } = await import('../../src/authenticator')
const { passwordResets } = await import('../../src/password/reset')
const { findToken } = await import('../../src/tokens')
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const VerifyAction = (await import('../../../../defaults/app/Actions/Auth/VerifyTwoFactorLoginAction')).default
const LoginAction = (await import('../../../../defaults/app/Actions/Auth/LoginAction')).default
const oldPassword = 'old-synthetic-password'
const newPassword = 'new-synthetic-password'
const resetToken = 'synthetic-recovery-credential'
const passwordHash = await makeHash(oldPassword, { algorithm: 'bcrypt' })
const resetHash = await makeHash(resetToken, { algorithm: 'bcrypt' })
const secret = generateTwoFactorSecret()
const email = (id: number) => `recovery-${id}@example.invalid`
async function setup() {
  for (const table of ['password_resets', 'two_factor_challenges', 'oauth_refresh_tokens', 'oauth_access_tokens', 'users'])
    await db.deleteFrom(table).execute()
  for (const id of [1, 2]) {
    await db.insertInto('users').values({ id, name: 'Synthetic', email: email(id), password: passwordHash,
      two_factor_secret: secret, two_factor_enabled: true,
    }).execute()
  }
  await db.insertInto('password_resets').values({ email: email(1), token: resetHash,
    created_at: sqlDateTime(), expires_at: sqlDateTime(new Date(Date.now() + 120_000)),
  }).execute()
  sent = 0
}
async function verify(challenge: string, code?: string): Promise<Response> {
  const submitted = code ?? await generateTwoFactorToken(secret)
  return VerifyAction.handle({ get: (key: string) => key === 'challenge_token' ? challenge : submitted } as never) as Promise<Response>
}
const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  try { await setup(); await run(); console.log(`PASS ${name}`) }
  catch (error) { failures.push(`${name}: ${error}`) }
}
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email VARCHAR(255), password TEXT, created_at TIMESTAMP, updated_at TIMESTAMP)').execute()
  await ensureFrameworkAuthTables()
  await check('recovery rejects the old password-stage grant, preserves a bystander, permits fresh login', async () => {
    const stale = await createTwoFactorChallenge(1)
    const bystander = await createTwoFactorChallenge(2)
    assert.equal((await passwordResets(email(1)).resetPassword(resetToken, newPassword)).success, true)
    assert.equal((await verify(stale)).status, 401, 'a challenge issued before recovery must not mint a session afterward')
    assert.equal((await verify(bystander)).status, 200, 'another account remains unaffected')
    const login = await LoginAction.handle({ get: (key: string) => key === 'email' ? email(1) : newPassword } as never) as Response
    assert.equal(login.status, 200)
    const challenge = await login.json() as { challenge_token: string, requires_two_factor: boolean }
    assert.equal(challenge.requires_two_factor, true)
    const result = await verify(challenge.challenge_token)
    assert.equal(result.status, 200)
    assert(result.headers.get('Set-Cookie'))
    const pack = await result.json() as { access_token: string }
    assert(await findToken(pack.access_token))
    assert.equal((await verify(challenge.challenge_token)).status, 401)
  })
  await check('an outer rollback preserves the password, recovery link and pending challenge', async () => {
    const challenge = await createTwoFactorChallenge(1)
    await assert.rejects(db.transaction(async () => {
      assert.equal((await passwordResets(email(1)).resetPassword(resetToken, newPassword)).success, true)
      throw new Error('fixture rollback')
    }), /fixture rollback/)
    assert.equal(sent, 0)
    assert(await passwordResets(email(1)).verifyToken(resetToken))
    assert(await verifyHash(oldPassword, String((await db.primary.selectFrom('users').where('id', '=', 1).select('password').executeTakeFirstOrThrow()).password)))
    assert.equal((await verify(challenge)).status, 200)
  })
  for (const mode of dialect === 'mysql' ? ['reject', 'dependency'] : ['reject', 'suppress', 'dependency']) {
    await check(`${mode} challenge deletion fails recovery without committing partial credentials`, async () => {
      const challenge = await createTwoFactorChallenge(1)
      if (dialect === 'postgres') {
        const statement = mode === 'suppress' ? 'RETURN NULL;'
          : mode === 'dependency' ? 'INSERT INTO missing_challenge_audit VALUES (1); RETURN OLD;'
            : "RAISE EXCEPTION 'fixture challenge deletion denied';"
        await db.unsafe(`CREATE FUNCTION reject_challenge_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ${statement} END; $$`).execute()
        await db.unsafe('CREATE TRIGGER reject_challenge_delete BEFORE DELETE ON two_factor_challenges FOR EACH ROW EXECUTE FUNCTION reject_challenge_delete()').execute()
      }
      else if (dialect === 'mysql') {
        const statement = mode === 'dependency' ? 'INSERT INTO missing_challenge_audit VALUES (1)'
          : "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'fixture challenge deletion denied'"
        await db.unsafe(`CREATE TRIGGER reject_challenge_delete BEFORE DELETE ON two_factor_challenges FOR EACH ROW ${statement}`).execute()
      }
      else {
        const statement = mode === 'suppress' ? 'SELECT RAISE(IGNORE)'
          : mode === 'dependency' ? 'INSERT INTO missing_challenge_audit VALUES (1)'
            : "SELECT RAISE(ABORT, 'fixture challenge deletion denied')"
        await db.unsafe(`CREATE TRIGGER reject_challenge_delete BEFORE DELETE ON two_factor_challenges BEGIN ${statement}; END`).execute()
      }
      try {
        await assert.rejects(passwordResets(email(1)).resetPassword(resetToken, newPassword),
          mode === 'dependency' ? /missing_challenge_audit/ : mode === 'suppress' ? /could not be revoked/ : /fixture challenge deletion denied/)
        assert.equal(sent, 0)
        assert(await passwordResets(email(1)).verifyToken(resetToken))
        assert(await verifyHash(oldPassword, String((await db.primary.selectFrom('users').where('id', '=', 1).select('password').executeTakeFirstOrThrow()).password)))
      }
      finally {
        await db.unsafe(`DROP TRIGGER reject_challenge_delete${dialect === 'postgres' ? ' ON two_factor_challenges' : ''}`).execute()
        if (dialect === 'postgres') await db.unsafe('DROP FUNCTION reject_challenge_delete()').execute()
      }
      assert.equal((await verify(challenge)).status, 200, 'failed recovery preserved its pending challenge')
    })
  }
  await check('an installation without the optional challenge table can still recover', async () => {
    await db.unsafe('DROP TABLE two_factor_challenges').execute()
    assert.equal((await passwordResets(email(1)).resetPassword(resetToken, newPassword)).success, true)
    assert(await verifyHash(newPassword, String((await db.primary.selectFrom('users').where('id', '=', 1).select('password').executeTakeFirstOrThrow()).password)))
  })
  assert.deepEqual(failures, [])
  console.log('two-factor recovery OK')
}
finally { await releaseOrm(); await closeDatabaseConnection() }
