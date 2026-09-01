/**
 * Taking a dump of the application database, and putting one back.
 *
 * ## Why this exists
 *
 * `buddy deploy` runs `migrate` on every deploy, against the production
 * database, with no way to undo it (stacksjs/stacks#2313). The most likely way
 * an app loses data is not a disk failure - it is a migration that did
 * something nobody meant, applied automatically, to the only copy.
 *
 * #2318 made the framework SAY so (`buddy doctor`, and a warning before
 * `deploy` runs). This is the half that does something about it: a dump taken
 * immediately before the schema changes, written outside the release tree so it
 * survives the release being pruned, and a restore path - because a backup
 * nobody has ever restored is a hypothesis, not a backup.
 *
 * ## What this is NOT
 *
 * It is not offsite. A dump on the same disk as the database survives a bad
 * migration and does not survive losing the box, so the `doctor` warning stays
 * exactly as it is until something copies these files somewhere else. Nothing
 * here should be read as "this app has backups".
 *
 * ## Why the commands are built here rather than in ts-cloud
 *
 * ts-cloud carries a full backup subsystem, but its logical database source
 * runs `pg_dumpall` through `runtime.exec()` against a **data container** and
 * throws for anything else, while `managedServices` installs the engine from
 * pantry as a boot-time systemd service. There is no container, so none of that
 * machinery can reach a Stacks box.
 *
 * The one thing that made a local implementation look unwise was the admin
 * connection: pantry's postgres grants `trust` on the unix socket but requires
 * md5 over TCP loopback, where the `postgres` superuser has no password, and
 * ts-cloud encodes that rule in an unexported `pgAdminCommand()`. This module
 * sidesteps it entirely by connecting as the **application's own user** with the
 * application's own password - the credentials the app already has, for the one
 * database it owns. No superuser, so no copy of that rule to drift.
 */

import type { Buffer } from 'node:buffer'

/** Engines a dump can be taken of. */
export type BackupEngine = 'sqlite' | 'postgres' | 'mysql'

/** Everything needed to dump one database. */
export interface BackupTarget {
  engine: BackupEngine
  /** SQLite: the file path. Server engines: the database name. */
  database: string
  host?: string
  port?: number
  username?: string
  password?: string
}

/** An external dump command, ready to spawn. */
export interface DumpCommand {
  /** The binary, e.g. `pg_dump`. */
  bin: string
  args: string[]
  /** Extra environment, kept out of argv so the password never hits `ps`. */
  env: Record<string, string>
}

/**
 * Dialects that speak a wire protocol we know how to dump.
 *
 * `vitess` and `singlestore` are deliberately absent even though the framework
 * supports them. Both speak MySQL, but a `mysqldump` against a vtgate is not a
 * restorable backup of a sharded keyspace, and shipping one would be worse than
 * shipping nothing: it would look like a backup right up until the restore.
 */
const ENGINES: Record<string, BackupEngine> = {
  sqlite: 'sqlite',
  postgres: 'postgres',
  postgresql: 'postgres',
  mysql: 'mysql',
  mariadb: 'mysql',
}

/**
 * The dump target for a database config (`config.database`), or `null` when the
 * engine is one we will not pretend to back up.
 *
 * Reads the loaded config rather than `process.env` so an app that configured
 * its database in `config/database.ts` without env vars is dumped from what it
 * actually connects with.
 */
export function resolveBackupTarget(databaseConfig: unknown): BackupTarget | null {
  // Narrowed to what this function reads. The parameter is `unknown` on
  // purpose - it is handed whatever config was loaded - so the narrowing
  // belongs here rather than in a cast at each read.
  const cfg = databaseConfig as { default?: unknown, connections?: Record<string, unknown> } | null | undefined
  const dialect = String(cfg?.default ?? '').trim().toLowerCase()
  const engine = ENGINES[dialect]
  if (!engine)
    return null

  const connection = cfg?.connections?.[dialect] as {
    database?: unknown
    name?: unknown
    host?: unknown
    port?: unknown
    username?: unknown
    password?: unknown
  } | undefined
  if (!connection)
    return null

  if (engine === 'sqlite') {
    const database = String(connection.database ?? '').trim()
    return database ? { engine, database } : null
  }

  // `name` is what the mysql/postgres connection blocks call it; `database` is
  // accepted too so a hand-written config is not silently skipped.
  const database = String(connection.name ?? connection.database ?? '').trim()
  if (!database)
    return null

  return {
    engine,
    database,
    host: String(connection.host ?? '127.0.0.1'),
    port: Number(connection.port) || (engine === 'postgres' ? 5432 : 3306),
    username: String(connection.username ?? ''),
    password: String(connection.password ?? ''),
  }
}

/**
 * The dump file name for a moment in time.
 *
 * Sorts lexicographically in chronological order, which is what makes
 * {@link prunableBackups} and "restore the newest" a string sort rather than a
 * stat of every file.
 */
