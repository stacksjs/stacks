import process from 'node:process'

interface SourceRun {
  id: number
  head_sha: string
  head_branch: string
  event: string
  path: string
  status: string
  conclusion: string | null
}
interface SourceJob { name: string, status: string, conclusion: string | null }
type Decision = { kind: 'pending' } | { kind: 'accepted', runId: number } | { kind: 'rejected', runId: number, reason: string }

// Required source contracts. PR-only lock maintenance and the release commit's
// intentionally skipped publication commit are not execution evidence.
export const requiredSourceJobs = [
  'lint', 'typecheck', 'compile', 'artifact-freshness', 'scaffold-smoke',
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
  if (run.conclusion !== 'success') return { kind: 'rejected', runId: run.id, reason: `Source CI concluded ${run.conclusion}` }
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
  const read = (endpoint: string): unknown[] => {
    const result = Bun.spawnSync(['gh', 'api', '--paginate', '--slurp', endpoint], { stdout: 'pipe', stderr: 'pipe', timeout: 30_000 })
    if (result.exitCode !== 0) throw new Error(`Source CI API failed: ${result.stderr.toString().trim()}`)
    const pages: unknown = JSON.parse(result.stdout.toString())
    if (!Array.isArray(pages)) throw new Error('Source CI API returned invalid pages')
    return pages
  }
  const deadline = performance.now() + 40 * 60_000
  while (true) {
    const runs = read(`repos/${repository}/actions/workflows/ci.yml/runs?head_sha=${sha}&event=push&per_page=100`)
      .flatMap(page => (page as { workflow_runs: SourceRun[] }).workflow_runs)
    const latest = latestExactRun(sha, runs)
    const jobs = latest?.status === 'completed' && latest.conclusion === 'success'
      ? read(`repos/${repository}/actions/runs/${latest.id}/jobs?filter=latest&per_page=100`).flatMap(page => (page as { jobs: SourceJob[] }).jobs)
      : []
    const decision = evaluateReleaseCi(sha, runs, jobs)
    if (decision.kind === 'rejected') throw new Error(`${decision.reason}: https://github.com/${repository}/actions/runs/${decision.runId}`)
    if (decision.kind === 'accepted') {
      console.log(`Accepted exact release source ${sha}: https://github.com/${repository}/actions/runs/${decision.runId}`)
      break
    }
    if (performance.now() >= deadline) throw new Error(`Exact release source CI did not finish for ${sha}; publication remains blocked`)
    console.log(`Waiting for exact release source CI: ${sha}`)
    await Bun.sleep(10_000)
  }
}
