/**
 * Migrate a compiled app's own SQLite database at launch
 * (stacksjs/stacks#3369).
 *
 * A desktop or webview build carries its migrations as strings and has no
 * `buddy migrate`: it brings the user's database up to date itself, before
 * any framework module loads. Postline wrote this by hand and found every way
 * it goes wrong, which is what this module is for:
 *
 * - **A table rebuild runs as written.** SQLite cannot change a CHECK
 *   constraint or drop most columns in place, so the framework's generator
 *   writes `PRAGMA foreign_keys=OFF; BEGIN; … COMMIT;`. Wrapping that in a
 *   second transaction fails ("cannot start a transaction within a
 *   transaction"), and `PRAGMA foreign_keys` does nothing inside one.
 * - **The backup is consistent.** The database runs in WAL mode, so the
 *   newest writes can sit in the `-wal` file. Copying the main file misses
 *   them; `VACUUM INTO` writes one complete file from what a reader sees.
 * - **A newer schema is refused.** An older build must not open data a newer
 *   one has changed: it would run against tables it does not know. The schema
 *   version is `PRAGMA user_version`, the highest migration number applied,
 *   and it is never lowered.
 * - **A failure is undone.** The backup goes back in place, `-wal` and
 *   `-shm` discarded, so the previous build still opens the data.
 *
 * The ledger is the framework's own `migrations` table, so a database
 * migrated here is one `buddy migrate` recognises.
 *
 * Imports nothing but Bun and Node, so a launcher can run it first.
 */

import { Database } from 'bun:sqlite'
import { chmodSync, closeSync, copyFileSync, existsSync, mkdirSync, openSync, readdirSync, readSync, rmSync, statSync } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'

export interface CompiledMigrationOptions {
  /** The user's database file. Created when it does not exist. */
  databasePath: string
  /** Every migration the build carries, by file name, e.g. `0000000003-alter-posts.sql`. */
  migrations: Record<string, string>
  /** Where pre-migration backups go. The database's own directory unless given. */
  backupDir?: string
  /** How many pre-migration backups to keep. Three unless given. */
  keepBackups?: number
}

export interface CompiledMigrationResult {
  /** Migrations applied by this call, in order. Empty on most launches. */
  applied: string[]
  /** True when this call created the database. */
  created: boolean
  /** The backup taken before migrating, when there was anything to migrate. */
  backup?: string
  /** The schema version the database is at now. */
  version: number
}

/** The database was last used by a newer build. Nothing was changed. */
export class NewerSchemaError extends Error {
  constructor(public readonly found: number, public readonly supported: number) {
    super(`This data was last used by a newer version of the app (schema ${found}; this version understands ${supported}). Nothing was changed.`)
    this.name = 'NewerSchemaError'
  }
}

/** A migration failed, and the database was put back as it was. */
export class MigrationRestoredError extends Error {
  constructor(
    public readonly migration: string,
    public readonly backup: string,
    public readonly cause: unknown,
  ) {
    super(`Migration ${migration} failed, and the data was put back as it was: ${cause instanceof Error ? cause.message : String(cause)}. A copy is also at ${backup}.`)
    this.name = 'MigrationRestoredError'
  }
}

/**
 * Whether a migration opens its own transaction: a statement that starts with
 * `BEGIN` once comments are gone. A trigger body's `BEGIN` follows `FOR EACH
 * ROW`, not a statement end, so it does not count.
 */
export function managesOwnTransaction(sql: string): boolean {
  const withoutComments = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  return /(?:^|;)\s*BEGIN\b/i.test(withoutComments)
}

/** The number a migration file name starts with, or 0. */
function migrationNumber(name: string): number {
  return Number(name.match(/^(\d+)/)?.[1] ?? 0)
}

/** The schema version a set of migrations brings a database to: the highest file number. */
export function schemaVersion(migrations: Record<string, string>): number {
  return Object.keys(migrations).reduce((highest, name) => Math.max(highest, migrationNumber(name)), 0)
}

/**
 * The schema version recorded in a database, or 0 for one that has none.
 *
 * Read from the file header when no write-ahead log is pending, so asking
 * changes nothing on disk: on Linux even a read-only connection to a WAL
 * database creates `-shm` and `-wal` files it cannot remove, and the refusal
 * of a newer database is meant to leave it exactly as it was found.
 */
export function databaseVersion(databasePath: string): number {
  const header = headerUserVersion(databasePath)
  if (header !== undefined)
    return header
  const database = new Database(databasePath, { readonly: true })
  try {
    return Number((database.query('PRAGMA user_version').get() as { user_version: number }).user_version)
  }
  finally {
    database.close()
  }
}

/**
 * `PRAGMA user_version` straight from the 100-byte database header (a
 * big-endian integer at offset 60), or undefined when the header may be
 * behind: a non-empty `-wal` holds commits not yet copied into the file.
 */
function headerUserVersion(databasePath: string): number | undefined {
  const wal = `${databasePath}-wal`
  if (existsSync(wal) && statSync(wal).size > 0)
    return undefined
  const header = Buffer.alloc(100)
  const fd = openSync(databasePath, 'r')
  try {
    if (readSync(fd, header, 0, 100, 0) < 100)
      return 0
  }
  finally {
    closeSync(fd)
  }
  if (header.toString('latin1', 0, 16) !== 'SQLite format 3\u0000')
    return undefined
  return header.readInt32BE(60)
}

