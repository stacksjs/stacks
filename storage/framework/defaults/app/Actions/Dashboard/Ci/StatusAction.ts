import { Action } from '@stacksjs/actions'
import { dashboard as dashboardConfig } from '@stacksjs/config'
import { getDashboardData } from '@stacksjs/github'
import { runCiFailureNotifier } from './failure-notifier'
import { runRunnerPressureMonitor } from './runner-pressure-monitor'

/**
 * `GET /api/dashboard/ci/status`
 *
 * Aggregated CI / runner snapshot consumed by `dashboard/ci/index.stx`.
 * Reads org list + runner caps from `config/dashboard.ts:ci.*` so installs
 * pick their own surface (stacksjs/stacks#1844). When the surface is
 * disabled or no orgs are configured, returns an empty snapshot rather
 * than throwing — the page renders an empty-state in that case.
 */
export default new Action({
  name: 'Dashboard CI Status',
  description: 'Aggregated CI/runner snapshot across the configured GitHub orgs.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    const ci = dashboardConfig?.ci

    if (!ci?.enabled || !ci.orgs || ci.orgs.length === 0) {
      return {
        repos: [],
        fetchedAt: new Date().toISOString(),
        total: 0,
        passing: 0,
        failing: 0,
        pending: 0,
        noRuns: 0,
        runners: {},
        disabled: !ci?.enabled,
      }
    }

    try {
      const data = await getDashboardData({
        orgs: ci.orgs,
        runnerCaps: ci.runnerCaps,
        defaultRunnerCap: ci.runnerCapDefault,
        ignoreRepos: ci.ignoreRepos,
      })
      // Failing-CI notifications (stacksjs/stacks#1849) +
      // runner-pressure alerts (stacksjs/stacks#1850). Both
      // fire-and-forget so they don't block the response on the
      // notification + time-series persistence round-trips. Each
      // internally guards on its own enabled flag, so unrelated
      // projects pay no cost.
      void runCiFailureNotifier(data)
      void runRunnerPressureMonitor(data)
      return data
    }
    catch (err) {
      // Most likely cause: GITHUB_TOKEN missing. Surface a clean error
      // shape the page can render without leaking the env-var name to
      // every browser viewing the dashboard.
      console.error('[dashboard/ci] snapshot failed:', err)
      return {
        repos: [],
        fetchedAt: new Date().toISOString(),
        total: 0,
        passing: 0,
        failing: 0,
        pending: 0,
        noRuns: 0,
        runners: {},
        error: err instanceof Error ? err.message : 'unknown error',
      }
    }
  },
})
