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
