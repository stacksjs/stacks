import type { LibraryReleaseCandidate, LibraryReleaseLimits, LibraryReleasePackage, LibraryReleaseSource } from './release-artifacts'
import type { LibraryNetworkOptions, LibraryReader } from './release-network'
import type { LibraryPublisher } from './publish'
import type { LibraryRegistryReadAuthOptions } from './release-registry-auth'
import { spawnOwnedProcess } from '@stacksjs/cli/owned-process'
import { resolve } from 'node:path'
import { inspectLibraryRelease, libraryIntegrity, librarySha256 } from './release-artifacts'
import { createLibraryReleaseReader } from './release-network'
import { publishCommand } from './publish'
import { libraryRegistryOrigin, libraryRegistryReadHeaders } from './release-registry-auth'

export type { LibraryRegistryReadAuth } from './release-registry-auth'

export interface LibraryRegistryOptions extends LibraryNetworkOptions, LibraryReleaseLimits, LibraryRegistryReadAuthOptions {
  /** Override for a private npm registry. HTTP is limited to loopback. */
  npmRegistry?: string
}
export interface LibraryRegistryPackageReceipt {
  name: string
  version: string
  registry: 'npm' | 'pantry'
  integrity: string
  archiveSha256: string
  /** Registry origin plus name/version identify provenance; opaque download URLs may be credentials. */
  registryOrigin: string
  tags: Record<string, string>
}
export interface LibraryRegistryReceipt {
  schemaVersion: 1
  source: LibraryReleaseSource
  verifierCommit?: string
  verifiedAt: string
  packages: Array<LibraryRegistryPackageReceipt & { status?: 'published' | 'existing-identical' | 'dry-run' }>
}
export interface LibraryReadbackOptions extends LibraryRegistryOptions {
  source?: LibraryReleaseSource
  verifierCommit?: string
  /** Defaults to true. Historical audits can report moved tags without requiring their old target. */
  requireCurrentTag?: boolean
}
function requireNpm(pkg: LibraryReleasePackage): void {
  if (pkg.registry !== 'npm') throw new Error('Exact retained archive readback for the Pantry registry is not supported by this adapter')
}

async function publishedPackage(pkg: LibraryReleasePackage, options: LibraryRegistryOptions, reader: LibraryReader, missing: boolean, checkTag: boolean): Promise<LibraryRegistryPackageReceipt | undefined> {
  requireNpm(pkg)
  const origin = libraryRegistryOrigin(options.npmRegistry)
  const headers = libraryRegistryReadHeaders(options, pkg.access === 'restricted')
  const endpoint = `${origin}/${encodeURIComponent(pkg.name)}`
  const raw = await reader.read(`${endpoint}/${encodeURIComponent(pkg.version)}`, { missing, processing: !missing, headers })
  if (!raw) return undefined
  const metadata = JSON.parse(new TextDecoder().decode(raw)) as { name?: string, version?: string, dist?: { integrity?: string, tarball?: string } }
  if (metadata.name !== pkg.name || metadata.version !== pkg.version || metadata.dist?.integrity !== pkg.archive.integrity || typeof metadata.dist.tarball !== 'string')
    throw new Error(`Published ${pkg.name}@${pkg.version} metadata identity differs from the retained candidate`)
  let tarball: URL
  try { tarball = new URL(metadata.dist.tarball) }
  catch { throw new Error('Published tarball URL is invalid') }
  if (tarball.origin !== origin || tarball.username || tarball.password || tarball.hash)
    throw new Error('Published tarball is outside its actual registry origin')
  const bytes = await reader.read(tarball.href, { maxBytes: options.maxArchiveBytes ?? 64 * 1024 * 1024, processing: !missing, headers })
  if (!bytes || bytes.length !== pkg.archive.bytes || librarySha256(bytes) !== pkg.archive.sha256 || libraryIntegrity(bytes) !== pkg.archive.integrity)
    throw new Error(`Published ${pkg.name}@${pkg.version} archive bytes differ from the retained candidate`)
  const tagsRaw = await reader.read(endpoint, { processing: !missing, headers })
  const packument = JSON.parse(new TextDecoder().decode(tagsRaw)) as { 'dist-tags'?: Record<string, string> }
  const tags = packument['dist-tags']
  if (!tags || typeof tags !== 'object' || Array.isArray(tags) || Object.values(tags).some(value => typeof value !== 'string'))
    throw new Error('Actual registry distribution tags are invalid')
  if (checkTag && tags[pkg.tag] !== pkg.version) throw new Error(`Actual registry tag ${pkg.tag} does not identify ${pkg.name}@${pkg.version}`)
  return { name: pkg.name, version: pkg.version, registry: pkg.registry, integrity: pkg.archive.integrity, archiveSha256: pkg.archive.sha256, registryOrigin: origin, tags }
}

/** Read actual bytes/tags with current verifier code; never has a publisher capability. */
export async function readbackLibraryRelease(directory: string, options: LibraryReadbackOptions = {}): Promise<LibraryRegistryReceipt> {
  const candidate = await inspectLibraryRelease(directory, options.source, options)
  if (options.verifierCommit !== undefined && !/^[a-f0-9]{40}$/.test(options.verifierCommit)) throw new Error('Expected full verifier commit SHA')
  libraryRegistryReadHeaders(options, candidate.packages.some(pkg => pkg.access === 'restricted'))
  const reader = createLibraryReleaseReader(options)
  const packages: LibraryRegistryPackageReceipt[] = []
  for (const pkg of candidate.packages) packages.push((await publishedPackage(pkg, options, reader, false, options.requireCurrentTag !== false))!)
  return { schemaVersion: 1, source: candidate.source, verifierCommit: options.verifierCommit, verifiedAt: new Date().toISOString(), packages }
}

