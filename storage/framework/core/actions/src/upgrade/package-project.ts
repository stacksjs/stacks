import type { DefaultsSyncMarker } from '@stacksjs/path'
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { DEFAULTS_SYNC_MARKER, defaultsPackagePath } from '@stacksjs/path'

export interface ProjectStructureChange {
  path: string
  action: 'add' | 'update' | 'remove'
}

interface PackageProjectOptions {
  dryRun?: boolean
  /**
   * Treat same-size files as equal instead of reading both sides.
   *
   * A full content comparison of the defaults tree costs ~75ms warm and ~200ms
   * cold, which is too much to spend on every `buddy dev`. Sizes alone still
   * catch the drift that matters, because a tree that is releases behind
   * differs in which files exist long before it differs only in bytes.
   *
   * Only meaningful together with `dryRun`: nothing should be copied on the
   * strength of a size match.
   */
  shallow?: boolean
}

interface ProjectPackageJson {
  scripts?: Record<string, string>
  workspaces?: string[]
  [key: string]: unknown
}

const DEFAULTS_PACKAGE_IGNORES = new Set([
  'README.md',
  'build.ts',
  'node_modules',
  'package.json',
  'project',
  'tests',
])

const LOCAL_DEFAULT_IGNORES = new Set([
  '.DS_Store',
  '.discovered-models.json',
  DEFAULTS_SYNC_MARKER,
  'dist',
  'node_modules',
])

const LEGACY_PACKAGE_PROJECT_FILES = ['pantry.lock']

const SUPPORT_FILES: Array<{ source: string, target: string, executable?: boolean }> = [
  { source: 'project/buddy', target: 'buddy', executable: true },
  { source: 'project/bootstrap', target: 'bootstrap', executable: true },
  {
    source: 'project/storage/framework/tsconfig.app.json',
    target: 'storage/framework/tsconfig.app.json',
  },
  {
    source: 'project/storage/framework/tsconfig.base.json',
    target: 'storage/framework/tsconfig.base.json',
  },
  {
    source: 'project/storage/framework/server/tsconfig.docker.json',
    target: 'storage/framework/server/tsconfig.docker.json',
  },
]

function sameFile(left: string, right: string, shallow = false): boolean {
  if (!existsSync(left) || !existsSync(right))
    return false

  const leftStat = statSync(left)
  const rightStat = statSync(right)
  if (leftStat.size !== rightStat.size)
    return false

  if (shallow)
    return true

  return readFileSync(left).equals(readFileSync(right))
}

function copyFileIfChanged(
  source: string,
  target: string,
  projectRoot: string,
  changes: ProjectStructureChange[],
  options: PackageProjectOptions,
  executable = false,
): void {
  // `shallow` is ignored unless nothing is being written, so a size match can
  // never be the reason a stale file survives a real sync.
  if (sameFile(source, target, options.shallow && options.dryRun)) {
    if (executable && !options.dryRun)
      chmodSync(target, 0o755)
    return
  }

  changes.push({
    path: relative(projectRoot, target),
    action: existsSync(target) ? 'update' : 'add',
  })

  if (options.dryRun)
    return

  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, readFileSync(source))
  if (executable)
    chmodSync(target, 0o755)
}

function syncDirectory(
  source: string,
  target: string,
  projectRoot: string,
  changes: ProjectStructureChange[],
  options: PackageProjectOptions,
  isRoot = false,
): void {
  if (!options.dryRun)
    mkdirSync(target, { recursive: true })
  const sourceEntries = new Set<string>()

  for (const entry of readdirSync(source)) {
    if (isRoot && DEFAULTS_PACKAGE_IGNORES.has(entry))
      continue

    sourceEntries.add(entry)
    const sourcePath = join(source, entry)
    const targetPath = join(target, entry)
    const sourceStat = lstatSync(sourcePath)

    if (sourceStat.isDirectory()) {
      syncDirectory(sourcePath, targetPath, projectRoot, changes, options)
      continue
    }

    copyFileIfChanged(sourcePath, targetPath, projectRoot, changes, options)
  }

  if (!existsSync(target))
    return

  for (const entry of readdirSync(target)) {
    if (LOCAL_DEFAULT_IGNORES.has(entry) || sourceEntries.has(entry))
      continue

    const targetPath = join(target, entry)
    changes.push({ path: relative(projectRoot, targetPath), action: 'remove' })
    if (!options.dryRun)
      rmSync(targetPath, { recursive: true, force: true })
  }
}

/**
 * Refresh the package-managed app scaffold from the installed
 * `@stacksjs/defaults` package.
 */
export function syncPackageProjectFiles(
  projectRoot: string,
  defaultsPackageRoot: string,
  options: PackageProjectOptions = {},
): ProjectStructureChange[] {
  const changes: ProjectStructureChange[] = []
  const targetDefaults = join(projectRoot, 'storage/framework/defaults')

  syncDirectory(defaultsPackageRoot, targetDefaults, projectRoot, changes, options, true)

  for (const file of SUPPORT_FILES) {
    const source = join(defaultsPackageRoot, file.source)
    if (!existsSync(source))
      continue

    copyFileIfChanged(
      source,
      join(projectRoot, file.target),
      projectRoot,
      changes,
      options,
      file.executable,
    )
  }

  for (const legacyFile of LEGACY_PACKAGE_PROJECT_FILES) {
    const target = join(projectRoot, legacyFile)
    if (!existsSync(target))
      continue

    changes.push({ path: legacyFile, action: 'remove' })
    if (!options.dryRun)
      rmSync(target, { force: true })
  }

  if (!options.dryRun)
    stampDefaultsSync(targetDefaults, defaultsPackageRoot)

  return changes
}

