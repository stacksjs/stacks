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
