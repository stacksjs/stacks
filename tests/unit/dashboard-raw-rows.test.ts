import { expect, test } from 'bun:test'
import { parseCommentableRow } from '../../storage/framework/defaults/app/Actions/Dashboard/Content/comment-input'
import { mapDashboardQueryLog } from '../../storage/framework/defaults/app/Actions/Dashboard/Queries/query-dashboard'

test('raw trait comments decode SQL integer strings and Date values without asserting a row type', () => {
  const row: Record<string, unknown> = { id: '1', commentables_id: '2', commentables_type: 'posts', body: 'Hello', status: 'approved', created_at: new Date('2026-11-05T00:00:00Z') }
  expect(parseCommentableRow(row)).toMatchObject({ id: 1, commentables_id: 2, body: 'Hello', created_at: '2026-11-05T00:00:00.000Z', user_id: null })
  expect(() => parseCommentableRow({ ...row, commentables_id: 'not-an-id' })).toThrow('positive integer')
  expect(() => parseCommentableRow({ ...row, body: { html: 'not text' } })).toThrow('body must be text')
})

test('raw query logs validate identity and optional text before rendering', () => {
  const row: Record<string, unknown> = { id: 1, query: 'SELECT 1', status: 'completed', duration: '2.5', executed_at: new Date('2026-11-05T00:00:00Z'), tags: '["test"]' }
  expect(mapDashboardQueryLog(row)).toMatchObject({ id: 1, duration: 2.5, connection: 'unknown', tags: ['test'], executedAt: '2026-11-05T00:00:00.000Z' })
  expect(() => mapDashboardQueryLog({ ...row, id: undefined })).toThrow('Query log id')
  expect(() => mapDashboardQueryLog({ ...row, model: { unexpected: true } })).toThrow('model must be text')
  expect(() => mapDashboardQueryLog({ ...row, tags: ['not JSON text'] })).toThrow('must be JSON text')
})
