import { describe, expect, test } from 'bun:test'
import QueryLog from '../../../defaults/app/Models/QueryLog'

/*
 * The query log's analysis columns hold an EXPLAIN plan, the tables a query
 * touched and the suggestions made about it. As varchar(255) on Postgres every
 * row with a real plan was refused ("value too long for type character
 * varying(255)") and the logger dropped it - the slow queries were the ones
 * lost (ReviewOS, 2026-10-20).
 */
describe('the query log keeps long analysis', () => {
  for (const column of ['tags', 'affected_tables', 'indexes_used', 'missing_indexes', 'explain_plan', 'optimization_suggestions'] as const) {
    test(`${column} is text, not varchar(255)`, () => {
      expect((QueryLog.attributes as Record<string, { type?: string }>)[column]?.type).toBe('text')
    })
  }
})
