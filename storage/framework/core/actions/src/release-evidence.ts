import { boundedBody, libraryArchiveEntries, safeArchivePath } from './library/archive.js'
import { createHash } from 'node:crypto'
import { closeSync, constants, fstatSync, lstatSync, openSync, opendirSync, readFileSync, readSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'

export interface InstalledLibraryPackageOptions {
  /** Optional consumer directory containing the installed package. */
  consumerRoot?: string
  /** Accept only a root .bun-tag regular file containing a SHA-512 SRI. */
  allowBunTag?: boolean
  /** Counts directories and installer metadata too. Default: 100,000. */
  maxEntries?: number
  /** Maximum nested directory depth. Default: 128. */
  maxDepth?: number
  /** Maximum total file bytes read. Default: 256 MiB. */
  maxBytes?: number
  /** Maximum individual file size. Defaults to maxBytes. */
  maxFileBytes?: number
}

/**
 * Inspect a stable, caller-owned installation against libraryArchiveEntries().
 * Returns every actual package file only after complete key-set/byte equality.
 * Rejects links, special files, unsafe paths and budget overruns. Optional Bun
 * installer metadata is checked and omitted from the returned archive payload.
 * This verifies local bytes, not registry/source ownership or concurrent writers.
 */
export function inspectInstalledLibraryPackage(directory: string, expected: ReadonlyMap<string, Uint8Array>, options: InstalledLibraryPackageOptions = {}): Map<string, Uint8Array> {
  return verifyInstalledFiles(directory, expected, options)
}

interface InstalledFileIdentity { sha256: string, bytes: number }

function contained(root: string, path: string): boolean {
  const child = relative(root, path)
  return !!child && child !== '..' && !child.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(child)
}

// Shared with legacy release evidence, whose root node_modules exception is
// intentionally unavailable on the public standalone-package interface.
function verifyInstalledFiles(directory: string, expected: ReadonlyMap<string, InstalledFileIdentity | Uint8Array>, options: InstalledLibraryPackageOptions = {}, separateDependencies = false): Map<string, Uint8Array> {
  const maxEntries = options.maxEntries ?? 100_000
  const maxDepth = options.maxDepth ?? 128
  const maxBytes = options.maxBytes ?? 256 * 1024 * 1024
  const maxFileBytes = options.maxFileBytes ?? maxBytes
  for (const limit of [maxEntries, maxDepth, maxBytes, maxFileBytes]) {
    if (!Number.isSafeInteger(limit) || limit <= 0) fail('Installed package budgets must be positive safe integers')
  }
  if (expected.size > maxEntries) fail('Installed package expected inventory exceeds its budget')
  const identities = new Map<string, InstalledFileIdentity>()
  let expectedBytes = 0
  for (const [name, entry] of expected) {
    const size = entry instanceof Uint8Array ? entry.byteLength : entry?.bytes
    if (!Number.isSafeInteger(size) || size < 0 || size > maxFileBytes || expectedBytes + size > maxBytes)
      fail('Installed package expected inventory exceeds its budget')
    const identity = entry instanceof Uint8Array ? { sha256: hash(entry), bytes: size } : entry
    if (!safeArchivePath(name) || !identity || !Number.isSafeInteger(identity.bytes) || identity.bytes < 0 || !/^[a-f0-9]{64}$/.test(identity.sha256))
      fail('Installed package expected inventory has an unsafe path or identity')
    expectedBytes += identity.bytes
    identities.set(name, identity)
  }
  const rootStat = lstatSync(directory)
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('Installed package root must be a real directory')
  const root = realpathSync(directory)
  if (options.consumerRoot && !contained(realpathSync(options.consumerRoot), root)) fail('Installed package resolves outside its consumer root')
  const actual = new Map<string, Uint8Array>()
  const hasBundledDependencies = [...expected.keys()].some(name => name.startsWith('node_modules/'))
  let entries = 0
  let bytesRead = 0
  function visit(path: string, depth: number): void {
    if (depth > maxDepth) fail('Installed package directory depth exceeds its budget')
    const fullDirectory = join(root, path)
    const before = lstatSync(fullDirectory)
    if (!before.isDirectory() || before.isSymbolicLink() || realpathSync(fullDirectory) !== fullDirectory)
      fail('Installed package directory is a link or escapes its root')
    const handle = opendirSync(fullDirectory)
    try {
      for (let entry = handle.readSync(); entry; entry = handle.readSync()) {
        if (++entries > maxEntries) fail('Installed package entry count exceeds its budget')
        const name = path ? `${path}/${entry.name}` : entry.name
        if (!safeArchivePath(name)) fail('Installed package contains an unsafe path')
        // Only legacy evidence delegates separately installed dependencies.
        if (separateDependencies && !path && entry.name === 'node_modules' && !hasBundledDependencies) continue
        const fullPath = join(root, name)
        const stat = lstatSync(fullPath)
        if (stat.isSymbolicLink()) fail(`Installed package file ${name} is a symbolic link`)
        if (!separateDependencies && name === '.bun-tag' && !stat.isFile()) fail(`Installed package file ${name} is not a regular file`)
        if (stat.isDirectory()) { visit(name, depth + 1); continue }
        if (!stat.isFile()) fail(`Installed package file ${name} is not a regular file`)
        const identity = identities.get(name)
        const bunTag = !identity && name === '.bun-tag' && options.allowBunTag === true
        if (!identity && !bunTag) fail(`Installed package file ${name} differs from the verified archive`)
        if (stat.size > maxFileBytes || bytesRead + stat.size > maxBytes) fail('Installed package file bytes exceed their budget')
        if ((identity && stat.size !== identity.bytes) || (bunTag && stat.size !== 95)) fail(`Installed package file ${name} differs from the verified archive`)
        // Open without following a substituted leaf; never read a FIFO/device.
        const fd = openSync(fullPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0))
        let bytes: Uint8Array
        try {
          const opened = fstatSync(fd)
          if (!opened.isFile() || opened.dev !== stat.dev || opened.ino !== stat.ino || opened.size !== stat.size) fail(`Installed package file ${name} changed during inspection`)
          bytes = new Uint8Array(stat.size)
          let offset = 0
          while (offset < bytes.length) {
            const count = readSync(fd, bytes, offset, bytes.length - offset, null)
            if (!count) fail(`Installed package file ${name} changed during inspection`)
            offset += count
          }
          const after = fstatSync(fd)
          if (readSync(fd, new Uint8Array(1), 0, 1, null) || after.size !== stat.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs)
            fail(`Installed package file ${name} changed during inspection`)
        }
        finally { closeSync(fd) }
        bytesRead += bytes.length
        if (bunTag) {
          if (!/^sha512-[A-Za-z0-9+/]{86}==$/.test(new TextDecoder().decode(bytes))) fail('Installed package has invalid Bun installer metadata')
        }
        else {
          if (hash(bytes) !== identity!.sha256) fail(`Installed package file ${name} differs from the verified archive`)
          actual.set(name, bytes)
        }
      }
    }
    finally { handle.closeSync() }
    const after = lstatSync(fullDirectory)
    if (!after.isDirectory() || after.dev !== before.dev || after.ino !== before.ino || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs || realpathSync(fullDirectory) !== fullDirectory)
      fail('Installed package directory changed during inspection')
  }
  visit('', 0)
  if (actual.size !== expected.size) fail('Installed package is missing files from the verified archive')
  if (realpathSync(directory) !== root) fail('Installed package root changed during inspection')
  return actual
}

