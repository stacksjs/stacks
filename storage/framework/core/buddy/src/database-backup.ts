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

import { Buffer } from 'node:buffer'
import process from 'node:process'

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
  // A server dump is SQL text, which gzip shrinks five to ten times, and
  // retention keeps several of them beside the live database: seven
  // uncompressed dumps of a 15 GB database filled a box (#3079). A SQLite
  // dump stays a database file, so it opens as one and restores by copying.
  const extension = target.engine === 'sqlite' ? 'sqlite' : 'sql.gz'
  return `${stamp}.${target.engine}.${extension}`
}

/**
 * Does this name look like something {@link backupFileName} produced?
 *
 * Uncompressed `.sql` is still recognised: dumps taken before #3079 have to
 * keep counting toward retention and stay restorable.
 */
export function isBackupFileName(name: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T[\d-]+\.(?:sqlite|postgres|mysql)\.(?:sqlite|sql|sql\.gz)$/.test(name)
}

/** Is this dump gzipped, so it has to be inflated on its way back in? */
export function isCompressedBackup(name: string): boolean {
  return name.endsWith('.gz')
}

/**
 * The external command that writes a dump of `target` to its stdout, for
 * {@link writeDump} to compress on the way to disk. Neither tool can gzip
 * a plain dump itself on every version we meet, and mysqldump not at all.
 *
 * `null` for SQLite, which is copied in-process with `VACUUM INTO` rather than
 * shelled out to a `sqlite3` binary that may not be installed.
 *
 * The password goes in the environment, never in argv: every user on the box
 * can read another process's command line out of `ps`, and a deploy that leaked
 * the production database password to the process table on every release would
 * be a worse bug than the one this file is fixing.
 */
export function dumpCommand(target: BackupTarget): DumpCommand | null {
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
      target.database,
    ],
    env: target.password ? { MYSQL_PWD: target.password } : {},
  }
}

/**
 * The command that reads a dump back in, from its stdin, which
 * {@link readDump} feeds (inflating a gzipped dump on the way).
 *
 * Restoring SQLite is a file copy, so this returns `null` for it, exactly as
 * {@link dumpCommand} does.
 */
export function restoreCommand(target: BackupTarget): DumpCommand | null {
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
    ],
    env: target.password ? { MYSQL_PWD: target.password } : {},
  }
}

/** How long a dump may run before it is stopped, when nothing says otherwise. */
export const DEFAULT_DUMP_TIMEOUT_SECONDS = 3600

/** How {@link writeDump} and {@link readDump} move the bytes. */
export interface DumpStreamOptions {
  /**
   * Stop the dump and fail once it has run this long. A deploy waits on the
   * pre-migration dump, so one that never finishes has to become an error
   * somebody reads rather than a job that sits until CI cancels it.
   * Defaults to {@link DEFAULT_DUMP_TIMEOUT_SECONDS}. Only dumps have one: a
   * restore stopped halfway leaves a database that is neither old nor new.
   */
  timeoutMs?: number
  /**
   * Which plumbing to use. Left unset, the kernel pipe is used wherever bash
   * and gzip are both on PATH and the in-process path everywhere else. Tests
   * set it to hold each path to the same contract.
   */
  via?: 'pipe' | 'process'
}

const BASH = 'bash'
const GZIP = 'gzip'

/** The in-process path compresses the dump in batches of at least this much. */
const GZIP_BATCH_BYTES = 1024 * 1024

/** Bash for "the exit code of every member of the pipeline that just ran". */
const PIPE_STATUS = ['echo "$', '{PIPESTATUS[*]}"'].join('')

/**
 * `tool | gzip > $DUMP_OUT`, with the two exit codes printed on stdout.
 *
 * The tool and its arguments arrive as positional parameters and the output
 * path in the environment, so nothing is interpolated into the script and the
 * password stays where {@link dumpCommand} put it. gzip's own complaints go to
 * stdout, apart from the tool's stderr, so a failure is reported as whose it
 * was.
 *
 * `set -m` puts the pipeline in a process group of its own. That is what lets
 * the deadline stop pg_dump and gzip themselves: signalling only bash would
 * leave both running, writing a dump nobody is waiting for.
 */
const DUMP_PIPELINE = [
  'set -m',
  `( "$0" "$@" | gzip -c 2>&1 > "$DUMP_OUT"; ${PIPE_STATUS} ) &`,
  'job=$!',
  'trap \'kill -TERM -- "-$job" 2>/dev/null\' TERM INT HUP',
  'wait "$job"',
].join('\n')

/** `gzip -dc < $DUMP_IN | tool`, reported the same way as {@link DUMP_PIPELINE}. */
const RESTORE_PIPELINE = [
  'exec 3>&1',
  'gzip -dc < "$DUMP_IN" 2>&3 | "$0" "$@" > /dev/null 3>&-',
  PIPE_STATUS,
].join('\n')

