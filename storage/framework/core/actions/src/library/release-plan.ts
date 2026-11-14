import type { LibraryConfig, LibraryReleaseOptions } from '@stacksjs/types/library'
import { lstat, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { incrementVersion, isReleaseType, isValidVersion } from '@stacksjs/bumpx'
import { isCalendarBump, nextCalendarVersion } from '../calendar-version'
import { configuredLibrary, resolveLibraryPackages } from './packages'
import { retainedArchivePublishCommand } from './release-registry'

export const DEFAULT_LIBRARY_SOURCE_CI = {
  workflow: '.github/workflows/ci.yml', branch: 'main',
  requiredJobs: ['Lint', 'Typecheck', 'Test'],
}
export interface LibraryReleasePlan {
  config: LibraryConfig
  repository: string
  tag: string
  publisher?: LibraryReleaseOptions['publisher']
  checks: string[]
  sourceCi: NonNullable<LibraryReleaseOptions['sourceCi']>
  packages: Array<{ name: string, version: string, registry: 'npm' | 'pantry', access: 'public' | 'restricted' }>
}

/** Classify a validated package version, excluding its build metadata. */
export function isLibraryPrereleaseVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+-/.test(version)
}

/** Read-only validation used BEFORE generation, Bump, tags or provider writes. */
export async function planNativeLibraryRelease(options: { cwd: string, config?: LibraryConfig, bump?: string, preid?: string, validateWorkflow?: boolean, which?: (bin: string) => string | null }): Promise<LibraryReleasePlan | undefined> {
  const config = options.config ?? await configuredLibrary()
  if (config?.releaseable === false) return undefined
  const packages = (await resolveLibraryPackages(config, { onUnmatched: 'skip' })).filter(pkg => !pkg.private)
  if (!packages.length) return undefined
  const root = JSON.parse(await readFile(join(options.cwd, 'package.json'), 'utf8')) as { version?: string, scripts?: Record<string, string> }
  const release = config?.release ?? {}
  const sourceCi = release.sourceCi ?? DEFAULT_LIBRARY_SOURCE_CI
  const repository = config?.repository
  if (!repository || !/^[\w-][\w.-]*\/[\w-][\w.-]*$/.test(repository)) throw new Error('Library release requires library.repository as owner/repository')
  if (!/^\.github\/workflows\/[\w.-]+\.ya?ml$/.test(sourceCi.workflow) || !sourceCi.branch || !sourceCi.requiredJobs?.length
    || sourceCi.requiredJobs.some(name => typeof name !== 'string' || !name) || new Set(sourceCi.requiredJobs).size !== sourceCi.requiredJobs.length)
    throw new Error('Library release requires an exact source CI workflow, branch and unique required jobs')
  if (release.sourceCi?.timeoutMinutes !== undefined && (!Number.isSafeInteger(release.sourceCi.timeoutMinutes) || release.sourceCi.timeoutMinutes < 1 || release.sourceCi.timeoutMinutes > 120))
    throw new Error('Library source CI timeoutMinutes must be an integer from 1 to 120')
  const checks = release.checks ?? []
  if (!Array.isArray(checks) || new Set(checks).size !== checks.length || checks.some(name => !/^[a-z0-9][\w:.-]*$/i.test(name) || !root.scripts?.[name]?.trim()))
    throw new Error('Library release checks must name unique declared package.json scripts')
  let version = root.version
  if (!version || !isValidVersion(version)) throw new Error('Library release requires a valid project version')
  if (options.bump) {
    if (isCalendarBump(options.bump)) version = nextCalendarVersion(version)
    else if (isReleaseType(options.bump) || isValidVersion(options.bump)) version = incrementVersion(version, options.bump, options.preid)
    else throw new Error('Invalid library release bump')
  }
  const resolved = packages.map(pkg => ({ name: pkg.name, version: pkg.version ?? version!, registry: pkg.registry, access: pkg.access }))
  const prerelease = resolved.some(pkg => isLibraryPrereleaseVersion(pkg.version))
  if (prerelease && (!release.distTag || release.distTag === 'latest')) throw new Error('Prerelease packages require an explicit non-latest distribution tag in library.release.distTag; --preid only selects a version identifier')
  const tag = release.distTag ?? 'latest'
  for (const pkg of resolved) {
    if (!isValidVersion(pkg.version)) throw new Error(`Invalid library package version: ${pkg.name}`)
    if (pkg.registry !== 'npm') throw new Error('Exact retained archive publication/readback for the Pantry registry is unsupported')
    retainedArchivePublishCommand({ ...pkg, tag, archive: { path: '', bytes: 0, sha256: '', integrity: '', files: {} } }, '/validation-only.tgz', { publisher: release.publisher, which: options.which, dryRun: true })
  }
  if (options.validateWorkflow) {
    const workflow = await lstat(join(options.cwd, sourceCi.workflow)).catch(() => undefined)
    if (!workflow?.isFile() || workflow.isSymbolicLink()) throw new Error(`Source CI workflow ${sourceCi.workflow} is not installed. Adopt the native app CI/release workflows before releasing libraries.`)
  }
  return { config: config!, repository, tag, publisher: release.publisher, checks, sourceCi: { ...sourceCi, requiredJobs: [...sourceCi.requiredJobs] }, packages: resolved }
}