export function backupFileName(target: BackupTarget, at: Date): string {
  const stamp = at.toISOString().replace(/[:.]/g, '-').replace('Z', '')
  const extension = target.engine === 'sqlite' ? 'sqlite' : 'sql'
  return `${stamp}.${target.engine}.${extension}`
}

/** Does this name look like something {@link backupFileName} produced? */
export function isBackupFileName(name: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T[\d-]+\.(?:sqlite|postgres|mysql)\.(?:sqlite|sql)$/.test(name)
}

/**
 * The external command that writes a dump of `target` to `destination`.
 *
 * `null` for SQLite, which is copied in-process with `VACUUM INTO` rather than
 * shelled out to a `sqlite3` binary that may not be installed.
 *
 * The password goes in the environment, never in argv: every user on the box
 * can read another process's command line out of `ps`, and a deploy that leaked
 * the production database password to the process table on every release would
 * be a worse bug than the one this file is fixing.
 */
export function dumpCommand(target: BackupTarget, destination: string): DumpCommand | null {
  if (target.engine === 'sqlite')
    return null

  if (target.engine === 'postgres') {
    return {
      bin: 'pg_dump',
      args: [
        '--host', String(target.host),
        '--port', String(target.port),
        '--username', String(target.username),
        // No ownership/ACL statements: they reference roles that need not exist
        // wherever the dump is restored, and restoring into a fresh box is the
        // case that matters.
        '--no-owner',
        '--no-acl',
        '--file', destination,
        target.database,
      ],
      env: target.password ? { PGPASSWORD: target.password } : {},
    }
  }

  return {
    bin: 'mysqldump',
    args: [
      `--host=${target.host}`,
      `--port=${target.port}`,
      `--user=${target.username}`,
      // Without this a dump of an InnoDB database is taken table-by-table and
      // can capture a half-applied transaction.
      '--single-transaction',
      `--result-file=${destination}`,
      target.database,
    ],
    env: target.password ? { MYSQL_PWD: target.password } : {},
  }
}

/**
 * The command that reads a dump back in.
 *
 * Restoring SQLite is a file copy, so this returns `null` for it, exactly as
 * {@link dumpCommand} does.
 */
export function restoreCommand(target: BackupTarget, source: string): DumpCommand | null {
  if (target.engine === 'sqlite')
    return null

  if (target.engine === 'postgres') {
    return {
      bin: 'psql',
      args: [
        '--host', String(target.host),
        '--port', String(target.port),
        '--username', String(target.username),
        // Stop at the first error rather than plough on and leave a database
        // that is neither the old one nor the new one.
        '--set', 'ON_ERROR_STOP=1',
        '--file', source,
        target.database,
      ],
      env: target.password ? { PGPASSWORD: target.password } : {},
    }
  }

  return {
    bin: 'mysql',
    args: [
      `--host=${target.host}`,
      `--port=${target.port}`,
      `--user=${target.username}`,
      `--database=${target.database}`,
      `--execute=source ${source}`,
    ],
    env: target.password ? { MYSQL_PWD: target.password } : {},
  }
}

/**
 * Which dumps to delete to keep the `retain` newest.
 *
 * Takes the file list rather than reading the directory so the policy is
 * testable without a filesystem, and returns names in the order they should be
 * removed (oldest first).
 */
export function prunableBackups(existing: string[], retain: number): string[] {
  if (!Number.isFinite(retain) || retain < 1)
    return []

  const backups = existing.filter(isBackupFileName).sort()
  const excess = backups.length - retain

  return excess > 0 ? backups.slice(0, excess) : []
}

/**
 * Dump a SQLite database with `VACUUM INTO`.
 *
 * Not a file copy. A running app keeps a write-ahead log beside the database,
 * so `cp` can capture a file whose most recently committed transactions live
 * only in the WAL - a backup that silently lacks the newest writes, which is
 * the worst kind to discover during a restore. `VACUUM INTO` asks SQLite for a
 * consistent snapshot instead, and needs no `sqlite3` binary on the box.
 *
 * It refuses to overwrite, so the destination is always a new file.
 */
export async function dumpSqlite(source: string, destination: string): Promise<void> {
  const { Database } = await import('bun:sqlite')

  const database = new Database(source, { readonly: true })
  try {
    database.exec(`VACUUM INTO '${destination.replace(/'/g, '\'\'')}'`)
  }
  finally {
    database.close()
  }
}

/**
 * Put a SQLite dump back, moving the live file aside first.
 *
 * Restoring the wrong dump is a mistake someone makes exactly once, at the
 * worst possible moment, so the file being replaced is kept rather than
 * truncated. Returns where it was kept, or `null` if there was nothing there.
 */
export async function restoreSqlite(source: string, live: string, stamp: number): Promise<string | null> {
  const { existsSync, renameSync } = await import('node:fs')

  let displaced: string | null = null
  if (existsSync(live)) {
    displaced = `${live}.replaced-${stamp}`
    renameSync(live, displaced)
  }

  await Bun.write(live, Bun.file(source))
  return displaced
}

