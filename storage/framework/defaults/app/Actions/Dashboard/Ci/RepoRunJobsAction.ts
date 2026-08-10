import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { dashboard as dashboardConfig } from '@stacksjs/config'
import { fetchRunJobs } from '@stacksjs/github'
import { response } from '@stacksjs/router'

/**
 * `GET /api/dashboard/ci/repos/:owner/:name/runs/:runId/jobs`
 * (stacksjs/stacks#1848).
 *
 * Returns the job-level breakdown for a single workflow run —
 * surfaced when the user expands a failing row in the drilldown
 * drawer. Pricier than the run list (one round-trip per request),
 * so the page only fires this on demand.
 *
 * Same auth + scope model as `RepoRunsAction`: org must be in
 * `config.dashboard.ci.orgs` for the endpoint to engage.
 */
export default new Action({
  name: 'Dashboard CI Repo Run Jobs',
  description: 'Job-level breakdown for a single workflow run (drilldown expand).',
  method: 'GET',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const ci = dashboardConfig?.ci

    if (!ci?.enabled) {
      return { jobs: [], disabled: true }
    }

    const owner = request.getParam('owner').trim()
    const repo = request.getParam('name').trim()
    const runId = Number(request.getParam('runId'))
    if (!owner || !repo) {
      return response.json({ message: 'Both owner and name route parameters are required.' }, 400)
    }
    if (!Number.isFinite(runId) || runId <= 0) {
      return response.json({ message: 'The run ID must be a positive integer.' }, 400)
    }

    const allowedOrgs = ci.orgs ?? []
    if (allowedOrgs.length > 0 && !allowedOrgs.includes(owner)) {
      return response.json({ message: 'This organization is not configured for CI tracking.' }, 403)
    }

    try {
      const jobs = await fetchRunJobs(owner, repo, runId)
      return { owner, repo, runId, jobs }
    }
    catch (err) {
      console.error('[dashboard/ci] RepoRunJobsAction failed:', err)
      return response.json({ message: 'Workflow jobs could not be loaded.' }, 502)
    }
  },
})
