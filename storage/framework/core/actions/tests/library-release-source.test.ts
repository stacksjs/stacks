import { expect, test } from 'bun:test'
import { acceptLibraryReleaseSource, evaluateLibrarySourceCi } from '../src/library/release-source'
import type { LibrarySourceRun } from '../src/library/release-source'

// Exact source/run/artifact ownership is the seam; provider authentication is external.
const source = { repository: 'example/libraries', commit: 'a'.repeat(40) }
const run: LibrarySourceRun = { id: 42, head_sha: source.commit, head_branch: 'main', event: 'push', path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success', repository: { id: 5, full_name: source.repository }, head_repository: { id: 5, full_name: source.repository }, run_attempt: 2 }
const jobs = [{ name: 'compile', status: 'completed', conclusion: 'success' }]
const artifact = { id: 8, name: 'library-candidate', expired: false, size_in_bytes: 1234, expires_at: '2099-01-01T00:00:00Z', digest: `sha256:${'b'.repeat(64)}`, workflow_run: { id: run.id, repository_id: 5, head_repository_id: 5, head_sha: source.commit } }
const policy = { source, runId: run.id, workflow: run.path, branch: 'main', requiredJobs: ['compile'], artifactName: artifact.name, verifierCommit: 'c'.repeat(40) }
function reader(change: { run?: unknown, jobs?: unknown[], artifacts?: unknown[] } = {}) {
  return async (url: string): Promise<Response> => {
    if (url.includes('/jobs?')) return Response.json({ jobs: change.jobs ?? jobs })
    if (url.includes('/artifacts?')) return Response.json({ artifacts: change.artifacts ?? [artifact] })
    return Response.json(change.run ?? run)
  }
}

test('accepts one same-repository exact-SHA artifact and records current verifier separately', async () => {
  const accepted = await acceptLibraryReleaseSource({ ...policy, fetch: reader() })
  expect(accepted.source.commit).toBe(source.commit)
  expect(accepted.verifierCommit).toBe('c'.repeat(40))
  expect(accepted.artifact.downloadUrl).toBe('https://api.github.com/repos/example/libraries/actions/artifacts/8/zip')
  expect(accepted.runAttempt).toBe(2)
})

test('selects the unique newest same-name artifact retained by a full CI rerun', async () => {
  const accepted = await acceptLibraryReleaseSource({ ...policy, fetch: reader({ artifacts: [artifact, { ...artifact, id: 7, expired: true }] }) })
  expect(accepted.artifact.id).toBe(8)
  expect(accepted.runAttempt).toBe(2)
  expect(accepted.artifact.downloadUrl).toBe('https://api.github.com/repos/example/libraries/actions/artifacts/8/zip')
})

test('rejects malformed or ambiguous latest IDs and never falls back from a newer invalid artifact', async () => {
  for (const artifacts of [
    [artifact, { ...artifact, id: 8 }],
    [artifact, { ...artifact, id: '9' }],
    [artifact, { ...artifact, id: 0 }],
    [artifact, { ...artifact, id: Number.MAX_SAFE_INTEGER + 1 }],
    [artifact, { ...artifact, id: 9, expired: true }],
    [artifact, { ...artifact, id: 9, digest: 'wrong' }],
    [artifact, { ...artifact, id: 9, workflow_run: { ...artifact.workflow_run, head_sha: 'f'.repeat(40) } }],
  ]) await expect(acceptLibraryReleaseSource({ ...policy, fetch: reader({ artifacts }) })).rejects.toThrow()
})

test('rejects another source, fork, branch, workflow, missing/duplicate jobs and expired/duplicate artifacts', async () => {
  for (const changed of [
    { ...run, head_sha: 'd'.repeat(40) }, { ...run, repository: { id: 6, full_name: 'other/libraries' } },
    { ...run, head_repository: { id: 6, full_name: 'fork/libraries' } }, { ...run, head_branch: 'feature' },
    { ...run, path: '.github/workflows/other.yml' }, { ...run, event: 'pull_request' },
  ]) await expect(acceptLibraryReleaseSource({ ...policy, fetch: reader({ run: changed }) })).rejects.toThrow('ownership differs')
  for (const changed of [[], [...jobs, jobs[0]], [{ ...jobs[0], conclusion: 'skipped' }]])
    await expect(acceptLibraryReleaseSource({ ...policy, fetch: reader({ jobs: changed }) })).rejects.toThrow('not accepted')
  for (const changed of [[], [artifact, artifact], [{ ...artifact, expired: true }], [{ ...artifact, workflow_run: { ...artifact.workflow_run, head_sha: 'f'.repeat(40) } }]])
    await expect(acceptLibraryReleaseSource({ ...policy, fetch: reader({ artifacts: changed }) })).rejects.toThrow()
})

test('shares failed-job retry eligibility without rerunning any provider operation', () => {
  const ci = { commit: source.commit, repository: source.repository, workflow: run.path, branch: 'main', requiredJobs: ['compile'] }
  const cancelled = [{ name: 'compile', status: 'completed', conclusion: 'cancelled', runner_id: 0, steps: [] }]
  expect(evaluateLibrarySourceCi(ci, [{ ...run, conclusion: 'failure' }], cancelled)).toEqual({ kind: 'starved', runId: 42, attempt: 2, jobs: ['compile'] })
  expect(evaluateLibrarySourceCi(ci, [{ ...run, conclusion: 'failure' }], [{ ...cancelled[0]!, runner_id: 7 }]).kind).toBe('rejected')
})
