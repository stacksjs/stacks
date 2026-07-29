import { describe, expect, it } from 'bun:test'
import { dashboardQueryColumns, mapDashboardQueryLog, parseQueryLogList, queryType } from './query-dashboard'

describe('query dashboard projection', () => {
  it('classifies supported query types', () => {
    expect(queryType(' select * from users')).toBe('SELECT')
    expect(queryType('UPDATE users SET name = ?')).toBe('UPDATE')
    expect(queryType('PRAGMA table_info(users)')).toBe('OTHER')
  })

  it('parses persisted JSON lists without throwing', () => {
    expect(parseQueryLogList('["SELECT","table:users"]')).toEqual(['SELECT', 'table:users'])
    expect(parseQueryLogList('invalid')).toEqual([])
  })

  it('excludes bindings, traces, and file paths from the dashboard shape', () => {
    const result = mapDashboardQueryLog({
      id: 4,
      query: 'SELECT * FROM users WHERE id = ?',
      normalized_query: 'SELECT * FROM users WHERE id = ?',
      duration: 8.4,
      connection: 'sqlite',
      status: 'slow',
      error: null,
      executed_at: '2026-07-29T14:00:00.000Z',
      tags: '["SELECT","table:users"]',
      affected_tables: '["users"]',
    })

    expect(result.type).toBe('SELECT')
    expect(result.tags).toEqual(['SELECT', 'table:users'])
    expect(result.affectedTables).toEqual(['users'])
    expect(result).not.toHaveProperty('bindings')
    expect(result).not.toHaveProperty('trace')
    expect(result).not.toHaveProperty('file')
    expect(dashboardQueryColumns).not.toContain('bindings')
    expect(dashboardQueryColumns).not.toContain('trace')
    expect(dashboardQueryColumns).not.toContain('file')
  })
})
