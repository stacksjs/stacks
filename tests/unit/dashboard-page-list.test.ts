/**
 * stacksjs/stacks#3192: the dashboard's CMS pages list is searched, sorted,
 * counted and paged by the database, and reads only the columns it shows.
 * See fixtures/page-list.ts for what runs.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import { parsePageListQuery } from '../../storage/framework/defaults/app/Actions/Dashboard/Content/page-list'

for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL
  test.skipIf(dialect !== 'sqlite' && !connection)(`${dialect} the pages list is searched, sorted, counted and paged by the database`, async () => {
    const url = dialect === 'sqlite' ? undefined : new URL(connection!)
    if (url && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Pages list tests require a local disposable database server')
    const directory = await mkdtemp(join(tmpdir(), 'stacks-page-list-'))
    const name = `stacks_page_list_${crypto.randomUUID().replaceAll('-', '')}`
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
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/page-list.ts`], {
        env: {
          ...process.env, APP_ENV: 'test', TZ: 'UTC', DB_CONNECTION: dialect, DB_QUERY_LOGGING_ENABLED: 'false',
          DB_DATABASE_PATH: dialect === 'sqlite' ? join(directory, 'page-list.sqlite') : ':memory:',
          STACKS_PAGE_LIST_CONFIG: config,
          ...(url ? { DB_DATABASE: name, DB_HOST: url.hostname, DB_PORT: url.port || (dialect === 'mysql' ? '3306' : '5432'),
          DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
          DB_SSL: url.searchParams.get('ssl') === 'true' ? 'true' : 'false' } : {}),
        }, stdout: 'pipe', stderr: 'pipe',
      })
      let timedOut = false
      const watchdog = setTimeout(() => { timedOut = true; child.kill() }, 25_000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect(timedOut, 'the pages list fixture must finish without a watchdog kill').toBe(false)
        expect(code, `${stdout}\n${stderr}`).toBe(0)
        expect(stdout).toContain('pages list OK')
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

describe('pages list query', () => {
  const parse = (values: Record<string, unknown>) => parsePageListQuery(key => values[key])

  test('defaults to the first page of 25, newest first', () => {
    expect(parse({})).toEqual({ page: 1, perPage: 25, search: '', sort: 'created_at', direction: 'desc' })
    expect(parse({ sort: 'published' })).toMatchObject({ sort: 'published', direction: 'asc' })
  })

  test('refuses a value it cannot honour rather than guessing', () => {
    for (const values of [{ page: '0' }, { per_page: '20' }, { sort: 'blocks' }, { sort: 'status' }, { direction: 'sideways' }])
      expect(parse(values)).toHaveProperty('error')
  })
})
