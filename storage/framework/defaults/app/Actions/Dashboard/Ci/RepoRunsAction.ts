import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { dashboard as dashboardConfig } from '@stacksjs/config'
import { fetchWorkflowRuns } from '@stacksjs/github'
import { response } from '@stacksjs/router'
import { dashboardRequestValue } from '../dashboard-request'

/**
 * `GET /api/dashboard/ci/repos/:owner/:name/runs?limit=N`
 * (stacksjs/stacks#1848).
 *
 * Returns the N most recent workflow runs for a single repo. Used by
 * the CI surface's drilldown drawer — clicking a repo card opens
 * this and renders a timeline.
 *
 * Auth model mirrors the CI status endpoint:
 *   - When the CI surface is disabled (`config.dashboard.ci.enabled
 *     === false`), responds with an empty list rather than a 4xx so
 *     the drawer renders an empty-state instead of an error.
 *   - When `GITHUB_TOKEN` is missing, the helper bubbles an error
 *     up through `fetchWorkflowRuns`; we catch it here and surface
 *     it cleanly to the page.
 */
export default new Action({
  name: 'Dashboard CI Repo Runs',
  description: 'Latest N workflow runs for a single repo (drilldown).',
  method: 'GET',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const ci = dashboardConfig?.ci

    if (!ci?.enabled) {
      return { owner: null, repo: null, runs: [], disabled: true }
    }

    const owner = request.getParam('owner').trim()
    const repo = request.getParam('name').trim()
    if (!owner || !repo) {
      return response.json({ message: 'Both owner and name route parameters are required.' }, 400)
    }

    // Scope check: only fetch runs for orgs the user explicitly
    // configured. Stops the endpoint from being a generic GH proxy.
    const allowedOrgs = ci.orgs ?? []
    if (allowedOrgs.length > 0 && !allowedOrgs.includes(owner)) {
      return response.json({ message: 'This organization is not configured for CI tracking.' }, 403)
    }

    const rawLimit = Number(dashboardRequestValue(request, 'limit', '20'))
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), 100)
      : 20
    const branchValue = dashboardRequestValue(request, 'branch')
    const branch = branchValue || undefined

    try {
      const runs = await fetchWorkflowRuns(owner, repo, { limit, branch })
      return { owner, repo, runs }
    }
    catch (err) {
      console.error('[dashboard/ci] RepoRunsAction failed:', err)
      return response.json({ message: 'Workflow runs could not be loaded.' }, 502)
    }
  },
})
