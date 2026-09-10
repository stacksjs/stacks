/**
 * Storage backups: the uploaded-files half of `@stacksjs/backup`
 * (stacksjs/stacks#269).
 *
 * `db:backup` already covers data. This covers the files beside it, and the
 * two are separate on purpose: a database dump and the uploads it references
 * are restored independently, and pretending they are one artifact makes the
 * common case - "restore yesterday's uploads, keep today's rows" - impossible.
 *
 * Pure, like `./database-backup` next door. Naming, target resolution and
 * retention are decided here and testable without a filesystem; the archiving
 * and uploading live in the command.
 */

import { isAbsolute, join } from 'node:path'

export interface StorageBackupTarget {
  /** The configured disk this backs up. */
  disk: string
  /** Absolute directory the archive is taken from. */
  root: string
}

/** Why a disk cannot be backed up this way. */
export interface StorageBackupRefusal {
  disk: string
  reason: string
}

export type StorageBackupResolution =
  | { ok: true, target: StorageBackupTarget }
  | { ok: false, refusal: StorageBackupRefusal }

/**
 * Disks whose contents are not on this machine.
 *
 * Refused rather than supported: "back up S3" through the application means
 * streaming every object down and back up again, which is slower, costs
 * egress, and is strictly worse than the versioning and replication the
 * provider already offers. Saying so is more useful than doing it badly.
 */
const REMOTE_DRIVERS: ReadonlySet<string> = new Set(['s3', 'azure', 'gcs', 'r2'])

/** Where each built-in disk keeps its files, relative to the project root. */
const DISK_ROOTS: Record<string, string> = {
  local: 'storage/app',
  public: 'public',
}

/**
 * Resolve which directory a disk's backup should archive.
 *
 * Returns a refusal rather than throwing, so a caller backing up several disks
 * can report the ones it skipped instead of stopping at the first.
 */
export function resolveStorageTarget(
  filesystems: { driver?: string, root?: string, disks?: Record<string, { driver?: string, root?: string }> } | undefined,
  disk: string,
  projectRoot: string,
): StorageBackupResolution {
  const configured = filesystems?.disks?.[disk]
  const driver = configured?.driver ?? (disk === 'local' || disk === 'public' ? 'local' : disk)

  if (REMOTE_DRIVERS.has(driver)) {
    return {
      ok: false,
      refusal: {
        disk,
        reason: `\`${disk}\` is a ${driver} disk, so its files are not on this machine. `
          + 'Use the provider\'s own versioning or replication: streaming every object through this process '
          + 'is slower, costs egress, and gives a worse guarantee.',
      },
    }
  }

  const declared = configured?.root ?? DISK_ROOTS[disk]
  if (!declared) {
    return {
      ok: false,
      refusal: {
        disk,
        reason: `\`${disk}\` is not a configured disk, and is not one of the built-in local disks (${Object.keys(DISK_ROOTS).join(', ')}).`,
      },
    }
  }

  return {
    ok: true,
    target: { disk, root: isAbsolute(declared) ? declared : join(projectRoot, declared) },
  }
}

/**
 * The archive's file name.
 *
 * Timestamp first, so a lexicographic sort is chronological - that is what
 * lets {@link prunableStorageBackups} and "restore the newest" be a string
 * sort rather than a stat of every file. The disk name is in the name because
 * one directory holds backups of several disks.
 */
export function storageBackupFileName(disk: string, at: Date): string {
  const stamp = at.toISOString().replace(/[:.]/g, '-').replace('Z', '')
  return `${stamp}.${disk}.zip`
}

/** Does this name look like something {@link storageBackupFileName} produced? */
export function isStorageBackupFileName(name: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T[\d-]+\.[\w-]+\.zip$/.test(name)
}

/** The disk a backup file name belongs to, or `null` if it is not one. */
export function diskOfBackup(name: string): string | null {
  if (!isStorageBackupFileName(name))
    return null
  const parts = name.split('.')
  return parts.length >= 3 ? parts[parts.length - 2]! : null
}

/**
 * Which archives to delete to keep `retain` of them, oldest first.
 *
 * Retention is PER DISK. A shared count would mean backing up a second disk
 * silently halves the history of the first, which is the kind of thing
 * discovered only when the backup you wanted is the one that was pruned.
 *
 * Takes the file list rather than reading a directory, so the policy is
 * testable without a filesystem.
 */
export function prunableStorageBackups(existing: string[], retain: number, disk?: string): string[] {
  if (!Number.isFinite(retain) || retain < 1)
    return []

  const byDisk = new Map<string, string[]>()
  for (const name of existing.filter(isStorageBackupFileName)) {
    const owner = diskOfBackup(name)!
    if (disk && owner !== disk)
      continue
    byDisk.set(owner, [...(byDisk.get(owner) ?? []), name])
  }

  const prunable: string[] = []
  for (const names of byDisk.values()) {
    const sorted = [...names].sort()
    const excess = sorted.length - retain
    if (excess > 0)
      prunable.push(...sorted.slice(0, excess))
  }

  return prunable.sort()
}
