interface PostSyncSpawnOptions {
  cmd: string[]
  cwd: string
  stdin: 'ignore'
  stdout: 'inherit'
  stderr: 'inherit'
}

type PostSyncSpawn = (options: PostSyncSpawnOptions) => { exited: Promise<number> }

interface PostSyncMigrationOptions {
  bunExecutable: string
  migrateScript: string
  projectRoot: string
  spawn: PostSyncSpawn
}

interface PostSyncDependencyOptions {
  /** Full argv for the refresh, from {@link resolveDependencyRefreshCommand}. */
  cmd: string[]
  projectRoot: string
  spawn: PostSyncSpawn
}

/**
 * Which installer owns the project's dependency graph.
 *
 * Stacks apps come in two flavours. The default resolves third-party packages
 * from `node_modules` and is installed by Bun. A pantry app instead installs
 * into `pantry/` and points tsconfig's catch-all path mapping at it, so that
 * directory - not `node_modules` - is what module resolution actually reads.
 */
export type DependencyInstaller = 'bun' | 'pantry'

/**
 * A `pantry.lock` is the marker: it only exists once pantry owns the graph.
 *
 * Getting this wrong is not cosmetic. Running `bun install` in a pantry app
 * refreshes a `node_modules` tree that nothing resolves against, so the
 * upgrade reports success while the app keeps importing the stale copies in
 * `pantry/` - which surfaces later as missing exports from packages the
 * manifest claims are current.
 */
export function detectDependencyInstaller(hasPantryLock: boolean): DependencyInstaller {
  return hasPantryLock ? 'pantry' : 'bun'
}

/**
 * Build the refresh argv. Both installers spell the "re-resolve everything"
 * flag `--force`, so the shape is the same either way.
 */
export function resolveDependencyRefreshCommand(options: {
  installer: DependencyInstaller
  bunExecutable: string
  pantryExecutable: string
}): string[] {
  const executable = options.installer === 'pantry'
    ? options.pantryExecutable
    : options.bunExecutable

  return [executable, 'install', '--force']
}

/**
 * Pick the first pantry binary that exists, falling back to a bare `pantry`
 * so a PATH install still works. `exists` is injected to keep this testable.
 */
export function resolvePantryExecutable(candidates: string[], exists: (path: string) => boolean): string {
  for (const candidate of candidates) {
    if (candidate && exists(candidate))
      return candidate
  }

  return 'pantry'
}

/**
 * The first upgrade process records the real file changes, then restarts itself
 * after replacing its own framework code. The restarted process sees the
 * already-synced tree as unchanged, but it still owns the post-sync work that
 * the first process intentionally deferred.
 */
export function shouldRunPostSyncHooks(changeCount: number, alreadyRestarted: boolean): boolean {
  return changeCount > 0 || alreadyRestarted
}

/**
 * A restarted process cannot reconstruct whether a package manifest changed
 * during the parent sync. Refreshing dependencies is the safe, idempotent
 * choice whenever post-sync work crosses that process boundary.
 */
export function shouldRefreshPostSyncDependencies(corePackageChanged: boolean, alreadyRestarted: boolean): boolean {
  return corePackageChanged || alreadyRestarted
}

/**
 * Fully refresh dependencies after replacing vendored workspace manifests.
 *
 * A plain install may reuse the existing nested package placement and leave a
 * lockfile that changes in a clean checkout. `--force` makes the installer
 * resolve the complete workspace graph so the resulting lockfile is valid for
 * subsequent frozen installs.
 */
export async function runPostSyncDependencyRefresh(options: PostSyncDependencyOptions): Promise<void> {
  const process = options.spawn({
    cmd: options.cmd,
    cwd: options.projectRoot,
    stdin: 'ignore',
    stdout: 'inherit',
    stderr: 'inherit',
  })

  const code = await process.exited
  if (code !== 0)
    throw new Error(`Post-upgrade dependency refresh exited with code ${code}.`)
}

/**
 * Run the migration hook after a vendored framework upgrade.
 *
 * The upgrade command is already an explicit request to install and activate
 * the new framework. Its nested migration must therefore never open a second
 * confirmation prompt. Ignoring stdin makes that contract structural, while
 * `--force` bypasses both migration confirmation gates. A nonzero exit is a
 * real upgrade failure so callers cannot report success with an unapplied
 * schema.
 */
export async function runPostSyncMigration(options: PostSyncMigrationOptions): Promise<void> {
  const process = options.spawn({
    cmd: [options.bunExecutable, options.migrateScript, 'migrate', '--force'],
    cwd: options.projectRoot,
    stdin: 'ignore',
    stdout: 'inherit',
    stderr: 'inherit',
  })

  const code = await process.exited
  if (code !== 0)
    throw new Error(`Post-upgrade migration exited with code ${code}.`)
}