export interface ReleaseSource {
  repository: string
  commit: string
  tag: string
  gates: Array<{ runId: number, workflow: string, requiredJobs: string[] }>
  /** Archive identities retained by the source release, not a latest tag. */
  packages: Array<{ name: string, version: string, integrity: string }>
}

export interface ReleaseEvidencePlan {
  schemaVersion: 1
  sources: ReleaseSource[]
  /** Existing consumer package.json scripts, executed after artifact checks. */
  checks: string[]
}

export interface ReleaseEvidenceReceipt {
  schemaVersion: 1
  verifiedAt: string
  sources: Array<ReleaseSource & {
    releaseCommand: 'bun run release:patch'
    releaseScript: string
    packages: Array<ReleaseSource['packages'][number] & { tarball: string, bytes: number, filesSha256: string }>
  }>
  consumer: {
    lockfile: 'bun.lock'
    sha256: string
    bunVersion: string
    checks: Array<{ script: string, exitCode: 0, outputSha256: string }>
  }
}

export interface ReleaseEvidenceOptions {
  cwd: string
  token?: string
  fetch?: (url: string, init?: RequestInit) => Promise<Response>
  signal?: AbortSignal
  requestTimeoutMs?: number
  checkTimeoutMs?: number
  maxArchiveBytes?: number
  maxExpandedBytes?: number
}

