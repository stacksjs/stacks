import { defineStore, derived, registerStoresClient, state } from '@stacksjs/stx'

interface FailedJob {
  name: string
  conclusion: string
  url: string
}

interface RepoStatus {
  name: string
  owner: string
  fullName: string
  url: string
  defaultBranch: string
  status: 'success' | 'failure' | 'pending' | 'no_runs' | 'error'
  conclusion: string | null
  workflowName: string | null
  commitSha: string | null
  commitMessage: string | null
  commitUrl: string | null
  commitAuthor: string | null
  commitCount: number | null
  updatedAt: string | null
  runUrl: string | null
  failedJobs: FailedJob[]
  renovatePRs: number
  renovatePRsUrl: string | null
  actionsPRs: number
  actionsPRsUrl: string | null
}

interface OrgRunnerUsage {
  running: number
  queued: number
  cap: number
}

type StatusFilter = 'all' | 'passing' | 'failing' | 'pending'

// Drilldown shapes (stacksjs/stacks#1848). Mirror the @stacksjs/github
// `WorkflowRun` / `WorkflowJob` typings without the strict GH-conclusion
// union (lets unknown future conclusion strings flow through without
// breaking the type).
interface WorkflowRun {
  id: number
  status: string
  conclusion: string | null
  name: string
  headBranch: string | null
  headSha: string
  headShaShort: string
  commitMessage: string | null
  commitAuthor: string | null
  event: string
  url: string
  startedAt: string | null
  updatedAt: string
  durationMs: number | null
}

interface WorkflowJobStep { name: string, status: string, conclusion: string | null, number: number }

interface WorkflowJob {
  id: number
  name: string
  status: string
  conclusion: string | null
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  url: string
  steps: WorkflowJobStep[]
}

/** The repo currently open in the drilldown drawer. `null` = closed. */
interface DrilldownTarget { owner: string, name: string, fullName: string }

/**
 * CI tracking store — backs `dashboard/ci/index.stx` (stacksjs/stacks#1844).
 * Fetches the aggregated snapshot from `/api/dashboard/ci/status` (Action:
 * `Dashboard/Ci/StatusAction`) and exposes the slice the page needs:
 *   - Reactive list of repos for the current org tab + status filter.
 *   - Per-org aggregates (passing/failing/total) for the tab strip.
 *   - Per-org runner-usage for the runner-pressure line.
 * Active tab + filter persist across SPA nav so a click into a repo and
 * back doesn't reset the user's view.
 */
