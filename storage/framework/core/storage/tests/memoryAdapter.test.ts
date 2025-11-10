import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { createMemoryStorage } from '../src/adapters/memory'

describe('InMemoryStorageAdapter', () => {
  let adapter: ReturnType<typeof createMemoryStorage>

  beforeEach(() => {
    adapter = createMemoryStorage()
  })

  afterEach(() => {
    adapter.clear()
  })

  describe('write and read', () => {
    it('should write and read a string', async () => {
      const content = 'Hello, Memory!'
      await adapter.write('test.txt', content)

      const result = await adapter.readToString('test.txt')
      expect(result).toBe(content)
    })

    it('should write and read a Buffer', async () => {
      const content = Buffer.from('Buffer content')
      await adapter.write('buffer.bin', content)

      const result = await adapter.readToBuffer('buffer.bin')
      expect(Buffer.compare(result, content)).toBe(0)
    })

    it('should write and read a Uint8Array', async () => {
      const content = new Uint8Array([1, 2, 3, 4, 5])
      await adapter.write('binary.bin', content)

      const result = await adapter.readToUint8Array('binary.bin')
      expect(result).toEqual(content)
    })

    it('should handle nested paths', async () => {
      await adapter.write('dir1/dir2/file.txt', 'nested content')
      expect(await adapter.readToString('dir1/dir2/file.txt')).toBe('nested content')
    })

    it('should handle paths with leading slashes', async () => {
      await adapter.write('/leading/slash.txt', 'content')
      expect(await adapter.readToString('leading/slash.txt')).toBe('content')
    })
  })

  describe('file operations', () => {
    it('should check if file exists', async () => {
      expect(await adapter.fileExists('nonexistent.txt')).toBe(false)

      await adapter.write('exists.txt', 'I exist')
      expect(await adapter.fileExists('exists.txt')).toBe(true)
    })

    it('should delete a file', async () => {
      await adapter.write('delete-me.txt', 'bye')
      expect(await adapter.fileExists('delete-me.txt')).toBe(true)

      await adapter.deleteFile('delete-me.txt')
      expect(await adapter.fileExists('delete-me.txt')).toBe(false)
    })

    it('should copy a file', async () => {
      const content = 'original content'
      await adapter.write('source.txt', content)
      await adapter.copyFile('source.txt', 'destination.txt')

      expect(await adapter.fileExists('source.txt')).toBe(true)
      expect(await adapter.fileExists('destination.txt')).toBe(true)
      expect(await adapter.readToString('destination.txt')).toBe(content)

      // Verify they're independent copies
      await adapter.write('destination.txt', 'modified')
      expect(await adapter.readToString('source.txt')).toBe(content)
    })

    it('should move a file', async () => {
      const content = 'move me'
      await adapter.write('from.txt', content)
      await adapter.moveFile('from.txt', 'to.txt')

      expect(await adapter.fileExists('from.txt')).toBe(false)
      expect(await adapter.fileExists('to.txt')).toBe(true)
      expect(await adapter.readToString('to.txt')).toBe(content)
    })

    it('should get file stats', async () => {
      const content = 'Stats test'
      await adapter.write('stats.txt', content)

      const stats = await adapter.stat('stats.txt')
      expect(stats.type).toBe('file')
      expect(stats.size).toBe(new TextEncoder().encode(content).length)
      expect(stats.visibility).toBe('private')
      expect(stats.lastModified).toBeGreaterThan(0)
    })

    it('should get file size', async () => {
      await adapter.write('size.txt', 'Hello')
      const size = await adapter.fileSize('size.txt')
      expect(size).toBe(5)
    })

    it('should get last modified time', async () => {
      await adapter.write('modified.txt', 'content')
      const time1 = await adapter.lastModified('modified.txt')

      // Wait a tiny bit
      await new Promise(resolve => setTimeout(resolve, 10))

      await adapter.write('modified.txt', 'updated')
      const time2 = await adapter.lastModified('modified.txt')

      expect(time2).toBeGreaterThan(time1)
    })
  })

  describe('directory operations', () => {
    it('should create a directory', async () => {
      await adapter.createDirectory('mydir')
      expect(await adapter.directoryExists('mydir')).toBe(true)
    })

    it('should create nested directories', async () => {
      await adapter.createDirectory('level1/level2/level3')
      expect(await adapter.directoryExists('level1')).toBe(true)
      expect(await adapter.directoryExists('level1/level2')).toBe(true)
      expect(await adapter.directoryExists('level1/level2/level3')).toBe(true)
    })

    it('should delete a directory and its contents', async () => {
      await adapter.write('deletedir/file1.txt', 'content1')
      await adapter.write('deletedir/sub/file2.txt', 'content2')

      await adapter.deleteDirectory('deletedir')

      expect(await adapter.directoryExists('deletedir')).toBe(false)
      expect(await adapter.fileExists('deletedir/file1.txt')).toBe(false)
      expect(await adapter.fileExists('deletedir/sub/file2.txt')).toBe(false)
    })

    it('should list directory contents (shallow)', async () => {
      await adapter.write('listdir/file1.txt', 'a')
      await adapter.write('listdir/file2.txt', 'b')
      await adapter.write('listdir/subdir/file3.txt', 'c')

      const entries: any[] = []
      for await (const entry of adapter.list('listdir', { deep: false })) {
        entries.push(entry)
      }

      // Should include file1, file2, and subdir (but not file3)
      const paths = entries.map(e => e.path)
      expect(paths.some(p => p.includes('file1.txt'))).toBe(true)
      expect(paths.some(p => p.includes('file2.txt'))).toBe(true)
      expect(paths.some(p => p.includes('subdir'))).toBe(true)
    })

    it('should list directory contents (deep)', async () => {
      await adapter.write('deepdir/file1.txt', 'a')
      await adapter.write('deepdir/sub/file2.txt', 'b')
      await adapter.write('deepdir/sub/nested/file3.txt', 'c')

      const entries: any[] = []
      for await (const entry of adapter.list('deepdir', { deep: true })) {
        entries.push(entry)
      }

      const paths = entries.map(e => e.path)
      expect(paths.some(p => p.includes('file1.txt'))).toBe(true)
      expect(paths.some(p => p.includes('file2.txt'))).toBe(true)
      expect(paths.some(p => p.includes('file3.txt'))).toBe(true)
    })

    it('should list root directory', async () => {
      await adapter.write('root1.txt', 'a')
      await adapter.write('root2.txt', 'b')

      const entries: any[] = []
      for await (const entry of adapter.list('', { deep: false })) {
        entries.push(entry)
      }

      expect(entries.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('MIME type detection', () => {
    it('should detect text file MIME type', async () => {
      await adapter.write('document.txt', 'text')
      const mime = await adapter.mimeType('document.txt')
      expect(mime).toBe('text/plain')
    })

    it('should detect JSON MIME type', async () => {
      await adapter.write('data.json', '{}')
      const mime = await adapter.mimeType('data.json')
      expect(mime).toBe('application/json')
    })

    it('should detect image MIME types', async () => {
      await adapter.write('image.png', 'fake png data')
      const mime = await adapter.mimeType('image.png')
      expect(mime).toBe('image/png')
    })

    it('should return default MIME type for unknown extensions', async () => {
      await adapter.write('file.xyz', 'data')
      const mime = await adapter.mimeType('file.xyz')
      expect(mime).toBe('application/octet-stream')
    })
  })

  describe('checksum', () => {
    it('should calculate SHA256 checksum', async () => {
      await adapter.write('hash.txt', 'Hello, World!')
      const checksum = await adapter.checksum('hash.txt', { algorithm: 'sha256' })
      expect(checksum).toBeTruthy()
      expect(checksum.length).toBe(64)
    })

    it('should calculate MD5 checksum', async () => {
      await adapter.write('md5.txt', 'test')
      const checksum = await adapter.checksum('md5.txt', { algorithm: 'md5' })
      expect(checksum).toBeTruthy()
      expect(checksum.length).toBe(32)
    })

    it('should calculate SHA1 checksum', async () => {
      await adapter.write('sha1.txt', 'test')
      const checksum = await adapter.checksum('sha1.txt', { algorithm: 'sha1' })
      expect(checksum).toBeTruthy()
      expect(checksum.length).toBe(40)
    })

    it('should produce same checksum for same content', async () => {
      const content = 'identical content'
      await adapter.write('file1.txt', content)
      await adapter.write('file2.txt', content)

      const checksum1 = await adapter.checksum('file1.txt')
      const checksum2 = await adapter.checksum('file2.txt')
      expect(checksum1).toBe(checksum2)
    })
  })

  describe('visibility', () => {
    it('should get default visibility', async () => {
      await adapter.write('file.txt', 'content')
      const visibility = await adapter.visibility('file.txt')
      expect(visibility).toBe('private')
    })

    it('should change visibility', async () => {
      await adapter.write('file.txt', 'content')
      await adapter.changeVisibility('file.txt', 'public')

      const visibility = await adapter.visibility('file.txt')
      expect(visibility).toBe('public')
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
      const url = await adapter.publicUrl('custom.txt', { domain: 'https://cdn.example.com' })
      expect(url).toBe('https://cdn.example.com/custom.txt')
    })

    it('should generate temporary URL', async () => {
      await adapter.write('temp.txt', 'content')
      const url = await adapter.temporaryUrl('temp.txt', { expiresIn: 3600 })
      expect(url).toContain('temp')
    })
  })

  describe('error handling', () => {
    it('should throw when reading non-existent file', async () => {
      expect(async () => {
        await adapter.readToString('missing.txt')
      }).toThrow()
    })

    it('should throw when deleting non-existent file', async () => {
      expect(async () => {
        await adapter.deleteFile('missing.txt')
      }).toThrow()
    })

    it('should throw when getting stats for non-existent file', async () => {
      expect(async () => {
        await adapter.stat('missing.txt')
      }).toThrow()
    })

    it('should throw when copying non-existent file', async () => {
      expect(async () => {
        await adapter.copyFile('missing.txt', 'dest.txt')
      }).toThrow()
    })

    it('should throw when moving non-existent file', async () => {
      expect(async () => {
        await adapter.moveFile('missing.txt', 'dest.txt')
      }).toThrow()
    })
  })

  describe('clear', () => {
    it('should clear all files and directories', async () => {
      await adapter.write('file1.txt', 'a')
      await adapter.write('dir/file2.txt', 'b')
      await adapter.createDirectory('emptydir')

      adapter.clear()

      expect(await adapter.fileExists('file1.txt')).toBe(false)
      expect(await adapter.fileExists('dir/file2.txt')).toBe(false)
      expect(await adapter.directoryExists('emptydir')).toBe(false)
    })
  })
})