interface GitObject { type: string, sha: string }
interface SourceManifest { encoding?: string, content?: string }
interface PackageManifest { name?: string, version?: string, scripts?: Record<string, string>, engines?: { bun?: string } }
interface WorkflowRun {
  id: number
  repository?: { full_name?: string }
  path?: string
  head_sha?: string
  status?: string
  conclusion?: string
}
interface WorkflowJob { name: string, status: string, conclusion: string }
interface PublishedPackage {
  name?: string
  version?: string
  gitHead?: string
  dist?: { integrity?: string, tarball?: string }
}

type PackageFiles = Map<string, { sha256: string, bytes: number }>

function fail(message: string): never {
  throw new Error(`Release verification blocked: ${message}`)
}

function hash(bytes: string | Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function nonemptyStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(item => typeof item === 'string' && item.length > 0)
}

/** Validate data before using any value as a URL, filesystem path or command. */
export function validateReleaseEvidencePlan(value: unknown): asserts value is ReleaseEvidencePlan {
  const plan = value as ReleaseEvidencePlan | null
  if (!plan || plan.schemaVersion !== 1 || !Array.isArray(plan.sources) || !plan.sources.length
    || !nonemptyStrings(plan.checks) || plan.checks.some(name => !/^[a-z0-9][\w:.-]*$/i.test(name))
    || new Set(plan.checks).size !== plan.checks.length)
    fail('Expected a version 1 plan with sources and named consumer checks')
  const packages = new Set<string>()
  for (const source of plan.sources) {
    if (!source || !/^[\w.-]+\/[\w.-]+$/.test(source.repository)
      || !/^[a-f0-9]{40}$/.test(source.commit) || typeof source.tag !== 'string' || !source.tag
      || !Array.isArray(source.gates) || !source.gates.length || !Array.isArray(source.packages) || !source.packages.length)
      fail('Each source needs a repository, full commit, tag, release gates and packages')
    for (const gate of source.gates) {
      if (!gate || !Number.isSafeInteger(gate.runId) || gate.runId <= 0
        || !/^\.github\/workflows\/[\w.-]+\.ya?ml$/.test(gate.workflow)
        || !nonemptyStrings(gate.requiredJobs) || new Set(gate.requiredJobs).size !== gate.requiredJobs.length)
        fail('Each release gate needs an exact run, workflow and required jobs')
    }
    for (const pkg of source.packages) {
      if (!pkg || !/^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/.test(pkg.name)
        || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(pkg.version)
        || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(pkg.integrity) || packages.has(pkg.name))
        fail('Packages need unique names, exact versions and original SHA-512 archive identities')
      packages.add(pkg.name)
    }
  }
}

async function archiveFiles(bytes: Uint8Array, limit: number): Promise<PackageFiles> {
  const entries = await libraryArchiveEntries(bytes, limit)
  return new Map([...entries].map(([name, bytes]) => [name, { sha256: hash(bytes), bytes: bytes.length }]))
}

