import type { DashboardData } from '../src/types'
import { describe, expect, test } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { clearDashboardCache, getDashboardData } from '../src/dashboard'

const SAMPLE: DashboardData = {
  repos: [],
  fetchedAt: '2026-05-19T00:00:00.000Z',
  total: 0,
  passing: 0,
  failing: 0,
  pending: 0,
  noRuns: 0,
  runners: {},
}

describe('getDashboardData cache', () => {
  test('returns disk-cached data without hitting the network', async () => {
    const cachePath = join(tmpdir(), `dashboard-cache-${Date.now()}-${Math.random().toString(36).slice(2)}.json`)
    await Bun.write(cachePath, JSON.stringify({ data: SAMPLE, savedAt: Date.now() }))

    clearDashboardCache(cachePath)
    const data = await getDashboardData({
      orgs: ['no-such-org'],
      cachePath,
      cacheTtlMs: 60_000,
    })

    expect(data.fetchedAt).toBe(SAMPLE.fetchedAt)
    expect(data.total).toBe(0)
  })
})
