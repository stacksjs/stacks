import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StorageManager } from '../src/facade'
import type { UploadedFileLike } from '../src/put-file'

const testRoot = join(tmpdir(), `stacks-storage-put-file-${Date.now()}`)
const publicRoot = join(testRoot, 'public')
const altRoot = join(testRoot, 'alt')

let storage: InstanceType<typeof StorageManager>

beforeEach(() => {
  mkdirSync(publicRoot, { recursive: true })
  mkdirSync(altRoot, { recursive: true })
  storage = new StorageManager()
  storage.init({
    default: 'public',
    disks: {
      public: {
        driver: 'local',
        root: publicRoot,
        url: 'https://example.test/storage',
        visibility: 'public',
      },
      alt: {
        driver: 'local',
        root: altRoot,
        url: '/alt',
        visibility: 'public',
      },
    },
  })
})

afterEach(() => {
  storage.reset()
  try {
    rmSync(testRoot, { recursive: true, force: true })
  }
  catch {
    // ignore
  }
})

function makeFile(overrides: Partial<UploadedFileLike> = {}): UploadedFileLike {
  return {
    originalName: 'photo.jpg',
    mimetype: 'image/jpeg',
    buffer: new TextEncoder().encode('hello world').buffer,
    ...overrides,
  }
}

describe('Storage.put(uploadedFile, opts)', () => {
  test('returns { path, url } and writes to the configured disk', async () => {
    const result = await storage.put(makeFile(), { dir: 'avatars' })

    expect(result.path).toMatch(/^avatars\/[a-f0-9]+\.jpg$/)
    expect(typeof result.url).toBe('string')
    expect(result.url).toContain(result.path)
    expect(existsSync(join(publicRoot, result.path))).toBe(true)
    expect(readFileSync(join(publicRoot, result.path), 'utf8')).toBe('hello world')
  })

  test('uses uuid filename strategy by default', async () => {
    const { path } = await storage.put(makeFile())
    // 32 hex chars from `crypto.randomUUID().replace(/-/g, '')` + .jpg
    expect(path).toMatch(/^[a-f0-9]{32}\.jpg$/)
  })

  test('derives extension from mimetype when originalName lacks one', async () => {
    const { path } = await storage.put(makeFile({ originalName: 'no-extension', mimetype: 'image/png' }))
    expect(path.endsWith('.png')).toBe(true)
  })

  test('preserves original extension when filename has one already', async () => {
    const { path } = await storage.put(makeFile({ originalName: 'profile.WEBP', mimetype: 'image/webp' }))
    expect(path.endsWith('.webp')).toBe(true)
  })

  test('skips extension when preserveExtension is false', async () => {
    const { path } = await storage.put(makeFile(), { preserveExtension: false })
    expect(path).toMatch(/^[a-f0-9]{32}$/) // no .jpg suffix
  })

  test('filename: "hash" produces a deterministic name for the same buffer', async () => {
    const file = makeFile()
    const a = await storage.put(file, { filename: 'hash', dir: 'a' })
    const b = await storage.put(file, { filename: 'hash', dir: 'b' })
    const aHash = a.path.split('/')[1].replace(/\.jpg$/, '')
    const bHash = b.path.split('/')[1].replace(/\.jpg$/, '')
    expect(aHash).toBe(bHash)
    expect(aHash).toHaveLength(32) // sha256 hex truncated to 32
  })

  test('filename: "original" sanitizes the original name', async () => {
    const { path } = await storage.put(
      makeFile({ originalName: '../../etc/passwd profile pic.jpg' }),
      { filename: 'original' },
    )
    // Path separators stripped, dots collapsed, spaces normalized.
    expect(path).not.toContain('..')
    expect(path).not.toContain('/etc/')
    expect(path.endsWith('.jpg')).toBe(true)
  })

  test('filename: function lets the caller pick the name', async () => {
    const { path } = await storage.put(
      makeFile({ mimetype: 'image/png' }),
      { filename: f => `user-42.${f.mimetype === 'image/png' ? 'png' : 'jpg'}` },
    )
    expect(path).toBe('user-42.png')
  })

  test('accepts Uint8Array and Buffer buffers, not just ArrayBuffer', async () => {
    const u8 = new Uint8Array([1, 2, 3])
    const a = await storage.put(makeFile({ buffer: u8 }))
    expect(readFileSync(join(publicRoot, a.path))).toEqual(Buffer.from(u8))

    const b = await storage.put(makeFile({ buffer: Buffer.from('xyz') }))
    expect(readFileSync(join(publicRoot, b.path), 'utf8')).toBe('xyz')
  })

  test('still supports the legacy path-based put() overload', async () => {
    await storage.put('legacy.txt', 'plain text payload')
    expect(readFileSync(join(publicRoot, 'legacy.txt'), 'utf8')).toBe('plain text payload')
  })

  test('routes to an explicit disk via opts.disk', async () => {
    const { path } = await storage.put(makeFile(), { disk: 'alt', dir: 'avatars' })
    expect(existsSync(join(altRoot, path))).toBe(true)
    expect(existsSync(join(publicRoot, path))).toBe(false)
  })
})
