// The file manager's metadata layer (stacksjs/stacks#2577).
//
// Two halves, tested separately because they fail differently. The pure rules -
// prefix matching, repathing, tag normalization - are asserted directly, since
// a bug there is silent: renaming `reports` would also rewrite
// `reports-archive`, and nothing would say so. The reconciliation is asserted
// through the real file-manager operations against a real temp disk, because
// what matters is not that `followRename` works but that `renameDashboardFile`
// calls it, after the move, with the right prefix.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StorageManager } from '@stacksjs/storage'
import type { DashboardFileNode } from './file-manager'
import {
  deleteDashboardFile,
  duplicateDashboardFile,
  getDashboardFileSnapshot,
  renameDashboardFile,
  setDashboardFileFavorite,
  setDashboardFileTags,
} from './file-manager'
import {
  createMemoryMetadataStore,
  isEmptyMetadata,
  isUnderPrefix,
  normalizeTags,
  repathUnderPrefix,
  sweepMetadata,
} from './file-metadata'

let root = ''
let manager: StorageManager
let store = createMemoryMetadataStore()

beforeEach(async () => {
  store = createMemoryMetadataStore()
  root = await mkdtemp(join(tmpdir(), 'stacks-file-metadata-'))
  await mkdir(join(root, 'public'), { recursive: true })
  manager = new StorageManager().init({
    default: 'public',
    disks: {
      public: { driver: 'local', root: join(root, 'public'), url: '/storage', visibility: 'public' },
    },
  })
})

afterEach(async () => {
  manager.reset()
  await rm(root, { force: true, recursive: true })
})

/** Find a node by path anywhere in the snapshot tree. */
function nodeAt(node: DashboardFileNode, path: string): DashboardFileNode | undefined {
  if (node.path === path)
    return node
  for (const child of node.items ?? []) {
    const found = nodeAt(child, path)
    if (found)
      return found
  }
  return undefined
}

describe('isUnderPrefix', () => {
  test('matches the prefix itself and what is beneath it', () => {
    expect(isUnderPrefix('reports', 'reports')).toBeTrue()
    expect(isUnderPrefix('reports/q1.pdf', 'reports')).toBeTrue()
    expect(isUnderPrefix('reports/2024/q1.pdf', 'reports')).toBeTrue()
  })

  test('does not match a sibling that shares a spelling', () => {
    // The separator is what makes this correct, and its absence is the bug that
    // only appears once somebody has both folders.
    expect(isUnderPrefix('reports-archive/q1.pdf', 'reports')).toBeFalse()
    expect(isUnderPrefix('reportsarchive', 'reports')).toBeFalse()
  })

  test('the empty prefix is the whole disk', () => {
    expect(isUnderPrefix('anything/at/all.txt', '')).toBeTrue()
  })
})

describe('repathUnderPrefix', () => {
  test('rewrites the prefix and keeps the rest', () => {
    expect(repathUnderPrefix('reports', 'reports', 'archive')).toBe('archive')
    expect(repathUnderPrefix('reports/q1.pdf', 'reports', 'archive')).toBe('archive/q1.pdf')
    expect(repathUnderPrefix('reports/2024/q1.pdf', 'reports', 'archive')).toBe('archive/2024/q1.pdf')
  })

  test('leaves a path that is not under the prefix alone', () => {
    expect(repathUnderPrefix('reports-archive/q1.pdf', 'reports', 'archive')).toBe('reports-archive/q1.pdf')
    expect(repathUnderPrefix('other.txt', 'reports', 'archive')).toBe('other.txt')
  })
})

describe('normalizeTags', () => {
  test('trims, drops blanks, and deduplicates case-insensitively', () => {
    expect(normalizeTags([' Invoice ', 'invoice', '', '   ', 'Draft'])).toEqual(['Draft', 'Invoice'])
  })

  test('keeps the first spelling of a duplicate', () => {
    expect(normalizeTags(['Invoice', 'INVOICE'])).toEqual(['Invoice'])
  })

  test('sorts, so the same set sent in a different order is the same record', () => {
    expect(normalizeTags(['b', 'a'])).toEqual(normalizeTags(['a', 'b']))
  })

  test('ignores anything that is not a string', () => {
    expect(normalizeTags([1, null, undefined, {}, 'kept'])).toEqual(['kept'])
  })
})

describe('isEmptyMetadata', () => {
  test('a record saying nothing is empty, and is why unstarring deletes the row', () => {
    expect(isEmptyMetadata({ favorite: false, tags: [] })).toBeTrue()
    expect(isEmptyMetadata({ favorite: true, tags: [] })).toBeFalse()
    expect(isEmptyMetadata({ favorite: false, tags: ['x'] })).toBeFalse()
  })
})

