import { describe, expect, test } from 'bun:test'
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
})
