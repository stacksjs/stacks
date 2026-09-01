import type { CLI } from '@stacksjs/types'
import type { BackupTarget, DumpCommand } from '../database-backup'
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import process from 'node:process'
import { confirmOrNull, intro, log, outro } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'
import {
  backupFileName,
  describeCommand,
  dumpCommand,
  dumpSqlite,
  isBackupFileName,
  prunableBackups,
  resolveBackupTarget,
  restoreCommand,
  restoreSqlite,
  toolFailureDetail,
  withoutPassword,
} from '../database-backup'

/** Where dumps go when nothing said otherwise. */
const DEFAULT_BACKUP_DIR = 'storage/backups/database'
const DEFAULT_RETAIN = 7

/**
 * The database this app actually opens.
 *
 * `@stacksjs/config` merges `config/*.ts` asynchronously and only re-binds its
 * exports once `overridesReady` resolves, so reading `config.database` before
 * then answers with the FRAMEWORK DEFAULT rather than the project's config
 * (stacksjs/stacks#2333). There is no barrier anywhere above this: the CLI
 * does not await it, so this function has to.
 *
 * That matters most where it is least visible. `applyPreMigrationBackup`
 * splices `db:backup --before-migrations` into a site's `preStart` ahead of
 * `migrate`, so an early read means dumping one database while `migrate`
 * changes another - and reporting success. A backup of the wrong database is
 * worse than no backup, because it is one you would restore from.
 *
 * The rejection is swallowed on purpose. `overridesReady` rejects when boot
 * validation finds ANY issue in ANY config file, but that check runs after
 * every config module has already merged into `overrides` in place, so the
 * values here are complete either way. Letting it propagate would mean a typo
 * in an unrelated file - `ports.frontend`, say - aborts the pre-migration
 * backup and therefore the deploy, which is a worse failure than the one it
 * would be reporting. The validator has already printed the issues itself.
 *
 * Deliberately untested, which is worth stating rather than hiding - but not
 * for the reason recorded here before. That reason was that early and late
 * reads agree in this repo, because `database.default` comes from
 * `DB_CONNECTION` and the environment is available synchronously. They do not
 * agree: the framework default is a hardcoded `'sqlite'` that never consults
 * the environment, and only `config/database.ts` reads `DB_CONNECTION`, so the
 * two differ whenever that variable says anything else. Measured directly against the config layer:
 *
 *     early: {"dbDefault":"sqlite"}
 *     late:  {"dbDefault":"postgres"}
 *
 * What is true is the observation that an ordering assertion passes with this
 * barrier removed, and the reason is the boot sequence rather than the value.
 * `bunfig.toml` preloads the framework's own preloader, so the config load is
 * already in flight before `main()` runs and has settled long before commands
 * are registered, let alone run. Instrumented on both edges:
 * `atRegistration=settled`, `atHandlerEntry=already-settled` - with the await
 * here removed.
 *
 * So this await is defence against a boot sequence that stops winning that
 * race, not against `DB_CONNECTION` being synchronous. Cheap enough to keep on
 * a path where being wrong means restoring from a backup of the wrong database,
 * and a test could only assert an ordering the preload already guarantees.
 */
export async function backupTarget(): Promise<BackupTarget | null> {
  const { config, overridesReady } = await import('@stacksjs/config')
  await overridesReady.catch(() => {})
  return resolveBackupTarget((config)?.database)
}

function backupDir(out?: string): string {
  const dir = out?.trim() || DEFAULT_BACKUP_DIR
  return isAbsolute(dir) ? dir : resolve(process.cwd(), dir)
}

/** Every dump in `dir`, oldest first. Missing directory means none yet. */
function existingBackups(dir: string): string[] {
  if (!existsSync(dir))
    return []
  return readdirSync(dir).filter(isBackupFileName).sort()
}

