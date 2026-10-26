import { describe, expect, it } from 'bun:test'
import { makeModelRecords } from '../src/seeder'

/**
 * A seeded datetime is written in the form every driver accepts
 * (stacksjs/stacks#3014).
 *
 * Factories return `toISOString()`. PostgreSQL parses it and SQLite stores the
 * text, but a MySQL DATETIME refuses the `T...Z` form outright: `buddy seed`
 * failed Courier ("Incorrect datetime value: '2026-10-26T16:13:41.994Z' for
 * column 'last_ping_at'") and Receipt, whose rule is timestampTz().
 */
const SQL_DATETIME = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/

describe('seeded datetime values', () => {
  it('writes a timestamp() attribute without the ISO zone suffix', async () => {
    for (const courier of await makeModelRecords('Courier', 3))
      expect(String(courier.last_ping_at)).toMatch(SQL_DATETIME)
  })

  it('writes a timestampTz() attribute without the ISO zone suffix', async () => {
    for (const receipt of await makeModelRecords('Receipt', 3))
      expect(String(receipt.timestamp)).toMatch(SQL_DATETIME)
  })
})
