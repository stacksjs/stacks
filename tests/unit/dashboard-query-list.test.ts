/**
 * stacksjs/stacks#3204: the dashboard's query log is filtered by range, status,
 * type and connection, counted and paged by the database, and the SQL
 * classifier agrees with the JS one. See fixtures/query-list.ts for what runs.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import { parseQueryListQuery } from '../../storage/framework/defaults/app/Actions/Dashboard/Queries/query-list'

for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL
  test.skipIf(dialect !== 'sqlite' && !connection)(`${dialect} the query log is filtered, counted and paged by the database`, async () => {
    const url = dialect === 'sqlite' ? undefined : new URL(connection!)
    if (url && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Query list tests require a local disposable database server')
    const directory = await mkdtemp(join(tmpdir(), 'stacks-query-list-'))
    const name = `stacks_query_list_${crypto.randomUUID().replaceAll('-', '')}`
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
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/query-list.ts`], {
        env: {
          ...process.env, APP_ENV: 'test', TZ: 'UTC', DB_CONNECTION: dialect, DB_QUERY_LOGGING_ENABLED: 'false',
          DB_DATABASE_PATH: dialect === 'sqlite' ? join(directory, 'query-list.sqlite') : ':memory:',
          STACKS_QUERY_LIST_CONFIG: config,
          ...(url ? { DB_DATABASE: name, DB_HOST: url.hostname, DB_PORT: url.port || (dialect === 'mysql' ? '3306' : '5432'),
          DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
          DB_SSL: url.searchParams.get('ssl') === 'true' ? 'true' : 'false' } : {}),
        }, stdout: 'pipe', stderr: 'pipe',
      })
      let timedOut = false
      const watchdog = setTimeout(() => { timedOut = true; child.kill() }, 25_000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect(timedOut, 'the query list fixture must finish without a watchdog kill').toBe(false)
        expect(code, `${stdout}\n${stderr}`).toBe(0)
        expect(stdout).toContain('query list OK')
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

describe('query list query', () => {
  const parse = (values: Record<string, unknown>) => parseQueryListQuery(key => values[key])

  test('defaults to the first page of 50 from the last day, unfiltered', () => {
    expect(parse({})).toEqual({ range: 'day', status: 'all', type: 'all', connection: '', page: 1, perPage: 50 })
    expect(parse({ range: 'week', status: 'slow', type: 'SELECT', connection: ' replica ', page: ['2', '3'], per_page: '25' }))
      .toEqual({ range: 'week', status: 'slow', type: 'SELECT', connection: 'replica', page: 2, perPage: 25 })
  })

  test('refuses a value it cannot honour rather than guessing', () => {
    for (const values of [{ range: 'month' }, { range: 'toString' }, { status: 'pending' }, { type: 'select' }, { type: 'MERGE' }, { page: '0' }, { page: '1.5' }, { per_page: '2000' }, { connection: 'x'.repeat(201) }])
      expect(parse(values)).toHaveProperty('error')
  })
})
