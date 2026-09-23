import assert from 'node:assert/strict'
import { mock } from 'bun:test'
import { basename, dirname } from 'node:path'
import { tmpdir } from 'node:os'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_TWO_FACTOR_DISABLE_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-two-factor-disable-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_two_factor_disable_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
  assert(process.env.DB_PORT && !['5432', '3306'].includes(process.env.DB_PORT))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, initializeDbConfig, ensureDatabaseConfigLoaded, closeDatabaseConnection } = await import('@stacksjs/database/runtime')
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
const security = { ...await import('@stacksjs/security') }
let afterVerification: (() => void) | undefined
mock.module('@stacksjs/security', () => ({ ...security, verifyHash: async (value: string, hash: string) => {
  const valid = await security.verifyHash(value, hash)
  const change = afterVerification
  afterVerification = undefined
  change?.()
  return valid
} }))
const { makeHash } = security
const { RateLimiter } = await import('../../src/rate-limiter')
const DisableAction = (await import('../../../../defaults/app/Actions/Auth/DisableTwoFactorAction')).default
const failures: string[] = []
const email = 'reauth@example.invalid'
function changeOwner(change: string, password: string) {
  const child = Bun.spawnSync([process.execPath, '--no-env-file', '-e', `
    import { Database } from 'bun:sqlite'
    const dialect = process.env.DB_CONNECTION
    const change = process.env.STACKS_REAUTH_CHANGE
    const sql = change === 'deleted' ? 'DELETE FROM users WHERE id = 1' : 'UPDATE users SET password = ? WHERE id = 1'
    const values = change === 'deleted' ? [] : [process.env.STACKS_REAUTH_HASH]
    if (dialect === 'sqlite') {
      const db = new Database(process.env.DB_DATABASE_PATH)
      try { db.query(sql).run(...values) } finally { db.close() }
    } else {
      const db = new Bun.SQL({ adapter: dialect, hostname: process.env.DB_HOST,
        port: Number(process.env.DB_PORT), database: process.env.DB_DATABASE,
        username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
        tls: process.env.DB_SSL === 'true' ? 'require' : 'disable' })
      try { await db.unsafe(dialect === 'postgres' ? sql.replace('?', '$1') : sql, values) }
      finally { await db.close() }
    }
  `], { cwd: tmpdir(), env: { ...process.env, STACKS_REAUTH_CHANGE: change, STACKS_REAUTH_HASH: password }, stdout: 'pipe', stderr: 'pipe', timeout: 5000 })
  assert.equal(child.exitCode, 0, child.stderr.toString())
}
try {
  await db.unsafe('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email VARCHAR(255) UNIQUE, password TEXT, two_factor_secret TEXT, two_factor_enabled BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP, updated_at TIMESTAMP)').execute()
  const oldHash = await makeHash('synthetic-old-password', { algorithm: 'bcrypt' })
  const newHash = await makeHash('synthetic-new-password', { algorithm: 'bcrypt' })
  for (const change of ['password', 'deleted', 'unchanged', 'wrong-password', 'wrong-owner']) {
    RateLimiter.useMemoryStore()
    await db.deleteFrom('users').execute()
    await db.insertInto('users').values({ id: 1, name: 'Synthetic', email, password: oldHash, two_factor_secret: 'synthetic-existing-secret', two_factor_enabled: true }).execute()
    if (change === 'wrong-owner')
      await db.insertInto('users').values({ id: 2, name: 'Other', email: 'reassigned@example.invalid', password: oldHash, two_factor_secret: 'other-secret', two_factor_enabled: true }).execute()
    let changed = false
    afterVerification = () => {
      // Run the real bcrypt verifier, then commit a competing write before
      // returning its result. No forged hash result or timing-dependent sleep.
      if (['password', 'deleted'].includes(change)) {
        changed = true
        changeOwner(change, newHash)
      }
    }
    try {
      const result = await DisableAction.handle({
        user: async () => ({ id: 1, email: change === 'wrong-owner' ? 'reassigned@example.invalid' : email }),
        get: () => change === 'wrong-password' ? 'incorrect-password' : 'synthetic-old-password',
      } as never) as Response
      assert.equal(result.status, change === 'unchanged' ? 200 : 401, `${change}: stale or other-account credentials cannot disable 2FA`)
      if (['password', 'deleted'].includes(change)) assert(changed, 'the competing write must run')
      const rows = await db.primary.selectFrom('users').selectAll().execute()
      if (change === 'deleted') assert.equal(rows.length, 0)
      else assert.equal(Boolean(rows.find(row => Number(row.id) === 1)?.two_factor_enabled), change !== 'unchanged')
      if (change === 'wrong-owner') assert.equal(Boolean(rows.find(row => Number(row.id) === 2)?.two_factor_enabled), true)
    }
    catch (error) { failures.push(`${change}: ${error}`) }
    finally { afterVerification = undefined }
  }
  assert.deepEqual(failures, [])
  console.log('two-factor disable reauthentication OK')
}
finally {
  RateLimiter.useMemoryStore()
  await releaseOrm()
  await closeDatabaseConnection()
}