/** A pipeline member killed for writing to a reader that had already gone. */
const SIGPIPE_EXIT = 141

function canPipe(): boolean {
  return process.platform !== 'win32' && Boolean(Bun.which(BASH)) && Boolean(Bun.which(GZIP))
}

/** Split a pipeline's stdout into what gzip said and the trailing exit codes. */
function pipelineOutcome(stdout: string): { said: string, codes: number[] | null } {
  const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean)
  const last = lines[lines.length - 1] ?? ''
  if (!/^\d+ \d+$/.test(last))
    return { said: lines.join('\n'), codes: null }
  return { said: lines.slice(0, -1).join('\n'), codes: last.split(' ').map(Number) }
}

function toolError(command: DumpCommand, stderr: string, code: number | null, password?: string): Error {
  return new Error(withoutPassword(`${command.bin}: ${toolFailureDetail(stderr, command.bin) || `exit code ${code}`}`, password))
}

function gzipError(detail: string, code: number | string, password?: string): Error {
  return new Error(withoutPassword(`${GZIP}: ${toolFailureDetail(detail, GZIP) || `exit code ${code}`}`, password))
}

function deadlineError(command: DumpCommand, timeoutMs: number): Error {
  const seconds = Math.round(timeoutMs / 100) / 10
  return new Error(
    `${command.bin} had not finished after ${seconds}s, so it was stopped and no dump was written. `
    + 'If this database needs longer, raise the limit (in seconds) with --timeout, DB_BACKUP_TIMEOUT or backups.timeout.',
  )
}

/**
 * Run `command` and gzip what it prints into `destination`.
 *
 * Written beside the destination under a `.partial` name and renamed only once
 * the tool has exited cleanly, so a dump that fails halfway never takes the
 * place of the newest good one, which is the one a hurried restore picks.
 *
 * The bytes do not pass through a web stream. This used to be
 * `Bun.write(partial, new Response(proc.stdout.pipeThrough(new CompressionStream('gzip'))))`,
 * which never resolves on Bun 1.3: every deploy of an app with a server
 * database hung at its pre-migration backup, holding the whole dump in memory.
 * So the kernel does the piping wherever bash and gzip exist, and this process
 * only waits. Where they do not, the dump is read and compressed here with
 * synchronous calls, which cannot outrun the disk. Both hold memory flat
 * whatever the size of the dump, on Bun 1.3 and on current Bun;
 * `tests/database-backup-min-bun.test.ts` runs them under the oldest Bun.
 */
export async function writeDump(
  command: DumpCommand,
  destination: string,
  password?: string,
  options: DumpStreamOptions = {},
): Promise<void> {
  const { renameSync, rmSync } = await import('node:fs')

  const partial = `${destination}.partial`
  const timeoutMs = options.timeoutMs ?? DEFAULT_DUMP_TIMEOUT_SECONDS * 1000
  const piped = options.via ? options.via === 'pipe' : canPipe()

  try {
    if (piped)
      await pipeDump(command, partial, timeoutMs, password)
    else
      await compressDump(command, partial, timeoutMs, password)
    renameSync(partial, destination)
  }
  finally {
    rmSync(partial, { force: true })
  }
}

/** {@link writeDump} through a kernel pipe: this process is not in the data path. */
async function pipeDump(command: DumpCommand, partial: string, timeoutMs: number, password?: string): Promise<void> {
  const proc = Bun.spawn([BASH, '-c', DUMP_PIPELINE, command.bin, ...command.args], {
    env: { ...process.env, ...command.env, DUMP_OUT: partial },
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  })

  let expired = false
  let hardStop: ReturnType<typeof setTimeout> | undefined
  const deadline = setTimeout(() => {
    expired = true
    // TERM reaches the trap, which stops the pipeline's own process group.
    // KILL follows for a bash that cannot run its trap.
    proc.kill('SIGTERM')
    hardStop = setTimeout(() => proc.kill('SIGKILL'), 5000)
  }, timeoutMs)

  try {
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    if (expired)
      throw deadlineError(command, timeoutMs)

    const { said, codes } = pipelineOutcome(stdout)
    if (!codes)
      throw toolError(command, stderr, code, password)

    const [toolCode = 1, gzipCode = 1] = codes
    // A tool killed by SIGPIPE died because gzip did, so gzip's failure is the
    // one worth reading (a full disk, a directory that cannot be written).
    if (gzipCode !== 0 && (toolCode === 0 || toolCode === SIGPIPE_EXIT))
      throw gzipError(said || stderr, gzipCode, password)
    if (toolCode !== 0)
      throw toolError(command, stderr, toolCode, password)
  }
  finally {
    clearTimeout(deadline)
    clearTimeout(hardStop)
  }
}

