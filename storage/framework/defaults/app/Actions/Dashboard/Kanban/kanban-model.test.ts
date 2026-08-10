import { describe, expect, test } from 'bun:test'
import { cardCommentResponse } from './kanban-comment'
import {
  modelBoolean,
  modelNullableNumber,
  modelNullableString,
  modelNumber,
  modelString,
  modelValue,
  refreshModel,
} from './kanban-model'

function record(values: Record<string, unknown>) {
  return {
    get(key: string) {
      return values[key]
    },
  }
}

describe('kanban model response values', () => {
  test('prefers model attribute names and supports database column names', () => {
    const row = record({
      boardId: 4,
      board_id: 3,
      created_at: '2026-07-31 03:00:00',
    })

    expect(modelNumber(row, 'boardId', 'board_id')).toBe(4)
    expect(modelString(row, 'createdAt', 'created_at')).toBe('2026-07-31 03:00:00')
    expect(modelValue(record({ value: null, value_fallback: 'stale' }), 'value', 'value_fallback')).toBeNull()
    expect(modelValue(row, 'missing')).toBeUndefined()
  })

  test('normalizes nullable strings and persisted booleans', () => {
    expect(modelNullableNumber(record({ value: null }), 'value')).toBeNull()
    expect(modelNullableNumber(record({ value: '42' }), 'value')).toBe(42)
    expect(modelNullableString(record({ value: null }), 'value')).toBeNull()
    expect(modelBoolean(record({ enabled: 1 }), 'enabled')).toBe(true)
    expect(modelBoolean(record({ enabled: 'true' }), 'enabled')).toBe(true)
    expect(modelBoolean(record({ enabled: 0 }), 'enabled')).toBe(false)
  })

  test('reads raw query rows as well as ORM model records', () => {
    const row = {
      board_id: 4,
      archived: 1,
      created_at: '2026-08-10 12:00:00',
    }

    expect(modelNumber(row, 'boardId', 'board_id')).toBe(4)
    expect(modelBoolean(row, 'archived')).toBe(true)
    expect(modelString(row, 'createdAt', 'created_at')).toBe('2026-08-10 12:00:00')
  })

  test('refreshes generated database values after a write', async () => {
    const stale = {
      ...record({ updated_at: null }),
      fresh: async () => record({ updated_at: '2026-07-31 04:00:00' }),
    }

    const refreshed = await refreshModel(stale)
    expect(modelString(refreshed, 'updatedAt', 'updated_at')).toBe('2026-07-31 04:00:00')
  })

  test('serializes model-backed comments with their author', () => {
    expect(cardCommentResponse(record({
      id: 7,
      uuid: 'comment-uuid',
      userId: 3,
      body: 'Updated note',
      createdAt: '2026-08-10 20:00:00',
      updatedAt: '2026-08-10 21:00:00',
    }), record({ name: 'Chris', email: 'chris@example.com' }))).toEqual({
      id: 7,
      uuid: 'comment-uuid',
      userId: 3,
      body: 'Updated note',
      authorName: 'Chris',
      authorEmail: 'chris@example.com',
      createdAt: '2026-08-10 20:00:00',
      updatedAt: '2026-08-10 21:00:00',
    })
  })
})
