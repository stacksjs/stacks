import { describe, expect, it } from 'bun:test'
import {
  matchesJobSearch,
  normalizeActiveJob,
  normalizeFailedJob,
  parseJobReference,
} from './job-records'

function record(values: Record<string, unknown>) {
  return {
    get(key: string) {
      return values[key]
    },
  }
}

describe('dashboard job records', () => {
  it('normalizes an active job with recorded queue state', () => {
    expect(normalizeActiveJob(record({
      id: 7,
      queue: 'emails',
      payload: JSON.stringify({ jobName: 'SendWelcomeEmail', payload: { userId: 4 }, options: { tries: 2 } }),
      attempts: 1,
      available_at: 1785000000,
      reserved_at: null,
      created_at: '2026-07-29 12:00:00',
      updated_at: null,
    }))).toMatchObject({
      id: 'job-7',
      recordId: '7',
      source: 'job',
      name: 'SendWelcomeEmail',
      queue: 'emails',
      connection: null,
      status: 'queued',
      attempts: 1,
      maxAttempts: 2,
      duration: null,
      runtime: null,
    })
  })

  it('derives processing state from the native reservation timestamp', () => {
    const job = normalizeActiveJob(record({
      id: 8,
      queue: 'default',
      payload: 'legacy payload',
      attempts: 1,
      available_at: 1785000000,
      reserved_at: 1785000010,
      created_at: '2026-07-29 12:00:00',
      updated_at: null,
    }))

    expect(job.status).toBe('processing')
    expect(job.reserved_at).toBe('2026-07-25T17:20:10.000Z')
    expect(job.maxAttempts).toBeNull()
  })

  it('normalizes persisted failure metrics without inventing diagnostics', () => {
    expect(normalizeFailedJob(record({
      id: 3,
      connection: 'database',
      queue: 'default',
      payload: '{"displayName":"SyncSearchIndex"}',
      exception: 'Search service unavailable',
      attempts: 2,
      max_attempts: 2,
      duration_ms: 184,
      failed_at: '2026-07-29 12:05:00',
      created_at: '2026-07-29 12:00:00',
      updated_at: null,
    }))).toMatchObject({
      id: 'failed-3',
      recordId: '3',
      source: 'failed',
      name: 'SyncSearchIndex',
      connection: 'database',
      status: 'failed',
      attempts: 2,
      maxAttempts: 2,
      duration: '184ms',
      runtime: 184,
      error: 'Search service unavailable',
      finished_at: '2026-07-29T12:05:00.000Z',
    })
  })

  it('keeps unavailable metrics null for legacy failed rows', () => {
    const job = normalizeFailedJob(record({
      id: 4,
      connection: 'database',
      queue: 'default',
      payload: '{"displayName":"LegacyJob"}',
      exception: 'Legacy failure',
      attempts: null,
      max_attempts: null,
      duration_ms: null,
      failed_at: null,
      created_at: '2026-07-29 12:00:00',
      updated_at: null,
    }))

    expect(job.attempts).toBeNull()
    expect(job.maxAttempts).toBeNull()
    expect(job.duration).toBeNull()
    expect(job.finished_at).toBeUndefined()
  })

  it('parses typed and legacy job references', () => {
    expect(parseJobReference('failed-42')).toEqual({ source: 'failed', id: '42' })
    expect(parseJobReference('job-9')).toEqual({ source: 'job', id: '9' })
    expect(parseJobReference('12')).toEqual({ source: null, id: '12' })
  })

  it('searches job identifiers, metadata, errors, and payload values', () => {
    const job = normalizeFailedJob(record({
      id: 15,
      connection: 'database',
      queue: 'emails',
      payload: '{"displayName":"SendWelcomeEmail","recipient":"operator@example.com"}',
      exception: 'SMTP connection refused',
      attempts: null,
      max_attempts: null,
      duration_ms: null,
      failed_at: '2026-07-29 12:05:00',
      created_at: '2026-07-29 12:00:00',
      updated_at: null,
    }))

    expect(matchesJobSearch(job, 'failed-15')).toBe(true)
    expect(matchesJobSearch(job, '15')).toBe(true)
    expect(matchesJobSearch(job, 'EMAILS')).toBe(true)
    expect(matchesJobSearch(job, 'connection refused')).toBe(true)
    expect(matchesJobSearch(job, 'operator@example.com')).toBe(true)
    expect(matchesJobSearch(job, 'missing')).toBe(false)
  })

  it('rejects corrupted persisted queue fields', () => {
    const values: Record<string, unknown> = {
      id: 4,
      queue: 'emails',
      payload: '{"jobName":"SendWelcomeEmail","options":{"tries":3}}',
      attempts: 1,
      available_at: 1785000000,
      reserved_at: null,
      created_at: '2026-07-29 12:00:00',
      updated_at: null,
    }
    const job = record(values)

    expect(normalizeActiveJob(job).maxAttempts).toBe(3)
    values.attempts = 'unknown'
    expect(() => normalizeActiveJob(job)).toThrow('Job.attempts must be an integer')
    values.attempts = 1
    values.payload = '{"jobName":"SendWelcomeEmail","options":{"tries":0}}'
    expect(() => normalizeActiveJob(job)).toThrow('options.tries must be a positive integer')
  })
})