export const ciStore = defineStore('ci', () => {
  const allRepos = state<RepoStatus[]>([])
  const runners = state<Record<string, OrgRunnerUsage>>({})
  const orgs = state<string[]>([])
  const loading = state(true)
  const error = state('')
  const disabled = state(false)
  const lastFetched = state<string | null>(null)

  const activeTab = state<string>('')
  const statusFilter = state<StatusFilter>('all')

  // ─── Drilldown state (stacksjs/stacks#1848) ─────────────────────
  const drilldown = state<DrilldownTarget | null>(null)
  const drilldownRuns = state<WorkflowRun[]>([])
  const loadingDrilldown = state(false)
  const drilldownError = state<string | null>(null)
  // Per-run job detail, keyed by run id. Lazy-loaded when the user
  // expands a row. Once fetched, cached for the duration of the
  // drawer so re-expanding doesn't re-fetch.
  const drilldownJobsByRunId = state<Record<number, WorkflowJob[]>>({})
  const loadingJobsForRunId = state<number | null>(null)
  const expandedRunId = state<number | null>(null)

  // ─── Runner pressure history (stacksjs/stacks#1850) ─────────────
  // Per-org sample history for the sparkline under the runner line.
  // Lazy-loaded on first view of an org's tab.
  const runnerHistoryByOrg = state<Record<string, Array<{ queued: number, sampledAt: string }>>>({})
  const loadingRunnerHistory = state<Record<string, boolean>>({})

  const reposForTab = derived(() => {
    const tab = activeTab()
    const filter = statusFilter()
    let list = allRepos().filter(r => r.owner === tab)
    if (filter === 'passing')
      list = list.filter(r => r.status === 'success')
    else if (filter === 'failing')
      list = list.filter(r => r.status === 'failure' || r.status === 'error')
    else if (filter === 'pending')
      list = list.filter(r => r.status === 'pending')
    return list
  })

  const tabTotals = derived(() => {
    const tab = activeTab()
    const list = allRepos().filter(r => r.owner === tab)
    return {
      total: list.length,
      passing: list.filter(r => r.status === 'success').length,
      failing: list.filter(r => r.status === 'failure' || r.status === 'error').length,
      pending: list.filter(r => r.status === 'pending').length,
    }
  })

  const tabRunners = derived(() => runners()[activeTab()] ?? { running: 0, queued: 0, cap: 0 })

  async function load(): Promise<void> {
    loading.set(true)
    error.set('')
    try {
      const res = await fetch('/api/dashboard/ci/status', { headers: { accept: 'application/json' } })
      if (!res.ok)
        throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as {
        repos: RepoStatus[]
        runners: Record<string, OrgRunnerUsage>
        fetchedAt: string
        disabled?: boolean
        error?: string
      }

      if (data.disabled) {
        disabled.set(true)
        allRepos.set([])
        runners.set({})
        return
      }
      if (data.error) {
        error.set(data.error)
        return
      }

      allRepos.set(data.repos ?? [])
      runners.set(data.runners ?? {})
      lastFetched.set(data.fetchedAt ?? new Date().toISOString())

      // Derive orgs from the runners map (server-authoritative) and
      // default the active tab to the first org so the page renders
      // something useful on first load. Preserve an existing selection
      // if it's still valid after a refresh.
      const nextOrgs = Object.keys(data.runners ?? {})
      orgs.set(nextOrgs)
      if (!nextOrgs.includes(activeTab()) && nextOrgs.length > 0)
        activeTab.set(nextOrgs[0])
    }
    catch (e) {
      error.set(e instanceof Error ? e.message : String(e))
    }
    finally {
      loading.set(false)
    }
  }

  function setActiveTab(id: string): void {
    activeTab.set(id)
  }
  function setStatusFilter(filter: StatusFilter): void {
    statusFilter.set(filter)
  }

  // ─── Drilldown actions ──────────────────────────────────────────

  async function openDrilldown(repo: { owner: string, name: string, fullName: string }): Promise<void> {
    drilldown.set({ owner: repo.owner, name: repo.name, fullName: repo.fullName })
    drilldownRuns.set([])
    drilldownJobsByRunId.set({})
    expandedRunId.set(null)
    drilldownError.set(null)
    loadingDrilldown.set(true)
    try {
      const res = await fetch(`/api/dashboard/ci/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/runs?limit=20`, { headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { runs?: WorkflowRun[], error?: string, disabled?: boolean }
      if (data.error)
        throw new Error(data.error)
      drilldownRuns.set(data.runs ?? [])
    }
    catch (e) {
      drilldownError.set(e instanceof Error ? e.message : String(e))
    }
    finally {
      loadingDrilldown.set(false)
    }
  }

  function closeDrilldown(): void {
    drilldown.set(null)
    drilldownRuns.set([])
    drilldownJobsByRunId.set({})
    expandedRunId.set(null)
    drilldownError.set(null)
  }

  async function loadRunnerHistory(org: string): Promise<void> {
    // Already loaded? Don't re-fetch — runner samples have a 30s
    // refresh cadence anyway. If the user wants a fresh view they
    // can reload the page.
    if (runnerHistoryByOrg()[org] !== undefined) return
    if (loadingRunnerHistory()[org]) return

    loadingRunnerHistory.set({ ...loadingRunnerHistory(), [org]: true })
    try {
      const res = await fetch(`/api/dashboard/ci/runner-history?org=${encodeURIComponent(org)}`, {
        headers: { accept: 'application/json' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { samples?: Array<{ queued: number, sampledAt: string }>, error?: string, disabled?: boolean }
      if (data.disabled || data.error) {
        runnerHistoryByOrg.set({ ...runnerHistoryByOrg(), [org]: [] })
        return
      }
      runnerHistoryByOrg.set({
        ...runnerHistoryByOrg(),
        [org]: (data.samples ?? []).map(s => ({ queued: s.queued, sampledAt: s.sampledAt })),
      })
    }
    catch {
      // Soft-fail — sparkline renders nothing, no need to surface
      // the error in the main CI page.
      runnerHistoryByOrg.set({ ...runnerHistoryByOrg(), [org]: [] })
    }
    finally {
      loadingRunnerHistory.set({ ...loadingRunnerHistory(), [org]: false })
    }
  }

  async function toggleRunJobs(runId: number): Promise<void> {
    // Click-the-same-row-twice collapses it.
    if (expandedRunId() === runId) {
      expandedRunId.set(null)
      return
    }
    expandedRunId.set(runId)

    // Already cached? Don't re-fetch.
    if (drilldownJobsByRunId()[runId])
      return

    const target = drilldown()
    if (!target) return

    loadingJobsForRunId.set(runId)
    try {
      const res = await fetch(`/api/dashboard/ci/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.name)}/runs/${runId}/jobs`, { headers: { accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { jobs?: WorkflowJob[], error?: string }
      if (data.error)
        throw new Error(data.error)
      drilldownJobsByRunId.set({ ...drilldownJobsByRunId(), [runId]: data.jobs ?? [] })
    }
    catch (e) {
      // Set empty list on error so the row shows "no jobs" rather
      // than spinning forever. The outer drawer error surface picks
      // up the failure message instead.
      drilldownJobsByRunId.set({ ...drilldownJobsByRunId(), [runId]: [] })
      drilldownError.set(e instanceof Error ? e.message : String(e))
    }
    finally {
      if (loadingJobsForRunId() === runId)
        loadingJobsForRunId.set(null)
    }
  }

  return {
    allRepos,
    runners,
    orgs,
    loading,
    error,
    disabled,
    lastFetched,
    activeTab,
    statusFilter,
    reposForTab,
    tabTotals,
    tabRunners,
    load,
    setActiveTab,
    setStatusFilter,
    // Drilldown (#1848)
    drilldown,
    drilldownRuns,
    loadingDrilldown,
    drilldownError,
    drilldownJobsByRunId,
    loadingJobsForRunId,
    expandedRunId,
    openDrilldown,
    closeDrilldown,
    toggleRunJobs,
    // Runner-pressure history (#1850)
    runnerHistoryByOrg,
    loadingRunnerHistory,
    loadRunnerHistory,
  }
}, {
  persist: {
    storage: 'sessionStorage',
    key: 'stacks-dashboard-ci',
    pick: ['activeTab', 'statusFilter'],
  },
})

if (typeof window !== 'undefined')
  registerStoresClient({ ciStore })
