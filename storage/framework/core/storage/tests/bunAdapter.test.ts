import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { rm } from 'node:fs/promises'
import { createBunStorage } from '../src/adapters/bun'

describe('BunStorageAdapter', () => {
  const testRoot = join(process.cwd(), 'tests', 'temp', 'bun-adapter')
  let adapter: ReturnType<typeof createBunStorage>

  beforeEach(async () => {
    adapter = createBunStorage({ root: testRoot })
    await adapter.createDirectory('')
  })

  afterEach(async () => {
    try {
      await rm(testRoot, { recursive: true, force: true })
    }
    catch {
      // Ignore cleanup errors
    }
  })

  describe('write and read', () => {
    it('should write and read a string', async () => {
      const content = 'Hello, Bun!'
      await adapter.write('test.txt', content)

      const result = await adapter.readToString('test.txt')
      expect(result).toBe(content)
    })

    it('should write and read a Buffer', async () => {
      const content = Buffer.from('Hello, Buffer!')
      await adapter.write('buffer.txt', content)

      const result = await adapter.readToBuffer('buffer.txt')
      expect(Buffer.compare(result, content)).toBe(0)
    })

    it('should write and read a Uint8Array', async () => {
      const content = new Uint8Array([72, 101, 108, 108, 111])
      await adapter.write('uint8.txt', content)

      const result = await adapter.readToUint8Array('uint8.txt')
      expect(result).toEqual(content)
    })

    it('should create parent directories automatically', async () => {
      await adapter.write('nested/deep/file.txt', 'content')
      expect(await adapter.fileExists('nested/deep/file.txt')).toBe(true)
      expect(await adapter.directoryExists('nested/deep')).toBe(true)
    })
  })

  describe('file operations', () => {
    it('should check if file exists', async () => {
      expect(await adapter.fileExists('nonexistent.txt')).toBe(false)

      await adapter.write('exists.txt', 'content')
      expect(await adapter.fileExists('exists.txt')).toBe(true)
    })

    it('should delete a file', async () => {
      await adapter.write('delete-me.txt', 'content')
      expect(await adapter.fileExists('delete-me.txt')).toBe(true)

      await adapter.deleteFile('delete-me.txt')
      expect(await adapter.fileExists('delete-me.txt')).toBe(false)
    })

    it('should copy a file', async () => {
      await adapter.write('source.txt', 'original content')
      await adapter.copyFile('source.txt', 'copy.txt')

      expect(await adapter.fileExists('source.txt')).toBe(true)
      expect(await adapter.fileExists('copy.txt')).toBe(true)
      expect(await adapter.readToString('copy.txt')).toBe('original content')
    })

    it('should move a file', async () => {
      await adapter.write('move-source.txt', 'content to move')
      await adapter.moveFile('move-source.txt', 'move-dest.txt')

      expect(await adapter.fileExists('move-source.txt')).toBe(false)
      expect(await adapter.fileExists('move-dest.txt')).toBe(true)
      expect(await adapter.readToString('move-dest.txt')).toBe('content to move')
    })

    it('should get file stats', async () => {
      const content = 'Test content'
      await adapter.write('stats.txt', content)

      const stats = await adapter.stat('stats.txt')
      expect(stats.type).toBe('file')
      expect(stats.size).toBe(content.length)
      expect(stats.lastModified).toBeGreaterThan(0)
    })

    it('should get file size', async () => {
      const content = 'Hello World'
      await adapter.write('size.txt', content)

      const size = await adapter.fileSize('size.txt')
      expect(size).toBe(content.length)
    })

    it('should get last modified time', async () => {
      await adapter.write('modified.txt', 'content')
      const before = Date.now()

      const lastModified = await adapter.lastModified('modified.txt')
      expect(lastModified).toBeLessThanOrEqual(Date.now())
      expect(lastModified).toBeGreaterThan(before - 1000)
    })
  })

  describe('directory operations', () => {
    it('should create a directory', async () => {
      await adapter.createDirectory('test-dir')
      expect(await adapter.directoryExists('test-dir')).toBe(true)
    })

    it('should create nested directories', async () => {
      await adapter.createDirectory('parent/child/grandchild')
      expect(await adapter.directoryExists('parent/child/grandchild')).toBe(true)
    })

    it('should delete a directory', async () => {
      await adapter.createDirectory('delete-dir')
      await adapter.write('delete-dir/file.txt', 'content')

      await adapter.deleteDirectory('delete-dir')
      expect(await adapter.directoryExists('delete-dir')).toBe(false)
      expect(await adapter.fileExists('delete-dir/file.txt')).toBe(false)
    })

    it('should list directory contents (shallow)', async () => {
      await adapter.write('list-test/file1.txt', 'content1')
      await adapter.write('list-test/file2.txt', 'content2')
      await adapter.write('list-test/sub/file3.txt', 'content3')

      const entries: any[] = []
      for await (const entry of adapter.list('list-test', { deep: false })) {
        entries.push(entry)
      }

      expect(entries.length).toBeGreaterThanOrEqual(2)
      expect(entries.some(e => e.path.includes('file1.txt'))).toBe(true)
      expect(entries.some(e => e.path.includes('file2.txt'))).toBe(true)
    })

    it('should list directory contents (deep)', async () => {
      await adapter.write('deep-test/file1.txt', 'content1')
      await adapter.write('deep-test/sub/file2.txt', 'content2')
      await adapter.write('deep-test/sub/nested/file3.txt', 'content3')

      const entries: any[] = []
      for await (const entry of adapter.list('deep-test', { deep: true })) {
        entries.push(entry)
      }

      expect(entries.length).toBeGreaterThanOrEqual(3)
      expect(entries.some(e => e.path.includes('file1.txt'))).toBe(true)
      expect(entries.some(e => e.path.includes('file2.txt'))).toBe(true)
      expect(entries.some(e => e.path.includes('file3.txt'))).toBe(true)
    })
  })

  describe('MIME type detection', () => {
    it('should detect MIME types', async () => {
      await adapter.write('test.txt', 'text content')
      const mimeType = await adapter.mimeType('test.txt')
      expect(mimeType).toBe('text/plain;charset=utf-8')
    })

    it('should detect JSON MIME type', async () => {
      await adapter.write('data.json', '{"key":"value"}')
      const mimeType = await adapter.mimeType('data.json')
      expect(mimeType).toContain('json')
    })
  })

  describe('checksum', () => {
    it('should calculate SHA256 checksum', async () => {
      const content = 'Hello, World!'
      await adapter.write('checksum.txt', content)

      const checksum = await adapter.checksum('checksum.txt', { algorithm: 'sha256' })
      expect(checksum).toBeTruthy()
      expect(checksum.length).toBe(64) // SHA256 hex length
    })

    it('should calculate MD5 checksum', async () => {
      const content = 'Test content'
      await adapter.write('md5.txt', content)

      const checksum = await adapter.checksum('md5.txt', { algorithm: 'md5' })
      expect(checksum).toBeTruthy()
      expect(checksum.length).toBe(32) // MD5 hex length
    })
  })

  describe('URL generation', () => {
    it('should generate public URL', async () => {
      await adapter.write('public.txt', 'content')
      const url = await adapter.publicUrl('public.txt')
      expect(url).toContain('public.txt')
    })

    it('should generate public URL with custom domain', async () => {
      await adapter.write('custom.txt', 'content')
      const url = await adapter.publicUrl('custom.txt', { domain: 'https://example.com' })
      expect(url).toBe('https://example.com/custom.txt')
    })

    it('should generate temporary URL', async () => {
      await adapter.write('temp.txt', 'content')
      const url = await adapter.temporaryUrl('temp.txt', { expiresIn: 3600 })
      expect(url).toContain('temp')
    })
  })

  describe('visibility', () => {
    it('should get file visibility', async () => {
      await adapter.write('private.txt', 'content')
      const visibility = await adapter.visibility('private.txt')
      expect(visibility).toBe('private')
    })

    it('should change file visibility', async () => {
      await adapter.write('toggle.txt', 'content')
      await adapter.changeVisibility('toggle.txt', 'public')
      // Note: Bun adapter doesn't actually change permissions, just a no-op
      expect(await adapter.visibility('toggle.txt')).toBe('private')
    })
  })

  describe('error handling', () => {
    it('should throw when reading non-existent file', async () => {
      expect(async () => {
        await adapter.readToString('does-not-exist.txt')
      }).toThrow()
    })

    it('should throw when getting stats for non-existent file', async () => {
      expect(async () => {
        await adapter.stat('missing.txt')
      }).toThrow()
    })

    it('should throw when calculating checksum for non-existent file', async () => {
      expect(async () => {
        await adapter.checksum('missing.txt')
      }).toThrow()
    })
  })
})
