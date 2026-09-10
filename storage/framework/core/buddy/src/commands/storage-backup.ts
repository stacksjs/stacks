/**
 * `buddy storage:backup` - the uploaded-files half of `@stacksjs/backup`
 * (stacksjs/stacks#269).
 *
 * `db:backup` next door covers data; this covers the files beside it. They are
 * separate artifacts on purpose: a dump and the uploads it references are
 * restored independently, and treating them as one makes the common case -
 * "restore yesterday's uploads, keep today's rows" - impossible.
 *
 * The decisions (which directory, what to call it, what to prune) live in
 * `../storage-backup` and are pure. This is the I/O.
 */

import type { CLI } from '@stacksjs/cli'
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import process from 'node:process'
import { intro, log, outro } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { ExitCode } from '@stacksjs/types'
import { backupObjectKey, parseBackupDestination } from '../database-backup'
import {
  isStorageBackupFileName,
  prunableStorageBackups,
  resolveStorageTarget,
  storageBackupFileName,
} from '../storage-backup'

const DEFAULT_BACKUP_DIR = 'storage/backups/storage'
const DEFAULT_RETAIN = 7

function backupDir(out?: string): string {
  const dir = out?.trim() || DEFAULT_BACKUP_DIR
  return isAbsolute(dir) ? dir : resolve(process.cwd(), dir)
}

function existingBackups(dir: string): string[] {
  if (!existsSync(dir))
    return []
  return readdirSync(dir).filter(isStorageBackupFileName)
}

/** Delete the oldest archives until only `retain` remain, per disk. */
function prune(dir: string, retain: number, disk: string): string[] {
  const removed = prunableStorageBackups(existingBackups(dir), retain, disk)
  for (const name of removed)
    rmSync(join(dir, name), { force: true })
  return removed
}

/** Human-readable size, so a listing says something at a glance. */
function humanSize(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(1)} ${units[unit]}`
}

/**
 * Copy an archive offsite.
 *
 * Failure throws rather than warns: the contract of a destination is that the
 * archive exists somewhere the box is not, and reporting success after the
 * upload failed leaves exactly the belief this feature corrects.
 */
async function uploadBackup(destinationUri: string, file: string, fileName: string): Promise<string> {
  const destination = parseBackupDestination(destinationUri)
  const { Storage } = await import('@stacksjs/storage')
  const key = backupObjectKey(destination, fileName)
  const diskName = destination.kind === 'disk' ? destination.target : 's3'
  const disk = Storage.disk(diskName)

  if (typeof disk.putStream !== 'function') {
    throw new TypeError(
      `The '${diskName}' disk cannot stream uploads, so a storage archive cannot be copied to it. `
      + 'Use an S3-backed disk for the destination.',
    )
  }

  await disk.putStream(key, Bun.file(file).stream())

  return destination.kind === 'disk'
    ? `disk://${destination.target}/${key}`
    : `s3://${destination.target}/${key}`
}

