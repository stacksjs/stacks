import type { Buffer } from 'node:buffer'
import { file, write as bunWrite } from 'bun'
import { basename, dirname, join, relative } from 'node:path'
import type {
  ChecksumOptions,
  DirectoryEntry,
  DirectoryListing,
  FileContents,
  ListOptions,
  MimeTypeOptions,
  PublicUrlOptions,
  StatEntry,
  StorageAdapter,
  StorageAdapterConfig,
  TemporaryUrlOptions,
  Visibility,
} from '../types'
import { createDirectoryListing, normalizeExpiryToDate } from '../types'

export class BunStorageAdapter implements StorageAdapter {
  private root: string

  constructor(config: StorageAdapterConfig = {}) {
    this.root = config.root || process.cwd()
  }

  private resolvePath(path: string): string {
    return join(this.root, path)
  }

  async write(path: string, contents: FileContents): Promise<void> {
    const fullPath = this.resolvePath(path)
    const dir = dirname(fullPath)
    await this.createDirectory(relative(this.root, dir))

    if (typeof contents === 'string') {
      await bunWrite(fullPath, contents)
    }
    else if (contents instanceof Buffer) {
      await bunWrite(fullPath, contents)
    }
    else if (contents instanceof Uint8Array) {
      await bunWrite(fullPath, contents)
    }
    else {
      const reader = contents.getReader()
      const chunks: Uint8Array[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) chunks.push(value)
      }
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
      const result = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.length
      }
      await bunWrite(fullPath, result)
    }
  }

  async read(path: string): Promise<FileContents> {
    const fullPath = this.resolvePath(path)
    const bunFile = file(fullPath)
    if (!(await bunFile.exists())) {
      throw new Error('File not found: ' + path)
    }
    return await bunFile.arrayBuffer().then(buf => new Uint8Array(buf))
  }

  async readToString(path: string): Promise<string> {
    const fullPath = this.resolvePath(path)
    const bunFile = file(fullPath)
    if (!(await bunFile.exists())) {
      throw new Error('File not found: ' + path)
    }
    return await bunFile.text()
  }

  async readToBuffer(path: string): Promise<Buffer> {
    const fullPath = this.resolvePath(path)
    const bunFile = file(fullPath)
    if (!(await bunFile.exists())) {
      throw new Error('File not found: ' + path)
    }
    const arrayBuffer = await bunFile.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  async readToUint8Array(path: string): Promise<Uint8Array> {
    const fullPath = this.resolvePath(path)
    const bunFile = file(fullPath)
    if (!(await bunFile.exists())) {
      throw new Error('File not found: ' + path)
    }
    const arrayBuffer = await bunFile.arrayBuffer()
    return new Uint8Array(arrayBuffer)
  }

  async deleteFile(path: string): Promise<void> {
    const fullPath = this.resolvePath(path)
    const bunFile = file(fullPath)
    if (await bunFile.exists()) {
      await Bun.$.throws(false)`rm ${fullPath}`
    }
  }

  async deleteDirectory(path: string): Promise<void> {
    const fullPath = this.resolvePath(path)
    await Bun.$.throws(false)`rm -rf ${fullPath}`
  }

  async createDirectory(path: string): Promise<void> {
    const fullPath = this.resolvePath(path)
    await Bun.$.throws(false)`mkdir -p ${fullPath}`
  }

  async moveFile(from: string, to: string): Promise<void> {
    const fromPath = this.resolvePath(from)
    const toPath = this.resolvePath(to)
    const toDir = dirname(toPath)
    await this.createDirectory(relative(this.root, toDir))
    await Bun.$.throws(true)`mv ${fromPath} ${toPath}`
  }

  async copyFile(from: string, to: string): Promise<void> {
    const fromPath = this.resolvePath(from)
    const toPath = this.resolvePath(to)
    const toDir = dirname(toPath)
    await this.createDirectory(relative(this.root, toDir))
    await Bun.$.throws(true)`cp ${fromPath} ${toPath}`
  }

  async stat(path: string): Promise<StatEntry> {
    const fullPath = this.resolvePath(path)
    const bunFile = file(fullPath)
    if (!(await bunFile.exists())) {
      throw new Error('File not found: ' + path)
    }
    const stats = await Bun.file(fullPath).stat()
    const isDir = stats.isDirectory()
    return {
      path,
      type: isDir ? 'directory' : 'file',
      visibility: 'private' as Visibility,
      size: isDir ? 0 : stats.size,
      lastModified: stats.mtime?.getTime() || Date.now(),
      mimeType: isDir ? undefined : bunFile.type,
    }
  }

  list(path: string, options: ListOptions = {}): DirectoryListing {
    const fullPath = this.resolvePath(path)
    return this.createAsyncIterator(fullPath, options.deep || false)
  }

  private async *createAsyncIterator(dirPath: string, deep: boolean): DirectoryListing {
    const entries: DirectoryEntry[] = []
    try {
      const glob = new Bun.Glob(deep ? '**/*' : '*')
      for await (const entry of glob.scan({ cwd: dirPath, onlyFiles: false })) {
        const fullEntryPath = join(dirPath, entry)
        const stats = await Bun.file(fullEntryPath).stat()
        entries.push({
          path: relative(this.root, fullEntryPath),
          type: stats.isDirectory() ? 'directory' : 'file',
        })
      }
    }
    catch (error) {
      return
    }
    yield* createDirectoryListing(entries)
  }

  async changeVisibility(_path: string, _visibility: Visibility): Promise<void> {}
  async visibility(_path: string): Promise<Visibility> { return 'private' as Visibility }

  async fileExists(path: string): Promise<boolean> {
    const fullPath = this.resolvePath(path)
    const bunFile = file(fullPath)
    return await bunFile.exists()
  }

  async directoryExists(path: string): Promise<boolean> {
    const fullPath = this.resolvePath(path)
    try {
      const stats = await Bun.file(fullPath).stat()
      return stats.isDirectory()
    }
    catch { return false }
  }

  async publicUrl(path: string, options: PublicUrlOptions = {}): Promise<string> {
    const domain = options.domain || 'http://localhost'
    return domain + '/' + path
  }

  async temporaryUrl(path: string, options: TemporaryUrlOptions): Promise<string> {
    const expiry = normalizeExpiryToDate(options.expiresIn)
    const token = Buffer.from(path + ':' + expiry.getTime()).toString('base64url')
    return 'http://localhost/temp/' + token
  }

  async checksum(path: string, options: ChecksumOptions = {}): Promise<string> {
    const algorithm = options.algorithm || 'sha256'
    const fullPath = this.resolvePath(path)
    const bunFile = file(fullPath)
    if (!(await bunFile.exists())) {
      throw new Error('File not found: ' + path)
    }
    const hasher = new Bun.CryptoHasher(algorithm)
    const arrayBuffer = await bunFile.arrayBuffer()
    hasher.update(new Uint8Array(arrayBuffer))
    return hasher.digest('hex')
  }

  async mimeType(path: string, _options: MimeTypeOptions = {}): Promise<string> {
    const fullPath = this.resolvePath(path)
    const bunFile = file(fullPath)
    if (!(await bunFile.exists())) {
      throw new Error('File not found: ' + path)
    }
    return bunFile.type || 'application/octet-stream'
  }

  async lastModified(path: string): Promise<number> {
    const stats = await this.stat(path)
    return stats.lastModified
  }

  async fileSize(path: string): Promise<number> {
    const stats = await this.stat(path)
    return stats.size
  }
}

export function createBunStorage(config: StorageAdapterConfig = {}): BunStorageAdapter {
  return new BunStorageAdapter(config)
}
