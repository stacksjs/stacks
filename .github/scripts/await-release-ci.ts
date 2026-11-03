import process from 'node:process'

interface SourceRun {
  id: number
  head_sha: string
  head_branch: string
  event: string
  path: string
  status: string
  conclusion: string | null
  run_attempt?: number
}
interface SourceJob { name: string, status: string, conclusion: string | null, runner_id?: number | null, steps?: unknown[] }
type Decision = { kind: 'pending' }
  | { kind: 'accepted', runId: number }
  | { kind: 'rejected', runId: number, reason: string }
  | { kind: 'starved', runId: number, attempt: number, jobs: string[] }

/** How many times one release asks GitHub to run jobs that never got a runner. */
export const STARVED_RERUNS = 3

/**
 * A job GitHub cancelled before any runner took it: no runner, no step ran.
 * The macOS release-evidence job sat queued for 15 minutes and was cancelled
 * this way five times on 2026-11-03 (runner_id 0, no steps), and each time the
 * release failed as though the ownership checks had. Nothing was executed, so
 * nothing was proven either way.
 */
export function neverStarted(job: SourceJob): boolean {
  return job.status === 'completed' && job.conclusion === 'cancelled' && !job.runner_id && (job.steps?.length ?? 0) === 0
}

// Required source contracts. PR-only lock maintenance and the release commit's
// intentionally skipped publication commit are not execution evidence.
export const requiredSourceJobs = [
  'lint', 'typecheck', 'compile', 'artifact-freshness', 'scaffold-smoke', 'browser-device-scale',
  'test (auth-1)', 'test (auth-2)', 'test (auth-3)', 'test (auth-4)',
  'test (buddy)', 'test (core-1)', 'test (core-2)',
  'Release evidence (ubuntu-latest)', 'Release evidence (macos-latest)', 'Release evidence (windows-latest)',
  'deployment-target', 'deploy',
]

function latestExactRun(sha: string, runs: SourceRun[]): SourceRun | undefined {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Expected the exact release commit')
  return runs.filter(run => Number.isSafeInteger(run.id) && run.id > 0 && run.head_sha === sha
    && run.head_branch === 'main' && run.event === 'push' && run.path === '.github/workflows/ci.yml')
    .sort((a, b) => b.id - a.id)[0]
}

/** No earlier green run, missing job or incomplete execution can permit a write. */
export function evaluateReleaseCi(sha: string, runs: SourceRun[], jobs: SourceJob[]): Decision {
  const run = latestExactRun(sha, runs)
  if (!run || run.status !== 'completed') return { kind: 'pending' }
  if (run.conclusion !== 'success') {
    // Only when every unsuccessful job never started: a job that ran and
    // failed, timed out or was cancelled mid-run still rejects the release.
    const unsuccessful = jobs.filter(job => job.conclusion !== 'success' && job.conclusion !== 'skipped')
    if ((run.conclusion === 'failure' || run.conclusion === 'cancelled') && unsuccessful.length && unsuccessful.every(neverStarted))
      return { kind: 'starved', runId: run.id, attempt: run.run_attempt ?? 1, jobs: unsuccessful.map(job => job.name) }
    return { kind: 'rejected', runId: run.id, reason: `Source CI concluded ${run.conclusion}` }
  }
  for (const name of requiredSourceJobs) {
    const matches = jobs.filter(job => job.name === name)
    if (matches.length !== 1 || matches[0]?.status !== 'completed' || matches[0].conclusion !== 'success')
      return { kind: 'rejected', runId: run.id, reason: `Required source job did not succeed exactly once: ${name}` }
  }
  return { kind: 'accepted', runId: run.id }
}

if (import.meta.main) {
  const repository = process.env.GITHUB_REPOSITORY
  const sha = process.env.GITHUB_SHA ?? ''
  if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Expected the release repository')
  latestExactRun(sha, [])
  const gh = (args: string[]): string => {
    const result = Bun.spawnSync(['gh', 'api', ...args], { stdout: 'pipe', stderr: 'pipe', timeout: 30_000 })
    if (result.exitCode !== 0) throw new Error(`Source CI API failed: ${result.stderr.toString().trim()}`)
    return result.stdout.toString()
  }
  const read = (endpoint: string): unknown[] => {
    const pages: unknown = JSON.parse(gh(['--paginate', '--slurp', endpoint]))
    if (!Array.isArray(pages)) throw new Error('Source CI API returned invalid pages')
    return pages
  }
  // Include time queued behind an earlier full CI/deployment run. Publication
  // still requires every job to succeed on this exact immutable source.
  const deadline = performance.now() + 90 * 60_000
  let reruns = 0
  let rerunAttempt = 0
  while (true) {
    const runs = read(`repos/${repository}/actions/workflows/ci.yml/runs?head_sha=${sha}&event=push&per_page=100`)
      .flatMap(page => (page as { workflow_runs: SourceRun[] }).workflow_runs)
    const latest = latestExactRun(sha, runs)
    // The attempt this release asked for has not replaced the starved one yet.
    const awaitingRerun = latest !== undefined && (latest.run_attempt ?? 1) <= rerunAttempt
    const jobs = latest?.status === 'completed' && !awaitingRerun
      ? read(`repos/${repository}/actions/runs/${latest.id}/jobs?filter=latest&per_page=100`).flatMap(page => (page as { jobs: SourceJob[] }).jobs)
      : []
    const decision = awaitingRerun ? { kind: 'pending' as const } : evaluateReleaseCi(sha, runs, jobs)
    if (decision.kind === 'rejected') throw new Error(`${decision.reason}: https://github.com/${repository}/actions/runs/${decision.runId}`)
    if (decision.kind === 'accepted') {
      console.log(`Accepted exact release source ${sha}: https://github.com/${repository}/actions/runs/${decision.runId}`)
      break
    }
    if (decision.kind === 'starved') {
      const where = `https://github.com/${repository}/actions/runs/${decision.runId}`
      if (reruns >= STARVED_RERUNS || performance.now() >= deadline)
        throw new Error(`No runner ever started ${decision.jobs.join(', ')} after ${reruns} rerun(s): ${where}`)
      reruns++
      rerunAttempt = decision.attempt
      console.log(`::warning::No runner ever started ${decision.jobs.join(', ')}; running the failed jobs again (${reruns} of ${STARVED_RERUNS}): ${where}`)
      gh(['--method', 'POST', `repos/${repository}/actions/runs/${decision.runId}/rerun-failed-jobs`])
    }
    if (performance.now() >= deadline) throw new Error(`Exact release source CI did not finish for ${sha}; publication remains blocked`)
    console.log(`Waiting for exact release source CI: ${sha}`)
    await Bun.sleep(10_000)
  }
}