export function storageBackup(buddy: CLI): void {
  buddy
    .command('storage:backup [disk]', 'Archive a storage disk to a file')
    .option('--out [dir]', `Where to write the archive (default: ${DEFAULT_BACKUP_DIR})`)
    .option('--retain [count]', 'How many archives to keep, per disk', { default: String(DEFAULT_RETAIN) })
    .option('--destination [uri]', 'Copy the archive offsite: s3://bucket/prefix or disk://name/prefix')
    .option('--verbose', 'Enable verbose output', { default: false })
    .example('buddy storage:backup')
    .example('buddy storage:backup public --retain 30')
    .example('buddy storage:backup --destination disk://backups/uploads')
    .action(async (disk: string | undefined, options: { out?: string, retain?: string, destination?: string, verbose?: boolean }) => {
      const perf = await intro('buddy storage:backup')
      const diskName = disk?.trim() || 'local'

      try {
        const resolution = resolveStorageTarget(config.filesystems as any, diskName, process.cwd())
        if (!resolution.ok) {
          await log.error(resolution.refusal.reason)
          process.exit(ExitCode.InvalidArgument)
        }

        const { root } = resolution.target

        // An absent directory is not a failure: a project that has never had an
        // upload still has a valid, empty storage disk, and failing the backup
        // for it would fail the deploy that runs it.
        if (!existsSync(root)) {
          await outro(`Nothing to archive: ${root} does not exist yet`, { startTime: perf, useSeconds: true })
          return
        }

        const dir = backupDir(options.out)
        mkdirSync(dir, { recursive: true })

        const fileName = storageBackupFileName(diskName, new Date())
        const file = join(dir, fileName)

        // The disk's top-level entries, named explicitly rather than `.`.
        // `zip` shell-escapes each argument, so a literal `.` arrives quoted
        // and matches nothing - `zip error: Nothing to do!` on a directory
        // that is plainly not empty.
        //
        // Archiving from the disk root also keeps paths relative, so the
        // archive holds `uploads/a.png` rather than
        // `srv/app/storage/app/uploads/a.png`: an archive carrying one
        // machine's directory layout cannot be restored onto another.
        const entries = readdirSync(root)
        if (entries.length === 0) {
          await outro(`Nothing to archive: ${root} is empty`, { startTime: perf, useSeconds: true })
          return
        }

        const { zip } = await import('@stacksjs/storage')
        const result = await zip(entries, file, { cwd: root })

        if (result.isErr) {
          await log.error(`Could not archive ${root}: ${result.error}`)
          process.exit(ExitCode.FatalError)
        }

        const size = statSync(file).size
        log.success(`Archived ${diskName} (${humanSize(size)}) to ${file}`)

        if (options.destination) {
          const uri = await uploadBackup(options.destination, file, fileName)
          log.success(`Copied to ${uri}`)
        }

        const retain = Number.parseInt(options.retain ?? String(DEFAULT_RETAIN), 10)
        const removed = prune(dir, retain, diskName)
        if (removed.length > 0 && options.verbose)
          log.info(`Pruned ${removed.length} older ${diskName} archive(s)`)

        await outro('Storage backup complete', { startTime: perf, useSeconds: true })
      }
      catch (error) {
        await log.error(error instanceof Error ? error.message : String(error))
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('storage:backups', 'List the storage archives that have been taken')
    .option('--out [dir]', `Where the archives are (default: ${DEFAULT_BACKUP_DIR})`)
    .action(async (options: { out?: string }) => {
      const dir = backupDir(options.out)
      const backups = existingBackups(dir).sort().reverse()

      if (backups.length === 0) {
        log.info(`No storage archives in ${dir}`)
        return
      }

      const { table } = await import('@stacksjs/cli')
      console.log(table(
        backups.map(name => ({
          archive: name,
          size: humanSize(statSync(join(dir, name)).size),
        })),
        { columns: [{ key: 'archive', header: 'Archive' }, { key: 'size', header: 'Size', align: 'right' }] },
      ))
    })

  buddy
    .command('storage:restore <archive> [disk]', 'Restore a storage disk from an archive')
    .option('--out [dir]', `Where the archives are (default: ${DEFAULT_BACKUP_DIR})`)
    .option('--force', 'Restore even though it overwrites files that are there now', { default: false })
    .example('buddy storage:restore 2026-09-10T08-15-00-000.local.zip')
    .action(async (archive: string, disk: string | undefined, options: { out?: string, force?: boolean }) => {
      const perf = await intro('buddy storage:restore')

      try {
        const diskName = disk?.trim() || 'local'
        const resolution = resolveStorageTarget(config.filesystems as any, diskName, process.cwd())
        if (!resolution.ok) {
          await log.error(resolution.refusal.reason)
          process.exit(ExitCode.InvalidArgument)
        }

        const dir = backupDir(options.out)
        const file = isAbsolute(archive) ? archive : join(dir, archive)

        if (!existsSync(file)) {
          await log.error(`No such archive: ${file}`)
          process.exit(ExitCode.InvalidArgument)
        }

        const { root } = resolution.target

        // A restore that overwrites without being asked is the one people run
        // by accident against the wrong disk, and there is no undo.
        if (!options.force && existsSync(root) && readdirSync(root).length > 0) {
          await log.error(
            `${root} is not empty. Restoring merges the archive over what is there, which cannot be undone. `
            + 'Re-run with --force once you are sure this is the right disk.',
          )
          process.exit(ExitCode.InvalidArgument)
        }

        mkdirSync(root, { recursive: true })

        // `unzip` from the storage package, which takes argv rather than a
        // shell string. Interpolating a quoted path into a command string is
        // the exact bug this command's first version had, and the one that
        // had silently broken `zip`/`unzip` for every caller.
        const { unzip } = await import('@stacksjs/storage')
        const result = await unzip([file], { cwd: root })

        if (result.isErr) {
          await log.error(`Could not restore ${file}: ${result.error}`)
          process.exit(ExitCode.FatalError)
        }

        log.success(`Restored ${diskName} from ${file}`)
        await outro('Storage restore complete', { startTime: perf, useSeconds: true })
      }
      catch (error) {
        await log.error(error instanceof Error ? error.message : String(error))
        process.exit(ExitCode.FatalError)
      }
    })
}
