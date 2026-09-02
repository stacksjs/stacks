import type { DashboardProviderUnavailable } from '../dashboard-provider'
import type { AnalyticsRange, AnalyticsScope } from './request-analytics'
import { Request } from '@stacksjs/orm'
import { HQ_READ_UNAVAILABLE, readThroughProvider, resolveDashboardDriver } from '../dashboard-provider'
import { buildWebAnalytics, requestAnalyticsRow } from './request-analytics'

/**
 * Where the web Analytics section reads from.
 *
 * The local provider aggregates this application's own recorded requests, and
 * it keeps the read exactly as `WebAnalyticsAction` performed it, including the
 * ten thousand row ceiling. That ceiling is applied by id before the range
 * filter runs, so a busy application reports on its ten thousand most recent
 * requests rather than on the window that was asked for. That is existing
 * behaviour, it is load bearing for the current numbers, and changing it here
 * would make this refactor impossible to verify as behaviour preserving. It is
 * worth fixing on its own, against its own tests.
 *
 * Only web analytics is seamed. Sales and marketing analytics aggregate orders
 * and campaigns from this application's own tables, which no hosted analytics
 * product has any view of.
 */

const ROW_CEILING = 10_000

/**
 * The exact shape `buildWebAnalytics` returns, taken from the function itself.
 *
 * Deliberately derived rather than declared. Writing this shape out by hand and
 * annotating the builder with it would narrow `source` from the literal
 * `'requests'` to `string` and would re-type the two empty arrays it returns,
 * which is a visible type change in a refactor that is supposed to have none.
 */
export type DashboardWebAnalyticsPayload
  = ReturnType<typeof buildWebAnalytics> & Partial<DashboardProviderUnavailable>

export interface DashboardWebAnalyticsQuery {
  range: AnalyticsRange
  scope: AnalyticsScope
}

export interface DashboardWebAnalyticsProvider {
  webAnalytics: (query: DashboardWebAnalyticsQuery) => Promise<DashboardWebAnalyticsPayload>
}

/**
 * An empty analytics payload, carrying the reason there is nothing to show.
 *
 * Built by running the real aggregation over no rows, so every key, every
 * zero and every placeholder string is whatever the section already renders
 * for an application that has served no traffic. A hand written empty object
 * would drift from that the first time the builder gains a field.
 */
export function emptyWebAnalyticsPayload(
  reason: string,
  query: DashboardWebAnalyticsQuery,
): DashboardWebAnalyticsPayload {
  return {
    ...buildWebAnalytics([], query.range, new Date(), query.scope),
    unavailable: reason,
  }
}

function isWebAnalyticsPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object')
    return false
  const candidate = payload as Partial<DashboardWebAnalyticsPayload>
  return Boolean(candidate.overview)
    && Array.isArray(candidate.traffic)
    && Array.isArray(candidate.pages)
}

/**
 * This application's own recorded requests.
 *
 * Not wrapped in a catch, so a local read failure still reaches the action's
 * operational error exactly as it did before the seam existed.
 */
export const localWebAnalyticsProvider: DashboardWebAnalyticsProvider = {
  async webAnalytics(query: DashboardWebAnalyticsQuery): Promise<DashboardWebAnalyticsPayload> {
    const records = await Request.orderByDesc('id').limit(ROW_CEILING).get()
    const rows = records.map(requestAnalyticsRow)

    return buildWebAnalytics(rows, query.range, new Date(), query.scope)
  },
}

/** Reads the web Analytics section through whichever provider config selects. */
export async function readDashboardWebAnalytics(
  query: DashboardWebAnalyticsQuery,
): Promise<DashboardWebAnalyticsPayload> {
  const driver = await resolveDashboardDriver('analytics')

  if (driver.name === 'local')
    return localWebAnalyticsProvider.webAnalytics(query)

  return readThroughProvider(
    'analytics',
    reason => emptyWebAnalyticsPayload(reason, query),
    async () => emptyWebAnalyticsPayload(HQ_READ_UNAVAILABLE, query),
    isWebAnalyticsPayload,
  )
}
