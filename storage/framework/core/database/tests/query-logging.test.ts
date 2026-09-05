import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { isExcludedQuery, logQuery, setQueryTracker } from '../src/query-logger'
import { createDatabaseQueryHooks } from '../src/utils'

describe('database query logging', () => {
  it.each([false, true])('delivers real query diagnostics across reconnects and errors (persistence: %s)', async (persistence) => {
    const child = Bun.spawn([process.execPath, join(import.meta.dir, 'fixtures/query-logger-dispatch.ts'), String(persistence)], {
      cwd: join(import.meta.dir, '..'),
      env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: ':memory:', DB_QUERY_LOGGING_ENABLED: 'false' },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    expect(exitCode, stderr).toBe(0)
    expect(stdout).toContain('query-logger-dispatch-ok')
  })

  it('forwards successful query-builder events to the logger shape', () => {
    const events: unknown[] = []
    const hooks = createDatabaseQueryHooks(event => events.push(event))

    hooks.onQueryEnd?.({
      sql: 'select * from users where id = ?',
      params: [4],
      durationMs: 8,
      rowCount: 1,
      kind: 'select',
    })

    expect(events).toEqual([{
      query: {
        sql: 'select * from users where id = ?',
        parameters: [4],
      },
      queryDurationMillis: 8,
    }])
  })

  it('forwards failed queries without throwing into the query path', () => {
    const events: unknown[] = []
    const error = new Error('connection lost')
    const hooks = createDatabaseQueryHooks(event => events.push(event))

    hooks.onQueryError?.({
      sql: 'update users set name = ?',
      params: ['Chris'],
      durationMs: 3,
      error,
      kind: 'update',
    })

    expect(events).toEqual([{
      query: {
        sql: 'update users set name = ?',
        parameters: ['Chris'],
      },
      queryDurationMillis: 3,
      error,
    }])
  })

  it('honors case-insensitive excluded query patterns', () => {
    expect(isExcludedQuery('SELECT * FROM query_logs', ['query_logs'])).toBe(true)
    expect(isExcludedQuery('select * from users', ['query_logs'])).toBe(false)
    expect(isExcludedQuery('select 1', ['  '])).toBe(false)
  })

  it('hands query diagnostics to a router loaded before or after the database', async () => {
    const key = Symbol.for('stacks.database.queryTracker')
    const globals = globalThis as Record<symbol, unknown>
    const previous = globals[key]
    const seen: string[] = []

    try {
      delete globals[key]
      setQueryTracker(query => seen.push(`configured:${query}`))
      await logQuery({ query: { sql: 'select 1' }, queryDurationMillis: 1 })

      globals[key] = (query: string) => seen.push(`shared:${query}`)
      await logQuery({ query: { sql: 'select 2' }, queryDurationMillis: 1 })

      expect(seen).toEqual(['configured:select 1', 'shared:select 2'])
    }
    finally {
      if (previous === undefined) delete globals[key]
      else globals[key] = previous
    }
  })
})
