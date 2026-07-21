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
