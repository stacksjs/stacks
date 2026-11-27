import type { AcceptedPublication } from './npm-publication'
import type { PriorJob } from './resume-npm-publication'
import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { npmDistTags, publicationMatchesOriginal, verifyAcceptedPublications } from './npm-publication'
import { inParallel } from './promote-latest'
import { attemptJobs, githubToken, priorPublicationJobIds, priorPublicationReceipts, readGitHub } from './resume-npm-publication'

const repository = 'stacksjs/stacks'
const registry = 'https://registry.npmjs.org'
const name = 'stacks'
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

interface OriginalJob extends PriorJob {
  steps?: { name: string, conclusion: string }[]
}

function acceptedJob(job: OriginalJob, runId: number, attempt: number, sha: string): boolean {
  return job.run_id === runId && job.run_attempt === attempt && job.head_sha === sha && job.status === 'completed'
}

export function pantryUmbrellaDigest(log: string, version: string): string | undefined {
  const digests = new Set<string>()
  for (const raw of log.split('\n')) {
    const line = stripVTControlCharacters(raw).trim().replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s+/, '')
    if (!line.startsWith('{"success":true,"message":"Published stacks@')) continue
    const entry = JSON.parse(line) as { message?: string, visibility?: string, scan?: { verdict?: string, artifactSha256?: string } }
    if (entry.message !== `Published stacks@${version}`) continue
    const digest = entry.scan?.artifactSha256
    if (entry.visibility !== 'public' || entry.scan?.verdict !== 'clean' || !digest || !/^[a-f0-9]{64}$/.test(digest))
      throw new Error('The original Pantry umbrella receipt is incomplete')
    digests.add(digest)
  }
  if (digests.size > 1) throw new Error('Conflicting Pantry umbrella archive receipts')
  return [...digests][0]
}

export async function originalReleaseEvidence(input: {
  version: string
  runId: number
  sha: string
  scoped: ReadonlySet<string>
  samples: ReadonlySet<string>
  read: (endpoint: string) => Promise<string>
}): Promise<{ digest: string, receipts: AcceptedPublication[] }> {
  const { version, runId, sha, scoped, samples, read } = input
  const run = JSON.parse(await read(`repos/${repository}/actions/runs/${runId}`))
  if (run.id !== runId || run.repository?.full_name !== repository || run.head_repository?.full_name !== repository
    || run.path !== '.github/workflows/release.yml' || run.head_branch !== `v${version}` || run.head_sha !== sha
    || !['push', 'workflow_dispatch'].includes(run.event) || run.status !== 'completed'
    || !Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1)
    throw new Error('The original run does not match the completed tagged release')

  const logs: string[] = []
  const digests = new Set<string>()
  for (let attempt = 1; attempt <= run.run_attempt; attempt++) {
    const jobs = await attemptJobs(repository, runId, attempt, read) as OriginalJob[]
    for (const jobId of priorPublicationJobIds(jobs, runId, attempt, sha)) {
      const job = jobs.find(candidate => candidate.id === jobId)!
      const log = await read(`repos/${repository}/actions/jobs/${jobId}/logs`)
      logs.push(log)
      if (!job.steps?.some(step => step.name === 'Verify Pantry publication' && step.conclusion === 'success')) continue
      const digest = pantryUmbrellaDigest(log, version)
      if (digest) {
        const passed = (label: string) => jobs.some(candidate => candidate.name === label && acceptedJob(candidate, runId, attempt, sha) && candidate.conclusion === 'success')
        if (!passed('accept exact release source CI') || !passed('release gate'))
          throw new Error('The original Pantry upload has no successful exact-source and release gates')
        digests.add(digest)
      }
    }
  }
  if (digests.size !== 1) throw new Error('Expected one verified original Pantry umbrella archive')
  const receipts = priorPublicationReceipts(logs, version, new Set([name, ...scoped, ...samples]))
  const verifiedNames = new Set(receipts.map(receipt => receipt.name))
  if (!scoped.size || [...scoped].some(pkg => !verifiedNames.has(pkg)))
    throw new Error('Original npm receipts do not cover every scoped package from the tag')
  return { digest: [...digests][0]!, receipts }
}

