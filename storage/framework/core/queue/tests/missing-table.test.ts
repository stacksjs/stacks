// "Table not migrated yet" detection, across dialects.
//
// The queue's optional tables (job_quarantine, dead-letter, idempotency,
// circuit-breaker) are created by migrations a project may not have run, and
// every consumer treats a missing table as "feature inert" rather than an
// error. Four byte-identical copies of the predicate matched only SQLite's
// `no such table` and MySQL's `doesn't exist`.
//
// Postgres says `relation "job_quarantine" does not exist` (SQLSTATE 42P01).
// "does not exist" is not "doesn't exist", so the predicate returned false and
// the error was rethrown. `Job.dispatch()` calls `isQuarantined()`
// unconditionally, so on Postgres EVERY dispatch threw. The strings below were
// captured from the real drivers, not invented.

import { describe, expect, it } from 'bun:test'
import { isMissingTableError } from '../src/missing-table'

function driverError(message: string, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(message), extra)
}

describe('isMissingTableError', () => {
  it('matches SQLite', () => {
    expect(isMissingTableError(driverError('no such table: job_quarantine'))).toBe(true)
  })

  it('matches MySQL', () => {
    expect(isMissingTableError(driverError('Table \'app.job_quarantine\' doesn\'t exist'))).toBe(true)
    expect(isMissingTableError(driverError('some other wording', { errno: 1146 }))).toBe(true)
  })

  it('matches Postgres, which is the regression this exists for', () => {
    // Captured verbatim from Bun's Postgres client.
    expect(isMissingTableError(
      driverError('relation "job_quarantine" does not exist', { errno: '42P01' }),
    )).toBe(true)
  })

  it('matches Postgres on SQLSTATE alone, without relying on message text', () => {
    // Message wording varies by server version and locale; the code does not.
    expect(isMissingTableError(driverError('translated message', { errno: '42P01' }))).toBe(true)
    expect(isMissingTableError(driverError('translated message', { code: '42p01' }))).toBe(true)
  })

  it('does NOT swallow unrelated failures', () => {
    // The consumers rethrow when this returns false, so a false positive here
    // would silently disable a queue feature instead of surfacing a real fault.
    expect(isMissingTableError(driverError('permission denied for table job_quarantine'))).toBe(false)
    expect(isMissingTableError(driverError('connection refused'))).toBe(false)
    expect(isMissingTableError(driverError('deadlock detected'))).toBe(false)
  })

  it('tolerates a non-error being thrown', () => {
    expect(isMissingTableError(null)).toBe(false)
    expect(isMissingTableError(undefined)).toBe(false)
    expect(isMissingTableError('a string')).toBe(false)
  })
})