function installedState(plan: ReleaseEvidencePlan, cwd: string, archives: Map<string, PackageFiles>, maxBytes: number): { lock: string, sha256: string, manifests: string } {
  const lock = readFileSync(join(cwd, 'bun.lock'), 'utf8')
  const parsed = Bun.JSONC.parse(lock) as { packages?: Record<string, unknown[]> }
  const nodeModules = realpathSync(join(cwd, 'node_modules'))
  const manifests: string[] = []
  for (const source of plan.sources) {
    for (const pkg of source.packages) {
      const locked = parsed.packages?.[pkg.name]
      if (locked?.[0] !== `${pkg.name}@${pkg.version}` || locked.at(-1) !== pkg.integrity)
        fail(`Consumer lock does not contain ${pkg.name}@${pkg.version} with the original archive identity`)
      const directory = realpathSync(join(cwd, 'node_modules', pkg.name))
      const path = relative(nodeModules, directory)
      if (!path || path.startsWith('..') || resolve(nodeModules, path) !== directory)
        fail(`${pkg.name} resolves outside the installed consumer packages`)
      const raw = readFileSync(join(directory, 'package.json'), 'utf8')
      const manifest = JSON.parse(raw) as { name?: string, version?: string }
      if (manifest.name !== pkg.name || manifest.version !== pkg.version)
        fail(`Installed ${pkg.name} does not match tested version ${pkg.version}`)
      verifyInstalledFiles(directory, archives.get(pkg.name)!, { maxBytes }, true)
      manifests.push(hash(raw))
    }
  }
  return { lock, sha256: hash(lock), manifests: manifests.join(':') }
}

/**
 * Verify existing releases, then run the installed consumer's declared checks.
 * Does not bump, tag, publish, upgrade or replace the owning release commands.
 * Archive SRI is compared with the independently retained source-release plan;
 * this receipt is not an assertion that registry attestations were validated.
 */
