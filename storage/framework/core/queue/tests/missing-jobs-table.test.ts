import { describe, expect, it } from 'bun:test'
import { isMissingTableError, missingJobsTableError } from '../src/missing-table'

describe('a dispatch with no jobs table', () => {
  it('is recognised on Postgres, MySQL and SQLite', () => {
    expect(isMissingTableError({ message: 'relation "jobs" does not exist', code: '42P01' })).toBe(true)
    expect(isMissingTableError({ message: 'Table \'app.jobs\' doesn\'t exist', errno: 1146 })).toBe(true)
    expect(isMissingTableError({ message: 'no such table: jobs' })).toBe(true)
    expect(isMissingTableError({ message: 'duplicate key value violates unique constraint' })).toBe(false)
  })

  it('says which job was lost, why, and what fixes it', () => {
    const cause = { message: 'relation "jobs" does not exist', code: '42P01' }
    const error = missingJobsTableError('SendPasswordResetEmailJob', cause)
    expect(error.message).toContain('SendPasswordResetEmailJob was not queued')
    expect(error.message).toContain('buddy queue:table')
    expect(error.message).toContain('declare a worker')
    // The database's own words are kept for whoever needs them.
    expect(error.cause).toBe(cause)
  })
})
