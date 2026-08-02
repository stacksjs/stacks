/**
 * Enum types an ALTER needs, but nothing in the batch creates.
 *
 * Postgres backs an enum column with a named type, and bun-query-builder names
 * it `<table>_<column>_type` when it creates the table. A column that becomes an
 * enum *later* produces `ALTER … TYPE "<table>_<column>_type"` naming a type
 * that was never created, because the `CREATE TYPE` only ever accompanied a
 * `CREATE TABLE`.
 *
 * Those statements used to be dropped with a warning calling itself a generator
 * bug. Dropping them left the column as whatever it already was, so the model
 * change quietly did not happen and the next diff proposed the same thing again
 * - forever. The values are in the plan, so the type can just be created.
 */

import { describe, expect, it } from 'bun:test'
import { createMissingEnumTypes, findDanglingTypeReferences } from '../src/migrations'

const PLAN = {
  tables: [
    {
      table: 'notification_deliveries',
      columns: [
        { name: 'id' },
        { name: 'channel', enumValues: ['email', 'sms', 'push'] },
        { name: 'status', enumValues: ['pending', 'sent', 'failed'] },
        { name: 'recipient' },
      ],
    },
    {
      table: 'issues',
      columns: [{ name: 'state', enumValues: ['open', 'closed'] }],
    },
  ],
}

describe('findDanglingTypeReferences', () => {
  it('finds a type an ALTER names that nothing creates', () => {
    const statements = [
      'ALTER TABLE "notification_deliveries" ALTER COLUMN "channel" TYPE "notification_deliveries_channel_type";',
    ]

    expect(findDanglingTypeReferences(statements)).toEqual(['notification_deliveries_channel_type'])
  })

  it('is quiet when the batch creates it', () => {
    const statements = [
      'CREATE TYPE "issues_state_type" AS ENUM (\'open\', \'closed\');',
      'ALTER TABLE "issues" ALTER COLUMN "state" TYPE "issues_state_type";',
    ]

    expect(findDanglingTypeReferences(statements)).toEqual([])
  })

  /** Built-in types are unquoted, so they can never be mistaken for an enum. */
  it('ignores built-in types', () => {
    expect(findDanglingTypeReferences(['ALTER TABLE "a" ALTER COLUMN "b" TYPE bigint;'])).toEqual([])
  })
})

describe('createMissingEnumTypes', () => {
  it('defines a type from the values the model declared', () => {
    const result = createMissingEnumTypes(['notification_deliveries_channel_type'], PLAN)

    expect(result.defined).toEqual(['notification_deliveries_channel_type'])
    expect(result.statements).toHaveLength(1)
    expect(result.statements[0]).toContain('CREATE TYPE "notification_deliveries_channel_type" AS ENUM')
    expect(result.statements[0]).toContain('\'email\', \'sms\', \'push\'')
  })

  it('defines several at once', () => {
    const result = createMissingEnumTypes(
      ['notification_deliveries_channel_type', 'notification_deliveries_status_type'],
      PLAN,
    )

    expect(result.defined).toHaveLength(2)
    expect(result.statements).toHaveLength(2)
  })

  /**
   * The type may already exist on a database that ran an earlier version of the
   * migration, and `CREATE TYPE` has no `IF NOT EXISTS`. Failing there would
   * stop the whole run at that file.
   */
  it('guards against the type already existing', () => {
    const [statement] = createMissingEnumTypes(['issues_state_type'], PLAN).statements

    expect(statement).toContain('EXCEPTION WHEN duplicate_object THEN null')
  })

  /**
   * Nothing to build it from means nothing to create. Those statements are
   * still dropped, and still reported, because the column keeps what it had.
   */
  it('leaves a type it has no values for alone', () => {
    const result = createMissingEnumTypes(['mystery_type'], PLAN)

    expect(result.statements).toEqual([])
    expect(result.defined).toEqual([])
  })

  it('reports which ones it could define, so the rest can still be dropped', () => {
    const result = createMissingEnumTypes(['issues_state_type', 'mystery_type'], PLAN)

    expect(result.defined).toEqual(['issues_state_type'])
    expect(result.statements).toHaveLength(1)
  })

  it('does nothing when there is nothing dangling', () => {
    expect(createMissingEnumTypes([], PLAN)).toEqual({ statements: [], defined: [] })
  })

  it('copes with no plan at all', () => {
    expect(createMissingEnumTypes(['issues_state_type'], undefined)).toEqual({ statements: [], defined: [] })
  })

  /** Enum members come from a model file, so a quote in one must not end the literal. */
  it('escapes a quote in a value', () => {
    const plan = { tables: [{ table: 't', columns: [{ name: 'c', enumValues: ['it\'s'] }] }] }
    const [statement] = createMissingEnumTypes(['t_c_type'], plan).statements

    expect(statement).toContain('\'it\'\'s\'')
  })

  /** A column with no enum values is not an enum, whatever it is called. */
  it('ignores a non-enum column with a matching name', () => {
    const plan = { tables: [{ table: 't', columns: [{ name: 'c' }] }] }

    expect(createMissingEnumTypes(['t_c_type'], plan).statements).toEqual([])
  })
})
