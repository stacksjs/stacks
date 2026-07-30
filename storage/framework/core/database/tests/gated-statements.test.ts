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
