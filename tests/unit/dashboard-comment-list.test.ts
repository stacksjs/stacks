/**
 * stacksjs/stacks#3193: the dashboard's comments, from the `comments` table
 * and the `commentables` trait table, are searched, filtered, counted and
 * paged by the database, newest first across both. See
 * fixtures/comment-list.ts for what runs.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SQL } from 'bun'
import { describe, expect, test } from 'bun:test'
import { newestFirst } from '../../storage/framework/defaults/app/Actions/Dashboard/Content/comment-input'
import { parseCommentListQuery } from '../../storage/framework/defaults/app/Actions/Dashboard/Content/comment-list'

for (const dialect of ['sqlite', 'postgres', 'mysql'] as const) {
  const connection = dialect === 'postgres' ? process.env.STACKS_TEST_POSTGRES_URL : process.env.STACKS_TEST_MYSQL_URL
  test.skipIf(dialect !== 'sqlite' && !connection)(`${dialect} comments from both tables are searched, filtered, counted and paged newest first`, async () => {
    const url = dialect === 'sqlite' ? undefined : new URL(connection!)
    if (url && !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
      throw new Error('Comments list tests require a local disposable database server')
    const directory = await mkdtemp(join(tmpdir(), 'stacks-comment-list-'))
    const name = `stacks_comment_list_${crypto.randomUUID().replaceAll('-', '')}`
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
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/comment-list.ts`], {
        env: {
          ...process.env, APP_ENV: 'test', TZ: 'UTC', DB_CONNECTION: dialect, DB_QUERY_LOGGING_ENABLED: 'false',
          DB_DATABASE_PATH: dialect === 'sqlite' ? join(directory, 'comment-list.sqlite') : ':memory:',
          STACKS_COMMENT_LIST_CONFIG: config,
          ...(url ? { DB_DATABASE: name, DB_HOST: url.hostname, DB_PORT: url.port || (dialect === 'mysql' ? '3306' : '5432'),
          DB_USERNAME: decodeURIComponent(url.username), DB_PASSWORD: decodeURIComponent(url.password),
          DB_SSL: url.searchParams.get('ssl') === 'true' ? 'true' : 'false' } : {}),
        }, stdout: 'pipe', stderr: 'pipe',
      })
      let timedOut = false
      const watchdog = setTimeout(() => { timedOut = true; child.kill() }, 25_000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect(timedOut, 'the comments list fixture must finish without a watchdog kill').toBe(false)
        expect(code, `${stdout}\n${stderr}`).toBe(0)
        expect(stdout).toContain('comments list OK')
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

describe('comments list query', () => {
  const parse = (values: Record<string, unknown>) => parseCommentListQuery(key => values[key])

  test('defaults to the first page of 25, newest first, every status', () => {
    expect(parse({})).toEqual({ page: 1, perPage: 25, search: '', sort: 'created_at', direction: 'desc', status: 'all' })
    expect(parse({ status: 'trash' })).toMatchObject({ status: 'trash' })
  })

  test('refuses a value it cannot honour rather than guessing', () => {
    for (const values of [{ page: '-1' }, { per_page: '1000' }, { status: 'rejected' }, { sort: 'author_name' }, { direction: 'asc' }])
      expect(parse(values)).toHaveProperty('error')
  })
})

describe('newest first', () => {
  // PostgreSQL and MySQL return Dates; String(date) starts with the weekday.
  test('orders Dates by time, not by weekday name', () => {
    const at = (key: string, created_at: unknown) => ({ key, created_at }) as any
    const rows = [at('comments:1', new Date('2026-11-04T10:00:00Z')), at('comments:2', new Date('2026-11-05T10:00:00Z')), at('commentables:3', '2026-11-03T10:00:00')]
    expect(rows.sort(newestFirst).map(row => row.key)).toEqual(['comments:2', 'comments:1', 'commentables:3'])
  })
})
