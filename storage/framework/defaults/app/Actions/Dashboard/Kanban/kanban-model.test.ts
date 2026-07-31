import { describe, expect, test } from 'bun:test'
import {
  modelBoolean,
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
    expect(modelNullableString(record({ value: null }), 'value')).toBeNull()
    expect(modelBoolean(record({ enabled: 1 }), 'enabled')).toBe(true)
    expect(modelBoolean(record({ enabled: 'true' }), 'enabled')).toBe(true)
    expect(modelBoolean(record({ enabled: 0 }), 'enabled')).toBe(false)
  })

  test('refreshes generated database values after a write', async () => {
    const stale = {
      ...record({ updated_at: null }),
      fresh: async () => record({ updated_at: '2026-07-31 04:00:00' }),
    }

    const refreshed = await refreshModel(stale)
    expect(modelString(refreshed, 'updatedAt', 'updated_at')).toBe('2026-07-31 04:00:00')
  })
})
