import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { dashboard as dashboardConfig } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { dashboardRequestValue } from '../dashboard-request'
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
 * Operational failures use a real 503 response so the client can
 * distinguish unavailable history from a valid empty sample set.
 */
export default new Action({
  name: 'Dashboard CI Runner History',
  description: 'Recent runner-sample history for one org (sparkline data).',
  method: 'GET',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const ci = dashboardConfig?.ci
    if (!ci?.enabled || !ci.alerts?.enabled) {
      return { org: null, samples: [], disabled: true }
    }

    const org = dashboardRequestValue(request, 'org')
    if (!org) {
      return response.json({ message: 'The org query parameter is required.' }, 400)
    }

    const allowedOrgs = ci.orgs ?? []
    if (allowedOrgs.length > 0 && !allowedOrgs.includes(org)) {
      return response.json({ message: 'This organization is not configured for CI tracking.' }, 403)
    }

    const rawLimit = Number(dashboardRequestValue(request, 'limit', '60'))
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
      return response.json({ message: 'Runner history could not be loaded.' }, 503)
    }
  },
})
