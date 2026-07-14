import { describe, expect, test } from 'bun:test'
import { isMissingTableError } from '../src/suppression'

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
