import { boundedBody } from './library/archive.js'

export interface ReviewOsWorkflowRun {
  number: number
  state: string
  head_sha: string
  ref?: string
  trusted?: boolean
  jobs?: Array<Record<string, unknown>>
  [key: string]: unknown
}

export interface ReviewOsWorkflowArtifact {
  id: number
  name: string
  digest: string
  size_bytes: number
  expires_at?: string | null
}

export interface ReviewOsWorkflowOptions {
  origin: string
  repository: string
  /** Private repositories require an identity with workflow read/dispatch rights. */
  token?: string
  fetch?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
  signal?: AbortSignal
}

const states = new Set(['queued', 'running', 'waiting', 'paused', 'succeeded', 'failed', 'cancelled', 'skipped'])
function fail(reason: string): never { throw new Error(`ReviewOS workflow request blocked: ${reason}`) }
function positive(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) > 0 }
function workflowPath(value: string): string {
  const path = value.startsWith('.reviewos/workflows/') ? value : `.reviewos/workflows/${value}`
  if (!/^\.reviewos\/workflows\/[\w.-]+\.ya?ml$/.test(path)) fail('Expected a committed workflow file')
  return path
}
function summary(value: any): ReviewOsWorkflowRun {
  if (!value || !positive(value.number) || !states.has(value.state) || !/^[a-f0-9]{40}$/.test(value.head_sha)) fail('Invalid run source identity')
  return value
}

/** Public, bounded workflow metadata and dispatch. No controller database or runner credential. */
export function reviewOsWorkflows(options: ReviewOsWorkflowOptions) {
  const origin = new URL(options.origin)
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash
    || !/^[\w.-]+\/[\w.-]+$/.test(options.repository) || options.repository.split('/').some(part => part === '.' || part === '..')) fail('Expected a canonical HTTPS instance and owner/repository')
  const [owner, repo] = options.repository.split('/') as [string, string]
  const request = options.fetch ?? fetch
  async function read(path: string, query: Record<string, string> = {}, body?: unknown): Promise<any> {
    const url = new URL(`/api/repos/${path}`, origin)
    for (const [key, value] of Object.entries({ owner, repo, ...query })) url.searchParams.set(key, value)
    const response = await request(url.href, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error',
      headers: { accept: 'application/json', ...(options.token ? { authorization: `Bearer ${options.token}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    if (!response.ok) { await response.body?.cancel(); fail(`Metadata API returned HTTP ${response.status}`) }
    const bytes = await boundedBody(response, 1_048_576)
    try { return JSON.parse(Buffer.from(bytes).toString('utf8')) }
    catch { return fail('Metadata was not JSON') }
  }
  async function pages(path: string, field: string, query: Record<string, string> = {}): Promise<any[]> {
    const rows: any[] = [], cursors = new Set<string>()
    let cursor = ''
    for (let page = 0; page < 10; page++) {
      const data = await read(path, { ...query, per_page: '100', ...(cursor ? { cursor } : {}) })
      if (!Array.isArray(data[field])) fail('Invalid metadata collection')
      rows.push(...data[field])
      if (data.next === null) return rows
      if (typeof data.next !== 'string' || !data.next || cursors.has(data.next)) fail('Invalid metadata pagination')
      cursors.add(data.next)
      cursor = data.next
    }
    return fail('Metadata pagination exceeds its budget')
  }
  return {
    async runs(workflow: string, filter: { branch?: string, sha?: string } = {}): Promise<ReviewOsWorkflowRun[]> {
      const path = workflowPath(workflow)
      const workflows = (await pages('workflows', 'workflows')).filter(row => row.path === path && row.owner_defined !== true)
      if (!workflows.length) return []
      if (workflows.length !== 1 || !positive(workflows[0].id)) fail('Ambiguous workflow identity')
      if (filter.sha !== undefined && !/^[a-f0-9]{40}$/.test(filter.sha)) fail('Expected an exact source commit')
      const rows = (await pages('workflow-runs', 'workflow_runs', { workflow: String(workflows[0].id), ...(filter.branch ? { branch: filter.branch } : {}), ...(filter.sha ? { sha: filter.sha } : {}) })).map(summary)
      if (filter.sha && rows.some(row => row.head_sha !== filter.sha)) fail('Run collection changed source identity')
      if (new Set(rows.map(row => row.number)).size !== rows.length) fail('Duplicate run identity')
      return rows
    },
    async run(number: number): Promise<ReviewOsWorkflowRun> {
      if (!positive(number)) fail('Expected a run number')
      const run = summary((await read('workflow-runs/show', { number: String(number) })).workflow_run)
      if (run.number !== number || typeof run.trusted !== 'boolean' || typeof run.ref !== 'string' || !Array.isArray(run.jobs)) fail('Run detail changed identity or omitted execution metadata')
      return run
    },
    async dispatch(workflow: string, ref: string, inputs: Record<string, string | number | boolean> = {}): Promise<{ number: number, state: string }> {
      const path = workflowPath(workflow)
      if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs) || Object.entries(inputs).some(([key, value]) => !/^[\w.-]+$/.test(key) || !['string', 'number', 'boolean'].includes(typeof value) || typeof value === 'number' && !Number.isFinite(value))) fail('Expected scalar workflow input values')
      if (!ref || /[\r\n\x00]/.test(ref)) fail('Expected a source ref')
      const run = (await read('workflows/dispatch', {}, { owner, repo, workflow: path, ref, inputs })).workflow_run
      if (!run || !positive(run.number) || !states.has(run.state)) fail('Dispatch returned no run identity')
      return { number: run.number, state: run.state }
    },
    async artifacts(number: number): Promise<ReviewOsWorkflowArtifact[]> {
      if (!positive(number)) fail('Expected a run number')
      const rows = (await read('workflow-runs/artifacts', { number: String(number) })).artifacts
      if (!Array.isArray(rows) || rows.some(row => !positive(row.id) || typeof row.name !== 'string' || !row.name || !/^[a-f0-9]{64}$/.test(row.digest) || !Number.isSafeInteger(row.size_bytes) || row.size_bytes < 0)) fail('Invalid artifact identities')
      return rows
    },
  }
}
