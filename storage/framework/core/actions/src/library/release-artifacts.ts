import type { LibraryConfig } from '@stacksjs/types'
import type { ProjectScriptReceipt } from '../project-scripts'
import type { LibraryPublishPlan } from './publish'
import { createHash } from 'node:crypto'
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { libraryArchiveEntries, safeArchivePath } from './archive'

export interface LibraryReleaseSource { repository: string, commit: string, tag?: string }
export interface LibraryFileIdentity { sha256: string, bytes: number }
export interface LibraryReleasePackage {
  name: string
  version: string
  registry: 'npm' | 'pantry'
  access: 'public' | 'restricted'
  tag: string
  archive: LibraryFileIdentity & { path: string, integrity: string, files: Record<string, LibraryFileIdentity> }
  hosted?: { manifest: string, files: Record<string, LibraryFileIdentity & { packagePath?: string }> }
}
export interface LibraryReleaseCandidate {
  schemaVersion: 1
  source: LibraryReleaseSource
  toolchain: { bun: string, packer: 'bun', packerVersion: string, compiler?: { name: '@stacksjs/stx', version: string } }
  packages: LibraryReleasePackage[]
  checks: ProjectScriptReceipt['checks']
}
export interface RetainedHostedInput {
  /** Manifest filename among files, interpreted as data rather than executed. */
  manifest: string
  files: Array<{ path: string, source: string, packagePath?: string, sha256?: string, bytes?: number }>
}
/** Structural subset of the native hosted builder report, independent of compiler imports. */
export interface LibraryHostedRetentionReport {
  immutableDir: string
  manifestPath: string
  files: Array<{ path: string, relativePath: string, sha256: string, bytes: number }>
}

/** Keep hosted aliases and immutable files, binding compiler assets to package bytes. */
export function hostedLibraryRetentionInput(report: LibraryHostedRetentionReport): RetainedHostedInput {
  const manifest = report.files.find(file => resolve(file.path) === resolve(report.manifestPath))
  if (!manifest) fail('Hosted build report is missing its immutable manifest')
  return {
    manifest: manifest.relativePath,
    files: report.files.map(file => ({
      path: file.relativePath, source: file.path, sha256: file.sha256, bytes: file.bytes,
      ...(['bundle.js', 'bundle.css', 'custom-elements.json'].includes(basename(file.path)) && resolve(file.path) === resolve(report.immutableDir, basename(file.path))
        ? { packagePath: `dist/${basename(file.path)}` } : {}),
    })),
  }
}
export interface LibraryReleaseLimits { maxArchiveBytes?: number, maxExpandedBytes?: number }
export interface RetainLibraryReleaseOptions extends LibraryReleaseLimits {
  directory: string
  source: LibraryReleaseSource
  tag: string
  packages: Array<LibraryPublishPlan & { archivePath?: string, hosted?: RetainedHostedInput }>
  checks?: ProjectScriptReceipt['checks']
  compiler?: LibraryReleaseCandidate['toolchain']['compiler']
}