/**
 * Record which release the tree was copied from.
 *
 * Without this the vendored tree carries no version of its own, so an app that
 * moves `stacks` forward through `package.json` and `bun install` (which never
 * runs the sync) has no way to notice that its framework defaults stayed put.
 */
function stampDefaultsSync(targetDefaults: string, defaultsPackageRoot: string): void {
  const version = manifestVersion(defaultsPackageRoot)
  if (!version)
    return

  const marker: DefaultsSyncMarker = { version, syncedAt: new Date().toISOString() }
  mkdirSync(targetDefaults, { recursive: true })
  writeFileSync(join(targetDefaults, DEFAULTS_SYNC_MARKER), `${JSON.stringify(marker, null, 2)}\n`)
}

/** Version field of a package manifest, or null when it cannot be read. */
function manifestVersion(packageRoot: string): string | null {
  try {
    const version = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))?.version
    return typeof version === 'string' ? version : null
  }
  catch {
    return null
  }
}

/**
 * What a sync would change right now, without changing it.
 *
 * Returns null when there is no installed package to compare against. Pass
 * `shallow` for a boot-time probe; leave it off for an exact answer.
 */
export function measureDefaultsDrift(
  projectRoot: string,
  options: { shallow?: boolean } = {},
): ProjectStructureChange[] | null {
  const packageRoot = defaultsPackagePath(projectRoot)
  if (!existsSync(join(packageRoot, 'package.json')))
    return null

  return syncPackageProjectFiles(projectRoot, packageRoot, { dryRun: true, shallow: options.shallow })
}

/** `+added ~updated -removed`, the shape `buddy upgrade` already prints. */
export function summarizeStructureChanges(changes: ProjectStructureChange[]): string {
  const added = changes.filter(change => change.action === 'add').length
  const updated = changes.filter(change => change.action === 'update').length
  const removed = changes.filter(change => change.action === 'remove').length
  return `+${added} ~${updated} -${removed}`
}

/**
 * Remove assumptions that only hold when `storage/framework/core` is a
 * workspace and point project scripts at the npm-backed launcher.
 */
export function migratePackageProjectManifest(pkg: ProjectPackageJson): ProjectStructureChange[] {
  const changes: ProjectStructureChange[] = []
  const scripts = pkg.scripts ?? {}

  const setScript = (name: string, value: string): void => {
    if (scripts[name] === value)
      return
    scripts[name] = value
    changes.push({ path: `package.json#scripts.${name}`, action: 'update' })
  }

  setScript('buddy', './buddy')
  setScript('typecheck', 'bun x --bun tsc --noEmit -p tsconfig.json --pretty false')
  setScript('typecheck:app', 'bun x --bun tsc --noEmit -p tsconfig.json --pretty false')
  setScript('types:check', 'bun x --bun tsc --noEmit -p tsconfig.json --pretty false')

  if (scripts['build:reset']?.includes('storage/framework')) {
    setScript(
      'build:reset',
      'rm -rf node_modules pantry.lock && bun install && ./buddy generate:types && ./buddy lint:fix',
    )
  }

  if (scripts['build:framework-types']) {
    delete scripts['build:framework-types']
    changes.push({ path: 'package.json#scripts.build:framework-types', action: 'remove' })
  }

  pkg.scripts = scripts

  if (Array.isArray(pkg.workspaces)) {
    const next = pkg.workspaces.filter(workspace =>
      workspace !== 'storage/framework/core'
      && !workspace.startsWith('storage/framework/core/'),
    )
    if (next.length !== pkg.workspaces.length) {
      pkg.workspaces = next
      changes.push({ path: 'package.json#workspaces', action: 'update' })
    }
  }

  return changes
}

/**
 * Preserve an app's TypeScript overrides while moving the legacy vendored-core
 * base config to the package-compatible app config.
 */
export function migratePackageProjectTsconfig(
  projectRoot: string,
  options: PackageProjectOptions = {},
): ProjectStructureChange[] {
  const path = join(projectRoot, 'tsconfig.json')
  if (!existsSync(path))
    return []

  const raw = readFileSync(path, 'utf8')
  const next = raw.replace(
    /"extends"\s*:\s*"\.\/storage\/framework\/core\/tsconfig\.json"/,
    '"extends": "./storage/framework/tsconfig.app.json"',
  )

  if (next === raw)
    return []

  if (!options.dryRun)
    writeFileSync(path, next)

  return [{ path: 'tsconfig.json', action: 'update' }]
}

export type DetectedAiProvider = 'claude' | 'codex' | 'cursor' | 'copilot' | 'gemini'

/**
 * Infer only providers a project already uses, plus Codex so the canonical
 * AGENTS.md is always present after an update.
 */
export function detectProjectAiProviders(projectRoot: string): DetectedAiProvider[] {
  const providers = new Set<DetectedAiProvider>(['codex'])

  if (existsSync(join(projectRoot, 'CLAUDE.md')) || existsSync(join(projectRoot, '.claude')))
    providers.add('claude')
  if (existsSync(join(projectRoot, '.cursor')))
    providers.add('cursor')
  if (existsSync(join(projectRoot, '.github/copilot-instructions.md')))
    providers.add('copilot')
  if (existsSync(join(projectRoot, 'GEMINI.md')))
    providers.add('gemini')

  return [...providers]
}
