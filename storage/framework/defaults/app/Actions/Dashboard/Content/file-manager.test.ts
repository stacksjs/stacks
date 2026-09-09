import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StorageManager } from '@stacksjs/storage'
import {
  createDashboardDirectory,
  deleteDashboardFile,
  duplicateDashboardFile,
  getDashboardFileSnapshot,
  normalizeDashboardFileName,
  normalizeDashboardFileLimit,
  normalizeDashboardFilePath,
  renameDashboardFile,
  setDashboardFileVisibility,
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

describe('renameDashboardFile', () => {
  test('renames a file and leaves nothing behind under the old name', async () => {
    const disk = manager.disk('public')
    await disk.write('documents/readme.txt', 'hello')

    const result = await renameDashboardFile({ path: 'documents/readme.txt', name: 'guide.txt' }, manager)

    expect(result).toEqual({ from: 'documents/readme.txt', to: 'documents/guide.txt', type: 'file', moved: 1 })
    expect(await disk.fileExists('documents/guide.txt')).toBe(true)
    expect(await disk.fileExists('documents/readme.txt')).toBe(false)
    expect(await disk.readToString('documents/guide.txt')).toBe('hello')
  })

  test('renames at the top level, where there is no parent to keep', async () => {
    const disk = manager.disk('public')
    await disk.write('notes.txt', 'top level')

    expect(await renameDashboardFile({ path: 'notes.txt', name: 'todo.txt' }, manager))
      .toEqual({ from: 'notes.txt', to: 'todo.txt', type: 'file', moved: 1 })
    expect(await disk.readToString('todo.txt')).toBe('top level')
  })

  /**
   * The parent is kept deliberately. Renaming is changing the last segment;
   * moving something elsewhere is a different gesture and would want its own
   * endpoint, so a name is a name and never a path.
   */
  test('refuses a name that is really a path', async () => {
    await manager.disk('public').write('a/b.txt', 'x')

    await expect(renameDashboardFile({ path: 'a/b.txt', name: '../escaped.txt' }, manager))
      .rejects.toMatchObject({ status: 422 })
    await expect(renameDashboardFile({ path: 'a/b.txt', name: 'nested/deep.txt' }, manager))
      .rejects.toMatchObject({ status: 422 })
  })

  test('renames a directory by moving what is inside it, at any depth', async () => {
    const disk = manager.disk('public')
    await disk.write('images/logo.png', 'a')
    await disk.write('images/icons/favicon.png', 'b')

    const result = await renameDashboardFile({ path: 'images', name: 'media' }, manager)

    expect(result).toEqual({ from: 'images', to: 'media', type: 'directory', moved: 2 })
    expect(await disk.readToString('media/logo.png')).toBe('a')
    expect(await disk.readToString('media/icons/favicon.png')).toBe('b')
    expect(await disk.fileExists('images/logo.png')).toBe(false)
    expect(await disk.directoryExists('images')).toBe(false)
  })

  test('refuses to overwrite an existing name', async () => {
    const disk = manager.disk('public')
    await disk.write('documents/readme.txt', 'keep me')
    await disk.write('documents/guide.txt', 'me too')

    await expect(renameDashboardFile({ path: 'documents/readme.txt', name: 'guide.txt' }, manager))
      .rejects.toMatchObject({ status: 409 })
    // Neither side moved: a refused rename is not a partial one.
    expect(await disk.readToString('documents/readme.txt')).toBe('keep me')
    expect(await disk.readToString('documents/guide.txt')).toBe('me too')
  })

  test('says so rather than silently doing nothing when the name is unchanged', async () => {
    await manager.disk('public').write('a.txt', 'x')

    await expect(renameDashboardFile({ path: 'a.txt', name: 'a.txt' }, manager))
      .rejects.toMatchObject({ status: 422 })
  })

  test('is a 404 when the item does not exist', async () => {
    await expect(renameDashboardFile({ path: 'nope.txt', name: 'yes.txt' }, manager))
      .rejects.toMatchObject({ status: 404 })
  })
})

describe('setDashboardFileVisibility', () => {
  test('flips a single file and reads back as the adapter sees it', async () => {
    const disk = manager.disk('public')
    await disk.write('documents/readme.txt', 'hello')

    expect(await setDashboardFileVisibility({ path: 'documents/readme.txt', visibility: 'private' }, manager))
      .toEqual({ path: 'documents/readme.txt', visibility: 'private', type: 'file', changed: 1 })
    expect(await disk.visibility('documents/readme.txt')).toBe('private')

    await setDashboardFileVisibility({ path: 'documents/readme.txt', visibility: 'public' }, manager)
    expect(await disk.visibility('documents/readme.txt')).toBe('public')
  })

  /**
   * A folder is applied file by file, not to the folder. Object storage has no
   * directories to carry an ACL, and on a local disk a directory's mode gates
   * listing rather than reading - the files are what gate access on both.
   */
  test('applies to every file beneath a folder, at any depth', async () => {
    const disk = manager.disk('public')
    await disk.write('images/logo.png', 'a')
    await disk.write('images/icons/favicon.png', 'b')

    expect(await setDashboardFileVisibility({ path: 'images', visibility: 'private' }, manager))
      .toEqual({ path: 'images', visibility: 'private', type: 'directory', changed: 2 })
    expect(await disk.visibility('images/logo.png')).toBe('private')
    expect(await disk.visibility('images/icons/favicon.png')).toBe('private')
  })

  test('leaves files outside the folder alone', async () => {
    const disk = manager.disk('public')
    await disk.write('images/logo.png', 'a')
    await disk.write('documents/readme.txt', 'b')

    await setDashboardFileVisibility({ path: 'images', visibility: 'private' }, manager)

    expect(await disk.visibility('documents/readme.txt')).toBe('public')
  })

  test('rejects anything that is not public or private', async () => {
    await manager.disk('public').write('a.txt', 'x')

    for (const visibility of ['world-readable', '', 'PUBLIC', true, undefined]) {
      await expect(setDashboardFileVisibility({ path: 'a.txt', visibility }, manager))
        .rejects.toMatchObject({ status: 422 })
    }
  })

  test('is a 404 when the item does not exist', async () => {
    await expect(setDashboardFileVisibility({ path: 'nope.txt', visibility: 'private' }, manager))
      .rejects.toMatchObject({ status: 404 })
  })
})

describe('duplicateDashboardFile', () => {
  test('names the copy before the extension, not after it', async () => {
    const disk = manager.disk('public')
    await disk.write('documents/readme.txt', 'hello')

    const result = await duplicateDashboardFile({ path: 'documents/readme.txt' }, manager)

    // `readme.txt copy` is a file whose type the OS, the browser and this
    // dashboard's own type grouping would all read as unknown.
    expect(result).toEqual({ from: 'documents/readme.txt', to: 'documents/readme copy.txt', type: 'file', copied: 1 })
    expect(await disk.readToString('documents/readme copy.txt')).toBe('hello')
    expect(await disk.readToString('documents/readme.txt')).toBe('hello')
  })

  test('counts up rather than colliding when a copy already exists', async () => {
    const disk = manager.disk('public')
    await disk.write('a.txt', 'x')

    expect((await duplicateDashboardFile({ path: 'a.txt' }, manager)).to).toBe('a copy.txt')
    expect((await duplicateDashboardFile({ path: 'a.txt' }, manager)).to).toBe('a copy 2.txt')
    expect((await duplicateDashboardFile({ path: 'a.txt' }, manager)).to).toBe('a copy 3.txt')
  })

  test('takes an explicit name when given one', async () => {
    await manager.disk('public').write('a.txt', 'x')

    expect((await duplicateDashboardFile({ path: 'a.txt', name: 'b.txt' }, manager)).to).toBe('b.txt')
    await expect(duplicateDashboardFile({ path: 'a.txt', name: 'b.txt' }, manager))
      .rejects.toMatchObject({ status: 409 })
    await expect(duplicateDashboardFile({ path: 'a.txt', name: '../escaped.txt' }, manager))
      .rejects.toMatchObject({ status: 422 })
  })

  test('copies a folder and everything under it, leaving the original whole', async () => {
    const disk = manager.disk('public')
    await disk.write('images/logo.png', 'a')
    await disk.write('images/icons/favicon.png', 'b')

    const result = await duplicateDashboardFile({ path: 'images' }, manager)

    expect(result).toEqual({ from: 'images', to: 'images copy', type: 'directory', copied: 2 })
    expect(await disk.readToString('images copy/logo.png')).toBe('a')
    expect(await disk.readToString('images copy/icons/favicon.png')).toBe('b')
    expect(await disk.readToString('images/logo.png')).toBe('a')
  })

  /**
   * The copy lands beside the original under the same parent, so a deep listing
   * taken while copying could see the files it is itself creating. Paths are
   * collected first; this is what says so.
   */
  test('does not copy the copy it is making', async () => {
    const disk = manager.disk('public')
    await disk.write('media/one.txt', '1')
    await disk.write('media/two.txt', '2')

    expect((await duplicateDashboardFile({ path: 'media' }, manager)).copied).toBe(2)
    expect(await disk.fileExists('media copy/media copy/one.txt')).toBe(false)
  })

  test('is a 404 when the item does not exist', async () => {
    await expect(duplicateDashboardFile({ path: 'nope.txt' }, manager))
      .rejects.toMatchObject({ status: 404 })
  })
})