describe('setDashboardFileFavorite', () => {
  test('stars a file, and the snapshot reports it', async () => {
    await manager.disk('public').write('reports/q1.pdf', 'x')

    const result = await setDashboardFileFavorite({ path: 'reports/q1.pdf', favorite: true }, manager, store)
    expect(result).toEqual({ path: 'reports/q1.pdf', favorite: true, tags: [] })

    const snapshot = await getDashboardFileSnapshot({}, manager, store)
    expect(nodeAt(snapshot.root, 'reports/q1.pdf')?.starred).toBeTrue()
  })

  test('unstarring removes the record rather than storing false', async () => {
    await manager.disk('public').write('a.txt', 'x')

    await setDashboardFileFavorite({ path: 'a.txt', favorite: true }, manager, store)
    await setDashboardFileFavorite({ path: 'a.txt', favorite: false }, manager, store)

    expect(await store.under('public', '')).toEqual(new Map())
  })

  test('leaves tags alone, because the two arrive from different controls', async () => {
    await manager.disk('public').write('a.txt', 'x')
    await setDashboardFileTags({ path: 'a.txt', tags: ['invoice'] }, manager, store)

    const result = await setDashboardFileFavorite({ path: 'a.txt', favorite: true }, manager, store)
    expect(result.tags).toEqual(['invoice'])
  })

  test('404s for a path the disk does not have', async () => {
    // Otherwise the row is an orphan the moment it is written, and the caller
    // gets a 200 for it.
    expect(setDashboardFileFavorite({ path: 'missing.txt', favorite: true }, manager, store))
      .rejects.toThrow(/was not found/)
  })

  test('rejects a non-boolean', async () => {
    await manager.disk('public').write('a.txt', 'x')
    expect(setDashboardFileFavorite({ path: 'a.txt', favorite: 'yes' }, manager, store))
      .rejects.toThrow(/true or false/)
  })

  test('stars a folder too', async () => {
    await manager.disk('public').write('reports/q1.pdf', 'x')

    await setDashboardFileFavorite({ path: 'reports', favorite: true }, manager, store)
    const snapshot = await getDashboardFileSnapshot({}, manager, store)

    expect(nodeAt(snapshot.root, 'reports')?.starred).toBeTrue()
  })
})

describe('setDashboardFileTags', () => {
  test('replaces the whole set, because there is no signal for a removal', async () => {
    await manager.disk('public').write('a.txt', 'x')

    await setDashboardFileTags({ path: 'a.txt', tags: ['invoice', 'draft'] }, manager, store)
    const result = await setDashboardFileTags({ path: 'a.txt', tags: ['invoice'] }, manager, store)

    expect(result.tags).toEqual(['invoice'])
  })

  test('normalizes what it stores, and the snapshot reports it', async () => {
    await manager.disk('public').write('a.txt', 'x')
    await setDashboardFileTags({ path: 'a.txt', tags: [' Invoice ', 'invoice', 'Draft'] }, manager, store)

    const snapshot = await getDashboardFileSnapshot({}, manager, store)
    expect(nodeAt(snapshot.root, 'a.txt')?.tags).toEqual(['Draft', 'Invoice'])
  })

  test('clearing the tags of an unstarred file removes the record', async () => {
    await manager.disk('public').write('a.txt', 'x')

    await setDashboardFileTags({ path: 'a.txt', tags: ['invoice'] }, manager, store)
    await setDashboardFileTags({ path: 'a.txt', tags: [] }, manager, store)

    expect(await store.under('public', '')).toEqual(new Map())
  })

  test('keeps the record while the file is still starred', async () => {
    await manager.disk('public').write('a.txt', 'x')

    await setDashboardFileFavorite({ path: 'a.txt', favorite: true }, manager, store)
    await setDashboardFileTags({ path: 'a.txt', tags: [] }, manager, store)

    expect((await store.under('public', '')).get('a.txt')).toEqual({ favorite: true, tags: [] })
  })

  test('bounds what one file may carry', async () => {
    await manager.disk('public').write('a.txt', 'x')

    expect(setDashboardFileTags({ path: 'a.txt', tags: Array.from({ length: 33 }, (_, i) => `t${i}`) }, manager, store))
      .rejects.toThrow(/at most 32/)
    expect(setDashboardFileTags({ path: 'a.txt', tags: ['x'.repeat(61)] }, manager, store))
      .rejects.toThrow(/60 characters/)
    expect(setDashboardFileTags({ path: 'a.txt', tags: 'invoice' }, manager, store))
      .rejects.toThrow(/must be an array/)
  })
})

