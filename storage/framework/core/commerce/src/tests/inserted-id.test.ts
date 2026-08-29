import { describe, expect, it } from 'bun:test'
import { insertedId } from '../utils/inserted-id'

describe('insertedId', () => {
  it('reads the SQLite spelling', () => {
    expect(insertedId({ changes: 1, lastInsertRowid: 42 })).toBe(42)
  })

  it('reads the MySQL spelling', () => {
    expect(insertedId({ insertId: 42, numInsertedOrUpdatedRows: 1n })).toBe(42)
  })

  it('accepts a bigint id', () => {
    expect(insertedId({ lastInsertRowid: 42n })).toBe(42)
  })

  it('unwraps a driver that answers with an array', () => {
    expect(insertedId([{ lastInsertRowid: 7 }])).toBe(7)
  })

  it('never reads a row count as an id', () => {
    // The bug this helper exists to prevent: `numInsertedOrUpdatedRows` is how
    // many rows changed. Read as an id it makes a successful insert fetch row 1.
    expect(insertedId({ numInsertedOrUpdatedRows: 1n })).toBeUndefined()
    expect(insertedId({ numAffectedRows: 1 })).toBeUndefined()
    expect(insertedId({ changes: 1 })).toBeUndefined()
    expect(insertedId({ rowCount: 1 })).toBeUndefined()
  })

  it('reports nothing for a Postgres receipt with no RETURNING', () => {
    expect(insertedId({ rowCount: 1, command: 'INSERT' })).toBeUndefined()
  })

  it('treats zero and negative ids as absent', () => {
    expect(insertedId({ lastInsertRowid: 0 })).toBeUndefined()
    expect(insertedId({ insertId: -1 })).toBeUndefined()
  })

  it('handles missing and malformed receipts', () => {
    expect(insertedId(undefined)).toBeUndefined()
    expect(insertedId(null)).toBeUndefined()
    expect(insertedId('nope')).toBeUndefined()
    expect(insertedId({})).toBeUndefined()
  })
})
