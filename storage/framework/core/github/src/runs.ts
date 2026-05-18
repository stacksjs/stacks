import type { FailedJob, RepoStatus } from './types'
import { ghFetch, GITHUB_API } from './client'

async function fillLatestCommit(base: RepoStatus, owner: string, name: string, branch: string): Promise<void> {
  try {
    const res = await ghFetch(`${GITHUB_API}/repos/${owner}/${name}/commits?sha=${branch}&per_page=1`)
    if (!res.ok)
      return

    const commits = await res.json() as Array<{
      sha: string
      commit: { message: string, author: { name: string, date: string } | null }
      author: { login: string } | null
    }>
    if (commits.length === 0)
      return

    const c = commits[0]
    base.commitSha = c.sha.slice(0, 7)
    base.commitMessage = c.commit.message.split('\n')[0]
    base.commitUrl = `https://github.com/${owner}/${name}/commit/${c.sha}`
    base.commitAuthor = c.commit.author?.name ?? c.author?.login ?? null
    base.updatedAt = c.commit.author?.date ?? null
  }
  catch {
    // commit info is best-effort
  }
}

export async function fetchFailedJobs(owner: string, name: string, runId: number): Promise<FailedJob[]> {
  try {
    const res = await ghFetch(`${GITHUB_API}/repos/${owner}/${name}/actions/runs/${runId}/jobs?filter=latest`)
    if (!res.ok)
      return []

    const data = await res.json() as { jobs: Array<{ name: string, conclusion: string | null, html_url: string }> }
    return data.jobs
      .filter(j => j.conclusion && j.conclusion !== 'success' && j.conclusion !== 'skipped')
      .map(j => ({ name: j.name, conclusion: j.conclusion!, url: j.html_url }))
  }
  catch {
    return []
  }
}

export async function fetchRepoStatus(owner: string, name: string, defaultBranch: string): Promise<RepoStatus> {
  const base: RepoStatus = {
    name,
    owner,
    fullName: `${owner}/${name}`,
    url: `https://github.com/${owner}/${name}`,
    defaultBranch,
    status: 'no_runs',
    conclusion: null,
    workflowName: null,
    commitSha: null,
    commitMessage: null,
    commitUrl: null,
    commitAuthor: null,
    commitCount: null,
    updatedAt: null,
    runUrl: null,
    failedJobs: [],
    renovatePRs: 0,
    renovatePRsUrl: null,
    actionsPRs: 0,
    actionsPRsUrl: null,
  }

  try {
    const res = await ghFetch(`${GITHUB_API}/repos/${owner}/${name}/actions/runs?branch=${defaultBranch}&event=push&per_page=1`)

    if (!res.ok) {
      base.status = 'error'
      await fillLatestCommit(base, owner, name, defaultBranch)
      return base
    }

    const data = await res.json() as {
      workflow_runs: Array<{
        id: number
        status: string
        conclusion: string | null
        name: string
        head_sha: string
        head_commit: { message: string, author: { name: string } | null } | null
        updated_at: string
        html_url: string
        actor: { login: string } | null
      }>
    }

    if (!data.workflow_runs || data.workflow_runs.length === 0) {
      await fillLatestCommit(base, owner, name, defaultBranch)
      return base
    }

    const run = data.workflow_runs[0]
    base.workflowName = run.name
    base.commitSha = run.head_sha.slice(0, 7)
    base.commitMessage = run.head_commit?.message.split('\n')[0] ?? null
    base.commitUrl = `https://github.com/${owner}/${name}/commit/${run.head_sha}`
    base.commitAuthor = run.head_commit?.author?.name ?? run.actor?.login ?? null
    base.updatedAt = run.updated_at
    base.runUrl = run.html_url

    if (run.status === 'completed') {
      base.status = run.conclusion === 'success' ? 'success' : 'failure'
      base.conclusion = run.conclusion

      if (base.status === 'failure')
        base.failedJobs = await fetchFailedJobs(owner, name, run.id)
    }
    else {
      base.status = 'pending'
      base.conclusion = run.status
    }
  }
  catch {
    base.status = 'error'
  }

  return base
}
