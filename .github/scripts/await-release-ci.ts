import process from 'node:process'

import { evaluateLibrarySourceCi, latestLibrarySourceRun, sourceJobNeverStarted } from '../../storage/framework/core/actions/src/library/release-source'
import type { LibrarySourceRun as SourceRun, LibrarySourceJob as SourceJob } from '../../storage/framework/core/actions/src/library/release-source'

/** How many times one release asks GitHub to run jobs that never got a runner. */
export const STARVED_RERUNS = 3
export const neverStarted = sourceJobNeverStarted

// Required source contracts. PR-only lock maintenance and the release commit's
// intentionally skipped publication commit are not execution evidence.
export const requiredSourceJobs = [
  'lint', 'typecheck', 'compile', 'artifact-freshness', 'scaffold-smoke', 'browser-device-scale',
  'test (auth-1)', 'test (auth-2)', 'test (auth-3)', 'test (auth-4)',
  'test (buddy)', 'test (core-1)', 'test (core-2)',
  'Release evidence (ubuntu-latest)', 'Release evidence (macos-arm64)', 'Release evidence (windows-latest)',
  'deployment-target', 'deploy',
]

/** A manual run executes the same protected main workflow and every required job. */
function sourcePolicy(sha: string) {
  return { commit: sha, branch: 'main', workflow: '.github/workflows/ci.yml', requiredJobs: requiredSourceJobs }
}
function latestExactRun(sha: string, runs: SourceRun[]): SourceRun | undefined {
  return latestLibrarySourceRun(sourcePolicy(sha), runs)
}

/** Existing framework required jobs and retry gates remain unchanged. */
export function evaluateReleaseCi(sha: string, runs: SourceRun[], jobs: SourceJob[]) {
  return evaluateLibrarySourceCi(sourcePolicy(sha), runs, jobs)
}

/** Whether a failed `gh api` call is worth retrying: GitHub's side, not ours. */
export function isTransientApiFailure(stderr: string, exitCode: number | null): boolean {
  if (exitCode === null) return true
  return /HTTP (5\d\d|429)\b|rate limit|timed? ?out|timeout|connection (reset|refused)|EOF|TLS handshake/i.test(stderr)
}

if (import.meta.main) {
  const repository = process.env.GITHUB_REPOSITORY
  const sha = process.env.GITHUB_SHA ?? ''
  if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Expected the release repository')
  latestExactRun(sha, [])
  const gh = (args: string[]): string => {
    // A transient GitHub error (a 5xx, 429 or rate limit, a timeout or a
    // dropped connection) is retried with backoff instead of failing the gate
    // while the CI it waits on is still running and may well pass.
    for (let attempt = 1; ; attempt++) {
      const result = Bun.spawnSync(['gh', 'api', ...args], { stdout: 'pipe', stderr: 'pipe', timeout: 30_000 })
      if (result.exitCode === 0) return result.stdout.toString()
      const error = result.stderr.toString().trim()
      if (attempt >= 4 || !isTransientApiFailure(error, result.exitCode)) throw new Error(`Source CI API failed: ${error}`)
      Bun.sleepSync(2_000 * 2 ** attempt)
    }
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
    const runs = read(`repos/${repository}/actions/workflows/ci.yml/runs?head_sha=${sha}&per_page=100`)
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
