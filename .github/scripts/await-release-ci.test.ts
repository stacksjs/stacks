import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { evaluateReleaseCi, requiredSourceJobs } from './await-release-ci'

const sha = '7b4490c499c3a3aa85b21d8273289d457fbbc41c'
const run = { id: 42, head_sha: sha, head_branch: 'main', event: 'push', path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success' }
const jobs = () => requiredSourceJobs.map(name => ({ name, status: 'completed', conclusion: 'success' }))

test('only the latest completed exact main source with every required job can publish', () => {
  expect(evaluateReleaseCi(sha, [run], jobs())).toEqual({ kind: 'accepted', runId: 42 })
  expect(evaluateReleaseCi(sha, [{ ...run, id: 43, status: 'in_progress', conclusion: null }, run], jobs()).kind).toBe('pending')
  expect(evaluateReleaseCi(sha, [{ ...run, head_sha: 'a'.repeat(40) }], jobs()).kind).toBe('pending')
  expect(evaluateReleaseCi(sha, [{ ...run, event: 'pull_request' }], jobs()).kind).toBe('pending')
  expect(evaluateReleaseCi(sha, [{ ...run, head_branch: 'v0.75.425' }], jobs()).kind).toBe('pending')
  expect(evaluateReleaseCi(sha, [{ ...run, head_branch: 'feature' }], jobs()).kind).toBe('pending')
  expect(evaluateReleaseCi(sha, [{ ...run, path: '.github/workflows/other.yml' }], jobs()).kind).toBe('pending')
})

test('the actual 0.75.275 Windows failure blocks publication even if other source jobs passed', () => {
  const observed = jobs().map(job => job.name === 'Release evidence (windows-latest)' ? { ...job, conclusion: 'failure' } : job)
  expect(evaluateReleaseCi(sha, [{ ...run, conclusion: 'failure' }], observed)).toEqual({ kind: 'rejected', runId: 42, reason: 'Source CI concluded failure' })
  expect(evaluateReleaseCi(sha, [run], observed).kind).toBe('rejected')
})

test('missing, skipped, cancelled, duplicate or unfinished required jobs never count as green', () => {
  expect(evaluateReleaseCi(sha, [run], jobs().slice(1)).kind).toBe('rejected')
  for (const conclusion of ['skipped', 'cancelled', 'neutral', null])
    expect(evaluateReleaseCi(sha, [run], jobs().map((job, i) => i === 0 ? { ...job, conclusion } : job)).kind).toBe('rejected')
  expect(evaluateReleaseCi(sha, [run], [...jobs(), jobs()[0]!]).kind).toBe('rejected')
  expect(evaluateReleaseCi(sha, [run], jobs().map((job, i) => i === 0 ? { ...job, status: 'in_progress' } : job)).kind).toBe('rejected')
  expect(evaluateReleaseCi(sha, [{ ...run, conclusion: 'cancelled' }], jobs()).kind).toBe('rejected')
})

test('invalid source identity fails and registry writes depend on the source gate', () => {
  expect(() => evaluateReleaseCi('main', [run], jobs())).toThrow('commit')
  const workflow = Bun.YAML.parse(readFileSync(new URL('../workflows/release.yml', import.meta.url), 'utf8')) as any
  expect(workflow.jobs['release-gate'].needs).toContain('source-ci')
  expect(workflow.jobs['source-ci'].steps.some((step: any) => step.run === 'bun .github/scripts/await-release-ci.ts')).toBe(true)
  expect(workflow.jobs.npm.needs).toBe('release-gate')
})

test('native browser device-scale evidence is required before publication', () => {
  const withoutBrowser = jobs().filter(job => job.name !== 'browser-device-scale')
  expect(evaluateReleaseCi(sha, [run], withoutBrowser).kind).toBe('rejected')
  expect(evaluateReleaseCi(sha, [run], [...withoutBrowser, { name: 'browser-device-scale', status: 'completed', conclusion: 'skipped' }]).kind).toBe('rejected')
  expect(evaluateReleaseCi(sha, [run], [...withoutBrowser, { name: 'browser-device-scale', status: 'completed', conclusion: 'success' }])).toEqual({ kind: 'accepted', runId: 42 })
})

test('a source job no runner ever started is rerun, never accepted or treated as a failed check', () => {
  // The observed 2026-11-03 jobs: cancelled 15 minutes after queueing, runner_id 0, no steps.
  const starved = { status: 'completed', conclusion: 'cancelled', runner_id: 0, steps: [] }
  const observed = jobs().map(job => job.name === 'Release evidence (macos-arm64)' ? { ...job, ...starved } : job)
  const failed = { ...run, conclusion: 'failure', run_attempt: 2 }
  expect(evaluateReleaseCi(sha, [failed], observed)).toEqual({ kind: 'starved', runId: 42, attempt: 2, jobs: ['Release evidence (macos-arm64)'] })
  // A run's own success is still required: a starved job can never be accepted.
  expect(evaluateReleaseCi(sha, [run], observed).kind).toBe('rejected')
  // Any job that started and did not succeed is a real failure.
  const alsoFailed = observed.map(job => job.name === 'Release evidence (windows-latest)' ? { ...job, conclusion: 'failure', runner_id: 7, steps: [{}] } : job)
  expect(evaluateReleaseCi(sha, [failed], alsoFailed).kind).toBe('rejected')
  const cancelledMidRun = jobs().map(job => job.name === 'Release evidence (macos-arm64)' ? { ...job, ...starved, runner_id: 7, steps: [{}] } : job)
  expect(evaluateReleaseCi(sha, [failed], cancelledMidRun).kind).toBe('rejected')
  expect(evaluateReleaseCi(sha, [{ ...failed, conclusion: 'timed_out' }], observed).kind).toBe('rejected')
  expect(evaluateReleaseCi(sha, [failed], jobs()).kind).toBe('rejected')
})

test('only source acceptance may rerun CI jobs', () => {
  const release = Bun.YAML.parse(readFileSync(new URL('../workflows/release.yml', import.meta.url), 'utf8')) as any
  expect(release.jobs['source-ci'].permissions).toEqual({ contents: 'read', actions: 'write' })
  expect(release.permissions.actions).toBe('read')
})


test('manual recovery accepts only complete exact-main CI and an immutable release tag', () => {
  const manual = { ...run, event: 'workflow_dispatch' }
  expect(evaluateReleaseCi(sha, [manual], jobs())).toEqual({ kind: 'accepted', runId: 42 })
  for (const head_branch of ['feature', 'v0.75.466'])
    expect(evaluateReleaseCi(sha, [{ ...manual, head_branch }], jobs()).kind).toBe('pending')
  expect(evaluateReleaseCi(sha, [{ ...manual, head_sha: 'a'.repeat(40) }], jobs()).kind).toBe('pending')
  expect(evaluateReleaseCi(sha, [manual], jobs().slice(1)).kind).toBe('rejected')
  expect(evaluateReleaseCi(sha, [{ ...manual, conclusion: 'failure' }], jobs()).kind).toBe('rejected')
  expect(evaluateReleaseCi(sha, [run, { ...manual, id: 43, status: 'in_progress', conclusion: null }], jobs()).kind).toBe('pending')
  const workflow = Bun.YAML.parse(readFileSync(new URL('../workflows/release.yml', import.meta.url), 'utf8')) as any
  expect(workflow.on).toHaveProperty('workflow_dispatch')
  expect(workflow.jobs.serialize.if).toBe("startsWith(github.ref, 'refs/tags/v')")
  expect(workflow.jobs['source-ci'].needs).toBe('serialize')
  expect(workflow.jobs['release-gate'].needs).toEqual(['serialize', 'source-ci'])
  expect(workflow.jobs.npm.needs).toBe('release-gate')
})
