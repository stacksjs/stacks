import { reviewOsWorkflows } from './reviewos-workflows.js'

export interface ReviewOsEvidencePlan {
  origin: string
  owner: string
  repository: string
  commit: string
  workflow: string
  /** SHA-256 of the committed workflow bytes, including comments. */
  workflowDigest: string
  job: string
  labels: string[]
  steps: string[]
}

type Decision = { state: 'pending' } | { state: 'accepted', number: number, url: string }

function blocked(reason: string): never {
  throw new Error(`ReviewOS evidence blocked: ${reason}`)
}

function validate(plan: ReviewOsEvidencePlan): URL {
  const origin = new URL(plan.origin)
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash
    || !/^[\w.-]+$/.test(plan.owner) || !/^[\w.-]+$/.test(plan.repository)
    || !/^[a-f0-9]{40}$/.test(plan.commit) || !/^[a-f0-9]{64}$/.test(plan.workflowDigest)
    || !/^\.reviewos\/workflows\/[\w.-]+\.ya?ml$/.test(plan.workflow)
    || !plan.job || !plan.labels.length || !plan.steps.length
    || [...plan.labels, ...plan.steps].some(value => typeof value !== 'string' || !value)
    || new Set(plan.steps).size !== plan.steps.length)
    blocked('Expected an HTTPS forge, exact source and workflow identities, job, labels and steps')
  return origin
}

/** Verify execution, rather than treating a completed/cancelled run as proof. */
export function evaluateReviewOsEvidence(plan: ReviewOsEvidencePlan, value: unknown): Decision {
  const origin = validate(plan)
  const run = (value as any)?.workflow_run
  if (!run || !Number.isSafeInteger(run.number) || run.number <= 0
    || run.head_sha !== plan.commit || run.trusted !== true || run.ref !== 'refs/heads/main'
    || !['push', 'workflow_dispatch'].includes(run.event)
    || run.workflow?.path !== plan.workflow || run.workflow?.owner_defined !== false
    || run.version?.path !== plan.workflow || run.version?.digest !== plan.workflowDigest)
    blocked('The run does not identify the trusted main source and committed workflow')
  if (['queued', 'running', 'waiting', 'paused'].includes(run.state)) return { state: 'pending' }
  if (run.state !== 'succeeded') blocked(`Run ${run.number} concluded ${String(run.state)}`)
  if (!Array.isArray(run.jobs)) blocked('The run has no job evidence')
  const jobs = run.jobs.filter((job: any) => job.job_id === plan.job)
  const job = jobs[0]
  if (jobs.length !== 1 || job.state !== 'succeeded' || !job.runner || !job.started_at || !job.finished_at
    || job.resume_from_step !== null || !Array.isArray(job.runs_on)
    || plan.labels.some(label => !job.runs_on.includes(label)) || !Array.isArray(job.steps))
    blocked('The required job did not execute fully on the declared runner')
  for (const name of plan.steps) {
    const steps = job.steps.filter((step: any) => step.name === name)
    const step = steps[0]
    if (steps.length !== 1 || step.state !== 'succeeded' || step.exit_code !== 0
      || !step.started_at || !step.finished_at || step.reused_from_attempt != null)
      blocked(`Required step did not execute successfully: ${name}`)
  }
  return { state: 'accepted', number: run.number, url: new URL(`/${plan.owner}/${plan.repository}/run/${run.number}`, origin).href }
}

/** Read execution metadata through the forge API; never a runner or controller credential. */
export async function inspectReviewOsEvidence(plan: ReviewOsEvidencePlan, options: {
  fetch?: typeof fetch
  signal?: AbortSignal
  /** A normal workflow-read identity for a private repository. */
  token?: string
} = {}): Promise<Decision> {
  const origin = validate(plan)
  const client = reviewOsWorkflows({ origin: origin.origin, repository: `${plan.owner}/${plan.repository}`, ...options })
  try {
    const runs = await client.runs(plan.workflow, { sha: plan.commit, branch: 'main' })
    const newest = runs.sort((a, b) => b.number - a.number)[0]
    if (!newest) return { state: 'pending' }
    return evaluateReviewOsEvidence(plan, { workflow_run: await client.run(newest.number) })
  }
  catch (error) {
    return blocked(error instanceof Error ? error.message : 'Could not inspect workflow execution')
  }
}
