import assert from 'node:assert/strict'
import { basename, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { setSystemTime } from 'bun:test'
import { SQL } from 'bun'

const dialect = process.env.DB_CONNECTION
assert(dialect === 'sqlite' || dialect === 'postgres' || dialect === 'mysql')
const configPath = process.env.STACKS_SESSION_RENEW_CONFIG
assert(configPath && basename(dirname(configPath)).startsWith('stacks-session-renew-'))
if (dialect === 'sqlite') assert.equal(dirname(process.env.DB_DATABASE_PATH!), dirname(configPath))
else {
  assert.equal(process.env.DB_DATABASE_PATH, ':memory:')
  assert(process.env.DB_DATABASE?.startsWith('stacks_session_renew_'))
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(process.env.DB_HOST!))
  assert(process.env.DB_PORT && !['5432', '3306'].includes(process.env.DB_PORT))
}
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { db, initializeDbConfig, ensureDatabaseConfigLoaded, closeDatabaseConnection, sqlDateTime, parseSqlDateTime } = await import('@stacksjs/database/runtime')
await ensureDatabaseConfigLoaded()
initializeDbConfig({ app: { env: 'test' }, database: {
  default: dialect, connections: dialect === 'sqlite' ? { sqlite: { database: process.env.DB_DATABASE_PATH } } : {
    [dialect]: { name: process.env.DB_DATABASE, host: process.env.DB_HOST, port: Number(process.env.DB_PORT), username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD },
  }, queryLogging: { enabled: false },
} })
const { SessionAuth } = await import('../../src/session-auth')
const { registerPersistentQueryHooks } = await import('@stacksjs/query-builder')
const failures: string[] = []
const now = new Date('2030-01-02T03:04:05Z')
async function check(name: string, run: () => Promise<void>, at: Date = now) {
  setSystemTime(at)
  await db.deleteFrom('sessions').execute()
  await db.insertInto('sessions').values({ id: 'target', user_id: 1, expires_at: sqlDateTime(new Date(at.getTime() + 60_000)), last_activity: 0 }).execute()
  try { await run(); console.log(`PASS ${name}`) }
  catch (error) { failures.push(`${name}: ${error}`) }
}
function replaceExpiry(expiresAt: string) {
  // Query hooks are synchronous. A second real connection commits before
  // the pending refresh UPDATE, with no mock of auth or database behavior.
  const child = Bun.spawnSync([process.execPath, '--no-env-file', '-e', `
    import { Database } from 'bun:sqlite'
    const dialect = process.env.DB_CONNECTION
    const values = [process.env.STACKS_REPLACEMENT_EXPIRY, 'target']
    if (dialect === 'sqlite') {
      const db = new Database(process.env.DB_DATABASE_PATH)
      try { db.query('UPDATE sessions SET expires_at = ? WHERE id = ?').run(...values) }
      finally { db.close() }
    } else {
      const db = new Bun.SQL({ adapter: dialect, hostname: process.env.DB_HOST,
        port: Number(process.env.DB_PORT), database: process.env.DB_DATABASE,
        username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
        tls: process.env.DB_SSL === 'true' ? 'require' : 'disable' })
      try { await db.unsafe(dialect === 'postgres'
        ? 'UPDATE sessions SET expires_at = $1 WHERE id = $2'
        : 'UPDATE sessions SET expires_at = ? WHERE id = ?', values) }
      finally { await db.close() }
    }
  `], { cwd: tmpdir(), env: { ...process.env, STACKS_REPLACEMENT_EXPIRY: expiresAt }, stdout: 'pipe', stderr: 'pipe', timeout: 5000 })
  assert.equal(child.exitCode, 0, new TextDecoder().decode(child.stderr))
}
try {
  await db.unsafe('CREATE TABLE sessions (id VARCHAR(255) PRIMARY KEY, user_id INTEGER, expires_at TIMESTAMP, last_activity INTEGER)').execute()
  for (const offset of [-1000, 300_000]) {
    await check(`refresh preserves a competing ${offset < 0 ? 'expiry' : 'renewal'}`, async () => {
      const replacement = sqlDateTime(new Date(now.getTime() + offset))
      let replaced = false
      const unregister = registerPersistentQueryHooks({ onQueryStart(event) {
        const claiming = dialect === 'mysql' ? event.sql.includes('FOR UPDATE') : event.kind === 'update'
        if (!replaced && claiming && event.sql.includes('sessions')) {
          replaceExpiry(replacement)
          replaced = true
        }
      } })
      try {
        assert.equal(await SessionAuth.refresh('target', 120_000), false, 'a stale refresh must not overwrite a newer version')
        assert(replaced)
      }
      finally { unregister() }
      const row = await db.primary.selectFrom('sessions').where('id', '=', 'target').selectAll().executeTakeFirstOrThrow()
      assert.equal(parseSqlDateTime(row.expires_at)?.getTime(), now.getTime() + offset)
    })
  }
  await check('expiry reached during the update rolls renewal back', async () => {
    let advanced = false
    const unregister = registerPersistentQueryHooks({ onQueryStart(event) {
      if (!advanced && event.kind === 'update' && event.sql.includes('sessions')) {
        advanced = true
        setSystemTime(new Date(now.getTime() + 60_000))
      }
    } })
    try { assert.equal(await SessionAuth.refresh('target', 120_000), false); assert(advanced) }
    finally { unregister() }
    const row = await db.primary.selectFrom('sessions').where('id', '=', 'target').selectAll().executeTakeFirstOrThrow()
    assert.equal(parseSqlDateTime(row.expires_at)?.getTime(), now.getTime() + 60_000, 'failed renewal must leave the original expiry')
    assert.equal(Number(row.last_activity), 0)
  })
  await check('valid and same-value refreshes remain successful', async () => {
    assert.equal(await SessionAuth.refresh('target', 120_000), true)
    assert.equal(await SessionAuth.refresh('target', 120_000), true)
    assert.equal(await SessionAuth.check('target'), true)
  })
  for (const timestamp of ['2030-11-03T08:59:30.800Z', '2030-03-10T09:59:30.800Z']) {
    const start = new Date(timestamp)
    await check(`renewal preserves elapsed TTL across the clock change at ${timestamp}`, async () => {
      assert.equal(await SessionAuth.refresh('target', 120_000), true)
      const row = await db.primary.selectFrom('sessions').where('id', '=', 'target').selectAll().executeTakeFirstOrThrow()
      const requested = start.getTime() + 120_000
      const expected = dialect === 'mysql' ? Math.floor(requested / 1000) * 1000 : requested
      assert.equal(parseSqlDateTime(row.expires_at)?.getTime(), expected)
      setSystemTime(new Date(expected - 1))
      assert.equal(await SessionAuth.check('target'), true)
      setSystemTime(new Date(expected))
      assert.equal(await SessionAuth.check('target'), false)
    }, start)
  }
  for (const fault of ['suppressed', 'expiry changed', 'owner changed']) {
    await check(`renewal rejects a ${fault} update without persisting a partial change`, async () => {
      const before = await db.primary.selectFrom('sessions').where('id', '=', 'target').selectAll().executeTakeFirstOrThrow()
      const assignment = fault === 'owner changed' ? 'user_id = 999' : 'expires_at = NULL'
      if (dialect === 'postgres') {
        const body = fault === 'suppressed' ? 'RETURN NULL;' : `NEW.${assignment.replace(' = ', ' := ')}; RETURN NEW;`
        await db.unsafe(`CREATE FUNCTION alter_session_renewal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN ${body} END; $$`).execute()
        await db.unsafe('CREATE TRIGGER alter_session_renewal BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION alter_session_renewal()').execute()
      }
      else if (dialect === 'mysql')
        await db.unsafe(`CREATE TRIGGER alter_session_renewal BEFORE UPDATE ON sessions FOR EACH ROW SET ${fault === 'suppressed'
          ? 'NEW.expires_at = OLD.expires_at, NEW.last_activity = OLD.last_activity' : `NEW.${assignment}`}`).execute()
      else
        await db.unsafe(`CREATE TRIGGER alter_session_renewal ${fault === 'suppressed' ? 'BEFORE' : 'AFTER'} UPDATE ON sessions BEGIN ${fault === 'suppressed'
          ? 'SELECT RAISE(IGNORE)' : `UPDATE sessions SET ${assignment} WHERE id = NEW.id`}; END`).execute()
      try {
        assert.equal(await SessionAuth.refresh('target', 120_000), false, 'an unpersisted renewal must not report success')
        assert.deepEqual(await db.primary.selectFrom('sessions').where('id', '=', 'target').selectAll().executeTakeFirstOrThrow(), before)
      }
      finally {
        await db.unsafe(`DROP TRIGGER alter_session_renewal${dialect === 'postgres' ? ' ON sessions' : ''}`).execute()
        if (dialect === 'postgres') await db.unsafe('DROP FUNCTION alter_session_renewal()').execute()
      }
    })
  }
  await check('a TTL shorter than stored clock precision cannot expire an active session', async () => {
    const before = await db.primary.selectFrom('sessions').where('id', '=', 'target').selectAll().executeTakeFirstOrThrow()
    assert.equal(await SessionAuth.refresh('target', 0.1), false)
    assert.deepEqual(await db.primary.selectFrom('sessions').where('id', '=', 'target').selectAll().executeTakeFirstOrThrow(), before)
  })
  await check('a renewed deadline reached during read-back rolls the change back', async () => {
    const before = await db.primary.selectFrom('sessions').where('id', '=', 'target').selectAll().executeTakeFirstOrThrow()
    let wrote = false
    let advanced = false
    const unregister = registerPersistentQueryHooks({ onQueryStart(event) {
      if (!event.sql.includes('sessions')) return
      if (event.kind === 'update') wrote = true
      if (wrote && event.kind === 'select') {
        advanced = true
        setSystemTime(new Date(now.getTime() + 1000))
      }
    } })
    try { assert.equal(await SessionAuth.refresh('target', 1000), false); assert(advanced) }
    finally { unregister() }
    assert.deepEqual(await db.primary.selectFrom('sessions').where('id', '=', 'target').selectAll().executeTakeFirstOrThrow(), before)
  })
  await check('caller rollback also rolls back a valid renewal', async () => {
    await assert.rejects(db.transaction(async () => {
      assert.equal(await SessionAuth.refresh('target', 120_000), true)
      throw new Error('fixture rollback')
    }), /fixture rollback/)
    const row = await db.primary.selectFrom('sessions').where('id', '=', 'target').selectAll().executeTakeFirstOrThrow()
    assert.equal(parseSqlDateTime(row.expires_at)?.getTime(), now.getTime() + 60_000)
  })
  if (dialect === 'mysql') {
    await check('an outer repeatable-read snapshot cannot revive a newly expired session', async () => {
      await db.transaction(async () => {
        await db.primary.selectFrom('sessions').selectAll().execute()
        replaceExpiry(sqlDateTime(new Date(now.getTime() - 1000)))
        assert.equal(await SessionAuth.refresh('target', 120_000), false)
      })
      assert.equal(await SessionAuth.check('target'), false)
    })
  }
  if (dialect === 'postgres') {
    await check('expiry while waiting on a real row lock rolls renewal back', async () => {
      const observer = new SQL({ adapter: 'postgres', hostname: process.env.DB_HOST,
        port: Number(process.env.DB_PORT), database: process.env.DB_DATABASE,
        username: process.env.DB_USERNAME, password: process.env.DB_PASSWORD })
      const blocker = await observer.reserve()
      let held = false
      let pending: Promise<boolean> | undefined
      try {
        await blocker.unsafe('BEGIN')
        held = true
        await blocker.unsafe("UPDATE sessions SET last_activity = last_activity WHERE id = 'target'")
        pending = SessionAuth.refresh('target', 120_000)
        const timeout = performance.now() + 5000
        let blocked = false
        while (performance.now() < timeout) {
          const rows = await observer.unsafe("SELECT COUNT(*) AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'")
          if (Number(rows[0].count) > 0) { blocked = true; break }
          await Bun.sleep(10)
        }
        assert(blocked, 'renewal must reach a real database lock')
        setSystemTime(new Date(now.getTime() + 60_000))
        await blocker.unsafe('COMMIT')
        held = false
        assert.equal(await pending, false)
        const row = await db.primary.selectFrom('sessions').where('id', '=', 'target').selectAll().executeTakeFirstOrThrow()
        assert.equal(parseSqlDateTime(row.expires_at)?.getTime(), now.getTime() + 60_000)
        assert.equal(Number(row.last_activity), 0)
      }
      finally {
        if (held) await blocker.unsafe('ROLLBACK')
        await pending?.catch(() => {})
        blocker.release()
        await observer.close()
      }
    })
  }
  assert.deepEqual(failures, [])
  console.log('session renewal atomicity OK')
}
finally { setSystemTime(); await closeDatabaseConnection() }
