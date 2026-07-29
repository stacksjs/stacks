import { describe, expect, it } from 'bun:test'
import { normalizeReleaseRecord, summarizeReleases } from './release-records'

describe('dashboard release records', () => {
  it('normalizes model-style records', () => {
    const values: Record<string, unknown> = {
      id: 7,
      version: '1.2.3',
      type: 'minor',
      status: 'published',
      notes: 'Native release',
      downloads: '42',
      author: 'Chris',
      created_at: '2026-07-28T12:00:00.000Z',
    }

    expect(normalizeReleaseRecord({ get: (key: string) => values[key] })).toEqual({
      id: '7',
      version: '1.2.3',
      type: 'minor',
      status: 'published',
      notes: 'Native release',
      downloads: 42,
      author: 'Chris',
      createdAt: '2026-07-28T12:00:00.000Z',
    })
  })

  it('summarizes only recorded release values', () => {
    const releases = [
      normalizeReleaseRecord({ id: 2, version: '2.0.0', status: 'draft', downloads: -5 }),
      normalizeReleaseRecord({ id: 1, version: '1.0.0', status: 'published', downloads: 12 }),
    ]

    expect(summarizeReleases(releases)).toEqual({
      total: 2,
      published: 1,
      downloads: 12,
      latestVersion: '2.0.0',
    })
  })
})
