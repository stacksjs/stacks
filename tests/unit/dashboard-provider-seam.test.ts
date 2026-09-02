import {
  emptyLogPayload,
  localLogsProvider,
} from '../../storage/framework/defaults/app/Actions/Dashboard/Infrastructure/log-provider'
import {
  HQ_READ_UNAVAILABLE,
  readThroughProvider,
  resetDashboardProviders,
  resolveDashboardDriver,
} from '../../storage/framework/defaults/app/Actions/Dashboard/dashboard-provider'
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  emptyWebAnalyticsPayload,
} from '../../storage/framework/defaults/app/Actions/Dashboard/Analytics/web-analytics-provider'

/**
 * The dashboard provider seam.
 *
 * The seam exists so the Logs, Errors and Analytics sections can read from
 * somewhere other than this application's own database. Two properties have to
 * hold for that to be safe, and they pull in opposite directions:
 *
 *   Local must be untouched. It is the default, every existing app runs it,
 *   and a refactor that quietly changed how a local read fails would be worse
 *   than no refactor at all.
 *
 *   Remote must never take a section down. A hosted backend that is slow,
 *   unreachable, or answering with the wrong shape has to become an empty
 *   section carrying a reason.
 */

const LOG_QUERY = {
  page: 1,
  perPage: 25,
  search: '',
  type: '',
  source: '',
  project: '',
  range: '30' as const,
}

const ANALYTICS_QUERY = { range: 'week' as const, scope: 'all' as const }

