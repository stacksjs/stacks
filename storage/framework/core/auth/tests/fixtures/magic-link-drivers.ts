import assert from 'node:assert/strict'
import { SQL } from 'bun'
import { mock, setSystemTime } from 'bun:test'
import { createHash } from 'node:crypto'
import { basename, dirname } from 'node:path'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_MAGIC_DRIVERS_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-magic-drivers-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_magic_drivers_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
}
const { overridesReady, overrides } = await import('@stacksjs/config')
await overridesReady
const { db, initializeDbConfig, ensureDatabaseConfigLoaded, closeDatabaseConnection, sqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect, connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  }, queryLogging: { enabled: false },
} })
const sent: string[] = []
const realEmail = { ...await import('@stacksjs/email') }
mock.module('@stacksjs/email', () => ({ ...realEmail,
  templateByName: async () => ({ html: '', text: '' }),
  mail: { sendOrFail: async (message: { text: string }) => { sent.push(message.text) } },
}))
const { sendMagicLink, consumeMagicLink } = await import('../../src/magic-link')
const { RateLimiter } = await import('../../src/rate-limiter')
const { registerPersistentQueryHooks } = await import('@stacksjs/query-builder')
RateLimiter.useMemoryStore()
const failures: string[] = []
async function check(name: string, run: () => Promise<void>) {
  try { await run() }
  catch (error) { failures.push(`${name}: ${String(error)}`) }
}
const now = new Date('2030-01-02T03:04:05.000Z')
const timestamp = dialect === 'mysql' ? 'DATETIME(3)' : 'TIMESTAMP'
const id = dialect === 'sqlite' ? 'INTEGER PRIMARY KEY' : dialect === 'mysql' ? 'INTEGER PRIMARY KEY AUTO_INCREMENT' : 'BIGSERIAL PRIMARY KEY'
try {
  await db.unsafe(`CREATE TABLE users (id ${id}, email VARCHAR(255) UNIQUE, name TEXT, password TEXT, created_at ${timestamp}, updated_at ${timestamp})`).execute()
  await db.unsafe(`CREATE TABLE magic_link_tokens (id ${id}, email VARCHAR(255), user_id INTEGER, token VARCHAR(64) UNIQUE, expires_at ${timestamp}, consumed_at ${timestamp}, redirect_to TEXT, site_id INTEGER, created_at ${timestamp}, updated_at ${timestamp})`).execute()
  await db.insertInto('users').values({ email: 'magic@example.invalid', name: 'Fixture' }).execute()
  setSystemTime(now)
  const seed = async (raw: string, ttl = 60_000, redirectTo = '/portal') => {
    await db.insertInto('magic_link_tokens').values({ email: 'magic@example.invalid', user_id: 1,
      token: createHash('sha256').update(raw).digest('hex'), expires_at: sqlDateTime(new Date(now.getTime() + ttl)),
      redirect_to: redirectTo, consumed_at: null }).execute()
  }
  await check('send and rotate', async () => {
    await sendMagicLink('magic@example.invalid')
    assert.equal(sent.length, 1, 'mail must reach the stub, never an external provider')
    const first = /\/auth\/magic\/([\w-]+)/.exec(sent[0]!)?.[1]
    assert(first)
    await sendMagicLink('magic@example.invalid')
    assert.equal(sent.length, 2)
    assert.equal((await db.primary.selectFrom('magic_link_tokens').selectAll().execute()).length, 1)
    assert.equal((await consumeMagicLink(first)).ok, false, 'rotation invalidates the previous link')
  })
  await check('single use', async () => {
    await seed('synthetic-single-use')
    assert.deepEqual(await consumeMagicLink('synthetic-single-use'), { ok: true, userId: 1, email: 'magic@example.invalid', redirectTo: '/portal' })
    assert.deepEqual(await consumeMagicLink('synthetic-single-use'), { ok: false, reason: 'used' })
  })
  await check('concurrent use', async () => {
    await seed('synthetic-concurrent')
    const attempts = await Promise.all(Array.from({ length: 8 }, () => consumeMagicLink('synthetic-concurrent')))
    assert.equal(attempts.filter(result => result.ok).length, 1)
  })
  await check('a link sent to a removed email no longer authenticates its old owner', async () => {
    const raw = 'synthetic-removed-email'
    await seed(raw)
    await db.updateTable('users').set({ email: 'replacement@example.invalid' }).where('id', '=', 1).execute()
    try { assert.equal((await consumeMagicLink(raw)).ok, false) }
    finally { await db.updateTable('users').set({ email: 'magic@example.invalid' }).where('id', '=', 1).execute() }
    assert.equal((await consumeMagicLink(raw)).ok, false, 'a rejected link stays single-use if the address is restored')
  })
  await check('a link expiring during the claim cannot authenticate', async () => {
    await seed('synthetic-delayed-claim')
    let delayed = false
    const stop = registerPersistentQueryHooks({ onQueryStart(event) {
      if (event.kind === 'update' && event.sql.includes('magic_link_tokens')) {
        delayed = true
        setSystemTime(new Date(now.getTime() + 60_000))
      }
    } })
    try {
      assert.deepEqual(await consumeMagicLink('synthetic-delayed-claim'), { ok: false, reason: 'expired' })
      assert(delayed)
    }
    finally { stop(); setSystemTime(now) }
  })
  if (dialect === 'sqlite') {
    await check('a lexically future malformed expiry cannot authenticate', async () => {
      await seed('synthetic-malformed-expiry')
      await db.updateTable('magic_link_tokens').set({ expires_at: 'zzzz-not-a-date' })
        .where('token', '=', createHash('sha256').update('synthetic-malformed-expiry').digest('hex')).execute()
      assert.deepEqual(await consumeMagicLink('synthetic-malformed-expiry'), { ok: false, reason: 'expired' })
    })
  }
  else {
    await check('expiry while blocked on a real database row lock is rejected', async () => {
      const raw = 'synthetic-row-lock-expiry'
      await seed(raw)
      const observer = new SQL({ adapter: dialect, hostname: process.env.DB_HOST,
        port: Number(process.env.DB_PORT), database: process.env.DB_DATABASE,
        username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
        tls: process.env.DB_SSL === 'true' ? 'require' : 'disable' })
      const blocker = await observer.reserve()
      let held = false
      let pending: ReturnType<typeof consumeMagicLink> | undefined
      try {
        await blocker.unsafe('BEGIN'); held = true
        await blocker.unsafe(`UPDATE magic_link_tokens SET consumed_at = consumed_at WHERE token = ${dialect === 'postgres' ? '$1' : '?'}`,
          [createHash('sha256').update(raw).digest('hex')])
        pending = consumeMagicLink(raw)
        const timeout = performance.now() + 5000
        let blocked = false
        while (performance.now() < timeout) {
          const waiting = await observer.unsafe(dialect === 'postgres'
            ? "SELECT COUNT(*) AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'"
            : "SELECT COUNT(*) AS count FROM performance_schema.data_locks WHERE OBJECT_SCHEMA = DATABASE() AND LOCK_STATUS = 'WAITING'")
          if (Number(waiting[0].count) > 0) { blocked = true; break }
          await Bun.sleep(10)
        }
        assert(blocked, 'consumption must reach the real row lock before the deadline moves')
        setSystemTime(new Date(now.getTime() + 60_000))
        await blocker.unsafe('COMMIT'); held = false
        assert.deepEqual(await pending, { ok: false, reason: 'expired' })
      }
      finally {
        if (held) await blocker.unsafe('ROLLBACK')
        await pending?.catch(() => {})
        blocker.release()
        await observer.close()
        setSystemTime(now)
      }
    })
  }
  const previousTimezone = process.env.TZ
  try {
    for (const zone of ['UTC', 'Pacific/Honolulu', 'Asia/Kathmandu']) {
      process.env.TZ = zone
      await check(`exact expiry in ${zone}`, async () => {
        const raw = `synthetic-expired-${zone}`
        await seed(raw, 0)
        assert.deepEqual(await consumeMagicLink(raw), { ok: false, reason: 'expired' })
      })
    }
  }
  finally {
    if (previousTimezone === undefined) delete process.env.TZ
    else process.env.TZ = previousTimezone
  }
  for (const redirect of ['/\\evil.example', '/\t/evil.example', '/\n/evil.example', '//evil.example', 'https://evil.example']) {
    await check(`redirect ${JSON.stringify(redirect)}`, async () => {
      const raw = `synthetic-redirect-${JSON.stringify(redirect)}`
      await seed(raw, 60_000, redirect)
      const result = await consumeMagicLink(raw)
      assert(result.ok)
      assert.equal(new URL(result.redirectTo, 'https://app.example.invalid').origin, 'https://app.example.invalid', 'browser URL normalization must not turn a relative-looking path into an external redirect')
    })
  }
  for (const redirect of ['/portal', '/account?from=email#security', '/path%20with%20spaces', '/%2F%2Fnot-an-external-host']) {
    await check(`internal redirect ${redirect}`, async () => {
      const raw = `synthetic-internal-${redirect}`
      await seed(raw, 60_000, redirect)
      const result = await consumeMagicLink(raw)
      assert(result.ok)
      assert.equal(result.redirectTo, redirect)
    })
  }
  const previousAuth = overrides.auth
  try {
    for (const fallback of ['/safe-default', '//evil.example', '/\\evil.example']) {
      overrides.auth = { ...previousAuth, magicLink: { ...previousAuth?.magicLink, redirectDefault: fallback } }
      await check(`configured fallback ${fallback}`, async () => {
        const raw = `synthetic-fallback-${fallback}`
        await seed(raw, 60_000, 'https://evil.example')
        const result = await consumeMagicLink(raw)
        assert(result.ok)
        assert.equal(result.redirectTo, fallback === '/safe-default' ? fallback : '/')
      })
    }
  }
  finally { overrides.auth = previousAuth }
  assert.deepEqual(failures, [])
  console.log('magic link drivers OK')
}
finally {
  setSystemTime()
  mock.module('@stacksjs/email', () => realEmail)
  await closeDatabaseConnection()
}
