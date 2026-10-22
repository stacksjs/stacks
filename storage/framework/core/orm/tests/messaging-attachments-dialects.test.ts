import { expect, test } from 'bun:test'
import { SQL } from 'bun'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** See the fixture. Postgres and MySQL run against local disposable servers only. */
for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL
  test.skipIf(dialect !== 'sqlite' && !connection)(`${dialect} messaging gains attachments on migrate and keeps sending before it`, async () => {
    const url = dialect === 'sqlite' ? undefined : new URL(connection!)
    if (url && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Messaging dialect tests require a local disposable database server')
    const directory = await mkdtemp(join(tmpdir(), 'stacks-messaging-attachments-'))
    const name = `stacks_messaging_attachments_${crypto.randomUUID().replaceAll('-', '')}`
    const admin = url ? new SQL(url.href) : undefined
    const quoted = dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
    let created = false
    try {
      const config = join(directory, 'bunfig.toml')
      await writeFile(config, 'preload = []\n')
      if (admin) { await admin.unsafe(`CREATE DATABASE ${quoted}`); created = true }
      const run = async (phase: 'legacy' | 'migrated') => {
        const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/messaging-attachments.ts`], {
          env: {
            ...process.env, APP_ENV: 'test', DB_CONNECTION: dialect, DB_QUERY_LOGGING_ENABLED: 'false', STACKS_MESSAGING_PHASE: phase,
            DB_DATABASE_PATH: dialect === 'sqlite' ? join(directory, 'messaging.sqlite') : ':memory:',
            ...(url ? { DB_DATABASE: name, DB_HOST: url.hostname, DB_PORT: url.port || (dialect === 'mysql' ? '3306' : '5432'),
              DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
              DB_SSL: url.searchParams.get('ssl') === 'true' ? 'true' : 'false' } : {}),
          },
          stdout: 'pipe', stderr: 'pipe', signal: AbortSignal.timeout(25_000),
        })
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect(code, `${phase}\n${stdout}\n${stderr}`).toBe(0)
        return stdout
      }
      // Two processes, as a deploy runs them: the app on the old schema, then
      // migrate and the app it restarts.
      expect(await run('legacy')).toContain('messaging legacy OK')
      expect(await run('migrated')).toContain('messaging attachments OK')
    }
    finally {
      try { if (created) await admin!.unsafe(`DROP DATABASE ${quoted}${dialect === 'postgres' ? ' WITH (FORCE)' : ''}`) }
      finally {
        try { await admin?.close() }
        finally { await rm(directory, { recursive: true, force: true }) }
      }
    }
  }, 60_000)
}
