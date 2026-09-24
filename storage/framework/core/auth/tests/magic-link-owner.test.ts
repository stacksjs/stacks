import { expect, test } from 'bun:test'
import { SQL } from 'bun'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL
  test.skipIf(dialect !== 'sqlite' && !connection)(`${dialect} magic-link login keeps email ownership through issuance`, async () => {
    const url = dialect === 'sqlite' ? undefined : new URL(connection!)
    if (url && (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !url.port || ['5432', '3306'].includes(url.port)))
      throw new Error('Magic-link ownership tests require a disposable local server on a non-default port')
    const directory = await mkdtemp(join(tmpdir(), 'stacks-magic-owner-'))
    const name = `stacks_magic_owner_${crypto.randomUUID().replaceAll('-', '')}`
    const admin = url ? new SQL(url.href) : undefined
    const quoted = dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
    let created = false
    try {
      const config = join(directory, 'bunfig.toml')
      await writeFile(config, 'preload = []\n')
      if (admin) { await admin.unsafe(`CREATE DATABASE ${quoted}`); created = true }
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/magic-link-owner.ts`], {
        env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: dialect, DB_QUERY_LOGGING_ENABLED: 'false',
          DB_DATABASE_PATH: dialect === 'sqlite' ? join(directory, 'auth.sqlite') : ':memory:', STACKS_MAGIC_OWNER_CONFIG: config,
          ...(url ? { DB_DATABASE: name, DB_HOST: url.hostname, DB_PORT: url.port,
            DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
            DB_SSL: url.searchParams.get('ssl') === 'true' ? 'true' : 'false' } : {}),
        }, stdout: 'pipe', stderr: 'pipe',
      })
      const watchdog = setTimeout(() => child.kill(), 35_000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect(code, `${stdout}\n${stderr}`).toBe(0)
        expect(stdout).toContain('magic-link ownership OK')
      }
      finally { clearTimeout(watchdog); child.kill(); await child.exited }
    }
    finally {
      try { if (created) await admin!.unsafe(`DROP DATABASE ${quoted}${dialect === 'postgres' ? ' WITH (FORCE)' : ''}`) }
      finally { try { await admin?.close() } finally { await rm(directory, { recursive: true, force: true }) } }
    }
  }, 40_000)
}
