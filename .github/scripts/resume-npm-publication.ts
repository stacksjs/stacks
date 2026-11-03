import process from 'node:process'
import { stripVTControlCharacters } from 'node:util'
import { acceptedPublications, verifyAcceptedPublications } from './npm-publication'
import { publishables } from './promote-latest'

/** Only this immutable release's acknowledged original archives can resume it. */
export function priorPublicationReceipts(logs: readonly string[], version: string, names: ReadonlySet<string>) {
  const receipts = acceptedPublications(logs.join('\n'))
  for (const receipt of receipts) {
    if (receipt.version !== version || !names.has(receipt.name))
      throw new Error('Prior publication receipt does not belong to this release cohort')
  }
  return receipts
}

export interface PriorJob {
  id: number
  name: string
  run_id: number
  run_attempt: number
  head_sha: string
  status: string
  conclusion: string | null
}

/** A skipped dependency job made no uploads and has no downloadable log. */
export function priorPublicationJobIds(jobs: readonly PriorJob[], runId: number, attempt: number, sha: string): number[] {
  const publications = jobs.filter(job => job.name === 'npm')
  if (publications.length > 1) throw new Error('Ambiguous publication history; no publication resumed')
  return publications.flatMap((job) => {
    if (!Number.isSafeInteger(job.id) || job.id <= 0 || job.run_id !== runId
      || job.run_attempt !== attempt || job.head_sha !== sha || job.status !== 'completed')
      throw new Error('Original publication job does not match the immutable release')
    return job.conclusion === 'skipped' ? [] : [job.id]
  })
}

type GitHubFetch = (url: string, init: RequestInit) => Promise<Response>

const API = 'https://api.github.com'

/** A short, printable reason: GitHub's JSON `message`, or the first body line. */
function failureReason(status: number, body: string): string {
  let message = body
  try { message = (JSON.parse(body) as { message?: unknown }).message as string ?? body }
  catch {}
  const line = stripVTControlCharacters(String(message)).replace(/[\u0000-\u001F\u007F]+/g, ' ').trim().slice(0, 200)
  return `HTTP ${status}${line ? ` ${line}` : ''}`
}

/**
 * Read one GitHub REST resource as text.
 *
 * This used to shell out to `gh api` and discard its stderr. gh 2.10x refuses
 * to print a response that contains terminal escape sequences unless it is
 * given `--allow-escape-sequences` (a flag older gh rejects), and every job log
 * is full of ANSI colour codes: the v0.75.458 rerun could list the earlier
 * attempt's jobs but not read the npm job's log, and reported only "Cannot read
 * original publication history". The REST call has no such version coupling.
 *
 * The token goes to api.github.com alone. A log download answers with a
 * redirect to signed blob storage; that URL is followed without credentials.
 */
export async function readGitHub(
  endpoint: string,
  token: string,
  read: GitHubFetch = fetch,
  timeoutMs = 30_000,
): Promise<string> {
  const fail = (reason: string) => new Error(`Cannot read original publication history (GET ${endpoint}: ${reason}); no publication resumed`)
  const url = new URL(endpoint.replace(/^\/+/, ''), `${API}/`)
  if (url.origin !== API) throw fail('not a GitHub API path')
  let response: Response
  try {
    response = await read(url.href, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'stacks-release' },
      signal: AbortSignal.timeout(timeoutMs),
    })
  }
  catch (error) { throw fail((error as Error).message) }
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel()
    const location = response.headers.get('location')
    const target = location ? new URL(location, url) : undefined
    if (!target || target.protocol !== 'https:' || target.username || target.password)
      throw fail(`HTTP ${response.status} without an https download location`)
    try {
      response = await read(target.href, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) })
    }
    catch (error) { throw fail(`download: ${(error as Error).message}`) }
  }
  const body = await response.text()
  if (!response.ok) throw fail(failureReason(response.status, body))
  return body
}

/** Every job of one run attempt (GitHub pages them 100 at a time). */
export async function attemptJobs(repository: string, runId: number, attempt: number, readText: (endpoint: string) => Promise<string>): Promise<PriorJob[]> {
  const jobs: PriorJob[] = []
  for (let page = 1; page <= 50; page++) {
    const body = JSON.parse(await readText(`repos/${repository}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100&page=${page}`)) as { total_count?: unknown, jobs?: unknown }
    if (!Array.isArray(body.jobs) || !Number.isSafeInteger(body.total_count))
      throw new Error('Invalid publication history; no publication resumed')
    jobs.push(...body.jobs as PriorJob[])
    if (body.jobs.length < 100 || jobs.length >= (body.total_count as number)) return jobs
  }
  throw new Error('Invalid publication history; no publication resumed')
}

/** The workflow's token, or the signed-in gh account when run by hand. */
export function githubToken(env: Record<string, string | undefined> = process.env): string {
  const token = env.GH_TOKEN || env.GITHUB_TOKEN
  if (token) return token
  const result = Bun.spawnSync(['gh', 'auth', 'token'], { stdout: 'pipe', stderr: 'pipe', timeout: 30_000 })
  const stderr = result.stderr.toString().trim()
  if (result.exitCode !== 0 || !result.stdout.toString().trim())
    throw new Error(`Cannot read original publication history (no GH_TOKEN, and \`gh auth token\` failed${stderr ? `: ${stderr}` : ''}); no publication resumed`)
  return result.stdout.toString().trim()
}

if (import.meta.main) {
  const repository = process.env.GITHUB_REPOSITORY ?? ''
  const sha = process.env.GITHUB_SHA ?? ''
  const version = /^refs\/tags\/v(\d+\.\d+\.\d+(?:-[\w.-]+)?)$/.exec(process.env.GITHUB_REF ?? '')?.[1]
  const runId = Number(process.env.GITHUB_RUN_ID)
  const attempt = Number(process.env.GITHUB_RUN_ATTEMPT)
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !/^[a-f0-9]{40}$/.test(sha) || !version
    || !Number.isSafeInteger(runId) || runId <= 0 || !Number.isSafeInteger(attempt) || attempt <= 0)
    throw new Error('Expected the exact tagged release and workflow attempt')

  const logs: string[] = []
  if (attempt > 1) {
    const token = githubToken()
    const readText = (endpoint: string) => readGitHub(endpoint, token)
    for (let previous = 1; previous < attempt; previous++) {
      for (const jobId of priorPublicationJobIds(await attemptJobs(repository, runId, previous, readText), runId, previous, sha))
        logs.push(await readText(`repos/${repository}/actions/jobs/${jobId}/logs`))
    }
  }
  const root = new URL('../../', import.meta.url).pathname
  const names = new Set(['stacks', ...(await publishables(root)).map(pkg => pkg.name)])
  const receipts = priorPublicationReceipts(logs, version, names)
  console.log(`Verifying ${receipts.length} original accepted archives from ${attempt - 1} earlier attempt(s)`)
  // As long as promote-latest.ts allows for npm's automated review: a rerun
  // after that wait timed out should be able to outlast the same review.
  await verifyAcceptedPublications(receipts, { budgetMs: 30 * 60_000 })
}
