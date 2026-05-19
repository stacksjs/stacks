import { Action } from '@stacksjs/actions'
import { dashboard as dashboardConfig } from '@stacksjs/config'
import { fetchRunnerHistory } from './runner-pressure-monitor'

/**
 * `GET /api/dashboard/ci/runner-history?org=stacksjs&limit=60`
 * (stacksjs/stacks#1850).
 *
 * Returns the recent runner-sample history for one org so the CI
 * page can render a small sparkline under each org's runner-pressure
 * line. Bounded by `limit` (defaults to 60, hard cap 500) and the
 * configured retention window — older samples aren't available
 * because they've been pruned.
 *
 * Soft-errors to an empty samples array on any failure so the
 * sparkline gracefully degrades to "no history yet" instead of
 * yelling at the user.
 */
export default new Action({
  name: 'Dashboard CI Runner History',
  description: 'Recent runner-sample history for one org (sparkline data).',
  method: 'GET',
  apiResponse: true,
  async handle(request) {
    const ci = dashboardConfig?.ci
    if (!ci?.enabled || !ci.alerts?.enabled) {
      return { org: null, samples: [], disabled: true }
    }

    const url = new URL(request.url ?? 'http://localhost/')
    const org = String(url.searchParams.get('org') ?? '').trim()
    if (!org) {
      return { error: '`org` query param is required.', status: 400 }
    }

    const allowedOrgs = ci.orgs ?? []
    if (allowedOrgs.length > 0 && !allowedOrgs.includes(org)) {
      return { error: 'Org not in `config.dashboard.ci.orgs`.', status: 403 }
    }

    const rawLimit = Number(url.searchParams.get('limit') ?? '60')
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), 500)
      : 60

    try {
      const samples = await fetchRunnerHistory(org, {
        limit,
        retentionHours: ci.alerts.retentionHours,
      })
      return { org, samples }
    }
    catch (err) {
      console.error('[dashboard/ci] RunnerHistoryAction failed:', err)
      return { org, samples: [], error: err instanceof Error ? err.message : 'unknown error' }
    }
  },
})
