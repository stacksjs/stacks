import { describe, expect, test, afterAll } from 'bun:test'
import { mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createLocalStorage } from '../src/adapters/local'

// ---------------------------------------------------------------------------
// Setup: use a unique temp directory for all tests
// ---------------------------------------------------------------------------
const testRoot = join(tmpdir(), `stacks-storage-integration-${Date.now()}`)
mkdirSync(testRoot, { recursive: true })

const storage = createLocalStorage({ root: testRoot })

afterAll(() => {
  try {
    rmSync(testRoot, { recursive: true, force: true })
  }
  catch {
    // best-effort cleanup
  }
})

// ---------------------------------------------------------------------------
// Write and read
// ---------------------------------------------------------------------------
describe('Write and read files', () => {
  test('write a text file then read it back', async () => {
    await storage.write('hello.txt', 'Hello World')
    const content = await storage.readToString('hello.txt')
    expect(content).toBe('Hello World')
  })

  test('write overwrites existing file', async () => {
    await storage.write('overwrite.txt', 'first')
    await storage.write('overwrite.txt', 'second')
    const content = await storage.readToString('overwrite.txt')
    expect(content).toBe('second')
  })

  test('write creates nested directories automatically', async () => {
    await storage.write('nested/deep/file.txt', 'deep content')
    const content = await storage.readToString('nested/deep/file.txt')
    expect(content).toBe('deep content')
  })

  test('write and read Buffer content', async () => {
    const buf = Buffer.from('binary data')
    await storage.write('binary.bin', buf)
    const result = await storage.readToBuffer('binary.bin')
    expect(result.toString()).toBe('binary data')
  })
})

// ---------------------------------------------------------------------------
// fileExists / deleteFile
// ---------------------------------------------------------------------------
describe('fileExists and deleteFile', () => {
  test('fileExists returns true for existing file', async () => {
    await storage.write('exists-check.txt', 'yes')
    const exists = await storage.fileExists('exists-check.txt')
    expect(exists).toBe(true)
  })

  test('fileExists returns false for missing file', async () => {
    const exists = await storage.fileExists('no-such-file.txt')
    expect(exists).toBe(false)
  })

  test('deleteFile removes file', async () => {
    await storage.write('to-delete.txt', 'bye')
    await storage.deleteFile('to-delete.txt')
    const exists = await storage.fileExists('to-delete.txt')
    expect(exists).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------
describe('copyFile', () => {
  test('copies a file and both exist', async () => {
    await storage.write('original.txt', 'original content')
    await storage.copyFile('original.txt', 'copy.txt')

    const originalExists = await storage.fileExists('original.txt')
    const copyExists = await storage.fileExists('copy.txt')
    expect(originalExists).toBe(true)
    expect(copyExists).toBe(true)

    const copyContent = await storage.readToString('copy.txt')
    expect(copyContent).toBe('original content')
  })
})

// ---------------------------------------------------------------------------
// Move
// ---------------------------------------------------------------------------
describe('moveFile', () => {
  test('moves a file: old is gone, new exists', async () => {
    await storage.write('to-move.txt', 'moving')
    await storage.moveFile('to-move.txt', 'moved.txt')

    const oldExists = await storage.fileExists('to-move.txt')
    const newExists = await storage.fileExists('moved.txt')
    expect(oldExists).toBe(false)
    expect(newExists).toBe(true)

    const content = await storage.readToString('moved.txt')
    expect(content).toBe('moving')
  })
})

// ---------------------------------------------------------------------------
// fileSize
// ---------------------------------------------------------------------------
describe('fileSize', () => {
  test('returns correct byte length', async () => {
    await storage.write('sized.txt', '12345')
    const size = await storage.fileSize('sized.txt')
    expect(size).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// lastModified
// ---------------------------------------------------------------------------
describe('lastModified', () => {
  test('returns a recent timestamp', async () => {
    const before = Date.now()
    await storage.write('timed.txt', 'ts')
    const mtime = await storage.lastModified('timed.txt')
    // mtime should be within a few seconds of now
    expect(mtime).toBeGreaterThanOrEqual(before - 2000)
    expect(mtime).toBeLessThanOrEqual(Date.now() + 2000)
  })
})

// ---------------------------------------------------------------------------
// List files (directory listing)
// ---------------------------------------------------------------------------
describe('list files', () => {
  test('lists files in a directory', async () => {
    await storage.write('listdir/a.txt', 'a')
    await storage.write('listdir/b.txt', 'b')

    const entries: { path: string; type: string }[] = []
    for await (const entry of storage.list('listdir')) {
      entries.push(entry)
    }

    const filePaths = entries.filter(e => e.type === 'file').map(e => e.path)
    expect(filePaths.length).toBeGreaterThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// createDirectory / deleteDirectory
// ---------------------------------------------------------------------------
describe('Directory operations', () => {
  test('createDirectory creates a new directory', async () => {
    await storage.createDirectory('new-dir')
    // write a file inside to verify it works
    await storage.write('new-dir/test.txt', 'ok')
    const content = await storage.readToString('new-dir/test.txt')
    expect(content).toBe('ok')
  })

  test('deleteDirectory removes directory', async () => {
    await storage.createDirectory('removable-dir')
    await storage.write('removable-dir/f.txt', 'data')
    await storage.deleteDirectory('removable-dir')
    const exists = existsSync(join(testRoot, 'removable-dir'))
    expect(exists).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// checksum
// ---------------------------------------------------------------------------
describe('checksum', () => {
  test('returns a hex string for a file', async () => {
    await storage.write('checksum.txt', 'check me')
    const hash = await storage.checksum('checksum.txt')
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)
    // SHA-256 hex is 64 chars
    expect(hash).toMatch(/^[a-f0-9]+$/)
  })
})
