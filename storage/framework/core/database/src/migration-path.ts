import { existsSync, readdirSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import process from 'node:process'

const DEFAULT_MIGRATION_DIR = 'database/migrations'
const DEFAULT_SNAPSHOT_DIR = 'storage/framework/database'

/**
 * Select one immutable SQL corpus per dialect when a project targets more
 * than one database engine. Existing single-dialect projects retain the flat
 * `database/migrations` path; a second dialect is isolated automatically as
 * `database/migrations/<dialect>` instead of mixing incompatible SQL files.
 */
export function resolveMigrationDirectory(dialect: string, options: {
  cwd?: string
  configured?: string
  snapshotDir?: string
} = {}): string {
  const cwd = options.cwd ?? process.cwd()
  const configured = process.env.DB_MIGRATIONS_PATH || options.configured || DEFAULT_MIGRATION_DIR
  const absoluteConfigured = isAbsolute(configured) ? configured : join(cwd, configured)
  if (configured !== DEFAULT_MIGRATION_DIR || isAbsolute(configured))
    return absoluteConfigured

  const dialectDir = join(absoluteConfigured, dialect)
  if (existsSync(dialectDir))
    return dialectDir
  if (dialect === 'sqlite')
    return absoluteConfigured

  const snapshotDir = isAbsolute(options.snapshotDir || '')
    ? options.snapshotDir!
    : join(cwd, options.snapshotDir || DEFAULT_SNAPSHOT_DIR)
  let snapshots: string[] = []
  try {
    snapshots = readdirSync(snapshotDir)
  }
  catch { /* a fresh project has no snapshot directory */ }
  const wanted = `model-snapshot.${dialect}.json`
  const hasOtherDialect = snapshots.some(file => /^model-snapshot\.\w+\.json$/.test(file) && file !== wanted)
  return hasOtherDialect ? dialectDir : absoluteConfigured
}

export function relativeMigrationDirectory(directory: string, cwd = process.cwd()): string {
  const prefix = `${cwd}/`
  return directory.startsWith(prefix) ? directory.slice(prefix.length) : directory
}