describe('reconciliation on rename', () => {
  test('a renamed file keeps its star and tags', async () => {
    await manager.disk('public').write('reports/q1.pdf', 'x')
    await setDashboardFileFavorite({ path: 'reports/q1.pdf', favorite: true }, manager, store)
    await setDashboardFileTags({ path: 'reports/q1.pdf', tags: ['invoice'] }, manager, store)

    await renameDashboardFile({ path: 'reports/q1.pdf', name: 'q1-final.pdf' }, manager, store)

    const records = await store.under('public', '')
    expect(records.get('reports/q1.pdf')).toBeUndefined()
    expect(records.get('reports/q1-final.pdf')).toEqual({ favorite: true, tags: ['invoice'] })
  })

  test('a renamed folder carries every record beneath it', async () => {
    // The part #2577 flagged as the one that would bite: a folder rename moves
    // every file under it, so this is a prefix update rather than one row.
    const disk = manager.disk('public')
    await disk.write('reports/q1.pdf', 'x')
    await disk.write('reports/2024/q2.pdf', 'x')
    await setDashboardFileFavorite({ path: 'reports/q1.pdf', favorite: true }, manager, store)
    await setDashboardFileFavorite({ path: 'reports/2024/q2.pdf', favorite: true }, manager, store)

    await renameDashboardFile({ path: 'reports', name: 'archive' }, manager, store)

    const records = await store.under('public', '')
    expect([...records.keys()].sort()).toEqual(['archive/2024/q2.pdf', 'archive/q1.pdf'])
  })

  test('does not touch a sibling folder that shares a spelling', async () => {
    const disk = manager.disk('public')
    await disk.write('reports/q1.pdf', 'x')
    await disk.write('reports-archive/old.pdf', 'x')
    await setDashboardFileFavorite({ path: 'reports/q1.pdf', favorite: true }, manager, store)
    await setDashboardFileFavorite({ path: 'reports-archive/old.pdf', favorite: true }, manager, store)

    await renameDashboardFile({ path: 'reports', name: 'archive' }, manager, store)

    const records = await store.under('public', '')
    expect(records.get('reports-archive/old.pdf')).toEqual({ favorite: true, tags: [] })
  })
})

describe('reconciliation on delete', () => {
  test('a deleted file forgets its record', async () => {
    await manager.disk('public').write('a.txt', 'x')
    await setDashboardFileFavorite({ path: 'a.txt', favorite: true }, manager, store)

    await deleteDashboardFile({ path: 'a.txt' }, manager, store)

    expect(await store.under('public', '')).toEqual(new Map())
  })

  test('a deleted folder forgets the whole subtree', async () => {
    const disk = manager.disk('public')
    await disk.write('reports/q1.pdf', 'x')
    await disk.write('reports/2024/q2.pdf', 'x')
    await setDashboardFileFavorite({ path: 'reports/q1.pdf', favorite: true }, manager, store)
    await setDashboardFileFavorite({ path: 'reports/2024/q2.pdf', favorite: true }, manager, store)

    await deleteDashboardFile({ path: 'reports' }, manager, store)

    expect(await store.under('public', '')).toEqual(new Map())
  })
})

describe('reconciliation on copy', () => {
  test('a copy carries the star and tags, and the source keeps its own', async () => {
    await manager.disk('public').write('a.txt', 'x')
    await setDashboardFileFavorite({ path: 'a.txt', favorite: true }, manager, store)
    await setDashboardFileTags({ path: 'a.txt', tags: ['invoice'] }, manager, store)

    const { to } = await duplicateDashboardFile({ path: 'a.txt' }, manager, store)

    const records = await store.under('public', '')
    expect(records.get('a.txt')).toEqual({ favorite: true, tags: ['invoice'] })
    expect(records.get(to)).toEqual({ favorite: true, tags: ['invoice'] })
  })

  test('writes no record for a file that had none', async () => {
    await manager.disk('public').write('a.txt', 'x')

    await duplicateDashboardFile({ path: 'a.txt' }, manager, store)

    expect(await store.under('public', '')).toEqual(new Map())
  })
})

describe('orphan sweeping', () => {
  test('a listing removes records for paths it did not see', async () => {
    // The answer to "what about files changed outside the dashboard": the disk
    // is authoritative, and the listing pass already knows every path, so
    // sweeping is free rather than a second pass.
    await manager.disk('public').write('a.txt', 'x')
    await setDashboardFileFavorite({ path: 'a.txt', favorite: true }, manager, store)
    await store.write('public', 'gone.txt', { favorite: true, tags: [] })

    await getDashboardFileSnapshot({}, manager, store)

    const records = await store.under('public', '')
    expect([...records.keys()]).toEqual(['a.txt'])
  })

  test('a truncated listing sweeps nothing', async () => {
    // A truncated walk has not shown a path is absent, only that it stopped
    // before reaching it. Sweeping on it would delete the metadata of every
    // file past the limit.
    const disk = manager.disk('public')
    await disk.write('a.txt', 'x')
    await disk.write('b.txt', 'x')
    await disk.write('c.txt', 'x')
    await store.write('public', 'starred-but-past-the-limit.txt', { favorite: true, tags: [] })

    const snapshot = await getDashboardFileSnapshot({ maxEntries: 1 }, manager, store)
    expect(snapshot.truncated).toBeTrue()

    expect((await store.under('public', '')).has('starred-but-past-the-limit.txt')).toBeTrue()
  })

  test('sweepMetadata refuses directly too, not only through the snapshot', async () => {
    await store.write('public', 'x.txt', { favorite: true, tags: [] })

    expect(await sweepMetadata(store, 'public', '', new Set(), { truncated: true })).toBe(0)
    expect(await sweepMetadata(store, 'public', '', new Set(), { truncated: false })).toBe(1)
  })

  test('leaves another disk\'s records alone', async () => {
    await manager.disk('public').write('a.txt', 'x')
    await store.write('other-disk', 'kept.txt', { favorite: true, tags: [] })

    await getDashboardFileSnapshot({}, manager, store)

    expect((await store.under('other-disk', '')).has('kept.txt')).toBeTrue()
  })
})
