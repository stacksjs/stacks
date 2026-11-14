import type { LibraryReleaseSource } from './release-artifacts'
import type { LibraryNetworkOptions } from './release-network'
import { validateLibraryReleaseSource } from './release-artifacts'
import { createLibraryReleaseReader } from './release-network'

export interface LibrarySourceRun {
  id: number
  head_sha: string
  head_branch: string
  event: string
  path: string
  status: string
  conclusion: string | null
  run_attempt?: number
  repository?: { id?: number, full_name?: string }
  head_repository?: { id?: number, full_name?: string }
}
export interface LibrarySourceJob { name: string, status: string, conclusion: string | null, runner_id?: number | null, steps?: unknown[] }
export interface LibrarySourcePolicy {
  commit: string
  workflow: string
  branch: string
  requiredJobs: string[]
  events?: string[]
  /** Omit only when the caller has already scoped/trusted source ownership. */
  repository?: string
}
export type LibrarySourceDecision = { kind: 'pending' }
  | { kind: 'accepted', runId: number }
  | { kind: 'rejected', runId: number, reason: string }
  | { kind: 'starved', runId: number, attempt: number, jobs: string[] }

/** A failed job is retry eligible only if no runner or step ever started it. */
export function sourceJobNeverStarted(job: LibrarySourceJob): boolean {
  return job.status === 'completed' && job.conclusion === 'cancelled' && !job.runner_id && (job.steps?.length ?? 0) === 0
}
function validatePolicy(policy: LibrarySourcePolicy): void {
  if (!/^[a-f0-9]{40}$/.test(policy.commit) || !/^\.github\/workflows\/[\w.-]+\.ya?ml$/.test(policy.workflow)
    || typeof policy.branch !== 'string' || !policy.branch || !Array.isArray(policy.requiredJobs) || !policy.requiredJobs.length
    || policy.requiredJobs.some(name => typeof name !== 'string' || !name) || new Set(policy.requiredJobs).size !== policy.requiredJobs.length
    || policy.repository !== undefined && !/^[\w-][\w.-]*\/[\w-][\w.-]*$/.test(policy.repository)
    || policy.events !== undefined && (!policy.events.length || policy.events.some(event => !['push', 'workflow_dispatch'].includes(event))))
    throw new Error('Expected an exact source commit and CI policy with unique required jobs')
}
export function latestLibrarySourceRun(policy: LibrarySourcePolicy, runs: LibrarySourceRun[]): LibrarySourceRun | undefined {
  validatePolicy(policy)
  return runs.filter(run => Number.isSafeInteger(run.id) && run.id > 0 && run.head_sha === policy.commit
    && run.head_branch === policy.branch && (policy.events ?? ['push', 'workflow_dispatch']).includes(run.event) && run.path === policy.workflow
    && (!policy.repository || run.repository?.full_name === policy.repository && run.head_repository?.full_name === policy.repository))
    .sort((a, b) => b.id - a.id)[0]
}

/** Shared exact-source policy, with product/framework job names supplied by callers. */
export function evaluateLibrarySourceCi(policy: LibrarySourcePolicy, runs: LibrarySourceRun[], jobs: LibrarySourceJob[]): LibrarySourceDecision {
  const run = latestLibrarySourceRun(policy, runs)
  if (!run || run.status !== 'completed') return { kind: 'pending' }
  if (run.conclusion !== 'success') {
    const unsuccessful = jobs.filter(job => job.conclusion !== 'success' && job.conclusion !== 'skipped')
    if ((run.conclusion === 'failure' || run.conclusion === 'cancelled') && unsuccessful.length && unsuccessful.every(sourceJobNeverStarted))
      return { kind: 'starved', runId: run.id, attempt: run.run_attempt ?? 1, jobs: unsuccessful.map(job => job.name) }
    return { kind: 'rejected', runId: run.id, reason: `Source CI concluded ${run.conclusion}` }
  }
  for (const name of policy.requiredJobs) {
    const matches = jobs.filter(job => job.name === name)
    if (matches.length !== 1 || matches[0]?.status !== 'completed' || matches[0].conclusion !== 'success')
      return { kind: 'rejected', runId: run.id, reason: `Required source job did not succeed exactly once: ${name}` }
  }
  return { kind: 'accepted', runId: run.id }
}