/** The migrations a build carries that this database has not had, in order. */
export function pendingMigrations(databasePath: string, migrations: Record<string, string>): string[] {
  const names = Object.keys(migrations).sort()
  if (!existsSync(databasePath))
    return names
  const database = new Database(databasePath, { readonly: true })
  try {
    const done = new Set((database.query('SELECT migration FROM migrations').all() as Array<{ migration: string }>).map(row => row.migration))
    return names.filter(name => !done.has(name))
  }
  catch {
    // No ledger: nothing has been applied.
    return names
  }
  finally {
    database.close()
  }
}

/** Write a consistent copy of a live database to `destination`, readable by its owner only. */
export function backupDatabase(databasePath: string, destination: string): void {
  mkdirSync(dirname(destination), { recursive: true })
  rmSync(destination, { force: true })
  const database = new Database(databasePath)
  try {
    database.exec(`VACUUM INTO '${destination.replace(/'/g, '\'\'')}'`)
  }
  finally {
    database.close()
  }
  chmodSync(destination, 0o600)
}

/** Put a backup back in place of the database, discarding its WAL files. */
function restoreDatabase(backup: string, databasePath: string): void {
  for (const suffix of ['', '-wal', '-shm'])
    rmSync(`${databasePath}${suffix}`, { force: true })
  copyFileSync(backup, databasePath)
  chmodSync(databasePath, 0o600)
}

/** `app.sqlite` → `app`: what backup file names start with. */
function stem(databasePath: string): string {
  const name = basename(databasePath)
  return extname(name) ? name.slice(0, -extname(name).length) : name
}

/** Remove all but the newest `keep` backups of this database. Names sort by the first pending migration. */
function pruneBackups(databasePath: string, backupDir: string, keep: number): void {
  const prefix = `${stem(databasePath)}.before-`
  const backups = readdirSync(backupDir).filter(name => name.startsWith(prefix) && name.endsWith('.sqlite')).sort()
  for (const name of backups.slice(0, Math.max(0, backups.length - keep)))
    rmSync(join(backupDir, name), { force: true })
}

/**
 * Apply each pending migration and record it in the ledger, stopping at the
 * first failure, which is thrown with the file's name. A plain file and its
 * ledger row commit together. A rebuild runs as written and its row is
 * recorded straight after; whatever it left open is rolled back if it fails.
 */
function applyMigrations(databasePath: string, migrations: Record<string, string>, pending: string[]): string[] {
  const database = new Database(databasePath)
  const applied: string[] = []
  try {
    database.exec('PRAGMA journal_mode = WAL')
    database.exec(`CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration VARCHAR(255) NOT NULL UNIQUE,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`)
    const record = database.query('INSERT INTO migrations (migration) VALUES (?)')

    for (const name of pending) {
      const sql = migrations[name]!
      try {
        if (managesOwnTransaction(sql)) {
          database.exec(sql)
          record.run(name)
        }
        else {
          database.transaction(() => {
            database.exec(sql)
            record.run(name)
          })()
        }
      }
      catch (error) {
        if (database.inTransaction)
          database.exec('ROLLBACK')
        throw Object.assign(error instanceof Error ? error : new Error(String(error)), { migration: name })
      }
      finally {
        // A rebuild turns foreign keys off for itself; the next file runs with them on.
        database.exec('PRAGMA foreign_keys = ON')
      }
      applied.push(name)
    }
  }
  finally {
    database.close()
  }
  return applied
}

/** Raise the recorded schema version to `version`. Never lowers it. */
function stampVersion(databasePath: string, version: number): number {
  const database = new Database(databasePath)
  try {
    const current = Number((database.query('PRAGMA user_version').get() as { user_version: number }).user_version)
    if (version > current)
      database.exec(`PRAGMA user_version = ${Math.trunc(version)}`)
    return Math.max(current, version)
  }
  finally {
    database.close()
  }
}

/**
 * Bring the database at `databasePath` up to the schema `migrations` describe.
 *
 * A missing database is created and given every migration, with no backup.
 * An existing one is first checked against the build: a newer schema throws
 * {@link NewerSchemaError} and nothing changes. When anything is pending, a
 * consistent backup is written, the pending files are applied in order, and a
 * failure puts the backup back and throws {@link MigrationRestoredError}.
 * Older backups beyond `keepBackups` are removed after a success.
 */
export function migrateCompiledDatabase(options: CompiledMigrationOptions): CompiledMigrationResult {
  const { databasePath, migrations } = options
  const supported = schemaVersion(migrations)
  const created = !existsSync(databasePath)
  mkdirSync(dirname(databasePath), { recursive: true })

  if (!created) {
    const found = databaseVersion(databasePath)
    if (found > supported)
      throw new NewerSchemaError(found, supported)
  }

  const pending = pendingMigrations(databasePath, migrations)
  if (pending.length === 0)
    return { applied: [], created, version: stampVersion(databasePath, supported) }

  if (created) {
    const applied = applyMigrations(databasePath, migrations, pending)
    chmodSync(databasePath, 0o600)
    return { applied, created, version: stampVersion(databasePath, supported) }
  }

  const backupDir = options.backupDir ?? dirname(databasePath)
  const backup = join(backupDir, `${stem(databasePath)}.before-${pending[0]!.replace(/\.sql$/, '')}.sqlite`)
  backupDatabase(databasePath, backup)

  let applied: string[]
  try {
    applied = applyMigrations(databasePath, migrations, pending)
  }
  catch (error) {
    restoreDatabase(backup, databasePath)
    throw new MigrationRestoredError((error as { migration?: string }).migration ?? pending[0]!, backup, error)
  }

  pruneBackups(databasePath, backupDir, Math.max(1, options.keepBackups ?? 3))
  return { applied, created, backup, version: stampVersion(databasePath, supported) }
}
