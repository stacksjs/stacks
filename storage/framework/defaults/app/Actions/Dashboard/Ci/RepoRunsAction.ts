import { Action } from '@stacksjs/actions'
import { dashboard as dashboardConfig } from '@stacksjs/config'
import { fetchWorkflowRuns } from '@stacksjs/github'

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
  async handle(request) {
    const ci = dashboardConfig?.ci

    if (!ci?.enabled) {
      return { owner: null, repo: null, runs: [], disabled: true }
    }

    const owner = String((request as any)?.params?.owner ?? (request as any)?.param?.('owner') ?? '').trim()
    const repo = String((request as any)?.params?.name ?? (request as any)?.param?.('name') ?? '').trim()
    if (!owner || !repo) {
      return { error: 'Both `owner` and `name` route params are required.', status: 400 }
    }

    // Scope check: only fetch runs for orgs the user explicitly
    // configured. Stops the endpoint from being a generic GH proxy.
    const allowedOrgs = ci.orgs ?? []
    if (allowedOrgs.length > 0 && !allowedOrgs.includes(owner)) {
      return { error: 'Org not in `config.dashboard.ci.orgs`.', status: 403 }
    }

    const url = new URL(request.url ?? `http://localhost/`)
    const rawLimit = Number(url.searchParams.get('limit') ?? '20')
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), 100)
      : 20
    const branch = url.searchParams.get('branch') || undefined

    try {
      const runs = await fetchWorkflowRuns(owner, repo, { limit, branch })
      return { owner, repo, runs }
    }
    catch (err) {
      console.error('[dashboard/ci] RepoRunsAction failed:', err)
      return {
        owner,
        repo,
        runs: [],
        error: err instanceof Error ? err.message : 'unknown error',
      }
    }
  },
})
