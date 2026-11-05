/**
 * stacksjs/stacks#3202: the Models page searched with the model query
 * builder's whereLike, a plain LIKE that is case-sensitive on PostgreSQL. It
 * now matches LOWER(column) LIKE LOWER(?), which has to bind its value on
 * every dialect. See fixtures/model-search.ts for what runs.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SQL } from 'bun'
import { expect, test } from 'bun:test'

for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL
  test.skipIf(dialect !== 'sqlite' && !connection)(`${dialect} the Models page search ignores case through the ORM`, async () => {
    const url = dialect === 'sqlite' ? undefined : new URL(connection!)
    if (url && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Model search tests require a local disposable database server')
    const directory = await mkdtemp(join(tmpdir(), 'stacks-model-search-'))
    const name = `stacks_model_search_${crypto.randomUUID().replaceAll('-', '')}`
    const admin = url ? new SQL(url.href) : undefined
    const quoted = dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
    let created = false
    try {
      const config = join(directory, 'bunfig.toml')
      // Passing --config at this file replaces the repo bunfig, so the child
      // inherits none of its preloads. The key is left out rather than set to
      // an empty array: `preload = []` is rejected by Bun before 1.4, which is
      // still what a stale local install runs.
      await writeFile(config, '# no preload\n')
      if (admin) { await admin.unsafe(`CREATE DATABASE ${quoted}`); created = true }
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/model-search.ts`], {
        env: {
          ...process.env, APP_ENV: 'test', TZ: 'UTC', DB_CONNECTION: dialect, DB_QUERY_LOGGING_ENABLED: 'false',
          DB_DATABASE_PATH: dialect === 'sqlite' ? join(directory, 'model-search.sqlite') : ':memory:',
          STACKS_MODEL_SEARCH_CONFIG: config,
          ...(url ? { DB_DATABASE: name, DB_HOST: url.hostname, DB_PORT: url.port || (dialect === 'mysql' ? '3306' : '5432'),
          DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
          DB_SSL: url.searchParams.get('ssl') === 'true' ? 'true' : 'false' } : {}),
        }, stdout: 'pipe', stderr: 'pipe',
      })
      let timedOut = false
      const watchdog = setTimeout(() => { timedOut = true; child.kill() }, 25_000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect(timedOut, 'the model search fixture must finish without a watchdog kill').toBe(false)
        expect(code, `${stdout}\n${stderr}`).toBe(0)
        expect(stdout).toContain('model search OK')
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