export function librarySha256(bytes: Uint8Array): string { return createHash('sha256').update(bytes).digest('hex') }
export function libraryIntegrity(bytes: Uint8Array): string { return `sha512-${createHash('sha512').update(bytes).digest('base64')}` }
function identity(bytes: Uint8Array): LibraryFileIdentity { return { sha256: librarySha256(bytes), bytes: bytes.length } }
function fail(message: string): never { throw new Error(`Library release blocked: ${message}`) }
const namePattern = /^(?:@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/
const versionPattern = /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/
const tagPattern = /^[a-z][a-z0-9_-]{0,63}$/

export function validateLibraryReleaseSource(source: LibraryReleaseSource): void {
  if (!source || !/^[\w-][\w.-]*\/[\w-][\w.-]*$/.test(source.repository) || !/^[a-f0-9]{40}$/.test(source.commit)
    || (source.tag !== undefined && (typeof source.tag !== 'string' || !source.tag || source.tag.length > 255)))
    fail('Expected a source repository and full commit SHA')
}
function fileIdentity(value: LibraryFileIdentity): boolean {
  return !!value && /^[a-f0-9]{64}$/.test(value.sha256) && Number.isSafeInteger(value.bytes) && value.bytes >= 0
}

/** Validate retained data before interpreting it as paths, publisher input or URLs. */
export function validateLibraryReleaseCandidate(value: unknown): asserts value is LibraryReleaseCandidate {
  const record = value as LibraryReleaseCandidate
  if (!record || record.schemaVersion !== 1 || !Array.isArray(record.packages) || !record.packages.length
    || record.packages.length > 1000 || !Array.isArray(record.checks) || !record.toolchain
    || record.toolchain.packer !== 'bun' || !versionPattern.test(record.toolchain.bun) || !versionPattern.test(record.toolchain.packerVersion))
    fail('Expected a version 1 retained library candidate')
  if (record.toolchain.compiler && (record.toolchain.compiler.name !== '@stacksjs/stx' || !versionPattern.test(record.toolchain.compiler.version)))
    fail('Invalid retained compiler identity')
  validateLibraryReleaseSource(record.source)
  const names = new Set<string>()
  for (const pkg of record.packages) {
    if (!pkg || typeof pkg.name !== 'string' || !namePattern.test(pkg.name) || names.has(pkg.name) || !versionPattern.test(pkg.version)
      || !['npm', 'pantry'].includes(pkg.registry) || !['public', 'restricted'].includes(pkg.access)
      || !tagPattern.test(pkg.tag) || !pkg.archive || !safeArchivePath(pkg.archive.path)
      || !fileIdentity(pkg.archive) || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(pkg.archive.integrity)
      || !pkg.archive.files || typeof pkg.archive.files !== 'object' || Array.isArray(pkg.archive.files)
      || !Object.hasOwn(pkg.archive.files, 'package.json') || Object.keys(pkg.archive.files).length > 100_000)
      fail('Invalid package identity in retained candidate')
    names.add(pkg.name)
    for (const [path, file] of Object.entries(pkg.archive.files)) {
      if (!safeArchivePath(path) || !fileIdentity(file)) fail('Invalid retained package file identity')
    }
    if (pkg.hosted) {
      if (!safeArchivePath(pkg.hosted.manifest) || !pkg.hosted.files || typeof pkg.hosted.files !== 'object'
        || Array.isArray(pkg.hosted.files) || !Object.hasOwn(pkg.hosted.files, pkg.hosted.manifest)
        || Object.keys(pkg.hosted.files).length > 100_000) fail('Invalid retained hosted manifest')
      for (const [path, file] of Object.entries(pkg.hosted.files)) {
        if (!safeArchivePath(path) || !fileIdentity(file) || (file.packagePath !== undefined && !safeArchivePath(file.packagePath)))
          fail('Invalid retained hosted file identity')
      }
    }
  }
  for (const check of record.checks) {
    if (!check || !/^[a-z0-9][\w:.-]*$/i.test(check.script) || check.exitCode !== 0 || !/^[a-f0-9]{64}$/.test(check.outputSha256))
      fail('Invalid retained check receipt')
  }
}

/** Refuse symlinks at every level; retained data can only name regular files. */
async function retainedBytes(root: string, path: string, limit: number): Promise<Uint8Array> {
  if (!safeArchivePath(path)) fail('Unsafe retained file path')
  let current = resolve(root)
  if (!(await lstat(current)).isDirectory()) fail('Retained candidate root is not a directory')
  const parts = path.split('/')
  for (let i = 0; i < parts.length; i++) {
    current = join(current, parts[i]!)
    const stat = await lstat(current)
    if (i < parts.length - 1 ? !stat.isDirectory() : !stat.isFile() || stat.size > limit)
      fail('Retained path is not a bounded regular file')
  }
  const bytes = new Uint8Array(await readFile(current))
  if (bytes.length > limit) fail('Retained file exceeds byte budget')
  return bytes
}
function limits(options: LibraryReleaseLimits) {
  const archive = options.maxArchiveBytes ?? 64 * 1024 * 1024
  const expanded = options.maxExpandedBytes ?? 256 * 1024 * 1024
  if (![archive, expanded].every(value => Number.isSafeInteger(value) && value > 0)) fail('Invalid archive byte budgets')
  return { archive, expanded }
}
function validateArchiveExports(manifest: Record<string, unknown>, files: Map<string, Uint8Array>): void {
  function target(value: unknown): void {
    if (value === null) return
    if (Array.isArray(value)) { value.forEach(target); return }
    if (value && typeof value === 'object') { Object.values(value).forEach(target); return }
    if (typeof value !== 'string') fail('Archive declares an invalid export target')
    const path = value.replace(/^\.\//, '')
    if (!safeArchivePath(path)) fail('Archive export escapes its package')
    if (path.includes('*')) {
      const glob = new Bun.Glob(path)
      if (![...files.keys()].some(file => glob.match(file))) fail(`Archive export ${value} has no files`)
    }
    else if (!files.has(path)) fail(`Archive export ${value} is missing`)
  }
  if (manifest.exports !== undefined) target(manifest.exports)
  for (const key of ['main', 'module', 'types', 'typings']) if (manifest[key] !== undefined) target(manifest[key])
}
function sameIdentity(bytes: Uint8Array, expected: LibraryFileIdentity): boolean {
  return bytes.length === expected.bytes && librarySha256(bytes) === expected.sha256
}

/** Inspect current data only. Never builds or executes code from retained source. */
export async function inspectLibraryRelease(directory: string, source?: LibraryReleaseSource, options: LibraryReleaseLimits = {}): Promise<LibraryReleaseCandidate> {
  const budget = limits(options)
  const record: unknown = JSON.parse(new TextDecoder().decode(await retainedBytes(directory, 'candidate.json', 16 * 1024 * 1024)))
  validateLibraryReleaseCandidate(record)
  if (source) {
    validateLibraryReleaseSource(source)
    if (record.source.repository !== source.repository || record.source.commit !== source.commit
      || (source.tag !== undefined && record.source.tag !== source.tag)) fail('Retained source identity differs from the requested source')
  }
  for (let i = 0; i < record.packages.length; i++) {
    const pkg = record.packages[i]!
    const bytes = await retainedBytes(directory, pkg.archive.path, budget.archive)
    if (!sameIdentity(bytes, pkg.archive) || libraryIntegrity(bytes) !== pkg.archive.integrity) fail('Retained archive identity differs')
    const files = await libraryArchiveEntries(bytes, budget.expanded)
    if (files.size !== Object.keys(pkg.archive.files).length) fail('Retained archive file identity differs')
    for (const [path, bytes] of files) {
      if (!pkg.archive.files[path] || !sameIdentity(bytes, pkg.archive.files[path]!)) fail('Retained archive file identity differs')
    }
    const manifest = JSON.parse(new TextDecoder().decode(files.get('package.json')!)) as Record<string, unknown>
    if (manifest.name !== pkg.name || manifest.version !== pkg.version || manifest.private) fail('Retained archive package identity differs')
    validateArchiveExports(manifest, files)
    if (pkg.hosted) {
      if (Object.values(pkg.hosted.files).reduce((sum, file) => sum + file.bytes, 0) > budget.expanded) fail('Retained hosted files exceed byte budget')
      for (const [path, expected] of Object.entries(pkg.hosted.files)) {
        const hosted = await retainedBytes(directory, `hosted/${i}/${path}`, budget.expanded)
        if (!sameIdentity(hosted, expected) || (expected.packagePath && (!files.has(expected.packagePath) || !sameIdentity(files.get(expected.packagePath)!, expected))))
          fail('Retained hosted identity differs from retained package bytes')
      }
      JSON.parse(new TextDecoder().decode(await retainedBytes(directory, `hosted/${i}/${pkg.hosted.manifest}`, budget.expanded)))
    }
  }
  return record
}

/** Pack exactly once, retain the original archive, and commit the record last. */
export async function retainLibraryRelease(options: RetainLibraryReleaseOptions): Promise<LibraryReleaseCandidate> {
  validateLibraryReleaseSource(options.source)
  if (!tagPattern.test(options.tag) || !options.packages.length) fail('Retaining packages requires an explicit distribution tag')
  const budget = limits(options)
  // Exclusive directory creation prevents replacing an earlier immutable candidate.
  await mkdir(dirname(resolve(options.directory)), { recursive: true })
  await mkdir(options.directory, { recursive: false })
  const bun = Bun.which('bun')
  if (!bun) fail('Bun packer is unavailable')
  const probe = Bun.spawnSync([bun, '--version'], { stdout: 'pipe', stderr: 'pipe', timeout: 10_000 })
  if (probe.exitCode !== 0) fail('Bun packer version probe failed')
  const version = probe.stdout.toString().trim()
  const record: LibraryReleaseCandidate = { schemaVersion: 1, source: { ...options.source }, toolchain: { bun: version, packer: 'bun', packerVersion: version, ...(options.compiler ? { compiler: options.compiler } : {}) }, packages: [], checks: options.checks ?? [] }
  await mkdir(join(options.directory, 'archives'))
  for (let i = 0; i < options.packages.length; i++) {
    const plan = options.packages[i]!
    const path = `archives/${i}.tgz`
    if (plan.archivePath) {
      const bytes = await retainedBytes(dirname(resolve(plan.archivePath)), basename(plan.archivePath), budget.archive)
      await writeFile(join(options.directory, path), bytes, { flag: 'wx' })
    }
    else {
      const packed = Bun.spawnSync([bun, 'pm', 'pack', '--ignore-scripts', '--filename', resolve(options.directory, path)], { cwd: plan.dir, stdout: 'pipe', stderr: 'pipe', timeout: 60_000 })
      if (packed.exitCode !== 0) fail(`Packing ${plan.name} failed: ${packed.stderr.toString().slice(0, 1000)}`)
    }
    const bytes = await retainedBytes(options.directory, path, budget.archive)
    const entries = await libraryArchiveEntries(bytes, budget.expanded)
    const pkg: LibraryReleasePackage = { name: plan.name, version: plan.version, registry: plan.registry, access: plan.access, tag: options.tag, archive: { path, ...identity(bytes), integrity: libraryIntegrity(bytes), files: Object.fromEntries([...entries].map(([name, bytes]) => [name, identity(bytes)])) } }
    if (plan.hosted) {
      pkg.hosted = { manifest: plan.hosted.manifest, files: Object.create(null) as NonNullable<LibraryReleasePackage['hosted']>['files'] }
      for (const file of plan.hosted.files) {
        if (!safeArchivePath(file.path) || Object.hasOwn(pkg.hosted.files, file.path)) fail('Unsafe or duplicate hosted file path')
        const bytes = await retainedBytes(dirname(resolve(file.source)), basename(file.source), budget.expanded)
        if (file.sha256 !== undefined && librarySha256(bytes) !== file.sha256 || file.bytes !== undefined && bytes.length !== file.bytes)
          fail('Hosted output changed after the native build report')
        const destination = join(options.directory, `hosted/${i}`, file.path)
        await mkdir(dirname(destination), { recursive: true })
        await writeFile(destination, bytes, { flag: 'wx' })
        pkg.hosted.files[file.path] = { ...identity(bytes), ...(file.packagePath ? { packagePath: file.packagePath } : {}) }
      }
    }
    record.packages.push(pkg)
  }
  validateLibraryReleaseCandidate(record)
  await writeFile(join(options.directory, 'candidate.json'), `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' })
  return inspectLibraryRelease(options.directory, options.source, options)
}

/** Materialize validated bytes for inspection/consumer checks, never for publication. */
export async function materializeLibraryRelease(directory: string, destination: string, options: LibraryReleaseLimits = {}): Promise<LibraryReleaseCandidate> {
  const record = await inspectLibraryRelease(directory, undefined, options)
  await mkdir(destination, { recursive: false })
  for (let i = 0; i < record.packages.length; i++) {
    const archive = await retainedBytes(directory, record.packages[i]!.archive.path, limits(options).archive)
    for (const [path, bytes] of await libraryArchiveEntries(archive, limits(options).expanded)) {
      const target = join(destination, String(i), path)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, bytes, { flag: 'wx' })
    }
  }
  return record
}

/** Native builder/resolver remain the source of package names, versions and outputs. */
export async function prepareLibraryRelease(options: Omit<RetainLibraryReleaseOptions, 'packages' | 'checks'> & { config?: LibraryConfig, checks?: string[], cwd: string }): Promise<LibraryReleaseCandidate | undefined> {
  const { configuredLibrary } = await import('./packages')
  const config = options.config ?? await configuredLibrary()
  if (config?.releaseable === false) return undefined
  const { buildLibraryPackages } = await import('./build')
  const reports = await buildLibraryPackages({ config, allowEmpty: true })
  if (!reports.length) return undefined
  const { planLibraryPublish } = await import('./publish')
  const plans = await planLibraryPublish(config, { allowEmpty: true })
  if (!plans.length) return undefined
  const compiler = reports.some(report => report.kind !== 'functions')
    ? { name: '@stacksjs/stx' as const, version: (await Bun.file(Bun.resolveSync('@stacksjs/stx/package.json', import.meta.dir)).json() as { version: string }).version } : undefined
  const { runProjectScripts } = await import('../project-scripts')
  const receipt = options.checks?.length ? await runProjectScripts({ cwd: options.cwd, scripts: options.checks }) : undefined
  return retainLibraryRelease({ ...options, compiler, packages: plans.map(plan => {
    const report = reports.find(report => report.name === plan.name) as { hosted?: LibraryHostedRetentionReport } | undefined
    return { ...plan, ...(report?.hosted ? { hosted: hostedLibraryRetentionInput(report.hosted) } : {}) }
  }), checks: receipt?.checks })
}
