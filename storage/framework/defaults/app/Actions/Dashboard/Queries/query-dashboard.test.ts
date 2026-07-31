import { describe, expect, it } from 'bun:test'
import { dashboardQueryColumns, mapDashboardQueryLog, parseQueryLogList, queryType } from './query-dashboard'

describe('query dashboard projection', () => {
  it('classifies supported query types', () => {
    expect(queryType(' select * from users')).toBe('SELECT')
    expect(queryType('UPDATE users SET name = ?')).toBe('UPDATE')
    expect(queryType('PRAGMA table_info(users)')).toBe('OTHER')
  })

  it('parses persisted JSON lists and reports malformed values', () => {
    expect(parseQueryLogList('["SELECT","table:users"]')).toEqual(['SELECT', 'table:users'])
    expect(() => parseQueryLogList('invalid')).toThrow('Could not parse query log list')
    expect(() => parseQueryLogList('{"tag":"SELECT"}')).toThrow('must be a JSON array of strings')
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

  it('reports invalid persisted metrics and statuses', () => {
    const base = {
      id: 7,
      query: 'SELECT 1',
      duration: 1,
      status: 'completed',
      executed_at: '2026-07-29T14:00:00.000Z',
    }

    expect(() => mapDashboardQueryLog({ ...base, duration: 'not-a-number' as unknown as number }))
      .toThrow('query log 7 duration must be a finite number')
    expect(() => mapDashboardQueryLog({ ...base, status: 'pending' }))
      .toThrow('query log 7 status must be completed, failed, or slow')
  })
})
