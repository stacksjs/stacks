import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StorageManager } from '@stacksjs/storage'
import {
  createDashboardDirectory,
  deleteDashboardFile,
  getDashboardFileSnapshot,
  normalizeDashboardFileName,
  normalizeDashboardFileLimit,
  normalizeDashboardFilePath,
  uploadDashboardFiles,
} from './file-manager'

let root = ''
let manager: StorageManager

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'stacks-dashboard-files-'))
  await mkdir(join(root, 'public'), { recursive: true })
  manager = new StorageManager().init({
    default: 'public',
    disks: {
      public: {
        driver: 'local',
        root: join(root, 'public'),
        url: '/storage',
        visibility: 'public',
      },
    },
  })
})

afterEach(async () => {
  manager.reset()
  await rm(root, { force: true, recursive: true })
})

describe('dashboard file manager', () => {
  test('lists real storage entries with stable metadata and totals', async () => {
    const disk = manager.disk('public')
    await disk.write('documents/readme.txt', 'hello')
    await disk.write('images/logo.png', new Uint8Array([137, 80, 78, 71]))
    await disk.write('.hidden/secret.txt', 'not listed')

    const snapshot = await getDashboardFileSnapshot({}, manager)
    const documents = snapshot.root.items?.find(item => item.path === 'documents')
    const readme = documents?.items?.find(item => item.path === 'documents/readme.txt')

    expect(snapshot.disk).toBe('public')
    expect(snapshot.disks).toContainEqual({ name: 'public', public: true })
    expect(snapshot.stats.files).toBe(2)
    expect(snapshot.stats.folders).toBe(2)
    expect(snapshot.stats.contentBytes).toBe(9)
    expect(snapshot.stats.byType.documents).toBe(5)
    expect(snapshot.stats.byType.images).toBe(4)
    expect(snapshot.root.items?.some(item => item.name === '.hidden')).toBe(false)
    expect(snapshot.warnings).toEqual([])
    expect(readme).toMatchObject({
      id: 'file:documents/readme.txt',
      name: 'readme.txt',
      size: 5,
      thumbnail: '/documents/readme.txt',
      type: 'txt',
      url: '/storage/documents/readme.txt',
    })
  })

  test('reports truncation instead of silently fabricating a complete tree', async () => {
    await manager.disk('public').write('one.txt', '1')
    await manager.disk('public').write('two.txt', '2')

    const snapshot = await getDashboardFileSnapshot({ maxEntries: 1 }, manager)

    expect(snapshot.truncated).toBe(true)
    expect(snapshot.stats.files).toBe(1)
  })

  test('rejects invalid scan limits instead of silently clamping them', () => {
    expect(normalizeDashboardFileLimit(undefined)).toBe(1000)
    expect(normalizeDashboardFileLimit('5000')).toBe(5000)
    expect(() => normalizeDashboardFileLimit('not-a-limit')).toThrow('between 1 and 5000')
    expect(() => normalizeDashboardFileLimit(5001)).toThrow('between 1 and 5000')
  })

  test('fails the snapshot when file metadata cannot be read', async () => {
    const disk = manager.disk('public')
    await disk.write('unreadable.txt', 'contents')
    disk.stat = async () => {
      throw new Error('metadata unavailable')
    }

    await expect(getDashboardFileSnapshot({}, manager))
      .rejects
      .toThrow('Metadata for storage file "unreadable.txt" could not be read')
  })

  test('reports unavailable public URLs without hiding stored files', async () => {
    const disk = manager.disk('public')
    await disk.write('document.txt', 'contents')
    disk.publicUrl = async () => {
      throw new Error('URL unavailable')
    }

    const snapshot = await getDashboardFileSnapshot({}, manager)
    expect(snapshot.stats.files).toBe(1)
    expect(snapshot.warnings).toEqual(['Public URL for "document.txt" could not be resolved.'])
  })

  test('creates and deletes persisted directories and files', async () => {
    await createDashboardDirectory({ path: '', name: 'Product shots' }, manager)
    expect(await manager.disk('public').directoryExists('Product shots')).toBe(true)

    await manager.disk('public').write('Product shots/photo.jpg', 'photo')
    await deleteDashboardFile({ path: 'Product shots/photo.jpg' }, manager)
    expect(await manager.disk('public').fileExists('Product shots/photo.jpg')).toBe(false)

    await deleteDashboardFile({ path: 'Product shots' }, manager)
    expect(await manager.disk('public').directoryExists('Product shots')).toBe(false)
  })

  test('uploads original filenames without replacing an existing file', async () => {
    const file = (contents: string) => ({
      name: 'release notes.txt',
      mimeType: 'text/plain',
      bytes: async () => new TextEncoder().encode(contents),
    })

    const uploaded = await uploadDashboardFiles({ path: 'documents', files: [file('first')] }, manager)
    expect(uploaded[0]).toMatchObject({
      path: 'documents/release_notes.txt',
      url: '/storage/documents/release_notes.txt',
      size: 5,
    })

    await expect(uploadDashboardFiles({ path: 'documents', files: [file('second')] }, manager))
      .rejects
      .toThrow('File already exists: documents/release_notes.txt')
    expect(await manager.disk('public').readToString('documents/release_notes.txt')).toBe('first')
  })

  test('rolls back earlier files when a multi-file upload collides', async () => {
    const file = (name: string, contents: string) => ({
      name,
      mimeType: 'text/plain',
      bytes: async () => new TextEncoder().encode(contents),
    })
    await manager.disk('public').write('duplicate.txt', 'existing')

    await expect(uploadDashboardFiles({
      files: [file('new.txt', 'new'), file('duplicate.txt', 'replacement')],
    }, manager)).rejects.toThrow('No files from this upload were kept')

    expect(await manager.disk('public').fileExists('new.txt')).toBe(false)
    expect(await manager.disk('public').readToString('duplicate.txt')).toBe('existing')
  })

  test('rejects traversal and invalid names before touching storage', () => {
    expect(() => normalizeDashboardFilePath('../outside')).toThrow('invalid segment')
    expect(() => normalizeDashboardFilePath('/absolute')).toThrow('relative')
    expect(() => normalizeDashboardFileName('.hidden')).toThrow('Hidden')
    expect(() => normalizeDashboardFileName('nested/name')).toThrow('separators')
  })
})
