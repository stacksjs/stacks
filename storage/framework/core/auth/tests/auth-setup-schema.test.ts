import { expect, test } from 'bun:test'
import { SQL } from 'bun'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL
  for (const mode of ['fresh', 'legacy', 'revoked-client', 'invalid', 'invalid-token', 'failed-backfill', 'reset-duplicates', 'verification-duplicates'] as const) {
    test.skipIf(dialect !== 'sqlite' && !connection)(`${dialect} auth setup handles a ${mode} schema`, async () => {
      const url = dialect === 'sqlite' ? undefined : new URL(connection!)
      if (url && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
        throw new Error('Auth setup tests require a local disposable database server')
      const directory = await mkdtemp(join(tmpdir(), 'stacks-auth-setup-'))
      const name = `stacks_auth_setup_${crypto.randomUUID().replaceAll('-', '')}`
      const admin = url ? new SQL(url.href) : undefined
      const quoted = dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
      let created = false
      try {
        const config = join(directory, 'bunfig.toml')
        await writeFile(config, 'preload = []\n')
        // auth:setup boots in a second process. Parent initializeDbConfig
        // calls do not reach it; provide a complete disposable app config.
        await mkdir(join(directory, 'config'))
        await writeFile(join(directory, 'config/database.ts'), `export default ${JSON.stringify({
          default: dialect,
          connections: dialect === 'sqlite'
            ? { sqlite: { database: join(directory, 'auth.sqlite') } }
            : { [dialect]: { name, host: url!.hostname, port: Number(url!.port || (dialect === 'mysql' ? 3306 : 5432)),
                username: decodeURIComponent(url!.username), password: decodeURIComponent(url!.password) } },
          queryLogging: { enabled: false },
        })}\n`, { mode: 0o600 })
        if (admin) { await admin.unsafe(`CREATE DATABASE ${quoted}`); created = true }
        const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/auth-setup-schema.ts`], {
          cwd: directory,
          env: {
            ...process.env, APP_ENV: 'test', DB_CONNECTION: dialect, DB_QUERY_LOGGING_ENABLED: 'false',
            DB_DATABASE_PATH: dialect === 'sqlite' ? join(directory, 'auth.sqlite') : ':memory:',
            STACKS_AUTH_SETUP_CONFIG: config, STACKS_AUTH_SETUP_MODE: mode,
            ...(url ? { DB_DATABASE: name, DB_HOST: url.hostname, DB_PORT: url.port || (dialect === 'mysql' ? '3306' : '5432'),
              DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
              DB_SSL: url.searchParams.get('ssl') === 'true' ? 'true' : 'false' } : {}),
          },
          stdout: 'pipe', stderr: 'pipe',
        })
        const watchdog = setTimeout(() => child.kill(), 25_000)
        try {
          const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
          expect(code, `${stdout}\n${stderr}`).toBe(0)
          expect(stdout).toContain('auth setup schema OK')
        }
        finally { clearTimeout(watchdog); child.kill() }
      }
      finally {
        try { if (created) await admin!.unsafe(`DROP DATABASE ${quoted}${dialect === 'postgres' ? ' WITH (FORCE)' : ''}`) }
        finally {
          try { await admin?.close() }
          finally { await rm(directory, { recursive: true, force: true }) }
        }
      }
    }, 30_000)
  }
}
