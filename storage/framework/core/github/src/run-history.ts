import { ghFetch, GITHUB_API } from './client'

/**
 * Recent-workflow-runs + per-run job detail for the dashboard CI
 * drilldown (stacksjs/stacks#1848).
 *
 * Distinct from `runs.ts` which is the *aggregator* — it folds the
 * latest run per repo into a `RepoStatus` for the at-a-glance card.
 * Here we want history: the last N runs for a single repo, plus the
 * per-job detail for a single run. Different shapes, different
 * callers, easier to keep them in separate files than to overload
 * one module.
 */

export interface WorkflowRun {
  id: number
  /** GH's `status` field: queued / in_progress / completed. */
  status: 'queued' | 'in_progress' | 'completed' | string
  /** GH's `conclusion` field: success / failure / cancelled / null
   *  (null while in flight). */
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | 'neutral' | 'startup_failure' | null
  /** Workflow display name. */
  name: string
  /** Branch / ref the run was triggered on. */
  headBranch: string | null
  headSha: string
  headShaShort: string
  commitMessage: string | null
  commitAuthor: string | null
  /** `push`, `pull_request`, `schedule`, …  */
  event: string
  url: string
  startedAt: string | null
  updatedAt: string
  /** Compute on the way out so the page can show "12m" without
   *  rolling its own diff. */
  durationMs: number | null
}

export interface WorkflowJob {
  id: number
  name: string
  status: 'queued' | 'in_progress' | 'completed' | string
  conclusion: WorkflowRun['conclusion']
  startedAt: string | null
  completedAt: string | null
  durationMs: number | null
  /** Direct link to GH's log viewer for this job. */
  url: string
  /** Step-level breakdown. UI usually only renders failed/cancelled
   *  steps but the full list is here for completeness. */
  steps: Array<{
    name: string
    status: WorkflowJob['status']
    conclusion: WorkflowRun['conclusion']
    number: number
  }>
}

interface FetchRunsOptions {
  /** Max runs to return. Defaults to 20. Hard-capped at 100 — anything
   *  larger should paginate (separate workstream). */
  limit?: number
  /** Filter to a specific branch. Defaults to no filter (every run on
   *  the default branch shows). */
  branch?: string
  /** Filter to a specific event type (`push`, `pull_request`, …). */
  event?: string
}

function shortSha(sha: string): string {
  return sha.length > 7 ? sha.slice(0, 7) : sha
}

function diffMs(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null
  const s = Date.parse(start)
  const e = Date.parse(end)
  if (Number.isNaN(s) || Number.isNaN(e)) return null
  if (e < s) return null
  return e - s
}

/**
 * The N most recent workflow runs for a repo. Each entry is a
 * lightweight summary — failed-job detail is fetched on-demand via
 * {@link fetchRunJobs} so the drawer only pays the round-trip cost
 * when the user actually expands a row.
 */
export async function fetchWorkflowRuns(
  owner: string,
  name: string,
  options: FetchRunsOptions = {},
): Promise<WorkflowRun[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 20, 100))
  const params = new URLSearchParams()
  params.set('per_page', String(limit))
  if (options.branch) params.set('branch', options.branch)
  if (options.event) params.set('event', options.event)

  const res = await ghFetch(`${GITHUB_API}/repos/${owner}/${name}/actions/runs?${params.toString()}`)
  if (!res.ok) return []

  const data = await res.json() as {
    workflow_runs?: Array<{
      id: number
      status: string
      conclusion: string | null
      name: string
      head_branch: string | null
      head_sha: string
      head_commit: { message: string, author: { name: string } | null } | null
      event: string
      html_url: string
      actor: { login: string } | null
      run_started_at: string | null
      created_at: string
      updated_at: string
    }>
  }
  const runs = data.workflow_runs ?? []

  return runs.map((r): WorkflowRun => ({
    id: r.id,
    status: r.status,
    conclusion: r.conclusion as WorkflowRun['conclusion'],
    name: r.name,
    headBranch: r.head_branch,
    headSha: r.head_sha,
    headShaShort: shortSha(r.head_sha),
    commitMessage: r.head_commit?.message?.split('\n')[0] ?? null,
    commitAuthor: r.head_commit?.author?.name ?? r.actor?.login ?? null,
    event: r.event,
    url: r.html_url,
    startedAt: r.run_started_at ?? r.created_at ?? null,
    updatedAt: r.updated_at,
    durationMs: diffMs(r.run_started_at ?? r.created_at, r.updated_at),
  }))
}

/**
 * Per-job detail for a single run. Used by the drilldown drawer when
 * the user expands a failing run to see *which* step broke. Different
 * shape from `fetchFailedJobs` in `runs.ts` (which is at-a-glance
 * "failed job names" for the card) — here we want everything,
 * including step-level breakdown + timing.
 *
 * Returns an empty array on error so the drawer can render an empty
 * state rather than a 500.
 */
export async function fetchRunJobs(
  owner: string,
  name: string,
  runId: number,
): Promise<WorkflowJob[]> {
  const res = await ghFetch(`${GITHUB_API}/repos/${owner}/${name}/actions/runs/${runId}/jobs?per_page=100`)
  if (!res.ok) return []

  const data = await res.json() as {
    jobs?: Array<{
      id: number
      name: string
      status: string
      conclusion: string | null
      started_at: string | null
      completed_at: string | null
      html_url: string
      steps?: Array<{
        name: string
        status: string
        conclusion: string | null
        number: number
      }>
    }>
  }
  const jobs = data.jobs ?? []

  return jobs.map((j): WorkflowJob => ({
    id: j.id,
    name: j.name,
    status: j.status,
    conclusion: j.conclusion as WorkflowJob['conclusion'],
    startedAt: j.started_at,
    completedAt: j.completed_at,
    durationMs: diffMs(j.started_at, j.completed_at),
    url: j.html_url,
    steps: (j.steps ?? []).map(s => ({
      name: s.name,
      status: s.status,
      conclusion: s.conclusion as WorkflowJob['conclusion'],
      number: s.number,
    })),
  }))
}
