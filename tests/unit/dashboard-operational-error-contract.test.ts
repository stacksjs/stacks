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
    expect(helper).toContain('return message')
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
      'Infrastructure/LogIndexAction.ts',
      'Queries/QueryDashboardAction.ts',
      'Queries/QueryShowAction.ts',
      'Queue/QueueStatsAction.ts',
      'Queue/QueueWorkersAction.ts',
      'Realtime/RealtimeStatsAction.ts',
    ].map(readAction).join('\n')

    expect(sources).not.toContain('error instanceof Error ? error.message')
    expect(sources.match(/dashboardOperationalError\(/g)?.length).toBe(16)
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

  test('keeps partial infrastructure insight issues actionable but safe', () => {
    const action = readAction('Infrastructure/InsightsAction.ts')

    expect(action).not.toContain('error instanceof Error ? error.message')
    expect(action.match(/inspectSource\(/g)?.length).toBe(12)
    expect(action).toContain("dashboardOperationalIssue(error, message, `InsightsAction.${source}`)")
  })

  test('protects external Buddy and global-search failures', () => {
    const buddy = readAction('Buddy/BuddyChatAction.ts')
    const search = readAction('Search/GlobalSearchAction.ts')

    expect(buddy).toContain("dashboardOperationalError(error, 'Buddy could not answer the question.', 'BuddyChatAction', 502)")
    expect(search).toContain("dashboardOperationalError(error, 'Search results could not be loaded.', 'GlobalSearchAction')")
    expect(search).toContain('modelCatalog.promise = null')
    expect(search).toContain('finally {\n        db.close()')
  })

  test('separates model validation, absence, capability, and ORM failures', () => {
    const writes = [
      'Models/ModelDestroyAction.ts',
      'Models/ModelStoreAction.ts',
      'Models/ModelUpdateAction.ts',
    ].map(readAction).join('\n')
    const show = readAction('Models/ModelShowAction.ts')
    const resolver = readAction('Models/model-write.ts')

    expect(writes.match(/dashboardOperationalError\(/g)?.length).toBe(3)
    expect(writes).not.toMatch(/return \{ ok: false, error:/)
    expect(show.match(/dashboardOperationalError\(/g)?.length).toBe(2)
    expect(show).not.toContain('e instanceof Error ? e.message')
    expect(resolver).toContain("status: 400 | 404 | 405 | 500")
    expect(resolver).toContain("dashboardOperationalIssue(error, `${modelName} could not be loaded.`")
  })
})