/** Redact a password that appears in text meant for a log or an error. */
export function withoutPassword(text: string, password: string | undefined): string {
  return password ? text.split(password).join('***') : text
}

/** Render a {@link DumpCommand} for a human, with the password left out. */
export function describeCommand(command: DumpCommand): string {
  return [command.bin, ...command.args].join(' ')
}

/**
 * Turn a dump tool's stderr into the part worth printing.
 *
 * Not simply the last line. `pg_dump` reports a failure across several, and the
 * last one is the least useful half:
 *
 *   pg_dump: error: aborting because of server version mismatch
 *   pg_dump: detail: server version: 17.10; pg_dump version: 16.14 (Homebrew)
 *
 * Taking the last line alone loses "server version mismatch" and keeps only the
 * numbers - measured on a real run, which is how this was found. So the `error:`
 * line leads and any `detail:`/`hint:` lines follow it.
 *
 * Each line's own `<bin>: ` prefix is stripped, because the caller adds one and
 * `pg_dump: pg_dump: detail: …` is what you get otherwise.
 */
export function toolFailureDetail(stderr: string | Buffer, bin?: string): string {
  const lines = String(stderr)
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => (bin && l.startsWith(`${bin}: `) ? l.slice(bin.length + 2) : l))

  if (!lines.length)
    return ''

  const errorAt = lines.findIndex(l => /^error\b|\berror:/i.test(l))
  if (errorAt === -1)
    return lines[lines.length - 1] ?? ''

  const kept = [lines[errorAt]]
  for (const line of lines.slice(errorAt + 1)) {
    if (/^(?:detail|hint):/i.test(line))
      kept.push(line)
  }

  return kept.join(' ')
}

/**
 * Where a dump is copied so that losing the instance does not lose the data.
 *
 * `buddy db:backup` writes to instance-local disk, which survives a bad
 * migration and nothing else — the command has said so on every run since it
 * shipped, and `unbacked-data.ts` warns about it on every deploy. This is the
 * other half: a destination the dump is copied to once it exists.
 *
 * Two forms, because the two situations are genuinely different:
 *
 *   `s3://bucket/prefix`   an explicit bucket, credentials from the app's
 *                          filesystems config for the s3 disk
 *   `disk://name/prefix`   a disk the app already configured, by name. The
 *                          scaffolded `config/cloud.ts` provisions an encrypted
 *                          versioned `backups` bucket, so `disk://backups` is
 *                          usually what an app wants and needs no new secrets.
 *
 * A local path is deliberately NOT accepted. `--out` already writes locally,
 * and accepting `/mnt/whatever` here would let an app configure a "destination"
 * that is still one disk failure from nothing — which is the exact belief this
 * whole area exists to correct. stacksjs/stacks#2313.
 */
export interface BackupDestination {
  kind: 's3' | 'disk'
  /** Bucket name for `s3://`, disk name for `disk://`. */
  target: string
  /** Key prefix within the bucket or disk. Empty when the URI had none. */
  prefix: string
}

/**
 * Parse a destination URI, or throw with what was wrong.
 *
 * Throws rather than returning null: a destination that was configured and
 * cannot be understood is a backup that silently stays on one disk, and the
 * whole point here is that nobody finds that out at restore time.
 */
export function parseBackupDestination(uri: string): BackupDestination {
  const trimmed = uri.trim()

  const match = trimmed.match(/^(s3|disk):\/\/([^/]+)(?:\/(.*))?$/)
  if (!match) {
    throw new Error(
      `Backup destination must be \`s3://bucket/prefix\` or \`disk://name/prefix\`, got ${JSON.stringify(uri)}. `
      + 'A local path is not accepted here — `--out` already writes locally, and a second copy on the same disk '
      + 'is not a backup of the box.',
    )
  }

  const [, kind, target, rawPrefix = ''] = match
  const prefix = rawPrefix.replace(/^\/+|\/+$/g, '')

  if (!target) {
    throw new Error(`Backup destination ${JSON.stringify(uri)} names no ${kind === 's3' ? 'bucket' : 'disk'}.`)
  }

  return { kind: kind as 's3' | 'disk', target, prefix }
}

/** The key a dump is stored under at its destination. */
export function backupObjectKey(destination: BackupDestination, fileName: string): string {
  return destination.prefix ? `${destination.prefix}/${fileName}` : fileName
}

/**
 * The configured offsite destination, or null.
 *
 * Env first so a deploy can set it without editing config, then
 * `config/database.ts`'s `backups.destination`. Returning null is the ordinary
 * case and is not an error — it is what the deploy warning is about.
 */
export function resolveBackupDestination(
  databaseConfig: unknown,
  env: Record<string, string | undefined> = {},
): BackupDestination | null {
  const configured = env.DB_BACKUP_DESTINATION
    ?? (databaseConfig as { backups?: { destination?: unknown } } | null | undefined)?.backups?.destination

  if (typeof configured !== 'string' || !configured.trim())
    return null

  return parseBackupDestination(configured)
}