/**
 * {@link writeDump} without bash or gzip on the box.
 *
 * Reads the tool's stdout and writes each batch with `Bun.gzipSync` and
 * `writeSync`. Synchronous on purpose: nothing is queued between the pipe and
 * the disk, so the tool is held back by the kernel pipe filling rather than by
 * a stream's backpressure, which is the part that differs between Bun
 * versions. Each batch is its own gzip member. A file of several members is a
 * valid gzip file, and gzip, zlib and {@link readDump} all read it as one.
 */
async function compressDump(command: DumpCommand, partial: string, timeoutMs: number, password?: string): Promise<void> {
  const { closeSync, openSync, writeSync } = await import('node:fs')

  // Opened before the tool starts, so a directory that cannot be written
  // fails here rather than leaving a dump running with nowhere to go.
  const fd = openSync(partial, 'w')

  const proc = Bun.spawn([command.bin, ...command.args], {
    env: { ...process.env, ...command.env },
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const stderrText = new Response(proc.stderr).text()

  let expired = false
  const startedAt = Date.now()
  const expire = (): void => {
    expired = true
    proc.kill('SIGKILL')
  }
  const deadline = setTimeout(expire, timeoutMs)

  let failure: unknown
  try {
    const flush = (batch: Uint8Array[]): void => {
      const packed = Bun.gzipSync(Buffer.concat(batch))
      for (let offset = 0; offset < packed.length;)
        offset += writeSync(fd, packed, offset)
    }

    const reader = proc.stdout.getReader()
    let batch: Uint8Array[] = []
    let batched = 0
    let members = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done)
        break
      batch.push(value)
      batched += value.length
      if (batched >= GZIP_BATCH_BYTES) {
        flush(batch)
        members++
        batch = []
        batched = 0
      }
      // A stream that never pauses never lets the timer run, so the deadline
      // is read off the clock here as well.
      if (!expired && Date.now() - startedAt > timeoutMs)
        expire()
    }
    // An empty dump is still written as a gzip file, never as zero bytes.
    if (batched > 0 || members === 0)
      flush(batch)
  }
  catch (error) {
    failure = error
    proc.kill('SIGKILL')
  }
  finally {
    clearTimeout(deadline)
    closeSync(fd)
  }

  const [code, stderr] = await Promise.all([proc.exited, stderrText])
  if (expired)
    throw deadlineError(command, timeoutMs)
  if (failure !== undefined)
    throw gzipError(failure instanceof Error ? failure.message : String(failure), 'unknown', password)
  if (code !== 0)
    throw toolError(command, stderr, code, password)
}

/**
 * Feed the dump at `source` to `command`'s stdin, inflating it first when it
 * is gzipped, so dumps taken before #3079 restore exactly as they did.
 *
 * An uncompressed dump is handed over as a file, which the tool reads itself.
 * A gzipped one is inflated by `gzip -dc` through a kernel pipe where bash and
 * gzip exist, and by zlib here otherwise, one chunk at a time. It used to be
 * `Bun.file(source).stream().pipeThrough(new DecompressionStream('gzip'))` as
 * the tool's stdin. On Bun 1.3 that has no backpressure: a restore held the
 * whole inflated dump in memory while psql worked through it.
 *
 * A dump that does not inflate is an error here even when the tool exits 0.
 * The tool only sees its input end, and a restore that stopped at a truncated
 * dump would otherwise report success.
 */
export async function readDump(
  command: DumpCommand,
  source: string,
  password?: string,
  options: Pick<DumpStreamOptions, 'via'> = {},
): Promise<void> {
  if (!isCompressedBackup(source)) {
    const proc = Bun.spawn([command.bin, ...command.args], {
      env: { ...process.env, ...command.env },
      stdin: Bun.file(source),
      stdout: 'ignore',
      stderr: 'pipe',
    })
    const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()])
    if (code !== 0)
      throw toolError(command, stderr, code, password)
    return
  }

  if (options.via ? options.via === 'pipe' : canPipe())
    await pipeRestore(command, source, password)
  else
    await inflateRestore(command, source, password)
}

