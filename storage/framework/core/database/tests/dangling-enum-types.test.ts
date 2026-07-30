// Statements referencing an enum type nothing creates.
//
// Background: bun-query-builder names an enum type `<table>_<column>_type` when
// it creates the table, but its ALTER path has emitted the bare
// `<column>_type`. A diff touching an existing enum column therefore produces
// `ALTER TABLE "payments" ALTER COLUMN "status" TYPE "status_type"` with no
// `CREATE TYPE "status_type"` anywhere, and Postgres stops the whole migration
// run there. The generator drops those statements rather than writing a corpus
// that cannot be applied.

import { describe, expect, it } from 'bun:test'
import { findDanglingTypeReferences, referencesUndefinedType } from '../src/migrations'

describe('findDanglingTypeReferences', () => {
  it('reports a type that is referenced but never created', () => {
    const statements = [
      'CREATE TABLE "payments" ("status" "payments_status_type");',
      'ALTER TABLE "payments" ALTER COLUMN "status" TYPE "status_type" USING "status"::"status_type";',
    ]

    expect(findDanglingTypeReferences(statements)).toEqual(['status_type'])
  })

  it('reports nothing when every referenced type is created', () => {
    const statements = [
      'CREATE TYPE "payments_status_type" AS ENUM (\'paid\', \'failed\');',
      'ALTER TABLE "payments" ALTER COLUMN "status" TYPE "payments_status_type";',
    ]

    expect(findDanglingTypeReferences(statements)).toEqual([])
  })

  it('ignores built-in types, which are never quoted', () => {
    const statements = ['ALTER TABLE "t" ALTER COLUMN "c" TYPE bigint USING "c"::bigint;']

    expect(findDanglingTypeReferences(statements)).toEqual([])
  })
})

describe('referencesUndefinedType', () => {
  it('matches a statement naming a dangling type', () => {
    const statement = 'ALTER TABLE "payments" ALTER COLUMN "status" TYPE "status_type";'

    expect(referencesUndefinedType(statement, ['status_type'])).toBe(true)
  })

  it('does not match a column that merely shares the word', () => {
    // Dropping this statement would silently skip a legitimate change.
    const statement = 'ALTER TABLE "payments" ALTER COLUMN "status" TYPE text;'

    expect(referencesUndefinedType(statement, ['status_type'])).toBe(false)
  })

  it('matches only the types it was given', () => {
    const statement = 'ALTER TABLE "t" ALTER COLUMN "c" TYPE "kept_type";'

    expect(referencesUndefinedType(statement, ['other_type'])).toBe(false)
    expect(referencesUndefinedType(statement, ['kept_type'])).toBe(true)
  })
})
