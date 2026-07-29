import { describe, expect, it } from 'bun:test'
import { isExcludedQuery } from '../src/query-logger'
import { createDatabaseQueryHooks } from '../src/utils'

describe('database query logging', () => {
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
})
