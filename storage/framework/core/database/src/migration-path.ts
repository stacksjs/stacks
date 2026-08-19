import { existsSync, readdirSync, readFileSync } from 'node:fs'
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

  /*
   * The flat corpus keeps its owner.
   *
   * Isolating the *second* dialect is the whole point of this function, but the
   * rule above isolated whichever one asked after a second snapshot appeared -
   * including the incumbent, whose entire applied history is in the flat
   * directory. A project on Postgres that generated a MySQL corpus once found
   * its next Postgres generation writing into `database/migrations/postgres`,
   * an empty corpus, orphaning two hundred applied files: the runner would then
   * try to create tables that already existed, and the snapshot would be
   * written as though it had emitted them.
   *
   * So a non-empty flat corpus is claimed, and it is claimed by the dialect
   * that wrote it - read off the identifiers, since a corpus quotes them one
   * way or the other and nothing else in these files is as reliable. Only a
   * dialect that did not write it gets a subdirectory of its own.
   */
  if (hasOtherDialect && ownerOfFlatCorpus(absoluteConfigured) === wireOf(dialect))
    return absoluteConfigured

  return hasOtherDialect ? dialectDir : absoluteConfigured
}

/**
 * Which family of dialect a corpus was written for, or null when the directory
 * holds no SQL to judge by.
 *
 * `"identifier"` is Postgres and SQLite; `` `identifier` `` is MySQL and its
 * relatives. Every generated `CREATE TABLE` quotes its table name, so the first
 * file that has one answers this.
 */
function ownerOfFlatCorpus(directory: string): 'postgres' | 'mysql' | null {
  let files: string[] = []
  try {
    files = readdirSync(directory).filter(file => file.endsWith('.sql')).sort()
  }
  catch {
    return null
  }

  for (const file of files) {
    let sql: string
    try {
      sql = readFileSync(join(directory, file), 'utf8')
    }
    catch {
      continue
    }

    const create = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(["`])/i.exec(sql)
    if (create)
      return create[1] === '`' ? 'mysql' : 'postgres'
  }

  return null
}

/** The quoting family a dialect belongs to. */
function wireOf(dialect: string): 'postgres' | 'mysql' {
  return dialect === 'mysql' || dialect === 'mariadb' || dialect === 'singlestore' || dialect === 'vitess' || dialect === 'planetscale'
    ? 'mysql'
    : 'postgres'
}

export function relativeMigrationDirectory(directory: string, cwd = process.cwd()): string {
  const prefix = `${cwd}/`
  return directory.startsWith(prefix) ? directory.slice(prefix.length) : directory
}
