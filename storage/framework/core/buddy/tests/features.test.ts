import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { copyFeatureFiles, deleteFeatureFiles, FEATURE_FILES, FEATURE_NAMES, featurePathsPresent } from '../src/commands/features'

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

describe('copyFeatureFiles()', () => {
  let source: string
  let target: string

  // We model the framework defaults tree under `source` and the user
  // project under `target`. Both are fresh tmp dirs per test.
  beforeEach(() => {
    source = mkdtempSync(join(tmpdir(), 'stacks-features-src-'))
    target = mkdtempSync(join(tmpdir(), 'stacks-features-tgt-'))
  })

  afterEach(async () => {
    await rm(source, { recursive: true, force: true })
    await rm(target, { recursive: true, force: true })
  })

  async function stamp(dir: string, rel: string, body = ''): Promise<void> {
    const full = join(dir, rel)
    await mkdir(join(full, '..'), { recursive: true })
    await writeFile(full, body)
  }

  it('copies file + directory manifest entries from source to target', async () => {
    // Populate source as if it were storage/framework/defaults/.
    await stamp(source, 'app/Actions/Cms/PostIndexAction.ts', 'export default {}')
    await stamp(source, 'app/Actions/Cms/PostStoreAction.ts', 'export default {}')
    await stamp(source, 'app/Models/Content/Post.ts', 'export default {}')
    await stamp(source, 'app/Models/Tag.ts', 'export default {}')

    const { copied } = await copyFeatureFiles('cms', { source, target })

    expect(copied).toContain('app/Actions/Cms/')
    expect(copied).toContain('app/Models/Content/')
    expect(copied).toContain('app/Models/Tag.ts')
    expect(existsSync(join(target, 'app/Actions/Cms/PostIndexAction.ts'))).toBe(true)
    expect(existsSync(join(target, 'app/Actions/Cms/PostStoreAction.ts'))).toBe(true)
    expect(existsSync(join(target, 'app/Models/Content/Post.ts'))).toBe(true)
    expect(existsSync(join(target, 'app/Models/Tag.ts'))).toBe(true)
  })

  it('skips manifest entries that have no template in source', async () => {
    // Only one of the cms paths has a template — the rest get skipped.
    await stamp(source, 'app/Models/Tag.ts', 'export default {}')

    const { copied, skipped } = await copyFeatureFiles('cms', { source, target })

    expect(copied).toEqual(['app/Models/Tag.ts'])
    expect(skipped).toContain('app/Actions/Cms/')
    expect(skipped).toContain('app/Models/Content/')
  })

  it('default mode skips paths that already exist in the target (idempotent)', async () => {
    await stamp(source, 'app/Models/Tag.ts', 'from defaults')
    await stamp(target, 'app/Models/Tag.ts', 'user customization')

    const { copied, skipped } = await copyFeatureFiles('cms', { source, target })

    expect(copied).not.toContain('app/Models/Tag.ts')
    expect(skipped).toContain('app/Models/Tag.ts')
    // User customization preserved.
    expect(readFileSync(join(target, 'app/Models/Tag.ts'), 'utf8')).toBe('user customization')
  })

  it('--force overwrites existing target paths', async () => {
    await stamp(source, 'app/Models/Tag.ts', 'from defaults')
    await stamp(target, 'app/Models/Tag.ts', 'user customization')

    const { copied } = await copyFeatureFiles('cms', { source, target, force: true })

    expect(copied).toContain('app/Models/Tag.ts')
    expect(readFileSync(join(target, 'app/Models/Tag.ts'), 'utf8')).toBe('from defaults')
  })

  it('does not touch unrelated user files in the target', async () => {
    await stamp(source, 'app/Models/Tag.ts', 'from defaults')
    await stamp(target, 'app/Models/MyCustom.ts', 'user code')

    await copyFeatureFiles('cms', { source, target })

    expect(existsSync(join(target, 'app/Models/MyCustom.ts'))).toBe(true)
    expect(readFileSync(join(target, 'app/Models/MyCustom.ts'), 'utf8')).toBe('user code')
  })

  it('returns empty copied + full skipped when source has no templates at all', async () => {
    const { copied, skipped } = await copyFeatureFiles('marketing', { source, target })

    expect(copied).toEqual([])
    expect(skipped.length).toBe(FEATURE_FILES.marketing.length)
  })

  it('paired install + uninstall round-trips: copy puts files, delete removes them', async () => {
    await stamp(source, 'app/Models/Tag.ts', 'export default {}')
    await stamp(source, 'app/Models/Comment.ts', 'export default {}')

    await copyFeatureFiles('cms', { source, target })
    expect(existsSync(join(target, 'app/Models/Tag.ts'))).toBe(true)
    expect(existsSync(join(target, 'app/Models/Comment.ts'))).toBe(true)

    const removed = await deleteFeatureFiles('cms', target)
    expect(removed).toContain('app/Models/Tag.ts')
    expect(removed).toContain('app/Models/Comment.ts')
    expect(existsSync(join(target, 'app/Models/Tag.ts'))).toBe(false)
    expect(existsSync(join(target, 'app/Models/Comment.ts'))).toBe(false)
  })
})