interface LibrarySourceArtifact {
  id: number
  name: string
  expired: boolean
  size_in_bytes: number
  expires_at: string
  digest?: string
  workflow_run?: { id?: number, repository_id?: number, head_repository_id?: number, head_sha?: string }
}
export interface LibrarySourceReceipt {
  schemaVersion: 1
  source: LibraryReleaseSource
  verifierCommit?: string
  runId: number
  runAttempt: number
  workflow: string
  branch: string
  requiredJobs: string[]
  artifact: { id: number, name: string, bytes: number, expiresAt: string, digest?: string, downloadUrl: string }
}
export interface AcceptLibrarySourceOptions extends LibraryNetworkOptions {
  source: LibraryReleaseSource
  runId: number
  workflow: string
  branch: string
  requiredJobs: string[]
  artifactName: string
  verifierCommit?: string
  token?: string
  maxArtifactBytes?: number
}

/** Accept ownership using current verifier code. Historical source is never executed. */
export async function acceptLibraryReleaseSource(options: AcceptLibrarySourceOptions): Promise<LibrarySourceReceipt> {
  validateLibraryReleaseSource(options.source)
  const policy = { ...options, commit: options.source.commit, repository: options.source.repository }
  validatePolicy(policy)
  if (!Number.isSafeInteger(options.runId) || options.runId <= 0 || !/^[\w.-]{1,128}$/.test(options.artifactName)
    || options.verifierCommit !== undefined && !/^[a-f0-9]{40}$/.test(options.verifierCommit))
    throw new Error('Expected an exact run ID, artifact name and verifier SHA')
  const reader = createLibraryReleaseReader(options)
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  const base = `https://api.github.com/repos/${options.source.repository}`
  const json = async <T>(path: string): Promise<T> => JSON.parse(new TextDecoder().decode(await reader.read(`${base}${path}`, { headers }))) as T
  const run = await json<LibrarySourceRun>(`/actions/runs/${options.runId}`)
  if (run.id !== options.runId || latestLibrarySourceRun(policy, [run])?.id !== options.runId
    || !Number.isSafeInteger(run.run_attempt ?? 1) || (run.run_attempt ?? 1) <= 0
    || !Number.isSafeInteger(run.repository?.id) || run.repository!.id! <= 0 || run.head_repository?.id !== run.repository?.id)
    throw new Error('Source CI repository, SHA, workflow, branch or fork ownership differs')
  async function pages<T>(path: string, field: string): Promise<T[]> {
    const all: T[] = []
    for (let page = 1; page <= 100; page++) {
      const result = await json<Record<string, unknown>>(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`)
      const items = result[field]
      if (!Array.isArray(items)) throw new Error('Source CI returned an invalid collection')
      all.push(...items as T[])
      if (items.length < 100) return all
    }
    throw new Error('Source CI collection exceeds its pagination budget')
  }
  const jobs = await pages<LibrarySourceJob>(`/actions/runs/${run.id}/jobs?filter=latest`, 'jobs')
  const decision = evaluateLibrarySourceCi(policy, [run], jobs)
  if (decision.kind !== 'accepted') throw new Error(`Source CI was not accepted: ${decision.kind === 'rejected' ? decision.reason : decision.kind}`)
  const artifacts = await pages<LibrarySourceArtifact>(`/actions/runs/${run.id}/artifacts`, 'artifacts')
  const matches = artifacts.filter(artifact => artifact.name === options.artifactName)
  if (matches.length !== 1) throw new Error('Expected exactly one owned retained candidate artifact')
  const artifact = matches[0]!
  const ownership = artifact.workflow_run
  const maxBytes = options.maxArtifactBytes ?? 256 * 1024 * 1024
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || !Number.isSafeInteger(artifact.id) || artifact.id <= 0 || artifact.expired !== false
    || !Number.isSafeInteger(artifact.size_in_bytes) || artifact.size_in_bytes <= 0 || artifact.size_in_bytes > maxBytes
    || !Number.isFinite(Date.parse(artifact.expires_at)) || Date.parse(artifact.expires_at) <= Date.now()
    || ownership?.id !== run.id || ownership.head_sha !== options.source.commit || ownership.repository_id !== run.repository!.id
    || ownership.head_repository_id !== run.repository!.id || artifact.digest !== undefined && !/^sha256:[a-f0-9]{64}$/.test(artifact.digest))
    throw new Error('Retained candidate artifact is expired, oversized or owned by another source')
  return { schemaVersion: 1, source: { ...options.source }, verifierCommit: options.verifierCommit, runId: run.id, runAttempt: run.run_attempt ?? 1,
    workflow: options.workflow, branch: options.branch, requiredJobs: [...options.requiredJobs],
    artifact: { id: artifact.id, name: artifact.name, bytes: artifact.size_in_bytes, expiresAt: artifact.expires_at, digest: artifact.digest, downloadUrl: `${base}/actions/artifacts/${artifact.id}/zip` } }
}
