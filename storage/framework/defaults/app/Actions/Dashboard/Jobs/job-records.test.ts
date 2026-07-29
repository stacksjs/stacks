import { describe, expect, it } from 'bun:test'
import {
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
  it('normalizes an active job with a unique reference', () => {
    expect(normalizeActiveJob(record({
      id: 7,
      queue: 'emails',
      payload: JSON.stringify({ displayName: 'SendWelcomeEmail', userId: 4 }),
      attempts: 1,
      available_at: 1785000000,
      created_at: '2026-07-29 12:00:00',
    }))).toMatchObject({
      id: 'job-7',
      recordId: '7',
      source: 'job',
      name: 'SendWelcomeEmail',
      queue: 'emails',
      status: 'queued',
      payload: { displayName: 'SendWelcomeEmail', userId: 4 },
    })
  })

  it('normalizes a failed job without inventing diagnostics', () => {
    expect(normalizeFailedJob(record({
      id: 3,
      connection: 'database',
      queue: 'default',
      payload: '{"displayName":"SyncSearchIndex"}',
      exception: 'Search service unavailable',
      failed_at: '2026-07-29 12:05:00',
    }))).toMatchObject({
      id: 'failed-3',
      recordId: '3',
      source: 'failed',
      name: 'SyncSearchIndex',
      connection: 'database',
      status: 'failed',
      error: 'Search service unavailable',
      finished_at: '2026-07-29 12:05:00',
    })
  })

  it('parses typed and legacy job references', () => {
    expect(parseJobReference('failed-42')).toEqual({ source: 'failed', id: '42' })
    expect(parseJobReference('job-9')).toEqual({ source: 'job', id: '9' })
    expect(parseJobReference('12')).toEqual({ source: null, id: '12' })
  })
})