export interface PublishPreparedLibraryOptions extends LibraryRegistryOptions {
  source?: LibraryReleaseSource
  /** Publisher CLI configuration is read from the current app, never restored sources. */
  cwd?: string
  publisher?: LibraryPublisher
  dryRun?: boolean
  which?: (bin: string) => string | null
  /** Boundary for publisher execution; arguments always name the retained tgz. */
  execute?: (args: string[], options: { cwd: string, timeoutMs: number }) => Promise<number>
}

/** Archive capability is deliberately narrower than legacy directory publication. */
export function retainedArchivePublishCommand(pkg: LibraryReleasePackage, archive: string, options: Pick<PublishPreparedLibraryOptions, 'which' | 'publisher' | 'dryRun' | 'npmRegistry'> = {}): string[] {
  const available = options.which ?? Bun.which
  const archiveCapable = (bin: string) => bin === 'pantry' && options.publisher === undefined ? null : available(bin)
  const command = publishCommand(pkg.registry, archiveCapable, pkg.tag, options.publisher)
  if (command[0] === 'pantry')
    throw new Error('Unsupported publisher capability: Pantry publish accepts package directories, not an exact retained .tgz. Select bun or npm for an npm-bound package.')
  return [...command, archive, '--access', pkg.access, '--ignore-scripts', '--registry', libraryRegistryOrigin(options.npmRegistry), ...(options.dryRun ? ['--dry-run'] : [])]
}

/** Never repack restored content. Retry skips existing versions only after comparing actual bytes. */
export async function publishPreparedLibraryRelease(directory: string, options: PublishPreparedLibraryOptions = {}): Promise<LibraryRegistryReceipt> {
  const candidate: LibraryReleaseCandidate = await inspectLibraryRelease(directory, options.source, options)
  // Validate every capability before publishing the first member of a set.
  const commands = candidate.packages.map(pkg => retainedArchivePublishCommand(pkg, resolve(directory, pkg.archive.path), options))
  libraryRegistryReadHeaders(options, candidate.packages.some(pkg => pkg.access === 'restricted'))
  const reader = createLibraryReleaseReader(options)
  const original = JSON.stringify(candidate)
  const existingPackages: Array<LibraryRegistryPackageReceipt | undefined> = []
  if (!options.dryRun) {
    for (const pkg of candidate.packages) {
      const existing = await publishedPackage(pkg, options, reader, true, false)
      if (existing && existing.tags[pkg.tag] !== pkg.version) throw new Error(`Existing identical archive is missing requested tag ${pkg.tag}; refusing implicit tag mutation`)
      existingPackages.push(existing)
    }
  }
  const packages: LibraryRegistryReceipt['packages'] = []
  const execute = options.execute ?? (async (args, execution) => {
    const bun = Bun.which('bun')
    if (!bun) throw new Error('The native publisher process owner requires an installed Bun runtime')
    const proc = spawnOwnedProcess(args, { ownerRuntime: bun, cwd: execution.cwd, stdout: 'inherit', stderr: 'inherit', stopGraceMs: 0 })
    // The deadline forcibly stops the owned tree, even if a publisher handles
    // SIGTERM. exited settles only after the native owner disposes descendants.
    const timer = setTimeout(() => { void proc.stop().catch(() => {}) }, Math.max(1, execution.timeoutMs))
    try { return (await proc.exited).code }
    finally { clearTimeout(timer); await proc.stop() }
  })
  for (let i = 0; i < candidate.packages.length; i++) {
    const pkg = candidate.packages[i]!
    if (options.dryRun) {
      // Dry-run delegates publisher validation but makes no registry reads/writes.
      const exit = await execute(commands[i]!, { cwd: resolve(options.cwd ?? process.cwd()), timeoutMs: options.requestTimeoutMs ?? 15_000 })
      if (exit !== 0) throw new Error(`Dry-run publishing ${pkg.name} failed with exit code ${exit}`)
      packages.push({ name: pkg.name, version: pkg.version, registry: pkg.registry, integrity: pkg.archive.integrity, archiveSha256: pkg.archive.sha256, registryOrigin: libraryRegistryOrigin(options.npmRegistry), tags: {}, status: 'dry-run' })
      continue
    }
    const existing = existingPackages[i]
    if (existing) {
      packages.push({ ...existing, status: 'existing-identical' })
      continue
    }
    // Product checks or another process cannot replace retained bytes unnoticed.
    if (JSON.stringify(await inspectLibraryRelease(directory, options.source, options)) !== original) throw new Error('Retained candidate record changed during publication')
    if (reader.remaining() <= 0) throw new Error('Library publication deadline exceeded')
    const exit = await execute(commands[i]!, { cwd: resolve(options.cwd ?? process.cwd()), timeoutMs: Math.min(60_000, reader.remaining()) })
    // An interrupted/failed upload may already have committed. Verify it before
    // returning failure; never blindly execute a second mutable publish.
    const actual = await publishedPackage(pkg, options, reader, exit !== 0, true)
    if (!actual) throw new Error(`Publishing ${pkg.name} failed with exit code ${exit}`)
    packages.push({ ...actual, status: 'published' })
  }
  return { schemaVersion: 1, source: candidate.source, verifiedAt: new Date().toISOString(), packages }
}
