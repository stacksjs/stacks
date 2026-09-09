// Statement-level gating of disabled-feature tables.
//
// The file-level gate classifies a migration by its filename, which works
// until the generator emits a catch-all `auto-misc` migration holding stray
// alters for every table at once. That file names no table, so it always ran,
// and its first statement against a gated table killed the whole migration run
// with "relation ... does not exist" — on a default project, where commerce and
// cms ship disabled.

import { describe, expect, test } from 'bun:test'
import { statementTable, withoutGatedStatements } from '../src/migrations'

const gated = new Set(['coupons', 'orders', 'posts'])

describe('statementTable', () => {
  test('reads the table from an alter', () => {
    expect(statementTable('ALTER TABLE "coupons" ALTER COLUMN "is_active" TYPE boolean')).toBe('coupons')
  })

  test('reads the table from a create', () => {
    expect(statementTable('CREATE TABLE IF NOT EXISTS "orders" (\n  "id" BIGSERIAL\n)')).toBe('orders')
  })

  test('reads the table from a drop', () => {
    expect(statementTable('DROP TABLE IF EXISTS "posts"')).toBe('posts')
  })

  test('reads the table an index is built on, not the index name', () => {
    expect(statementTable('CREATE UNIQUE INDEX IF NOT EXISTS "orders_uuid_unique" ON "orders" ("uuid")')).toBe('orders')
  })

  test('is case insensitive and tolerates unquoted names', () => {
    expect(statementTable('alter table orders add column x integer')).toBe('orders')
  })

  test('names nothing for a statement it does not recognise', () => {
    expect(statementTable('CREATE TYPE "status_type" AS ENUM (\'a\')')).toBeNull()
    expect(statementTable('')).toBeNull()
  })
})

describe('withoutGatedStatements', () => {
  test('drops a statement against a gated table', () => {
    const sql = 'ALTER TABLE "coupons" ADD COLUMN "x" integer;\nALTER TABLE "issues" ADD COLUMN "y" integer;\n'
    const result = withoutGatedStatements(sql, gated)

    expect(result).not.toContain('coupons')
    expect(result).toContain('issues')
  })

  test('keeps a file that touches nothing gated, byte for byte', () => {
    const sql = 'ALTER TABLE "issues" ADD COLUMN "y" integer;\n'

    expect(withoutGatedStatements(sql, gated)).toBe(sql)
  })

  test('keeps a statement whose table cannot be identified', () => {
    // Safer to run something unrecognised than to silently skip schema.
    const sql = 'CREATE TYPE "mood" AS ENUM (\'ok\');\nALTER TABLE "orders" ADD COLUMN "x" integer;\n'
    const result = withoutGatedStatements(sql, gated)

    expect(result).toContain('CREATE TYPE')
    expect(result).not.toContain('orders')
  })

  test('empties a file whose every statement is gated', () => {
    const sql = 'ALTER TABLE "coupons" ADD COLUMN "x" integer;\nALTER TABLE "orders" ADD COLUMN "y" integer;\n'

    expect(withoutGatedStatements(sql, gated)).toBe('')
  })

  test('does nothing when no feature is disabled', () => {
    const sql = 'ALTER TABLE "coupons" ADD COLUMN "x" integer;\n'

    expect(withoutGatedStatements(sql, new Set())).toBe(sql)
  })

  test('keeps the remaining statements runnable', () => {
    const sql = [
      'ALTER TABLE "coupons" ADD COLUMN "a" integer;',
      'ALTER TABLE "issues" ADD COLUMN "b" integer;',
      'CREATE INDEX IF NOT EXISTS "i" ON "issues" ("b");',
    ].join('\n')
    const result = withoutGatedStatements(sql, gated)

    // Every kept statement still ends in a semicolon, so the runner's split
    // sees the same shape it always does.
    const kept = result.split(';').map(s => s.trim()).filter(Boolean)
    expect(kept).toHaveLength(2)
    expect(result.trimEnd().endsWith(';')).toBe(true)
  })

  test('gates an index on a gated table', () => {
    const sql = 'CREATE UNIQUE INDEX IF NOT EXISTS "orders_uuid" ON "orders" ("uuid");\n'

    expect(withoutGatedStatements(sql, gated)).toBe('')
  })
})

/**
 * A SQLite table rebuild has to gate as one block (stacksjs/stacks#2534).
 *
 * bun-query-builder cannot ALTER a column in place, so it rebuilds:
 * create a `_qb_tmp_<t>`, copy into it, drop `<t>`, rename the temp over it,
 * recreate the indexes.
 *
 * Only the copy and the drop name `<t>` in a way the gate could see. The ALTER
 * names the temp table as its SOURCE, and `statementReferencesTable` matches
 * FROM/JOIN/UPDATE/INTO but never RENAME TO. So gating deleted the copy, the
 * drop and the index while KEEPING the create and the rename - and a rebuild
 * became a bare create of the very table the gate was meant to suppress.
 *
 * A fresh commerce-disabled install therefore carried 34 of 41 commerce tables,
 * each missing its unique indexes, and a table rebuilt twice crashed the
 * install outright with "there is already another table or index with this
 * name: receipts".
 */
describe('a gated table rebuild', () => {
  const rebuild = [
    'PRAGMA foreign_keys=OFF',
    'BEGIN',
    'CREATE TABLE "_qb_tmp_coupons" (\n  "id" INTEGER PRIMARY KEY,\n  "uuid" TEXT\n)',
    'INSERT INTO "_qb_tmp_coupons" ("id", "uuid") SELECT "id", "uuid" FROM "coupons"',
    'DROP TABLE "coupons"',
    'ALTER TABLE "_qb_tmp_coupons" RENAME TO "coupons"',
    'CREATE UNIQUE INDEX IF NOT EXISTS "coupons_uuid_unique" ON "coupons" ("uuid")',
    'PRAGMA foreign_key_check',
    'COMMIT',
  ].join(';\n')

  test('drops the temp create, so the gated table is never made', () => {
    const kept = withoutGatedStatements(rebuild, gated)

    // The statement that actually created the table on a commerce-disabled
    // install. Red before the fix.
    expect(kept).not.toContain('_qb_tmp_coupons')
  })

  test('drops the rename, which is what materialised the table', () => {
    expect(withoutGatedStatements(rebuild, gated)).not.toContain('RENAME TO "coupons"')
  })

  test('leaves no half of the rebuild behind', () => {
    const kept = withoutGatedStatements(rebuild, gated)

    // A kept CREATE with a dropped RENAME strands a temp table; a kept RENAME
    // with a dropped CREATE fails outright. Both ends gate together or neither.
    expect(kept).not.toContain('coupons')
    // The transaction scaffolding names no table and is still there.
    expect(kept).toContain('BEGIN')
    expect(kept).toContain('COMMIT')
  })

  test('leaves an ungated table\'s rebuild completely intact', () => {
    const ungated = rebuild.replace(/coupons/g, 'receipts_kept')

    const kept = withoutGatedStatements(ungated, gated)

    expect(kept).toContain('CREATE TABLE "_qb_tmp_receipts_kept"')
    expect(kept).toContain('DROP TABLE "receipts_kept"')
    expect(kept).toContain('RENAME TO "receipts_kept"')
    expect(kept).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "coupons_uuid_unique"'.replace('coupons', 'receipts_kept'))
  })

  test('is a no-op when nothing is gated', () => {
    expect(withoutGatedStatements(rebuild, new Set())).toBe(rebuild)
  })
})
