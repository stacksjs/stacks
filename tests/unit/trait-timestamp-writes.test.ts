/**
 * An explicit created_at, updated_at or deleted_at written through a model is
 * stored on every dialect, MySQL included, which refuses the ISO form with
 * its zone suffix (stacksjs/stacks#3014). See fixtures/trait-timestamp-writes.ts.
 *
 * Each dialect gets its own disposable database. The server cases skip unless
 * STACKS_TEST_POSTGRES_URL / STACKS_TEST_MYSQL_URL name a local one; CI sets both.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { SQL } from 'bun'
import { expect, test } from 'bun:test'

for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL
  test.skipIf(dialect !== 'sqlite' && !connection)(`${dialect}: explicit trait timestamps are written in a form the database accepts`, async () => {
    const url = dialect === 'sqlite' ? undefined : new URL(connection!)
    if (url && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('The trait timestamp test requires a local disposable database server')
    const directory = await mkdtemp(join(tmpdir(), 'stacks-trait-timestamp-writes-'))
    const name = `stacks_trait_timestamps_${crypto.randomUUID().replaceAll('-', '')}`
    const admin = url ? new SQL(url.href) : undefined
    const quoted = dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
    let created = false
    try {
      const config = join(directory, 'bunfig.toml')
      await writeFile(config, 'preload = []\n')
      if (admin) { await admin.unsafe(`CREATE DATABASE ${quoted}`); created = true }
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/trait-timestamp-writes.ts`], {
        env: {
          ...process.env, APP_ENV: 'test',
          DB_CONNECTION: dialect, DB_QUERY_LOGGING_ENABLED: 'false',
          DB_DATABASE_PATH: dialect === 'sqlite' ? join(directory, 'trait-timestamp-writes.sqlite') : ':memory:',
          ...(url ? { DB_DATABASE: name, DB_HOST: url.hostname, DB_PORT: url.port || (dialect === 'mysql' ? '3306' : '5432'),
          DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
          DB_SSL: url.searchParams.get('ssl') === 'true' ? 'true' : 'false' } : {}),
        }, stdout: 'pipe', stderr: 'pipe',
      })
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      expect(stdout).toContain(`trait timestamps OK on ${dialect}`)
    }
    finally {
      if (created) await admin!.unsafe(`DROP DATABASE IF EXISTS ${quoted}`)
      await admin?.close()
      await rm(directory, { recursive: true, force: true })
    }
  }, 120_000)
}
