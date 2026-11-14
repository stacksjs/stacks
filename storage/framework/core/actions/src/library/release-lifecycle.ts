import type { LibraryNetworkOptions } from './release-network'
import type { LibraryReleaseCandidate, LibraryReleaseSource } from './release-artifacts'
import type { LibraryReleasePlan } from './release-plan'
import type { LibraryRegistryOptions, LibraryRegistryReceipt } from './release-registry'
import type { LibrarySourceReceipt, LibrarySourceRun } from './release-source'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { inspectLibraryRelease, prepareLibraryRelease, validateLibraryReleaseSource } from './release-artifacts'
import { downloadLibraryReleaseSource } from './release-download'
import { createLibraryReleaseReader } from './release-network'
import { DEFAULT_LIBRARY_SOURCE_CI, isLibraryPrereleaseVersion, planNativeLibraryRelease } from './release-plan'
import { publishPreparedLibraryRelease, readbackLibraryRelease } from './release-registry'
import { acceptLibraryReleaseSource, latestLibrarySourceRun } from './release-source'
import { configuredLibrary } from './packages'

export const LIBRARY_CANDIDATE_ARTIFACT = 'stacks-library-candidate'
export const LIBRARY_CANDIDATE_DIRECTORY = 'storage/framework/runtime/library-release'
export function libraryReleaseGit(cwd: string, args: string[]): string {
  const result = Bun.spawnSync(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' })
  if (result.exitCode !== 0) throw new Error(`Library release Git read failed: ${result.stderr.toString().trim()}`)
  return result.stdout.toString().trim()
}
function fullCommit(cwd: string, ref: string): string {
  const commit = libraryReleaseGit(cwd, ['rev-parse', '--verify', `${ref}^{commit}`])
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Expected full source commit SHA')
  return commit
}
export function libraryReleaseTagSource(cwd: string, repository: string, tag: string): LibraryReleaseSource {
  if (!/^v\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(tag)) throw new Error('Expected an exact semantic release tag')
  return { repository, commit: fullCommit(cwd, `refs/tags/${tag}`), tag }
}
export interface LibraryCandidateOwner { schemaVersion: 1, repository: string, commit: string, runId: number, runAttempt: number, workflow: string, branch: string, artifact: string }

export type NativeLibraryPreparation = { prepared: false, plan?: LibraryReleasePlan, commit?: string }
  | { prepared: true, candidate: LibraryReleaseCandidate, owner: LibraryCandidateOwner, sourceEligible: boolean }

/** Main CI builds/checks/packs once. The workflow uploads only after its tests pass. */
export async function prepareNativeLibraryRelease(options: { cwd: string, directory: string, dryRun?: boolean, runId?: number, runAttempt?: number, branch?: string }): Promise<NativeLibraryPreparation> {
  const plan = await planNativeLibraryRelease(options)
  if (!plan) return { prepared: false as const }
  const commit = fullCommit(options.cwd, 'HEAD')
  if (options.dryRun) return { prepared: false as const, plan, commit }
  if (!Number.isSafeInteger(options.runId) || options.runId! <= 0 || !Number.isSafeInteger(options.runAttempt) || options.runAttempt! <= 0 || typeof options.branch !== 'string' || !options.branch || options.branch.length > 255 || /[\r\n\0]/.test(options.branch))
    throw new Error('Retaining a CI candidate requires its exact source run, attempt and actual branch')
  const candidate = await prepareLibraryRelease({ ...options, config: plan.config, tag: plan.tag, checks: plan.checks, source: { repository: plan.repository, commit } })
  if (!candidate) return { prepared: false as const }
  const owner: LibraryCandidateOwner = { schemaVersion: 1, repository: plan.repository, commit, runId: options.runId!, runAttempt: options.runAttempt!, branch: options.branch, workflow: plan.sourceCi.workflow, artifact: LIBRARY_CANDIDATE_ARTIFACT }
  await writeFile(join(options.directory, 'ownership.json'), `${JSON.stringify(owner, null, 2)}\n`, { flag: 'wx' })
  return { prepared: true as const, candidate, owner, sourceEligible: options.branch === plan.sourceCi.branch }
}

export interface NativeLibraryAcceptanceOptions extends LibraryNetworkOptions { cwd: string, directory: string, tag: string, token?: string, runId?: number, historical?: boolean }
/** Resolve the actual tag, wait for exact CI and download its unique owned bytes. */
export async function acceptNativeLibraryRelease(options: NativeLibraryAcceptanceOptions): Promise<LibrarySourceReceipt | undefined> {
  const config = await configuredLibrary()
  const plan: Pick<LibraryReleasePlan, 'repository' | 'sourceCi'> | undefined = options.historical
    ? { repository: config?.repository ?? '', sourceCi: config?.release?.sourceCi ?? DEFAULT_LIBRARY_SOURCE_CI }
    : await planNativeLibraryRelease(options)
  if (!plan) return undefined
  const source = libraryReleaseTagSource(options.cwd, plan.repository, options.tag)
  validateLibraryReleaseSource(source)
  latestLibrarySourceRun({ ...plan.sourceCi, repository: source.repository, commit: source.commit }, [])
  if (plan.sourceCi.timeoutMinutes !== undefined && (!Number.isSafeInteger(plan.sourceCi.timeoutMinutes) || plan.sourceCi.timeoutMinutes < 1 || plan.sourceCi.timeoutMinutes > 120)) throw new Error('Invalid historical source CI timeout')
  const verifierCommit = fullCommit(options.cwd, 'HEAD')
  const reader = createLibraryReleaseReader({ ...options, deadlineMs: options.deadlineMs ?? (plan.sourceCi.timeoutMinutes ?? 30) * 60_000 })
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json', ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) }
  let runId = options.runId
  while (!runId && reader.remaining() > 0) {
    const query = new URLSearchParams({ head_sha: source.commit, branch: plan.sourceCi.branch, per_page: '100' })
    const bytes = await reader.read(`https://api.github.com/repos/${source.repository}/actions/workflows/${plan.sourceCi.workflow.split('/').at(-1)}/runs?${query}`, { headers })
    const result = JSON.parse(new TextDecoder().decode(bytes)) as { workflow_runs?: LibrarySourceRun[] }
    if (!Array.isArray(result.workflow_runs)) throw new Error('Source CI returned an invalid run collection')
    const run = latestLibrarySourceRun({ ...plan.sourceCi, repository: source.repository, commit: source.commit }, result.workflow_runs)
    if (run?.status === 'completed') {
      if (run.conclusion !== 'success') throw new Error(`Exact source CI concluded ${run.conclusion}; resume CI before publication`)
      runId = run.id
      break
    }
    await Bun.sleep(Math.min(10_000, reader.remaining()))
  }
  if (!runId || reader.remaining() <= 0) throw new Error('Exact source CI did not complete within the acceptance deadline')
  const receipt = await acceptLibraryReleaseSource({ ...options, deadlineMs: Math.max(1, Math.floor(reader.remaining())), source, verifierCommit, runId, ...plan.sourceCi, artifactName: LIBRARY_CANDIDATE_ARTIFACT })
  await mkdir(dirname(options.directory), { recursive: true })
  await downloadLibraryReleaseSource(receipt, options.directory, { ...options, deadlineMs: Math.max(1, Math.floor(reader.remaining())) })
  const candidate = await inspectLibraryRelease(options.directory, { repository: source.repository, commit: source.commit })
  const owner = JSON.parse(await readFile(join(options.directory, 'ownership.json'), 'utf8')) as LibraryCandidateOwner
  if (owner.schemaVersion !== 1 || owner.repository !== source.repository || owner.commit !== source.commit || owner.runId !== receipt.runId || owner.runAttempt !== receipt.runAttempt
    || owner.workflow !== receipt.workflow || owner.branch !== receipt.branch || owner.artifact !== receipt.artifact.name)
    throw new Error('Candidate ownership record differs from accepted source CI')
  if (candidate.source.tag && candidate.source.tag !== source.tag) throw new Error('Candidate tag differs from the actual release tag')
  await writeFile(join(options.directory, 'accepted-source.json'), `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' })
  return receipt
}

/** Revalidate source acceptance with a read-only token before granting publication. */
export async function verifyNativeLibraryAcceptance(options: Omit<NativeLibraryAcceptanceOptions, 'tag'>): Promise<LibrarySourceReceipt> {
  const deadline = performance.now() + (options.deadlineMs ?? 300_000)
  const remaining = () => {
    const duration = Math.floor(deadline - performance.now())
    if (duration <= 0) throw new Error('Native source acceptance deadline exceeded')
    return duration
  }
  const saved = JSON.parse(await readFile(join(options.directory, 'accepted-source.json'), 'utf8')) as LibrarySourceReceipt
  const config = await configuredLibrary()
  const policy = config?.release?.sourceCi ?? DEFAULT_LIBRARY_SOURCE_CI
  if (!saved?.source?.tag || saved.source.repository !== config?.repository) throw new Error('Expected a native accepted source receipt for this repository')
  const source = libraryReleaseTagSource(options.cwd, saved.source.repository, saved.source.tag)
  const actual = await acceptLibraryReleaseSource({ ...options, deadlineMs: remaining(), source, verifierCommit: fullCommit(options.cwd, 'HEAD'), runId: saved.runId, ...policy, artifactName: LIBRARY_CANDIDATE_ARTIFACT })
  if (JSON.stringify(actual.artifact) !== JSON.stringify(saved.artifact) || source.commit !== saved.source.commit || actual.runAttempt !== saved.runAttempt) throw new Error('Source artifact acceptance changed')
  const temporary = await mkdtemp(join(tmpdir(), 'stacks-library-acceptance-'))
  try {
    const original = join(temporary, 'candidate')
    await downloadLibraryReleaseSource(actual, original, { ...options, deadlineMs: remaining() })
    const expected = await inspectLibraryRelease(original, { repository: source.repository, commit: source.commit })
    const local = await inspectLibraryRelease(options.directory, { repository: source.repository, commit: source.commit })
    if (JSON.stringify(expected) !== JSON.stringify(local)) throw new Error('Local candidate differs from the owned provider artifact')
  }
  finally { await rm(temporary, { recursive: true, force: true }) }
  return actual
}

export async function publishNativeLibraryRelease(options: Omit<NativeLibraryAcceptanceOptions, 'tag'> & LibraryRegistryOptions & { dryRun?: boolean }): Promise<LibraryRegistryReceipt> {
  const plan = await planNativeLibraryRelease(options)
  if (!plan) throw new Error('Library publication is disabled or no public packages are configured')
  const receipt = await verifyNativeLibraryAcceptance(options)
  const config = plan.config
  const candidate = await inspectLibraryRelease(options.directory, { repository: receipt.source.repository, commit: receipt.source.commit })
  if (candidate.packages.some(pkg => pkg.tag !== (config?.release?.distTag ?? 'latest') || isLibraryPrereleaseVersion(pkg.version) && pkg.tag === 'latest')) throw new Error('Candidate distribution channel differs from current release policy')
  const result = await publishPreparedLibraryRelease(options.directory, { ...options, source: { repository: receipt.source.repository, commit: receipt.source.commit }, publisher: config?.release?.publisher })
  result.source = receipt.source
  result.verifierCommit = fullCommit(options.cwd, 'HEAD')
  if (!options.dryRun) await writeFile(join(options.directory, 'registry-receipt.json'), `${JSON.stringify(result, null, 2)}\n`)
  return result
}

/** Historical readback runs only current native verifier code over retained data. */
export async function readbackNativeLibraryRelease(options: Omit<NativeLibraryAcceptanceOptions, 'tag'> & LibraryRegistryOptions): Promise<LibraryRegistryReceipt> {
  const receipt = await verifyNativeLibraryAcceptance(options)
  const readbackOptions = { ...options, requireCurrentTag: false, source: { repository: receipt.source.repository, commit: receipt.source.commit }, verifierCommit: fullCommit(options.cwd, 'HEAD') }
  const result = await readbackLibraryRelease(options.directory, readbackOptions)
  result.source = receipt.source
  return result
}
