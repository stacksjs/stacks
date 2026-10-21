import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

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

async function boundedBody(response: Response, limit: number): Promise<Uint8Array> {
  const declared = response.headers.get('content-length')
  if (declared && Number(declared) > limit) {
    await response.body?.cancel()
    fail('Response exceeds its byte budget')
  }
  if (!response.body) fail('Response has no body')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      length += next.value.byteLength
      if (length > limit) fail('Response exceeds its byte budget')
      chunks.push(next.value)
    }
    return Buffer.concat(chunks, length)
  }
  finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

// Check physical tar bounds before an archive reader allocates declared sizes.
// Sparse files and links cannot describe an installed npm code identity here.
function validateTarBounds(tar: Uint8Array): number {
  if (!tar.byteLength || tar.byteLength % 512) fail('Published archive has invalid tar block bounds')
  let offset = 0
  let files = 0
  let headers = 0
  const text = (start: number, length: number): string => new TextDecoder().decode(tar.subarray(start, start + length)).replace(/\0.*$/s, '').trim()
  while (offset + 512 <= tar.byteLength) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) {
      if (tar.subarray(offset).some(byte => byte !== 0)) fail('Published archive has data after its tar terminator')
      return files
    }
    if (++headers > 100_000) fail('Published archive has too many entries')
    const rawSize = text(offset + 124, 12)
    if (!/^[0-7]+$/.test(rawSize)) fail('Published archive has an unsupported tar size')
    const size = Number.parseInt(rawSize, 8)
    const end = offset + 512 + Math.ceil(size / 512) * 512
    if (!Number.isSafeInteger(end) || end > tar.byteLength) fail('Published archive declares bytes outside its tar bounds')
    const type = header[156] === 0 ? '0' : String.fromCharCode(header[156]!)
    if (type === '0') files++
    else if (type === 'x' || type === 'g') {
      const metadata = tar.subarray(offset + 512, offset + 512 + size)
      const allowed = new Set(['path', 'mtime', 'atime', 'ctime', 'uid', 'gid', 'uname', 'gname', 'comment', 'charset', 'hdrcharset'])
      for (let start = 0; start < metadata.length;) {
        const space = metadata.indexOf(32, start)
        if (space < 0) fail('Published archive has malformed PAX records')
        const rawLength = new TextDecoder().decode(metadata.subarray(start, space))
        const length = Number(rawLength)
        const end = start + length
        if (!/^\d+$/.test(rawLength) || !Number.isSafeInteger(end) || end > metadata.length || end <= space + 2 || metadata[end - 1] !== 10)
          fail('Published archive has malformed PAX bounds')
        const equals = metadata.indexOf(61, space + 1)
        const key = new TextDecoder().decode(metadata.subarray(space + 1, equals))
        if (equals < 0 || equals >= end - 1 || !allowed.has(key)) fail('Published archive has unsupported PAX allocation or link metadata')
        start = end
      }
    }
    else if (type !== '5' && type !== 'L') fail('Published archive contains a link or unsupported tar entry')
    offset = end
  }
  fail('Published archive has no tar terminator')
}

async function archiveFiles(bytes: Uint8Array, limit: number): Promise<PackageFiles> {
  const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream('gzip'))
  const tar = await boundedBody(new Response(stream), limit)
  const count = validateTarBounds(tar)
  const files = await new Bun.Archive(tar).files()
  if (!count || files.size !== count) fail('Published archive has missing or duplicate file paths')
  const result: PackageFiles = new Map()
  for (const [name, file] of files) {
    const path = name.slice('package/'.length)
    if (!name.startsWith('package/') || !path || path.includes('\\') || path.includes(':')
      || path.split('/').some(part => !part || part === '.' || part === '..') || result.has(path))
      fail('Published archive contains an unsafe or duplicate package path')
    result.set(path, { sha256: hash(new Uint8Array(await file.arrayBuffer())), bytes: file.size })
  }
  if (!result.has('package.json')) fail('Published archive has no package manifest')
  return result
}

