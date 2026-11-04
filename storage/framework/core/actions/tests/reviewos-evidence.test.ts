import type { ReviewOsEvidencePlan } from '../src/reviewos-evidence'
import { expect, test } from 'bun:test'
import { evaluateReviewOsEvidence, inspectReviewOsEvidence } from '../src/reviewos-evidence'

// Public package function seam: catches false publication evidence; actual
// runner execution is qualified separately through the normal forge workflow.
const plan: ReviewOsEvidencePlan = {
  origin: 'https://reviewos.org', owner: 'stacks', repository: 'stacks',
  commit: 'a'.repeat(40), workflow: '.reviewos/workflows/release-evidence.yml',
  workflowDigest: 'b'.repeat(64), job: 'macos', labels: ['self-hosted', 'macos-arm64'],
  steps: ['Verify native platform', 'Build source packages', 'Verify release evidence', 'Stress immediate exit ordering'],
}
function evidence(): any {
  return { workflow_run: {
    number: 12, head_sha: plan.commit, trusted: true, ref: 'refs/heads/main', event: 'push', state: 'succeeded',
    workflow: { path: plan.workflow, owner_defined: false }, version: { path: plan.workflow, digest: plan.workflowDigest },
    jobs: [{ job_id: 'macos', state: 'succeeded', runner: '2', started_at: '2026-11-04T18:00:00Z', finished_at: '2026-11-04T18:02:00Z', resume_from_step: null,
      runs_on: plan.labels, steps: plan.steps.map(name => ({ name, state: 'succeeded', exit_code: 0, started_at: '2026-11-04T18:00:00Z', finished_at: '2026-11-04T18:01:00Z', reused_from_attempt: null })) }],
  } }
}

test('accepts only fully executed trusted main evidence from the committed workflow bytes', () => {
  expect(evaluateReviewOsEvidence(plan, evidence())).toEqual({ state: 'accepted', number: 12, url: 'https://reviewos.org/stacks/stacks/run/12' })
  for (const change of [
    { head_sha: 'c'.repeat(40) }, { trusted: false }, { ref: 'refs/heads/feature' }, { event: 'pull_request' },
    { workflow: { path: plan.workflow, owner_defined: true } }, { version: { path: plan.workflow, digest: 'c'.repeat(64) } },
  ]) expect(() => evaluateReviewOsEvidence(plan, { workflow_run: { ...evidence().workflow_run, ...change } })).toThrow('trusted main')
})

test('cancelled, skipped, resumed and runnerless executions never become release evidence', () => {
  for (const state of ['cancelled', 'failed', 'skipped']) {
    const value = evidence(); value.workflow_run.state = state
    expect(() => evaluateReviewOsEvidence(plan, value)).toThrow('concluded')
  }
  for (const change of [{ runner: null }, { resume_from_step: 2 }, { state: 'skipped' }, { runs_on: ['ubuntu-latest'] }, { steps: [] }]) {
    const value = evidence(); Object.assign(value.workflow_run.jobs[0], change)
    expect(() => evaluateReviewOsEvidence(plan, value)).toThrow()
  }
  for (const change of [{ state: 'pending' }, { exit_code: 1 }, { reused_from_attempt: 1 }, { started_at: null }]) {
    const value = evidence(); Object.assign(value.workflow_run.jobs[0].steps[0], change)
    expect(() => evaluateReviewOsEvidence(plan, value)).toThrow('Required step')
  }
  const duplicate = evidence(); duplicate.workflow_run.jobs.push(duplicate.workflow_run.jobs[0])
  expect(() => evaluateReviewOsEvidence(plan, duplicate)).toThrow('required job')
})

test('reads the latest exact-source run through public paginated metadata without credentials', async () => {
  const calls: URL[] = []
  const request = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input)); calls.push(url)
    expect(init?.redirect).toBe('error')
    expect(new Headers(init?.headers).has('authorization')).toBe(false)
    if (url.pathname.endsWith('/workflows'))
      return Response.json({ workflows: url.searchParams.has('cursor') ? [{ id: 9, path: plan.workflow }] : [], next: url.searchParams.has('cursor') ? null : 'page-two' })
    if (url.pathname.endsWith('/workflow-runs')) {
      expect(url.searchParams.get('sha')).toBe(plan.commit)
      expect(url.searchParams.get('branch')).toBe('main')
      expect(url.searchParams.get('workflow')).toBe('9')
      return Response.json({ workflow_runs: [{ number: 11, head_sha: plan.commit }, { number: 12, head_sha: plan.commit }], next: null })
    }
    expect(url.searchParams.get('number')).toBe('12')
    const latest = evidence(); latest.workflow_run.state = 'failed'
    return Response.json(latest)
  }) as typeof fetch
  await expect(inspectReviewOsEvidence(plan, { fetch: request })).rejects.toThrow('Run 12 concluded failed')
  expect(calls).toHaveLength(4)
})

test('waits for a registered workflow and rejects redirects, cyclic pages and oversized responses', async () => {
  const empty = (async () => Response.json({ workflows: [], next: null })) as typeof fetch
  expect(await inspectReviewOsEvidence(plan, { fetch: empty })).toEqual({ state: 'pending' })
  const cyclic = (async () => Response.json({ workflows: [], next: 'same-page' })) as typeof fetch
  await expect(inspectReviewOsEvidence(plan, { fetch: cyclic })).rejects.toThrow('pagination')
  const excessive = (async () => new Response(' '.repeat(1_048_577))) as typeof fetch
  await expect(inspectReviewOsEvidence(plan, { fetch: excessive })).rejects.toThrow('byte budget')
  await expect(inspectReviewOsEvidence({ ...plan, origin: 'http://reviewos.org' })).rejects.toThrow('HTTPS')
})
