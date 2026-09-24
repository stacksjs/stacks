import { SQL } from 'bun'
import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL
  test.skipIf(dialect !== 'sqlite' && !connection)(`${dialect} session and bearer logins bind the verified credential version`, async () => {
    const url = dialect === 'sqlite' ? undefined : new URL(connection!)
    if (url && (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !url.port || ['5432', '3306'].includes(url.port)))
      throw new Error('Session login races require a local disposable database server on a non-default port')
    const directory = await mkdtemp(join(tmpdir(), 'stacks-session-login-race-'))
    const name = `stacks_login_race_${crypto.randomUUID().replaceAll('-', '')}`
    const admin = url ? new SQL({ url: url.href, max: 1 }) : undefined
    const quoted = dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
    let created = false
    try {
      const config = join(directory, 'bunfig.toml')
      await writeFile(config, 'preload = []\n')
      if (admin) { await admin.unsafe(`CREATE DATABASE ${quoted}`); created = true }
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/session-login-race.ts`], {
        // Model definitions resolve from this package's framework checkout;
        // every database connection remains pinned to the disposable fixture.
        cwd: join(import.meta.dir, '..'),
        env: {
          ...process.env, APP_ENV: 'test', DB_CONNECTION: dialect, DB_QUERY_LOGGING_ENABLED: 'false',
          DB_DATABASE_PATH: dialect === 'sqlite' ? join(directory, 'sessions.sqlite') : ':memory:', STACKS_LOGIN_RACE_CONFIG: config,
          ...(url ? { DB_DATABASE: name, DB_HOST: url.hostname, DB_PORT: url.port || (dialect === 'mysql' ? '3306' : '5432'),
            DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
            DB_SSL: url.searchParams.get('ssl') === 'true' ? 'true' : 'false' } : {}),
        }, stdout: 'pipe', stderr: 'pipe',
      })
      const watchdog = setTimeout(() => child.kill(), 30_000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect(code, `${stdout}\n${stderr}`).toBe(0)
        expect(stdout).toContain('session login races OK')
      }
      finally { clearTimeout(watchdog); child.kill(); await child.exited }
    }
    finally {
      try { if (created) await admin!.unsafe(`DROP DATABASE ${quoted}${dialect === 'postgres' ? ' WITH (FORCE)' : ''}`) }
      finally {
        try { await admin?.close() }
        finally { await rm(directory, { recursive: true, force: true }) }
      }
    }
  }, 35_000)
}
