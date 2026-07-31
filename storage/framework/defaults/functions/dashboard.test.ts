import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useDashboard } from './dashboard'

describe('dashboard home composable', () => {
  test('starts empty instead of inventing healthy zero-value data', () => {
    const dashboard = useDashboard()

    expect(dashboard.stats.value).toEqual([])
    expect(dashboard.httpMetrics.value).toEqual([])
    expect(dashboard.recentActivity.value).toEqual([])
    expect(dashboard.systemHealth.value).toEqual([])
    expect(dashboard.issues.value).toEqual([])
  })

  test('uses the guarded canonical home endpoint', () => {
    const source = readFileSync(resolve('storage/framework/defaults/functions/dashboard.ts'), 'utf8')

    expect(source).toContain("dashboardApi<DashboardHomeResponse>('/api/dashboard/home')")
    expect(source).not.toContain('defaultStats')
    expect(source).not.toContain('defaultHealth')
    expect(source).not.toContain('resolveApiBaseUrl')
    expect(source).not.toContain('/dashboard/stats')
  })
})