function verifyInstalledFiles(directory: string, expected: PackageFiles): void {
  const found = new Set<string>()
  const hasBundledDependencies = [...expected.keys()].some(path => path.startsWith('node_modules/'))
  function visit(path: string, depth: number): void {
    if (depth > 128) fail('Installed package directory depth exceeds its budget')
    for (const entry of readdirSync(join(directory, path), { withFileTypes: true })) {
      // Nested dependency installations belong to their own package archive.
      if (!path && entry.name === 'node_modules' && !hasBundledDependencies) continue
      const name = path ? `${path}/${entry.name}` : entry.name
      if (found.size >= 100_000) fail('Installed package has too many files')
      const fullPath = join(directory, name)
      if (entry.isDirectory()) visit(name, depth + 1)
      else {
        const identity = expected.get(name)
        const stat = lstatSync(fullPath)
        if (!identity || !stat.isFile() || stat.size !== identity.bytes || hash(readFileSync(fullPath)) !== identity.sha256)
          fail(`Installed package file ${name} differs from the verified archive`)
        found.add(name)
      }
    }
  }
  visit('', 0)
  if (found.size !== expected.size) fail('Installed package is missing files from the verified archive')
}

function installedState(plan: ReleaseEvidencePlan, cwd: string, archives: Map<string, PackageFiles>): { lock: string, sha256: string, manifests: string } {
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
      verifyInstalledFiles(directory, archives.get(pkg.name)!)
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
  const initial = installedState(plan, options.cwd, archives)
  const manifest = JSON.parse(readFileSync(join(options.cwd, 'package.json'), 'utf8')) as PackageManifest
  // In a compiled Buddy, process.execPath is Buddy itself. Use the consumer's
  // installed Bun toolchain rather than recursively launching this executable.
  const bun = Bun.which('bun', { cwd: options.cwd })
  if (!bun) fail('Consumer Bun executable is unavailable')
  const probe = Bun.spawnSync([bun, '--version'], { cwd: options.cwd, stdout: 'pipe', stderr: 'pipe', timeout: 10_000 })
  const bunVersion = probe.stdout.toString().trim()
  if (probe.exitCode !== 0 || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(bunVersion)
    || !Bun.semver.satisfies(bunVersion, manifest.engines?.bun ?? '>=1.3.0'))
    fail('Consumer Bun executable does not satisfy the declared toolchain')
  receipt.consumer.bunVersion = bunVersion
  for (const script of plan.checks) {
    if (!Object.hasOwn(manifest.scripts ?? {}, script) || typeof manifest.scripts?.[script] !== 'string')
      fail(`Consumer script ${script} is not declared`)
    options.signal?.throwIfAborted()
    const windowsTaskkill = process.platform === 'win32' ? Bun.which('taskkill.exe') : undefined
    if (process.platform === 'win32' && !windowsTaskkill) fail('Windows process-tree cleanup requires taskkill.exe')
    // A separate POSIX group owns the normal descendants of this check. This
    // is cleanup ownership, not a sandbox for a process that deliberately
    // detaches into a different group. Windows uses its native tree operation.
    const child = Bun.spawn([bun, 'run', script], { cwd: options.cwd, stdout: 'pipe', stderr: 'pipe', detached: process.platform !== 'win32' })
    const pipes = [child.stdout, child.stderr].map(stream => ({ reader: stream.getReader(), done: false }))
    let interrupted = false
    let teardown: Promise<void> | undefined
    let announceStop: () => void = () => {}
    const stopped = new Promise<void>(resolve => { announceStop = resolve })
    const waitWithin = async <T>(promise: Promise<T>, milliseconds: number): Promise<T> => {
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        return await Promise.race([promise, new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Process or output cleanup did not finish within its grace period')), milliseconds)
        })])
      }
      finally {
        if (timer) clearTimeout(timer)
      }
    }
    const stop = (): void => {
      if (interrupted) return
      interrupted = true
      teardown = (async () => {
        const errors: string[] = []
        if (windowsTaskkill) {
          // Query and terminate the tree before its leader disappears. Killing
          // only the leader first loses taskkill's parent/descendant relation.
          try {
            const result = Bun.spawnSync([windowsTaskkill, '/PID', String(child.pid), '/T', '/F'], {
              stdout: 'ignore', stderr: 'ignore', timeout: 2000,
            })
            if (result.exitCode !== 0) errors.push(`taskkill failed with exit code ${result.exitCode}`)
          }
          catch { errors.push('Windows process-tree cleanup could not execute taskkill') }
          if (errors.length) {
            // Still dispose the direct child and readers while retaining the
            // tree-cleanup error; this must never produce a success receipt.
            try { child.kill('SIGKILL') }
            catch { errors.push('Direct child cleanup also failed') }
          }
        }
        else {
          const signalGroup = (signal: 'SIGTERM' | 'SIGKILL'): void => {
            try { process.kill(-child.pid, signal) }
            catch (error) {
              // The group may already have exited. Permission and other
              // failures are cleanup errors rather than successful disposal.
              if ((error as NodeJS.ErrnoException).code !== 'ESRCH') errors.push(`Process-group ${signal} failed`)
            }
          }
          signalGroup('SIGTERM')
          await new Promise<void>(resolve => setTimeout(resolve, 500))
          signalGroup('SIGKILL')
        }
        // A descendant may hold a pipe even after its leader exits. Close our
        // readers explicitly and bound the wait, including an escaped process
        // outside the owned group, without claiming to have killed that escape.
        const close = Promise.all([
          ...pipes.filter(pipe => !pipe.done).map(async (pipe) => {
            try { await pipe.reader.cancel() }
            catch { errors.push('Output reader cancellation failed') }
          }),
          child.exited,
        ])
        try { await waitWithin(close, 1000) }
        catch { errors.push('Process or output cleanup exceeded its grace period') }
        if (errors.length) fail(`Consumer script ${script} cleanup failed: ${errors.join('; ')}`)
      })()
      // The interruption race awaits this exact promise below. Attach its
      // rejection handler now so a quick cleanup failure is never unhandled.
      void teardown.catch(() => {})
      announceStop()
    }
    const deadline = setTimeout(stop, checkTimeoutMs)
    options.signal?.addEventListener('abort', stop, { once: true })
    if (options.signal?.aborted) stop()
    const output = createHash('sha256')
    async function drain(pipe: typeof pipes[number]): Promise<void> {
      try {
        while (true) {
          const next = await pipe.reader.read()
          if (next.done) break
          output.update(next.value)
        }
      }
      finally {
        pipe.done = true
        pipe.reader.releaseLock()
      }
    }
    let exitCode: number
    try {
      const completion = Promise.all([Promise.all(pipes.map(drain)), child.exited]).then(result => ({ kind: 'completed' as const, exitCode: result[1] }))
      const result = await Promise.race([completion, stopped.then(() => ({ kind: 'interrupted' as const }))])
      if (result.kind === 'interrupted' || interrupted) {
        await teardown
        fail(`Consumer script ${script} was interrupted or exceeded its execution budget`)
      }
      exitCode = result.exitCode
    }
    catch (error) {
      stop()
      await teardown
      throw error
    }
    finally {
      clearTimeout(deadline)
      options.signal?.removeEventListener('abort', stop)
    }
    if (interrupted || options.signal?.aborted)
      fail(`Consumer script ${script} was interrupted or exceeded its execution budget`)
    if (exitCode !== 0) fail(`Consumer script ${script} failed with exit code ${exitCode}`)
    receipt.consumer.checks.push({ script, exitCode: 0, outputSha256: output.digest('hex') })
  }
  const final = installedState(plan, options.cwd, archives)
  if (final.sha256 !== initial.sha256 || final.manifests !== initial.manifests) fail('Consumer checks changed the verified lockfile or package identities')
  receipt.consumer.sha256 = initial.sha256
  options.signal?.throwIfAborted()
  receipt.verifiedAt = new Date().toISOString()
  return receipt
}
