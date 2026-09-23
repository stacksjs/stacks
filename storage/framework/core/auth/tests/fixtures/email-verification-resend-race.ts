import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { mock, setSystemTime } from 'bun:test'
import { SQL } from 'bun'
import { basename, dirname, join } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_EMAIL_RESEND_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-email-resend-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_email_resend_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
  assert(process.env.DB_PORT && !['5432', '3306'].includes(process.env.DB_PORT))
}
const sent: string[] = []
let failDelivery = false
mock.module('@stacksjs/email', () => ({
  template: async (_name: string, options: { variables: { verificationUrl: string } }) => ({ text: options.variables.verificationUrl }),
  mail: { sendOrFail: async (message: { text: string }) => {
    if (failDelivery) throw new Error('fixture resend unavailable')
    sent.push(message.text)
  } },
}))
const { overrides, overridesReady } = await import('@stacksjs/config')
await overridesReady
const key = 'synthetic-email-resend-key'
overrides.app = { ...overrides.app, key, url: 'example.invalid' }
overrides.auth = { ...overrides.auth, emailVerification: { ...overrides.auth?.emailVerification, url: '/verify-email/{id}/{token}' } }
const { db, initializeDbConfig, ensureDatabaseConfigLoaded, closeDatabaseConnection, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect, connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  }, queryLogging: { enabled: false },
} })
const { resendVerificationEmail } = await import('../../src/email-verification')
const { ensureFrameworkAuthTables } = await import('../helpers/auth-schema')
const user = { id: 1, email: 'synthetic@example.invalid' }
const worker = process.env.STACKS_EMAIL_RESEND_WORKER
if (worker) {
  assert(/^[0-3]$/.test(worker))
  await writeFile(join(dirname(configPath), `ready-${worker}`), 'ready')
  const timeout = performance.now() + 10_000
  while (!existsSync(join(dirname(configPath), 'release-workers'))) {
    assert(performance.now() < timeout, 'worker release timeout')
    await Bun.sleep(5)
  }
  try {
    const result = await resendVerificationEmail(user)
    console.log(JSON.stringify({ worker: true, success: result.success, sent: sent.length }))
  }
  finally { await closeDatabaseConnection() }
  process.exit(0)
}
const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  try { await run(); console.log(`PASS ${name}`) }
  catch (error) { failures.push(`${name}: ${error}`) }
}
async function seed(older: boolean = false) {
  sent.length = 0
  await db.deleteFrom('email_verifications').execute()
  await db.deleteFrom('users').execute()
  await db.insertInto('users').values({ id: 1 }).execute()
  if (older)
    await db.insertInto('email_verifications').values({ user_id: 1, token: 'old-hash', created_at: sqlDateTime(new Date(Date.now() - 120_000)), expires_at: sqlDateTime(new Date(Date.now() + 60_000)) }).execute()
}
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY)').execute()
  await ensureFrameworkAuthTables()
  for (const older of [false, true]) {
    await check(`${older ? 'expired cooldown' : 'first send'} has one concurrent winner`, async () => {
      await seed(older)
      const results = await Promise.allSettled(Array.from({ length: 8 }, () => resendVerificationEmail(user)))
      assert.equal(results.filter(result => result.status === 'rejected').length, 0, 'cooldown losers should return a normal result')
      assert.equal(results.filter(result => result.status === 'fulfilled' && result.value.success).length, 1)
      assert.equal(sent.length, 1)
      const rows = await db.primary.selectFrom('email_verifications').where('user_id', '=', 1).selectAll().execute()
      assert.equal(rows.length, 1)
      const nonce = new URL(sent[0]!).pathname.split('/').pop()!
      assert.equal(rows[0]!.token, createHmac('sha256', key).update(`1:${nonce}`).digest('hex'))
      assert.equal((await resendVerificationEmail(user)).success, false)
    })
  }
  await check('independent processes share one cooldown claim', async () => {
    await seed()
    const children = Array.from({ length: 4 }, (_, index) => Bun.spawn([
      process.execPath, `--config=${configPath}`, '--no-env-file', import.meta.path,
    ], { env: { ...process.env, STACKS_EMAIL_RESEND_WORKER: String(index) }, stdout: 'pipe', stderr: 'pipe' }))
    const results = children.map(async child => {
      const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      return { code, out, err }
    })
    try {
      const timeout = performance.now() + 10_000
      while (!children.every((_, index) => existsSync(join(dirname(configPath), `ready-${index}`)))) {
        assert(performance.now() < timeout, 'workers must initialize before release')
        await Bun.sleep(5)
      }
      await writeFile(join(dirname(configPath), 'release-workers'), 'go')
      const completed = await Promise.all(results)
      const summaries = completed.map(({ code, out, err }) => {
        assert.equal(code, 0, `${out}\n${err}`)
        return JSON.parse(out.trim().split('\n').find(line => line.startsWith('{"worker":'))!) as { success: boolean, sent: number }
      })
      assert.equal(summaries.filter(result => result.success).length, 1)
      assert.equal(summaries.reduce((total, result) => total + result.sent, 0), 1)
    }
    finally {
      for (const child of children) child.kill()
      await Promise.all(results)
    }
  })
  await check('fresh verified status overrides a stale caller object', async () => {
    await seed()
    await db.updateTable('users').set({ email_verified_at: sqlDateTime() }).where('id', '=', 1).execute()
    assert.equal((await resendVerificationEmail(user)).success, false)
    assert.equal(sent.length, 0)
  })
  await check('cooldown and token expiry use the same issuance clock', async () => {
    await seed()
    // PostgreSQL's CURRENT_TIMESTAMP default is the outer transaction's start,
    // not the instant this token is issued. Pin a later application clock.
    const now = new Date('2030-01-02T03:04:05Z')
    try {
      await db.transaction(async () => {
        await db.primary.selectFrom('users').selectAll().execute()
        setSystemTime(now)
        assert.equal((await resendVerificationEmail(user)).success, true)
      })
      assert.equal((await resendVerificationEmail(user)).success, false, 'a newly sent link must start a fresh cooldown')
      assert.equal(sent.length, 1)
    }
    finally { setSystemTime() }
  })
  if (dialect === 'mysql') {
    await check('an older transaction snapshot cannot hide a newer cooldown', async () => {
      await seed()
      const writer = new SQL({ adapter: 'mysql', hostname: process.env.DB_HOST,
        port: Number(process.env.DB_PORT), database: process.env.DB_DATABASE,
        username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, tls: true })
      try {
        await db.transaction(async () => {
          assert.equal((await db.primary.selectFrom('email_verifications').selectAll().execute()).length, 0)
          await writer.unsafe('INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)', [1, 'newer-cooldown', sqlDateTime(new Date(Date.now() + 60_000))])
          assert.equal((await resendVerificationEmail(user)).success, false)
          assert.equal(sent.length, 0)
        })
      }
      finally { await writer.close() }
    })
  }
  await check('missing owner cannot claim a resend', async () => {
    await seed()
    await db.deleteFrom('users').execute()
    assert.equal((await resendVerificationEmail(user)).success, false)
    assert.equal(sent.length, 0)
    assert.equal((await db.primary.selectFrom('email_verifications').selectAll().execute()).length, 0)
  })
  await check('outer rollback does not send or consume the cooldown', async () => {
    await seed(true)
    await assert.rejects(db.transaction(async () => {
      assert.equal((await resendVerificationEmail(user)).success, true)
      assert.equal(sent.length, 0)
      throw new Error('fixture resend rollback')
    }), /fixture resend rollback/)
    assert.equal(sent.length, 0)
    assert.equal((await resendVerificationEmail(user)).success, true)
    assert.equal(sent.length, 1)
  })
  await check('standalone delivery error is not swallowed by cooldown transaction', async () => {
    await seed()
    failDelivery = true
    try { await assert.rejects(resendVerificationEmail(user), /fixture resend unavailable/) }
    finally { failDelivery = false }
    assert.equal((await resendVerificationEmail(user)).success, false, 'failed delivery still reserves the cooldown against abuse')
  })
  assert.deepEqual(failures, [])
  console.log('verification resend race OK')
}
finally { await closeDatabaseConnection() }
