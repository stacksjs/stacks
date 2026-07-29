import { describe, expect, test } from 'bun:test'
import { adjustInventoryOnConnection, inventoryAdjustmentStatement } from '../utils/inventory-adjustment'
import { mutationCount } from '../utils/mutation-count'

describe('commerce mutation counts', () => {
  test('normalizes native and driver-specific result shapes', () => {
    expect(mutationCount(3)).toBe(3)
    expect(mutationCount(4n)).toBe(4)
    expect(mutationCount({ affectedRows: 5 })).toBe(5)
    expect(mutationCount({ numDeletedRows: { changes: 6, lastInsertRowid: 1 } })).toBe(6)
    expect(mutationCount([{ numUpdatedRows: 2 }, { changes: 3 }])).toBe(5)
  })

  test('returns zero for missing or non-finite counts', () => {
    expect(mutationCount(undefined)).toBe(0)
    expect(mutationCount({})).toBe(0)
    expect(mutationCount(Number.NaN)).toBe(0)
  })

  test('builds dialect-aware guarded inventory updates', () => {
    const sqlite = inventoryAdjustmentStatement('sqlite', 7, -2, '2026-07-29 16:00:00')
    const postgres = inventoryAdjustmentStatement('postgres', 7, -2, '2026-07-29 16:00:00')

    expect(sqlite.query).toContain('inventory_count = inventory_count + ?')
    expect(postgres.query).toContain('inventory_count = inventory_count + $1')
    expect(postgres.query).toContain('updated_at = $2')
    expect(postgres.query).toContain('WHERE id = $3')
    expect(postgres.query).toContain('inventory_count + $4 >= 0')
    expect(postgres.parameters).toEqual([-2, '2026-07-29 16:00:00', 7, -2])
  })

  test('normalizes the transaction connection result', async () => {
    const calls: Array<{ query: string, parameters?: unknown[] }> = []
    const affected = await adjustInventoryOnConnection({
      unsafe(query, parameters) {
        calls.push({ query, parameters })
        return { changes: 1, lastInsertRowid: 0 }
      },
    }, 7, -1, '2026-07-29 16:00:00')

    expect(affected).toBe(1)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.parameters).toEqual([-1, '2026-07-29 16:00:00', 7, -1])
  })
})
