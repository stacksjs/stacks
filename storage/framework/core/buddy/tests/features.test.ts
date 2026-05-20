import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deleteFeatureFiles, FEATURE_FILES, FEATURE_NAMES, featurePathsPresent } from '../src/commands/features'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'stacks-features-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

async function touch(rel: string): Promise<void> {
  const full = join(root, rel)
  await mkdir(join(full, '..'), { recursive: true })
  await writeFile(full, '')
}

async function mkdirp(rel: string): Promise<void> {
  await mkdir(join(root, rel), { recursive: true })
}

describe('FEATURE_FILES manifest', () => {
  it('covers every feature listed in FEATURE_NAMES', () => {
    for (const name of FEATURE_NAMES)
      expect(FEATURE_FILES[name]).toBeDefined()
  })

  it('paths are all relative (no leading slash, no .. escape)', () => {
    for (const name of FEATURE_NAMES) {
      for (const path of FEATURE_FILES[name]) {
        expect(path.startsWith('/')).toBe(false)
        expect(path.includes('..')).toBe(false)
      }
    }
  })
})

describe('featurePathsPresent()', () => {
  it('returns only the manifest paths that actually exist on disk', async () => {
    await mkdirp('app/Actions/Cms')
    await touch('app/Models/Tag.ts')
    // Don't create app/Models/Comment.ts or app/Models/Content/ — they should be filtered out.

    const present = featurePathsPresent('cms', root)

    expect(present).toContain('app/Actions/Cms/')
    expect(present).toContain('app/Models/Tag.ts')
    expect(present).not.toContain('app/Models/Comment.ts')
    expect(present).not.toContain('app/Models/Content/')
  })

  it('returns an empty array when no manifest paths exist', () => {
    expect(featurePathsPresent('queue', root)).toEqual([])
  })
})

describe('deleteFeatureFiles()', () => {
  it('removes both file and directory entries, returning what was deleted', async () => {
    await mkdirp('app/Actions/Cms')
    await touch('app/Actions/Cms/PostIndexAction.ts')
    await touch('app/Models/Tag.ts')

    const removed = await deleteFeatureFiles('cms', root)

    expect(removed).toContain('app/Actions/Cms/')
    expect(removed).toContain('app/Models/Tag.ts')
    expect(existsSync(join(root, 'app/Actions/Cms'))).toBe(false)
    expect(existsSync(join(root, 'app/Models/Tag.ts'))).toBe(false)
  })

  it('skips missing manifest paths silently', async () => {
    // Only one of the cms paths exists; the rest should be skipped.
    await touch('app/Models/Comment.ts')

    const removed = await deleteFeatureFiles('cms', root)

    expect(removed).toEqual(['app/Models/Comment.ts'])
    expect(existsSync(join(root, 'app/Models/Comment.ts'))).toBe(false)
  })

  it('returns an empty list when nothing matches the manifest', async () => {
    const removed = await deleteFeatureFiles('marketing', root)
    expect(removed).toEqual([])
  })

  it('does not touch unrelated user files in the project', async () => {
    await touch('app/Actions/Cms/PostIndexAction.ts') // claimed
    await touch('app/Actions/MyCustomAction.ts') // user file — must survive

    await deleteFeatureFiles('cms', root)

    expect(existsSync(join(root, 'app/Actions/Cms'))).toBe(false)
    expect(existsSync(join(root, 'app/Actions/MyCustomAction.ts'))).toBe(true)
  })

  it('is idempotent across repeated runs', async () => {
    await touch('app/Models/Job.ts')

    const first = await deleteFeatureFiles('queue', root)
    const second = await deleteFeatureFiles('queue', root)

    expect(first).toContain('app/Models/Job.ts')
    expect(second).toEqual([])
  })
})
