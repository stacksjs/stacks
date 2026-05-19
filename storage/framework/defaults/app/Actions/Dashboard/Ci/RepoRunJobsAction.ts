import { Action } from '@stacksjs/actions'
import { dashboard as dashboardConfig } from '@stacksjs/config'
import { fetchRunJobs } from '@stacksjs/github'

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
  async handle(request) {
    const ci = dashboardConfig?.ci

    if (!ci?.enabled) {
      return { jobs: [], disabled: true }
    }

    const owner = String((request as any)?.params?.owner ?? (request as any)?.param?.('owner') ?? '').trim()
    const repo = String((request as any)?.params?.name ?? (request as any)?.param?.('name') ?? '').trim()
    const runIdRaw = (request as any)?.params?.runId ?? (request as any)?.param?.('runId') ?? null
    const runId = Number(runIdRaw)
    if (!owner || !repo) {
      return { error: 'Both `owner` and `name` route params are required.', status: 400 }
    }
    if (!Number.isFinite(runId) || runId <= 0) {
      return { error: '`runId` must be a positive integer.', status: 400 }
    }

    const allowedOrgs = ci.orgs ?? []
    if (allowedOrgs.length > 0 && !allowedOrgs.includes(owner)) {
      return { error: 'Org not in `config.dashboard.ci.orgs`.', status: 403 }
    }

    try {
      const jobs = await fetchRunJobs(owner, repo, runId)
      return { owner, repo, runId, jobs }
    }
    catch (err) {
      console.error('[dashboard/ci] RepoRunJobsAction failed:', err)
      return {
        owner,
        repo,
        runId,
        jobs: [],
        error: err instanceof Error ? err.message : 'unknown error',
      }
    }
  },
})
