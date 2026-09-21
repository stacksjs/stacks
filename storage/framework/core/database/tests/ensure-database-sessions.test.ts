/**
 * The database probe runs one statement, so it must open one server session.
 *
 * Bun's `new SQL(url)` is a pool of 10 that keeps opening connections after
 * its first query. The probe used it as-is, and with Bun 1.4.1 it opened 10
 * sessions per call on both PostgreSQL 16 and MySQL 8.4, in each of 10 runs.
 * `buddy migrate` probes at least twice (preflightDatabase, then
 * ensureDatabaseReady). See `defaultConnect` in src/ensure-database.ts.
 *
 * Counted by the server rather than sampled while the probe runs: a session
 * can open and close between two samples, and a cumulative counter cannot
 * miss it. PostgreSQL counts sessions per database
 * (`pg_stat_database.sessions`) and MySQL counts connections per user
 * (`performance_schema.users`), so each case gets its own disposable database,
 * and on MySQL its own disposable user. The server cases skip unless
 * STACKS_TEST_POSTGRES_URL / STACKS_TEST_MYSQL_URL name a local server.
 */

import { join } from 'node:path'
import process from 'node:process'
import { SQL } from 'bun'
import { expect, test } from 'bun:test'

type Dialect = 'postgres' | 'mysql'

/** Re-read a cumulative counter until it stops moving, so a late stats flush is not read as a lower number. */
async function settled(read: () => Promise<number>): Promise<number> {
  let previous = await read()
  for (let attempt = 0; attempt < 50; attempt++) {
    await Bun.sleep(100)
    const current = await read()
    if (current === previous && current > 0)
      return current
    previous = current
  }
  return previous
}

for (const dialect of ['postgres', 'mysql'] as const satisfies readonly Dialect[]) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL
  test.skipIf(!connection)(`${dialect} database probe opens exactly one server session`, async () => {
    const url = new URL(connection!)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('The probe session test requires a local disposable database server')

    const suffix = crypto.randomUUID().replaceAll('-', '')
    const name = `stacks_probe_sessions_${suffix}`
    // MySQL counts connections per user, not per database, so the probe gets
    // a user nothing else logs in as. 29 characters, under MySQL's 32.
    const user = dialect === 'mysql' ? `stacks_probe_${suffix.slice(0, 16)}` : decodeURIComponent(url.username)
    const password = dialect === 'mysql' ? crypto.randomUUID().replaceAll('-', '') : decodeURIComponent(url.password)
    const admin = new SQL(url.href, { max: 1 })
    let createdDatabase = false
    let createdUser = false

    try {
      if (dialect === 'postgres') {
        await admin.unsafe(`CREATE DATABASE "${name}"`)
        createdDatabase = true
      }
      else {
        await admin.unsafe(`CREATE DATABASE \`${name}\``)
        createdDatabase = true
        await admin.unsafe(`CREATE USER '${user}'@'%' IDENTIFIED BY '${password}'`)
        createdUser = true
        await admin.unsafe(`GRANT ALL ON \`${name}\`.* TO '${user}'@'%'`)
      }

      const sessions = dialect === 'postgres'
        ? async () => Number((await admin.unsafe('SELECT sessions FROM pg_stat_database WHERE datname = $1', [name]))[0]?.sessions ?? 0)
        : async () => Number((await admin.unsafe('SELECT TOTAL_CONNECTIONS AS n FROM performance_schema.users WHERE USER = ?', [user]))[0]?.n ?? 0)
      const before = await sessions()

      const target = {
        dialect,
        driver: dialect,
        database: name,
        host: url.hostname,
        port: Number(url.port || (dialect === 'mysql' ? 3306 : 5432)),
        username: user,
        password,
        maintenanceCandidates: [],
      }
      const child = Bun.spawn([process.execPath, '--no-env-file', join(import.meta.dir, 'fixtures/ensure-database-sessions.ts')], {
        cwd: join(import.meta.dir, '..'),
        env: {
          ...process.env,
          DB_SSL: url.searchParams.get('ssl') === 'true' ? 'true' : 'false',
          DB_PREFLIGHT_TIMEOUT_MS: '',
          STACKS_PROBE_TARGET: JSON.stringify(target),
        },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      let timedOut = false
      const watchdog = setTimeout(() => { timedOut = true; child.kill() }, 25_000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect(timedOut, 'the probe must finish without a watchdog kill').toBe(false)
        expect(code, `${stdout}\n${stderr}`).toBe(0)
        expect(JSON.parse(stdout.trim().split('\n').pop()!), stderr).toMatchObject({ ok: true })
      }
      finally {
        clearTimeout(watchdog)
        child.kill()
      }

      // The child has exited, so its sessions are over and the count is final.
      expect((await settled(sessions)) - before, 'one statement needs one server session').toBe(1)
    }
    finally {
      try {
        if (createdUser) {
          const open = await admin.unsafe('SELECT id FROM information_schema.processlist WHERE user = ?', [user])
          await Promise.allSettled(open.map((row: { id: number }) => admin.unsafe(`KILL ${Number(row.id)}`)))
          await admin.unsafe(`DROP USER '${user}'@'%'`)
        }
        if (createdDatabase)
          await admin.unsafe(dialect === 'postgres' ? `DROP DATABASE "${name}" WITH (FORCE)` : `DROP DATABASE \`${name}\``)
      }
      finally {
        await admin.close()
      }
    }
  }, 30_000)
}
