import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const dashboardActions = resolve('storage/framework/defaults/app/Actions/Dashboard')

function readAction(relativePath: string): string {
  return readFileSync(resolve(dashboardActions, relativePath), 'utf8')
}

describe('dashboard operational error contract', () => {
  test('logs server details and returns a safe unavailable response', () => {
    const helper = readAction('dashboard-response.ts')

    expect(helper).toContain('console.error(`[dashboard/api] ${action} failed:`, error)')
    expect(helper).toContain('return response.json({ message }, status)')
    expect(helper).toContain('status = 503')
  })

  test('does not expose caught storage errors from operational read APIs', () => {
    const sources = [
      'DashboardActivityAction.ts',
      'Data/ActivityIndexAction.ts',
      'Data/SubscriberIndexAction.ts',
      'Data/TeamIndexAction.ts',
      'Data/UserIndexAction.ts',
      'Jobs/JobIndexAction.ts',
      'Jobs/JobShowAction.ts',
      'Jobs/JobStatsAction.ts',
      'Email/CapturedMailIndexAction.ts',
      'Email/CapturedMailShowAction.ts',
      'Queries/QueryDashboardAction.ts',
      'Queries/QueryShowAction.ts',
      'Queue/QueueStatsAction.ts',
      'Queue/QueueWorkersAction.ts',
      'Realtime/RealtimeStatsAction.ts',
    ].map(readAction).join('\n')

    expect(sources).not.toContain('error instanceof Error ? error.message')
    expect(sources.match(/dashboardOperationalError\(/g)?.length).toBe(15)
  })

  test('uses native status codes for invalid and missing job records', () => {
    const action = readAction('Jobs/JobShowAction.ts')

    expect(action).toContain("response.json({ message: 'Invalid job id.' }, 400)")
    expect(action.match(/response\.json\(\{ message: 'Job not found\.' \}, 404\)/g)?.length).toBe(3)
  })

  test('separates analytics validation from operational failures', () => {
    const sources = [
      'Analytics/EventAnalyticsAction.ts',
      'Analytics/MarketingAnalyticsAction.ts',
      'Analytics/SalesAnalyticsAction.ts',
      'Analytics/WebAnalyticsAction.ts',
    ].map(readAction).join('\n')

    expect(sources.match(/dashboardOperationalError\(/g)?.length).toBe(4)
    expect(sources.match(/error instanceof Error \? error\.message/g)?.length).toBe(4)
    expect(sources).not.toContain("error.message : 'Sales analytics records could not be read.'")
    expect(sources).not.toContain("error.message : 'Web analytics records could not be read.'")
  })
})