describe('dashboard provider seam', () => {
  test('every domain defaults to local, which is the behaviour that shipped before the seam', async () => {
    resetDashboardProviders()

    for (const domain of ['logs', 'errors', 'analytics'] as const) {
      const driver = await resolveDashboardDriver(domain)
      expect(driver.name).toBe('local')
    }
  })

  test('a domain resolves once and is reused, until it is reset', async () => {
    resetDashboardProviders()

    const first = await resolveDashboardDriver('logs')
    const second = await resolveDashboardDriver('logs')
    expect(second).toBe(first)

    resetDashboardProviders()
    expect(await resolveDashboardDriver('logs')).not.toBe(first)
  })

  test('a provider that rejects becomes an empty section with a reason', async () => {
    const payload = await readThroughProvider(
      'logs',
      reason => emptyLogPayload(reason, LOG_QUERY),
      async () => {
        throw new Error('connect ECONNREFUSED')
      },
      () => true,
    )

    expect(payload.logs).toEqual([])
    expect(payload.pagination.total).toBe(0)
    expect(payload.unavailable).toBeTruthy()
  })

  test('a provider that answers with the wrong shape becomes an empty section, not a broken page', async () => {
    // The failure this covers is not a rejection. A backend that answers 200
    // with an object missing its array reaches the component and fails there,
    // which is a blank page rather than an empty state.
    const payload = await readThroughProvider(
      'logs',
      reason => emptyLogPayload(reason, LOG_QUERY),
      async () => ({ nonsense: true }) as never,
      candidate => Array.isArray((candidate as { logs?: unknown })?.logs),
    )

    expect(payload.logs).toEqual([])
    expect(payload.unavailable).toBeTruthy()
  })

  test('a healthy provider is handed back untouched', async () => {
    const good = emptyLogPayload('placeholder', LOG_QUERY)
    const payload = await readThroughProvider('logs', () => good, async () => good, () => true)

    expect(payload).toBe(good)
  })

  test('selecting hq today says why it is empty rather than pretending to be down', () => {
    // Both published HQ SDKs are ingest clients. Neither exposes a read call,
    // and an ingest key grants no read access, so there is nothing to fetch yet.
    expect(HQ_READ_UNAVAILABLE).toContain('no read API')
  })

  test('the empty analytics payload is the real aggregation over no rows', () => {
    const payload = emptyWebAnalyticsPayload('nothing to show', ANALYTICS_QUERY)

    // Built by running the shipped builder over an empty set, so it cannot
    // drift from the shape the section renders for an app with no traffic.
    expect(payload.source).toBe('requests')
    expect(payload.range).toBe('week')
    expect(payload.overview.pageViews).toBe(0)
    expect(payload.overview.uniqueVisitors).toBe(0)
    expect(payload.traffic).toBeInstanceOf(Array)
    expect(payload.unavailable).toBe('nothing to show')
  })

  test('the empty log payload still offers the filter options the page needs', () => {
    const payload = emptyLogPayload('nothing to show', LOG_QUERY)

    // The filter dropdowns are rendered from `options`. An empty section that
    // also empties them leaves the page with no way back to a populated view.
    expect(payload.options.types).toEqual(['error', 'warning', 'info', 'success'])
    expect(payload.options.ranges).toEqual(['1', '7', '30', '90', 'all'])
    expect(payload.pagination.perPage).toBe(25)
    expect(payload.summary.total).toBe(0)
  })

  test('the local logs provider is the query the action used to run', () => {
    // A characterization check on the lifted code rather than on a live
    // database: the five statements, the ordering and the filtered columns are
    // what the page's numbers depend on.
    const source = readFileSync(
      resolve('storage/framework/defaults/app/Actions/Dashboard/Infrastructure/log-provider.ts'),
      'utf8',
    )

    expect(source).toContain("db.selectFrom('logs')")
    expect(source).toContain("whereAny(['message', 'project', 'file', 'stacktrace'], 'like', searchPattern)")
    expect(source).toContain("orderBy('timestamp', 'desc')")
    expect(source).toContain('Math.min(query.page, totalPages)')
    expect(typeof localLogsProvider.logs).toBe('function')
  })

  test('the seamed actions no longer reach past the provider', () => {
    const action = (path: string) =>
      readFileSync(resolve('storage/framework/defaults/app/Actions', path), 'utf8')

    // The regression this invites is somebody re-adding a direct query beside
    // the provider call, which would work locally and silently ignore config.
    const logIndex = action('Dashboard/Infrastructure/LogIndexAction.ts')
    expect(logIndex).not.toContain('@stacksjs/database')
    expect(logIndex).toContain('readDashboardLogs')

    const webAnalytics = action('Dashboard/Analytics/WebAnalyticsAction.ts')
    expect(webAnalytics).not.toContain('@stacksjs/orm')
    expect(webAnalytics).toContain('readDashboardWebAnalytics')

    for (const read of ['ErrorIndexAction', 'ErrorStatsAction', 'ErrorTimelineAction', 'ErrorGroupAction', 'ErrorShowAction'])
      expect(action(`Monitoring/${read}.ts`)).not.toContain('@stacksjs/commerce')
  })

  test('the error write paths are deliberately left alone', () => {
    // Reads may come from elsewhere; a resolve or a delete always acts on the
    // local store. A section reading remotely and writing locally would
    // disagree with itself, so the writes stay put until a provider can take one.
    for (const write of ['ErrorResolveAction', 'ErrorIgnoreAction', 'ErrorUnresolveAction', 'ErrorDestroyAction']) {
      const source = readFileSync(
        resolve('storage/framework/defaults/app/Actions/Monitoring', `${write}.ts`),
        'utf8',
      )
      expect(source).toContain('@stacksjs/commerce')
      expect(source).not.toContain('error-provider')
    }
  })

  test('no separator dash typography reaches a reason string', () => {
    // tests/unit/dashboard-copy-contract.test.ts only walks .stx files, so the
    // house rule is unenforced for the .ts strings the seam introduces.
    for (const file of [
      'Dashboard/dashboard-provider.ts',
      'Dashboard/Infrastructure/log-provider.ts',
      'Dashboard/Analytics/web-analytics-provider.ts',
      'Monitoring/error-provider.ts',
    ]) {
      const source = readFileSync(
        resolve('storage/framework/defaults/app/Actions', file),
        'utf8',
      )
      expect(source).not.toContain('—')
      expect(source).not.toContain('–')
    }
  })
})
