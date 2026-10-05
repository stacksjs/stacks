/**
 * Moving a file onto itself keeps it, and the Result helpers resolve.
 *
 * Three ways a file was lost, or a failure arrived in the wrong shape:
 *
 *   - `rename(a, a, { overwrite: true })` deleted the destination before
 *     renaming. The destination was the source, so the file was gone and the
 *     rename then failed on a missing path. A change of case on a
 *     case-insensitive disk is the same file under another spelling.
 *   - `Storage.moveAcross('local:a', 'local:a')` copied the file onto itself
 *     and then deleted the source, which was the destination.
 *   - `rename()` and the delete helpers REJECTED with an `Err` Result rather
 *     than resolving to it, so `if (result.isErr)` never ran: the caller got
 *     an exception whose thrown value was a Result.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { deleteEmptyFolder, deleteFile, deleteFolder, isDirectoryEmpty } from '../src/delete'
import { StorageManager } from '../src/facade'
import { move, rename } from '../src/move'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'stacks-move-self-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('rename()', () => {
  test('onto itself, with overwrite, keeps the file', async () => {
    const file = join(root, 'report.txt')
    writeFileSync(file, 'keep me')

    const result = await rename(file, file, { overwrite: true })

    expect(result.isOk).toBe(true)
    expect(readFileSync(file, 'utf8')).toBe('keep me')
  })

  test('onto another spelling of the same path keeps the file', async () => {
    mkdirSync(join(root, 'dir'))
    const file = join(root, 'dir', 'report.txt')
    writeFileSync(file, 'keep me')

    const result = await rename(file, join(root, 'dir', '.', 'report.txt'), { overwrite: true })

    expect(result.isOk).toBe(true)
    expect(readFileSync(file, 'utf8')).toBe('keep me')
  })

  test('a missing source resolves to an Err, and creates nothing', async () => {
    const result = await rename(join(root, 'nope.txt'), join(root, 'new-dir', 'nope.txt'))

    expect(result.isErr).toBe(true)
    if (result.isErr)
      expect(result.error.message).toContain('does not exist')
    expect(existsSync(join(root, 'new-dir'))).toBe(false)
  })

  test('an occupied destination without overwrite resolves to an Err', async () => {
    writeFileSync(join(root, 'a.txt'), 'a')
    writeFileSync(join(root, 'b.txt'), 'b')

    const result = await rename(join(root, 'a.txt'), join(root, 'b.txt'))

    expect(result.isErr).toBe(true)
    expect(readFileSync(join(root, 'b.txt'), 'utf8')).toBe('b')
  })

  test('and move() reports it as a failure rather than throwing', async () => {
    const result = await move(join(root, 'nope.txt'), join(root, 'elsewhere.txt'))
    expect(result.isErr).toBe(true)
  })
})

describe('the delete helpers', () => {
  test('resolve to an Err when they fail, rather than rejecting', async () => {
    const missing = join(root, 'missing')

    for (const helper of [deleteFile, deleteEmptyFolder, isDirectoryEmpty]) {
      const result = await helper(missing)
      expect(result.isErr).toBe(true)
    }
    // A missing folder is not an error for deleteFolder: there is nothing to do.
    expect((await deleteFolder(missing)).isOk).toBe(true)
  })
})

describe('Storage.moveAcross() and copyAcross()', () => {
  let storage: InstanceType<typeof StorageManager>

  beforeEach(() => {
    mkdirSync(join(root, 'local'))
    mkdirSync(join(root, 'archive'))
    storage = new StorageManager()
    storage.init({
      default: 'local',
      disks: {
        local: { driver: 'local', root: join(root, 'local'), visibility: 'private' },
        archive: { driver: 'local', root: join(root, 'archive'), visibility: 'private' },
      },
    })
  })

  afterEach(() => {
    storage.reset()
  })

  test('onto itself keeps the file', async () => {
    writeFileSync(join(root, 'local', 'photo.jpg'), 'pixels')

    const result = await storage.moveAcross('local:photo.jpg', 'local:./photo.jpg')

    expect(result.path).toBe('./photo.jpg')
    expect(readFileSync(join(root, 'local', 'photo.jpg'), 'utf8')).toBe('pixels')
  })

  test('copyAcross onto itself leaves the file as it was', async () => {
    writeFileSync(join(root, 'local', 'photo.jpg'), 'pixels')

    await storage.copyAcross('local:photo.jpg', 'local:photo.jpg')

    expect(readFileSync(join(root, 'local', 'photo.jpg'), 'utf8')).toBe('pixels')
  })

  test('within a disk, moves', async () => {
    writeFileSync(join(root, 'local', 'photo.jpg'), 'pixels')

    const result = await storage.moveAcross('local:photo.jpg', 'local:albums/photo.jpg')

    expect(result.size).toBe(6)
    expect(existsSync(join(root, 'local', 'photo.jpg'))).toBe(false)
    expect(readFileSync(join(root, 'local', 'albums', 'photo.jpg'), 'utf8')).toBe('pixels')
  })

  test('across disks, copies then removes the source', async () => {
    writeFileSync(join(root, 'local', 'photo.jpg'), 'pixels')

    await storage.moveAcross('local:photo.jpg', 'archive:photo.jpg')

    expect(existsSync(join(root, 'local', 'photo.jpg'))).toBe(false)
    expect(readFileSync(join(root, 'archive', 'photo.jpg'), 'utf8')).toBe('pixels')
  })
})
