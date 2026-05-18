export interface FailedJob {
  name: string
  conclusion: string
  url: string
}

export type RepoStatusKind = 'success' | 'failure' | 'pending' | 'no_runs' | 'error'

export interface RepoStatus {
  name: string
  owner: string
  fullName: string
  url: string
  defaultBranch: string
  status: RepoStatusKind
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

export interface OrgRunnerUsage {
  running: number
  queued: number
  cap: number
}

export interface DashboardData {
  repos: RepoStatus[]
  fetchedAt: string
  total: number
  passing: number
  failing: number
  pending: number
  noRuns: number
  runners: Record<string, OrgRunnerUsage>
}

export interface DashboardOptions {
  /** Orgs to include in the snapshot. */
  orgs: string[]
  /** Self-hosted runner caps per org. Missing entries fall back to {@link defaultRunnerCap}. */
  runnerCaps?: Record<string, number>
  /** Fallback runner cap when {@link runnerCaps} omits an org. */
  defaultRunnerCap?: number
  /** Repo names to exclude (matches against the bare repo name). */
  ignoreRepos?: string[]
  /** Cache TTL in ms. Defaults to 30s. */
  cacheTtlMs?: number
  /** On-disk cache path. Defaults to `.cache/dashboard.json`. */
  cachePath?: string
}

export interface Repo {
  name: string
  owner: string
  full_name: string
  html_url: string
  default_branch: string
  archived: boolean
}
