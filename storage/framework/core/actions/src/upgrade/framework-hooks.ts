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
  bunExecutable: string
  projectRoot: string
  spawn: PostSyncSpawn
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
 * A plain `bun install` may reuse the existing nested package placement and
 * leave a lockfile that changes in a clean checkout. `--force` makes Bun
 * resolve the complete workspace graph so the resulting lockfile is valid for
 * subsequent frozen installs.
 */
export async function runPostSyncDependencyRefresh(options: PostSyncDependencyOptions): Promise<void> {
  const process = options.spawn({
    cmd: [options.bunExecutable, 'install', '--force'],
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
