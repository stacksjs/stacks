import { describe, expect, test } from 'bun:test'
import { isDuplicateSuppressionError, isMissingTableError } from '../src/suppression-errors'

// stacksjs/stacks#1976 — the suppression layer is fail-open: a missing
// `email_suppressions` table must warn-once and proceed, never hard-fail a
// send. The matcher previously only knew sqlite/mysql phrasing, so on Postgres
// (`relation "..." does not exist`) the guard missed and every outbound email
// threw. These pin the cross-dialect behavior, including the SQLSTATE path and
// the deliberate scoping that keeps real schema bugs surfacing.

describe('isMissingTableError', () => {
  test('sqlite: "no such table"', () => {
    expect(isMissingTableError(new Error('no such table: email_suppressions'))).toBe(true)
  })

  test('mysql: "doesn\'t exist"', () => {
    expect(isMissingTableError(new Error("Table 'stacks.email_suppressions' doesn't exist"))).toBe(true)
  })

  test('postgres: relation "..." does not exist (#1976)', () => {
    expect(isMissingTableError(new Error('relation "email_suppressions" does not exist'))).toBe(true)
  })

  test('postgres: SQLSTATE 42P01 without recognizable message', () => {
    expect(isMissingTableError(Object.assign(new Error('db error'), { code: '42P01' }))).toBe(true)
  })

  test('does NOT match a real column error (over-matching guard)', () => {
    // A `column ... does not exist` bug must still surface, not be swallowed
    // by a bare "does not exist" match.
    expect(isMissingTableError(new Error('column "emial" does not exist'))).toBe(false)
  })

  test('does NOT match unrelated errors', () => {
    expect(isMissingTableError(new Error('connection refused'))).toBe(false)
    expect(isMissingTableError(null)).toBe(false)
    expect(isMissingTableError(undefined)).toBe(false)
  })
})

// Suppressing the same address twice is a no-op on every database, in each
// one's own words for "already there". Postgres's were not known, so a second
// bounce for an address threw out of the webhook that recorded it.
describe('isDuplicateSuppressionError', () => {
  test('sqlite: UNIQUE constraint failed', () => {
    expect(isDuplicateSuppressionError({ message: 'UNIQUE constraint failed: email_suppressions.email, email_suppressions.type' })).toBe(true)
  })

  test('mysql: Duplicate entry, by message or by errno', () => {
    expect(isDuplicateSuppressionError({ message: 'Duplicate entry \'a@b.co-bounce\' for key \'email_suppressions_email_type_unique\'' })).toBe(true)
    expect(isDuplicateSuppressionError({ message: 'ER_DUP_ENTRY', errno: 1062 })).toBe(true)
  })

  test('postgres: unique_violation, by SQLSTATE or by message', () => {
    expect(isDuplicateSuppressionError({ message: 'something else', code: '23505' })).toBe(true)
    expect(isDuplicateSuppressionError({ message: 'duplicate key value violates unique constraint "email_suppressions_email_type_unique"' })).toBe(true)
  })

  test('does NOT match a missing table or an unrelated error', () => {
    expect(isDuplicateSuppressionError({ message: 'relation "email_suppressions" does not exist', code: '42P01' })).toBe(false)
    expect(isDuplicateSuppressionError({ message: 'connection closed' })).toBe(false)
    expect(isDuplicateSuppressionError(null)).toBe(false)
  })
})