type ReadPublic = NonNullable<Parameters<typeof publicationMatchesOriginal>[1]>

export async function retainedUmbrella(version: string, digest: string, read: ReadPublic = fetch) {
  const url = `https://pantry.dev/packages/stacks/${version}/tarball`
  const request = { method: 'GET' as const, signal: AbortSignal.timeout(30_000) }
  const metadata = await read(`https://registry.pantry.dev/packages/stacks/${version}`, request)
  if (!metadata.ok) throw new Error(`Pantry metadata returned HTTP ${metadata.status}`)
  const { name: packageName, version: packageVersion, tarballUrl, integrity, checksum } = await metadata.json()
  if (packageName !== name || packageVersion !== version || tarballUrl !== url || checksum !== `sha256:${digest}`)
    throw new Error('Pantry metadata does not match the original umbrella receipt')
  const response = await read(url, request)
  if (!response.ok) throw new Error(`Pantry archive returned HTTP ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const hash = (algorithm: 'sha256' | 'sha512' | 'sha1', encoding: 'hex' | 'base64') => createHash(algorithm).update(bytes).digest(encoding)
  const archiveIntegrity = `sha512-${hash('sha512', 'base64')}`
  if (hash('sha256', 'hex') !== digest || archiveIntegrity !== integrity) throw new Error('The umbrella archive does not match the original bytes')
  return { bytes, receipt: { name, version, integrity: archiveIntegrity, shasum: hash('sha1', 'hex') } }
}

export async function backfillUmbrella(receipt: AcceptedPublication, options: {
  publish: boolean
  mayUpload: boolean
  read?: ReadPublic
  upload: (tag: string, dryRun: boolean) => Promise<void>
  budgetMs?: number
  pollMs?: number
}): Promise<'dry-run' | 'verified'> {
  const { version } = receipt
  const tag = `backfill-${version}`
  if (receipt.name !== name || !versionPattern.test(version)) throw new Error('Expected an exact stable Stacks umbrella version')
  const read = options.read ?? fetch
  const tags = () => npmDistTags(name, registry, read)
  const initial = await tags()
  const latest = initial.latest
  if (typeof latest !== 'string' || !versionPattern.test(latest) || Bun.semver.order(latest, version) <= 0)
    throw new Error('A historical backfill requires a newer stable stacks latest tag')
  if (initial[tag] !== undefined && initial[tag] !== version) throw new Error('The backfill tag already points at another version')

  const metadata = await read(`${registry}/stacks/${version}`, { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(20_000) })
  await metadata.body?.cancel()
  if (metadata.status !== 200 && metadata.status !== 404) throw new Error(`Could not inspect npm umbrella version: HTTP ${metadata.status}`)
  if (metadata.status === 200 && !await publicationMatchesOriginal(receipt, read))
    throw new Error('The existing npm umbrella version differs from the original Pantry archive')
  if (!options.publish) {
    await options.upload(tag, true)
    return 'dry-run'
  }
  if (metadata.status === 404 && initial[tag] === undefined && options.mayUpload) await options.upload(tag, false)
  await verifyAcceptedPublications([receipt], { read, budgetMs: options.budgetMs, pollMs: options.pollMs })
  const deadline = performance.now() + (options.budgetMs ?? 120_000)
  while (true) {
    const current = await tags()
    if (typeof current.latest !== 'string' || !versionPattern.test(current.latest) || Bun.semver.order(current.latest, latest) < 0)
      throw new Error('The stable stacks latest tag regressed during backfill')
    if (current[tag] === version) return 'verified'
    if (current[tag] !== undefined || performance.now() >= deadline) throw new Error('The exact npm backfill tag could not be verified')
    await Bun.sleep(options.pollMs ?? 2_000)
  }
}

function git(args: string[]): string {
  const result = Bun.spawnSync(['git', ...args], { stdout: 'pipe', stderr: 'pipe', timeout: 30_000 })
  if (result.exitCode !== 0) throw new Error('Could not read the original release Git tree')
  return result.stdout.toString().trim()
}

function taggedPackages(version: string) {
  const sha = git(['rev-parse', '--verify', `refs/tags/v${version}^{commit}`])
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid tagged source commit')
  const manifest = (path: string) => JSON.parse(git(['show', `${sha}:${path}`])) as { name?: string, version?: string, private?: boolean }
  const umbrella = manifest('storage/framework/core/package.json')
  if (umbrella.name !== name || umbrella.version !== version || umbrella.private)
    throw new Error('The tagged umbrella manifest does not match the requested version')

  const scoped = new Set<string>()
  const samples = new Set<string>()
  const paths = git(['ls-tree', '-r', '--name-only', sha, 'storage/framework/core', 'storage/framework/libs']).split('\n')
  for (const path of paths) {
    const core = /^storage\/framework\/core\/[^/]+\/package\.json$/.test(path)
    const sample = /^storage\/framework\/libs\/(?:components|functions)\/(?!.*node_modules\/).*\/package\.json$/.test(path)
    if (!core && !sample) continue
    const pkg = manifest(path)
    if (!pkg.name || !pkg.version || pkg.private) continue
    if (pkg.version !== version) throw new Error(`Tagged package ${pkg.name} does not match the release version`)
    if (core) scoped.add(pkg.name)
    else samples.add(pkg.name)
  }
  return { sha, scoped, samples }
}

async function cleanInstall(root: string, version: string, specifier: string) {
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'stacks-backfill-smoke', private: true, dependencies: { stacks: specifier } }))
  const env = {
    ...process.env,
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: undefined,
    ACTIONS_ID_TOKEN_REQUEST_URL: undefined,
    GH_TOKEN: undefined,
    GITHUB_TOKEN: undefined,
    NODE_AUTH_TOKEN: undefined,
    NPM_TOKEN: undefined,
  }
  const result = Bun.spawnSync([process.execPath, '--no-env-file', 'install', '--ignore-scripts', '--no-cache'], { cwd: root, env, stdout: 'pipe', stderr: 'pipe', timeout: 120_000 })
  if (result.exitCode !== 0) throw new Error(`Clean consumer could not install stacks@${version}\n${result.stderr.toString()}`)
  const installed = await Bun.file(join(root, 'node_modules/stacks/package.json')).json()
  const buddy = Bun.spawnSync([process.execPath, '--no-env-file', 'node_modules/@stacksjs/buddy/dist/cli.js', '--help'], { cwd: root, env, stdout: 'pipe', stderr: 'pipe', timeout: 30_000 })
  if (installed.name !== name || installed.version !== version || buddy.exitCode !== 0 || !buddy.stdout.toString().includes(`buddy/${version}`))
    throw new Error('The clean consumer did not execute Buddy from the exact backfilled release')
}

function uploadArchive(root: string, archive: string, receipt: AcceptedPublication, tag: string, dryRun: boolean) {
  const result = Bun.spawnSync([
    'npm', 'publish', archive, '--registry', registry, '--tag', tag, '--access', 'public', '--ignore-scripts',
    '--fetch-retries=0', '--json', '--userconfig', join(root, 'npmrc'), ...(dryRun ? ['--dry-run'] : []),
  ], {
    cwd: root, stdout: 'pipe', stderr: 'pipe', timeout: 120_000,
    env: { ...process.env, GH_TOKEN: undefined, GITHUB_TOKEN: undefined, NODE_AUTH_TOKEN: undefined, NPM_TOKEN: undefined },
  })
  if (dryRun) {
    if (result.exitCode !== 0) throw new Error('npm refused the archive in a dry run')
    const output = JSON.parse(result.stdout.toString())
    const reported = output.stacks ?? output
    if (reported.name !== name || reported.version !== receipt.version || reported.integrity !== receipt.integrity || reported.shasum !== receipt.shasum)
      throw new Error('The npm dry run did not use the exact accepted archive')
    return
  }
  if (result.exitCode === 0) return
  const code = /npm (?:error|ERR!) code (E[A-Z0-9_]+)/.exec(result.stderr.toString())?.[1]
  if (code && ['E401', 'E403', 'ENEEDAUTH', 'EOTP'].includes(code)) throw new Error(`npm rejected the trusted backfill publisher (${code})`)
  process.stdout.write('Upload outcome is pending public verification. The job will not send a second upload.\n')
}

async function main() {
  const version = process.env.STACKS_NPM_BACKFILL_VERSION ?? ''
  const originalRun = process.env.STACKS_NPM_BACKFILL_RELEASE_RUN ?? ''
  const runId = Number(originalRun)
  if (!versionPattern.test(version) || !/^[1-9]\d*$/.test(originalRun) || !Number.isSafeInteger(runId))
    throw new Error('Expected a stable Stacks version and its original GitHub release run ID')
  const publish = process.env.STACKS_NPM_BACKFILL_PUBLISH === 'true'
  if (publish && (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REPOSITORY !== repository
    || process.env.GITHUB_REF !== 'refs/heads/main' || process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch'
    || process.env.GITHUB_WORKFLOW_REF !== `${repository}/.github/workflows/release.yml@refs/heads/main`))
    throw new Error('A public backfill requires the trusted main release workflow')

  const source = taggedPackages(version)
  const token = githubToken()
  const evidence = await originalReleaseEvidence({ ...source, version, runId, read: endpoint => readGitHub(endpoint, token) })
  const original = await retainedUmbrella(version, evidence.digest)
  const priorUmbrella = evidence.receipts.find(receipt => receipt.name === name)
  if (priorUmbrella && (priorUmbrella.integrity !== original.receipt.integrity || priorUmbrella.shasum !== original.receipt.shasum))
    throw new Error('The earlier npm umbrella receipt describes different bytes')
  const checked = await inParallel(evidence.receipts, 8, async receipt => ({ receipt, matches: await publicationMatchesOriginal(receipt) }))
  const unresolved = checked.filter(result => !result.matches).map(result => result.receipt.name)
  if (unresolved.length) throw new Error(`Original npm archives could not be verified: ${unresolved.join(', ')}`)

  const scratch = await mkdtemp(join(tmpdir(), 'stacks-npm-backfill-'))
  try {
    const archive = join(scratch, `stacks-${version}.tgz`)
    await writeFile(archive, original.bytes, { mode: 0o600 })
    await writeFile(join(scratch, 'npmrc'), '', { mode: 0o600 })
    const packed = Bun.spawnSync(['tar', '-xOzf', archive, 'package/package.json'], { stdout: 'pipe', stderr: 'pipe', timeout: 10_000 })
    if (packed.exitCode !== 0) throw new Error('Could not read the original umbrella manifest')
    const manifest = JSON.parse(packed.stdout.toString())
    if (manifest.name !== name || manifest.version !== version || manifest.private
      || Object.values(manifest.dependencies ?? {}).some(value => typeof value !== 'string' || value.startsWith('workspace:')))
      throw new Error('The original umbrella manifest is not suitable for npm')
    if ((manifest.publishConfig?.tag && manifest.publishConfig.tag !== `backfill-${version}`)
      || (manifest.publishConfig?.registry && manifest.publishConfig.registry.replace(/\/$/, '') !== registry))
      throw new Error('The original manifest overrides the npm backfill tag or registry')
    await cleanInstall(scratch, version, `./stacks-${version}.tgz`)
    process.stdout.write(`Verified ${source.scoped.size} scoped npm receipts and original umbrella SHA-256 ${evidence.digest} from ${source.sha} (release run ${runId}).\n`)
    const outcome = await backfillUmbrella(original.receipt, {
      publish,
      mayUpload: process.env.GITHUB_RUN_ATTEMPT === '1' && !priorUmbrella,
      upload: async (tag, dryRun) => uploadArchive(scratch, archive, original.receipt, tag, dryRun),
    })
    if (outcome === 'verified') {
      const consumer = await mkdtemp(join(tmpdir(), 'stacks-npm-backfill-public-'))
      try { await cleanInstall(consumer, version, version) }
      finally { await rm(consumer, { recursive: true, force: true }) }
    }
    const summary = `Stacks ${version} npm backfill ${outcome}. Source ${source.sha}, original archive SHA-256 ${evidence.digest}, tag backfill-${version}.\n`
    process.stdout.write(summary)
    if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, summary, { flag: 'a' })
  }
  finally { await rm(scratch, { recursive: true, force: true }) }
}

if (import.meta.main) await main()
