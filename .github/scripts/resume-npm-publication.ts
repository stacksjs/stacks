import process from 'node:process'
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

interface PriorJob {
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

if (import.meta.main) {
  const repository = process.env.GITHUB_REPOSITORY ?? ''
  const sha = process.env.GITHUB_SHA ?? ''
  const version = /^refs\/tags\/v(\d+\.\d+\.\d+(?:-[\w.-]+)?)$/.exec(process.env.GITHUB_REF ?? '')?.[1]
  const runId = Number(process.env.GITHUB_RUN_ID)
  const attempt = Number(process.env.GITHUB_RUN_ATTEMPT)
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !/^[a-f0-9]{40}$/.test(sha) || !version
    || !Number.isSafeInteger(runId) || runId <= 0 || !Number.isSafeInteger(attempt) || attempt <= 0)
    throw new Error('Expected the exact tagged release and workflow attempt')

  const read = (endpoint: string, paginated = false): string => {
    // gh handles its own API redirect/authentication boundary. No credential is
    // supplied to registry readback or a URL recovered from a publish log.
    const args = ['gh', 'api', ...(paginated ? ['--paginate', '--slurp'] : []), endpoint]
    const result = Bun.spawnSync(args, { stdout: 'pipe', stderr: 'pipe', timeout: 30_000 })
    if (result.exitCode !== 0) throw new Error('Cannot read original publication history; no publication resumed')
    return result.stdout.toString()
  }
  const logs: string[] = []
  for (let previous = 1; previous < attempt; previous++) {
    const pages = JSON.parse(read(`repos/${repository}/actions/runs/${runId}/attempts/${previous}/jobs?per_page=100`, true)) as Array<{ jobs: PriorJob[] }>
    if (!Array.isArray(pages) || pages.some(page => !Array.isArray(page.jobs)))
      throw new Error('Invalid publication history; no publication resumed')
    for (const jobId of priorPublicationJobIds(pages.flatMap(page => page.jobs), runId, previous, sha))
      logs.push(read(`repos/${repository}/actions/jobs/${jobId}/logs`))
  }
  const root = new URL('../../', import.meta.url).pathname
  const names = new Set(['stacks', ...(await publishables(root)).map(pkg => pkg.name)])
  const receipts = priorPublicationReceipts(logs, version, names)
  console.log(`Verifying ${receipts.length} original accepted archives from ${attempt - 1} earlier attempt(s)`)
  await verifyAcceptedPublications(receipts)
}