export async function verifyReleaseEvidence(plan: ReleaseEvidencePlan, options: ReleaseEvidenceOptions): Promise<ReleaseEvidenceReceipt> {
  validateReleaseEvidencePlan(plan)
  const requestTimeoutMs = options.requestTimeoutMs ?? 30_000
  const checkTimeoutMs = options.checkTimeoutMs ?? 300_000
  const maxArchiveBytes = options.maxArchiveBytes ?? 128 * 1024 * 1024
  const maxExpandedBytes = options.maxExpandedBytes ?? 128 * 1024 * 1024
  for (const number of [requestTimeoutMs, checkTimeoutMs, maxArchiveBytes, maxExpandedBytes]) {
    if (!Number.isSafeInteger(number) || number <= 0) fail('Budgets must be positive safe integers')
  }
  const read = options.fetch ?? fetch
  const archives = new Map<string, PackageFiles>()
  const receipt: ReleaseEvidenceReceipt = {
    schemaVersion: 1, verifiedAt: '', sources: [],
    consumer: { lockfile: 'bun.lock', sha256: '', bunVersion: '', checks: [] },
  }
  async function request(url: string, github: boolean, limit = 1024 * 1024): Promise<Uint8Array> {
    const timeout = AbortSignal.timeout(requestTimeoutMs)
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout
    signal.throwIfAborted()
    const response = await read(url, {
      method: 'GET', redirect: 'error', signal,
      headers: github ? { Accept: 'application/vnd.github+json', ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) } : {},
    })
    if (response.status !== 200) {
      await response.body?.cancel()
      fail(`${github ? 'Source evidence' : 'Published package'} request returned HTTP ${response.status}`)
    }
    return boundedBody(response, limit)
  }
  async function github<T>(path: string): Promise<T> {
    return JSON.parse(new TextDecoder().decode(await request(`https://api.github.com/repos/${path}`, true))) as T
  }
  for (const source of plan.sources) {
    let ref = (await github<{ object?: GitObject }>(`${source.repository}/git/ref/tags/${encodeURIComponent(source.tag)}`)).object
    for (let depth = 0; ref?.type === 'tag' && depth < 5; depth++)
      ref = (await github<{ object?: GitObject }>(`${source.repository}/git/tags/${ref.sha}`)).object
    if (ref?.type !== 'commit' || ref.sha !== source.commit) fail(`${source.tag} does not identify ${source.commit}`)
    const manifest = await github<SourceManifest>(`${source.repository}/contents/package.json?ref=${source.commit}`)
    if (manifest.encoding !== 'base64' || typeof manifest.content !== 'string') fail('Source package manifest is unavailable')
    const sourcePackage = JSON.parse(Buffer.from(manifest.content, 'base64').toString('utf8')) as PackageManifest
    const releaseScript = sourcePackage.scripts?.['release:patch']
    if (typeof releaseScript !== 'string' || !releaseScript.trim()) fail(`${source.repository} has no existing release:patch command`)
    for (const gate of source.gates) {
      const run = await github<WorkflowRun>(`${source.repository}/actions/runs/${gate.runId}`)
      if (run.id !== gate.runId || run.repository?.full_name !== source.repository || run.path !== gate.workflow
        || run.head_sha !== source.commit) fail(`Release gate ${gate.runId} does not verify the exact source and workflow`)
      if (run.status !== 'completed' || run.conclusion !== 'success') fail(`Release gate ${gate.runId} is not successful`)
      const jobs: WorkflowJob[] = []
      for (let page = 1; page <= 10; page++) {
        const batch = await github<{ jobs?: WorkflowJob[] }>(`${source.repository}/actions/runs/${gate.runId}/jobs?per_page=100&page=${page}`)
        if (!Array.isArray(batch.jobs)) fail(`Release gate ${gate.runId} has no readable jobs`)
        jobs.push(...batch.jobs)
        if (batch.jobs.length < 100) break
        if (page === 10) fail('Release job inventory exceeds its budget')
      }
      for (const name of gate.requiredJobs) {
        const matches = jobs.filter(job => job.name === name)
        if (matches.length !== 1 || matches[0]?.status !== 'completed' || matches[0]?.conclusion !== 'success')
          fail(`Required release job ${name} did not pass exactly once`)
      }
    }
    const verified: ReleaseEvidenceReceipt['sources'][number] = { ...source, releaseCommand: 'bun run release:patch', releaseScript, packages: [] }
    for (const pkg of source.packages) {
      const metadata = JSON.parse(new TextDecoder().decode(await request(`https://registry.npmjs.org/${encodeURIComponent(pkg.name)}/${encodeURIComponent(pkg.version)}`, false))) as PublishedPackage
      if (metadata.name !== pkg.name || metadata.version !== pkg.version || metadata.dist?.integrity !== pkg.integrity)
        fail(`Published ${pkg.name}@${pkg.version} does not match the original archive identity`)
      if (metadata.gitHead !== undefined && metadata.gitHead !== source.commit) fail(`Published ${pkg.name} names a different source commit`)
      if (!metadata.dist?.tarball) fail(`Published ${pkg.name} has no archive URL`)
      const tarball = new URL(metadata.dist.tarball)
      if (tarball.origin !== 'https://registry.npmjs.org' || tarball.username || tarball.password)
        fail('Archive URL is outside the public npm registry')
      const bytes = await request(tarball.href, false, maxArchiveBytes)
      if (`sha512-${createHash('sha512').update(bytes).digest('base64')}` !== pkg.integrity)
        fail(`Published ${pkg.name}@${pkg.version} archive bytes failed SHA-512 verification`)
      const files = await archiveFiles(bytes, maxExpandedBytes)
      archives.set(pkg.name, files)
      const filesSha256 = hash(JSON.stringify([...files].sort(([left], [right]) => left.localeCompare(right))))
      verified.packages.push({ ...pkg, tarball: tarball.href, bytes: bytes.byteLength, filesSha256 })
    }
    receipt.sources.push(verified)
  }
  const initial = installedState(plan, options.cwd, archives, maxExpandedBytes)
  const { runProjectScripts } = await import('./project-scripts.js')
  const checks = await runProjectScripts({ cwd: options.cwd, scripts: plan.checks, signal: options.signal, timeoutMs: checkTimeoutMs })
  receipt.consumer.bunVersion = checks.bunVersion
  receipt.consumer.checks = checks.checks
  const final = installedState(plan, options.cwd, archives, maxExpandedBytes)
  if (final.sha256 !== initial.sha256 || final.manifests !== initial.manifests) fail('Consumer checks changed the verified lockfile or package identities')
  receipt.consumer.sha256 = initial.sha256
  options.signal?.throwIfAborted()
  receipt.verifiedAt = new Date().toISOString()
  return receipt
}