/**
 * Is there actually a database to dump?
 *
 * A first deploy runs `migrate` against nothing, and failing it because there
 * was no database to back up would mean an app could never take its first
 * release. Only SQLite can be answered locally; a server engine is answered by
 * whether the dump tool can connect, which is the dump itself.
 */
function sqliteDatabaseExists(target: BackupTarget): boolean {
  const path = sqliteFile(target)
  return existsSync(path) && statSync(path).size > 0
}

/** The SQLite file this app opens, as an absolute path. */
function sqliteFile(target: BackupTarget): string {
  return isAbsolute(target.database) ? target.database : resolve(process.cwd(), target.database)
}

/** Run an external dump/restore tool, surfacing what it said when it fails. */
async function runTool(command: DumpCommand, password: string | undefined): Promise<void> {
  const proc = Bun.spawn([command.bin, ...command.args], {
    env: { ...process.env, ...command.env },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const [code, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()])
  if (code === 0)
    return

  const detail = toolFailureDetail(stderr, command.bin) || `exit code ${code}`
  throw new Error(withoutPassword(`${command.bin}: ${detail}`, password))
}

/** Delete the oldest dumps until only `retain` remain. */
function prune(dir: string, retain: number): string[] {
  const removed = prunableBackups(existingBackups(dir), retain)
  for (const name of removed)
    rmSync(join(dir, name), { force: true })
  return removed
}

export function db(buddy: CLI): void {
  buddy
    .command('db:backup', 'Dump the application database to a file')
    .option('--out [dir]', `Where to write the dump (default: ${DEFAULT_BACKUP_DIR})`)
    .option('--retain [count]', `How many dumps to keep`, { default: String(DEFAULT_RETAIN) })
    .option('--before-migrations', 'Deploy mode: succeed quietly when there is no database yet', { default: false })
    .option('--verbose', 'Enable verbose output', { default: false })
    .example('buddy db:backup')
    .example('buddy db:backup --out /var/backups/app --retain 30')
    .action(async (options: { out?: string, retain?: string, beforeMigrations?: boolean, verbose?: boolean }) => {
      const perf = await intro('buddy db:backup')

      try {
        const target = await backupTarget()

        if (!target) {
          // Not an error. An app on an engine we will not pretend to dump
          // (vitess, dynamodb) should not have its deploy fail over it.
          await outro('No dumpable database is configured; nothing to back up.', { startTime: perf, useSeconds: true })
          process.exit(ExitCode.Success)
        }

        if (target.engine === 'sqlite' && !sqliteDatabaseExists(target)) {
          const message = `No database at ${target.database} yet; nothing to back up.`
          if (options.beforeMigrations) {
            await outro(message, { startTime: perf, useSeconds: true })
            process.exit(ExitCode.Success)
          }
          log.warn(message)
          await outro('Nothing backed up.', { startTime: perf, useSeconds: true })
          process.exit(ExitCode.Success)
        }

        const dir = backupDir(options.out)
        mkdirSync(dir, { recursive: true })

        const name = backupFileName(target, new Date())
        const destination = join(dir, name)

        const command = dumpCommand(target, destination)
        if (command) {
          if (options.verbose)
            log.info(describeCommand(command))
          await runTool(command, target.password)
        }
        else {
          await dumpSqlite(sqliteFile(target), destination)
        }

        const size = existsSync(destination) ? statSync(destination).size : 0
        log.success(`Wrote ${destination} (${(size / 1024).toFixed(1)} KB)`)

        const retain = Number.parseInt(String(options.retain ?? DEFAULT_RETAIN), 10)
        const removed = prune(dir, retain)
        if (removed.length)
          log.info(`Pruned ${removed.length} older dump(s), keeping ${retain}.`)

        // Said on every dump rather than once in the docs: a file on the same
        // disk as the database is not a backup of the box (#2313).
        log.info('This dump is on the same disk as the database. Copy it off the box for a real backup.')

        await outro('Database backed up', { startTime: perf, useSeconds: true })
      }
      catch (error) {
        // Deliberately fatal. The caller is usually a deploy about to run
        // `migrate` against production, and continuing would do the exact thing
        // this command exists to make recoverable.
        //
        // AWAITED. `log.error` is async, so `log.error(...)` immediately
        // followed by `process.exit()` kills the process before the logger
        // flushes and the command exits 1 having printed nothing. Measured on
        // this exact command against a live Postgres: a real `pg_dump` version
        // mismatch produced a silent exit 1. A backup step whose failures are
        // invisible is worse than no backup step at all.
        await log.error('Database backup failed:', error)
        process.exit(ExitCode.FatalError)
      }

      process.exit(ExitCode.Success)
    })

  buddy
    .command('db:backups', 'List the database dumps that have been taken')
    .option('--out [dir]', `Where dumps are kept (default: ${DEFAULT_BACKUP_DIR})`)
    .example('buddy db:backups')
    .action(async (options: { out?: string }) => {
      const dir = backupDir(options.out)
      const backups = existingBackups(dir)

      if (!backups.length) {
        log.info(`No dumps in ${dir}.`)
        process.exit(ExitCode.Success)
      }

      log.info(`${backups.length} dump(s) in ${dir}, oldest first:`)
      for (const name of backups) {
        const size = statSync(join(dir, name)).size
        log.info(`  ${name}  ${(size / 1024).toFixed(1)} KB`)
      }

      process.exit(ExitCode.Success)
    })

  buddy
    .command('db:restore [file]', 'Restore the application database from a dump')
    .option('--out [dir]', `Where dumps are kept (default: ${DEFAULT_BACKUP_DIR})`)
    .option('--force', 'Skip the confirmation prompt', { default: false })
    .option('--verbose', 'Enable verbose output', { default: false })
    .example('buddy db:restore')
    .example('buddy db:restore 2026-08-13T09-00-00-000.sqlite.sqlite --force')
    .action(async (file: string | undefined, options: { out?: string, force?: boolean, verbose?: boolean }) => {
      const perf = await intro('buddy db:restore')

      try {
        const target = await backupTarget()
        if (!target) {
          await log.error('No restorable database is configured.')
          process.exit(ExitCode.FatalError)
        }

        const dir = backupDir(options.out)
        const backups = existingBackups(dir)

        // No argument means the newest, which is what someone typing this in a
        // hurry almost always wants.
        const name = file ?? backups[backups.length - 1]
        if (!name) {
          await log.error(`No dumps found in ${dir}.`)
          process.exit(ExitCode.FatalError)
        }

        const source = isAbsolute(name) ? name : join(dir, name)
        if (!existsSync(source)) {
          await log.error(`No such dump: ${source}`)
          process.exit(ExitCode.FatalError)
        }

        if (!options.force) {
          // confirmOrNull, not confirm: `confirm` maps EOF to its default, so a
          // non-interactive shell would answer "yes" to overwriting a
          // production database on the operator's behalf.
          const answer = await confirmOrNull({
            message: `Replace ${target.engine} database "${target.database}" with ${name}? The current contents are lost.`,
            initial: false,
          })

          if (answer !== true) {
            await outro('Restore cancelled.', { startTime: perf, useSeconds: true })
            process.exit(ExitCode.Success)
          }
        }

        const command = restoreCommand(target, source)
        if (command) {
          if (options.verbose)
            log.info(describeCommand(command))
          await runTool(command, target.password)
        }
        else {
          const displaced = await restoreSqlite(source, sqliteFile(target), Date.now())
          if (displaced)
            log.info(`The database that was there is kept at ${displaced}`)
        }

        log.success(`Restored ${target.database} from ${name}`)
        await outro('Database restored', { startTime: perf, useSeconds: true })
      }
      catch (error) {
        await log.error('Database restore failed:', error)
        process.exit(ExitCode.FatalError)
      }

      process.exit(ExitCode.Success)
    })
}
