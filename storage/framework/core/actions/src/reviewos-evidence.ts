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

/** Read public execution metadata through the forge API; no runner or admin credential. */
export async function inspectReviewOsEvidence(plan: ReviewOsEvidencePlan, options: {
  fetch?: typeof fetch
  signal?: AbortSignal
} = {}): Promise<Decision> {
  const origin = validate(plan)
  const request = options.fetch ?? fetch
  async function read(path: string, values: Record<string, string>): Promise<any> {
    const url = new URL(`/api/repos/${path}`, origin)
    for (const [name, value] of Object.entries({ owner: plan.owner, repo: plan.repository, ...values })) url.searchParams.set(name, value)
    const response = await request(url.href, {
      redirect: 'error', headers: { accept: 'application/json' },
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000),
    })
    if (!response.ok) blocked(`Metadata API returned HTTP ${response.status}`)
    if (!response.body) blocked('Metadata API returned no body')
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const part = await reader.read()
        if (part.done) break
        size += part.value.byteLength
        if (size > 1_048_576) blocked('Metadata exceeds its byte budget')
        chunks.push(part.value)
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'))
    }
    finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
  }
  async function pages(path: string, field: string, values: Record<string, string>): Promise<any[]> {
    const rows: any[] = []
    const cursors = new Set<string>()
    let cursor = ''
    for (let page = 0; page < 10; page++) {
      const data = await read(path, { ...values, per_page: '100', ...(cursor ? { cursor } : {}) })
      if (!Array.isArray(data[field])) blocked('Metadata API returned an invalid collection')
      rows.push(...data[field])
      if (data.next === null) return rows
      if (typeof data.next !== 'string' || !data.next || cursors.has(data.next)) blocked('Invalid metadata pagination')
      cursors.add(data.next)
      cursor = data.next
    }
    return blocked('Metadata exceeds its page budget')
  }
  const workflows = (await pages('workflows', 'workflows', {})).filter(row => row.path === plan.workflow)
  if (!workflows.length) return { state: 'pending' }
  if (workflows.length !== 1 || !Number.isSafeInteger(workflows[0].id) || workflows[0].id <= 0) blocked('Workflow identity is ambiguous')
  const runs = await pages('workflow-runs', 'workflow_runs', { workflow: String(workflows[0].id), sha: plan.commit, branch: 'main' })
  if (runs.some(row => row.head_sha !== plan.commit || !Number.isSafeInteger(row.number) || row.number <= 0)) blocked('Run collection has an invalid source identity')
  const newest = runs.sort((a, b) => b.number - a.number)[0]
  if (!newest) return { state: 'pending' }
  const detail = await read('workflow-runs/show', { number: String(newest.number) })
  if (detail?.workflow_run?.number !== newest.number) blocked('Run detail does not match the selected run')
  return evaluateReviewOsEvidence(plan, detail)
}
