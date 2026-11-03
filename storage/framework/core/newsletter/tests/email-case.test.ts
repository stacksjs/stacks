import { SQL } from 'bun'
import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// stacksjs/stacks#3155: an opt-out holds whatever case the address was typed in.
for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL
  test.skipIf(dialect !== 'sqlite' && !connection)(`${dialect}: subscribe, sync and the bounce path treat an address case-insensitively`, async () => {
    const url = dialect === 'sqlite' ? undefined : new URL(connection!)
    if (url && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Newsletter tests require a local disposable database server')
    const directory = mkdtempSync(join(tmpdir(), 'stacks-newsletter-email-case-'))
    const name = `stacks_newsletter_case_${crypto.randomUUID().replaceAll('-', '')}`
    const quoted = dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
    const admin = url ? new SQL(url.href) : undefined
    let created = false
    try {
      const preload = join(directory, 'preload.ts')
      const config = join(directory, 'bunfig.toml')
      writeFileSync(preload, 'export {}\n')
      writeFileSync(config, `preload = [${JSON.stringify(preload)}]\n`)
      if (admin) { await admin.unsafe(`CREATE DATABASE ${quoted}`); created = true }
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', join(import.meta.dir, 'fixtures/email-case.ts')], {
        env: {
          ...process.env, APP_ENV: 'test', DB_CONNECTION: dialect, DB_QUERY_LOGGING_ENABLED: 'false',
          DB_DATABASE_PATH: dialect === 'sqlite' ? join(directory, 'test.sqlite') : ':memory:',
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
        expect(stdout).toContain('newsletter email case OK')
      }
      finally { clearTimeout(watchdog); child.kill() }
    }
    finally {
      try { if (created) await admin!.unsafe(`DROP DATABASE ${quoted}${dialect === 'postgres' ? ' WITH (FORCE)' : ''}`) }
      finally {
        try { await admin?.close() }
        finally { rmSync(directory, { recursive: true, force: true }) }
      }
    }
  }, 30_000)
}
