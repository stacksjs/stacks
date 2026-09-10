import { describe, expect, it } from 'bun:test'
import {
  diskOfBackup,
  isStorageBackupFileName,
  prunableStorageBackups,
  resolveStorageTarget,
  storageBackupFileName,
} from '../src/storage-backup'

const ROOT = '/srv/app'

describe('resolveStorageTarget', () => {
  it('resolves the built-in local disks without any configuration', () => {
    expect(resolveStorageTarget(undefined, 'local', ROOT)).toEqual({
      ok: true,
      target: { disk: 'local', root: '/srv/app/storage/app' },
    })
    expect(resolveStorageTarget(undefined, 'public', ROOT)).toEqual({
      ok: true,
      target: { disk: 'public', root: '/srv/app/public' },
    })
  })

  it('honours a configured root, absolute or relative', () => {
    const relative = resolveStorageTarget({ disks: { media: { driver: 'local', root: 'var/media' } } }, 'media', ROOT)
    expect(relative).toEqual({ ok: true, target: { disk: 'media', root: '/srv/app/var/media' } })

    const absolute = resolveStorageTarget({ disks: { media: { driver: 'local', root: '/mnt/media' } } }, 'media', ROOT)
    expect(absolute).toEqual({ ok: true, target: { disk: 'media', root: '/mnt/media' } })
  })

  it('refuses a remote disk, and says why', () => {
    // Streaming every object down and back up is slower, costs egress, and is
    // a worse guarantee than the provider's own versioning. Saying so beats
    // doing it badly.
    for (const driver of ['s3', 'azure', 'gcs', 'r2']) {
      const result = resolveStorageTarget({ disks: { remote: { driver } } }, 'remote', ROOT)
      expect(result.ok).toBeFalse()
      if (!result.ok)
        expect(result.refusal.reason).toContain('not on this machine')
    }
  })

  it('refuses an unknown disk by name rather than inventing a path', () => {
    const result = resolveStorageTarget({ disks: {} }, 'nope', ROOT)
    expect(result.ok).toBeFalse()
    if (!result.ok)
      expect(result.refusal.reason).toContain('not a configured disk')
  })

  it('returns a refusal rather than throwing, so a multi-disk run can continue', () => {
    expect(() => resolveStorageTarget({ disks: { r: { driver: 's3' } } }, 'r', ROOT)).not.toThrow()
  })
})

describe('storageBackupFileName', () => {
  const at = new Date('2026-09-10T08:15:00.000Z')

  it('puts the timestamp first, so a string sort is chronological', () => {
    const earlier = storageBackupFileName('local', new Date('2026-09-09T00:00:00.000Z'))
    const later = storageBackupFileName('local', at)
    expect([later, earlier].sort()).toEqual([earlier, later])
  })

  it('names the disk, because one directory holds several', () => {
    expect(storageBackupFileName('public', at)).toContain('.public.zip')
    expect(diskOfBackup(storageBackupFileName('public', at))).toBe('public')
  })

  it('round-trips its own names', () => {
    expect(isStorageBackupFileName(storageBackupFileName('local', at))).toBeTrue()
  })

  it('does not claim unrelated files', () => {
    for (const name of ['notes.zip', 'backup.zip', '2026-09-10.zip', 'README.md', '2026-09-10T08-15-00.local.sql'])
      expect(isStorageBackupFileName(name)).toBeFalse()
  })
})

describe('prunableStorageBackups', () => {
  const names = (disk: string, days: number[]) =>
    days.map(day => `2026-09-${String(day).padStart(2, '0')}T00-00-00-000.${disk}.zip`)

  it('keeps the newest and returns the rest oldest first', () => {
    const existing = names('local', [1, 2, 3, 4])
    expect(prunableStorageBackups(existing, 2)).toEqual(existing.slice(0, 2))
  })

  it('counts retention PER DISK', () => {
    // A shared count would mean backing up a second disk silently halves the
    // history of the first - discovered only when the backup you wanted is
    // the one that was pruned.
    const existing = [...names('local', [1, 2, 3]), ...names('public', [1, 2, 3])]
    expect(prunableStorageBackups(existing, 3)).toEqual([])
    expect(prunableStorageBackups(existing, 2)).toEqual([
      '2026-09-01T00-00-00-000.local.zip',
      '2026-09-01T00-00-00-000.public.zip',
    ])
  })

  it('prunes only the named disk when given one', () => {
    const existing = [...names('local', [1, 2, 3]), ...names('public', [1, 2, 3])]
    expect(prunableStorageBackups(existing, 1, 'local')).toEqual(names('local', [1, 2]))
  })

  it('ignores files it did not write', () => {
    expect(prunableStorageBackups(['random.zip', 'notes.txt', ...names('local', [1, 2])], 1))
      .toEqual(names('local', [1]))
  })

  it('prunes nothing for a nonsensical retention, rather than everything', () => {
    // `retain: 0` reaching this by accident must not delete the history.
    for (const retain of [0, -1, Number.NaN])
      expect(prunableStorageBackups(names('local', [1, 2, 3]), retain)).toEqual([])
  })
})