/** {@link readDump} through a kernel pipe. */
async function pipeRestore(command: DumpCommand, source: string, password?: string): Promise<void> {
  const proc = Bun.spawn([BASH, '-c', RESTORE_PIPELINE, command.bin, ...command.args], {
    env: { ...process.env, ...command.env, DUMP_IN: source },
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  const { said, codes } = pipelineOutcome(stdout)
  if (!codes)
    throw toolError(command, stderr, code, password)

  // The tool first: when it stops early gzip is killed by SIGPIPE, and that is
  // a consequence rather than the cause.
  const [gzipCode = 1, toolCode = 1] = codes
  if (toolCode !== 0)
    throw toolError(command, stderr, toolCode, password)
  if (gzipCode !== 0)
    throw gzipError(said || stderr, gzipCode, password)
}

/** {@link readDump} without bash or gzip on the box. */
async function inflateRestore(command: DumpCommand, source: string, password?: string): Promise<void> {
  const { createReadStream } = await import('node:fs')
  const { createGunzip } = await import('node:zlib')

  const proc = Bun.spawn([command.bin, ...command.args], {
    env: { ...process.env, ...command.env },
    stdin: 'pipe',
    stdout: 'ignore',
    stderr: 'pipe',
  })
  const stderrText = new Response(proc.stderr).text()

  let inflating = true
  let failure: unknown
  try {
    // Iterating takes one chunk at a time and the flush waits for the tool to
    // have read it, so the inflated dump never accumulates here.
    for await (const chunk of createReadStream(source).pipe(createGunzip())) {
      inflating = false
      // Awaited: on Bun 1.3 a write to a tool that has gone rejects later,
      // outside this try, unless the promise it returns is the one waited on.
      await proc.stdin.write(chunk as Uint8Array)
      await proc.stdin.flush()
      inflating = true
    }
  }
  catch (error) {
    failure = error
  }

  try {
    await proc.stdin.end()
  }
  catch {
    // The tool has gone; its exit code and stderr say why.
  }

  const [code, stderr] = await Promise.all([proc.exited, stderrText])
  if (code !== 0)
    throw toolError(command, stderr, code, password)
  // Only a failure to inflate is gzip's. A failed write to a tool that still
  // exited 0 means it stopped reading, which the tool is entitled to do.
  if (failure !== undefined && inflating)
    throw gzipError(failure instanceof Error ? failure.message : String(failure), 'unknown', password)
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

/** How many dumps are kept when nothing says otherwise. */
export const DEFAULT_RETAIN = 7

/**
 * How many dumps to keep: the `--retain` flag, then `DB_BACKUP_RETAIN`, then
 * `config/database.ts`'s `backups.retain`, then {@link DEFAULT_RETAIN}.
 *
 * The same precedence {@link resolveBackupDestination} uses, so the deploy's
 * pre-migration backup, which passes no flag, can be tuned per app (#3079).
 * A value that is not a whole number of at least one throws, as an unreadable
 * destination does: a deploy that silently kept the default after being told
 * otherwise would be the disk filling up again.
 */
export function resolveBackupRetain(
  databaseConfig: unknown,
  env: Record<string, string | undefined> = {},
  flag?: string,
): number {
  const configured = (databaseConfig as { backups?: { retain?: unknown } } | null | undefined)?.backups?.retain
  const sources: Array<[string, unknown]> = [
    ['--retain', flag],
    ['DB_BACKUP_RETAIN', env.DB_BACKUP_RETAIN],
    ['backups.retain', configured],
  ]

  for (const [name, value] of sources) {
    if (value === undefined || value === null || String(value).trim() === '')
      continue
    const count = Number(String(value).trim())
    if (!Number.isInteger(count) || count < 1)
      throw new Error(`${name} must be a whole number of dumps to keep, at least 1; got ${JSON.stringify(value)}.`)
    return count
  }

  return DEFAULT_RETAIN
}

/**
 * How long a dump may run, in milliseconds: the `--timeout` flag, then
 * `DB_BACKUP_TIMEOUT`, then `config/database.ts`'s `backups.timeout`, then
 * {@link DEFAULT_DUMP_TIMEOUT_SECONDS}. Each is given in seconds.
 *
 * There is no way to switch it off. A dump with no deadline is what held every
 * deploy of an app until CI cancelled it six hours later, and a database that
 * needs longer than the default can say how long.
 */
export function resolveBackupTimeout(
  databaseConfig: unknown,
  env: Record<string, string | undefined> = {},
  flag?: string,
): number {
  const configured = (databaseConfig as { backups?: { timeout?: unknown } } | null | undefined)?.backups?.timeout
  const sources: Array<[string, unknown]> = [
    ['--timeout', flag],
    ['DB_BACKUP_TIMEOUT', env.DB_BACKUP_TIMEOUT],
    ['backups.timeout', configured],
  ]

  for (const [name, value] of sources) {
    if (value === undefined || value === null || String(value).trim() === '')
      continue
    const seconds = Number(String(value).trim())
    if (!Number.isFinite(seconds) || seconds <= 0)
      throw new Error(`${name} must be a number of seconds greater than 0; got ${JSON.stringify(value)}.`)
    return Math.round(seconds * 1000)
  }

  return DEFAULT_DUMP_TIMEOUT_SECONDS * 1000
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
