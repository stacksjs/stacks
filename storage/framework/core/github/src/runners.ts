import { ghFetch, GITHUB_API } from './client'

/**
 * Count jobs (not runs) currently using runners. A workflow run can be
 * "in_progress" while some of its matrix jobs are still queued — only the
 * actually-running jobs occupy runners, so we sum at the job level.
 */
export async function fetchRepoActiveRuns(owner: string, name: string): Promise<{ running: number, queued: number }> {
  try {
    const runRes = await ghFetch(`${GITHUB_API}/repos/${owner}/${name}/actions/runs?status=in_progress&per_page=100`)
    if (!runRes.ok)
      return { running: 0, queued: 0 }

    const runData = await runRes.json() as { workflow_runs: Array<{ id: number }> }
    const runs = runData.workflow_runs ?? []
    if (runs.length === 0)
      return { running: 0, queued: 0 }

    const counts = await Promise.all(runs.map(async (r) => {
      const jobsRes = await ghFetch(`${GITHUB_API}/repos/${owner}/${name}/actions/runs/${r.id}/jobs`)
      if (!jobsRes.ok)
        return { running: 0, queued: 0 }
      const jobsData = await jobsRes.json() as { jobs: Array<{ status: string }> }
      let running = 0
      let queued = 0
      for (const j of jobsData.jobs ?? []) {
        if (j.status === 'in_progress')
          running++
        else if (j.status === 'queued')
          queued++
      }
      return { running, queued }
    }))

    return counts.reduce(
      (a, b) => ({ running: a.running + b.running, queued: a.queued + b.queued }),
      { running: 0, queued: 0 },
    )
  }
  catch {
    return { running: 0, queued: 0 }
  }
}
