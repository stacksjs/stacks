import { describe, expect, it } from 'bun:test'
import { normalizeDashboardLog, summarizeDashboardLogTypes } from './log-dashboard'

describe('dashboard log records', () => {
  it('projects persisted log columns without inventing metadata', () => {
    expect(normalizeDashboardLog({
      id: 42,
      timestamp: 1785098564146,
      type: 'warning',
      source: 'file',
      message: 'A warning from storage',
      project: 'stacks',
      stacktrace: 'at handler (Actions/Handler.ts:12:4)',
      file: 'Actions/Handler.ts',
      created_at: '2026-07-27 16:20:39',
      updated_at: null,
    })).toEqual({
      id: 42,
      timestamp: '2026-07-26T20:42:44.146Z',
      type: 'warning',
      source: 'file',
      message: 'A warning from storage',
      project: 'stacks',
      stacktrace: 'at handler (Actions/Handler.ts:12:4)',
      file: 'Actions/Handler.ts',
      createdAt: '2026-07-27 16:20:39',
      updatedAt: '',
    })
  })

  it('uses the persisted creation date when a legacy timestamp is invalid', () => {
    const record = normalizeDashboardLog({
      id: '7',
      timestamp: 'invalid',
      type: 'custom',
      created_at: '2026-07-27 16:20:39',
    })

    expect(record.id).toBe(7)
    expect(record.timestamp).toBe('2026-07-27T16:20:39.000Z')
    expect(record.type).toBe('unknown')
  })

  it('summarizes exact grouped database counts', () => {
    expect(summarizeDashboardLogTypes([
      { type: 'error', count: 8 },
      { type: 'warning', count: '5' },
      { type: 'info', count: 13 },
      { type: 'success', count: 9 },
    ], '35')).toEqual({
      total: 35,
      error: 8,
      warning: 5,
      info: 13,
      success: 9,
    })
  })
})
