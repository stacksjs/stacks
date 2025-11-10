import type { Buffer } from 'node:buffer'
import { createReadStream, createWriteStream } from 'node:fs'
import { access, constants, copyFile, lstat, mkdir, readdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'
import { pipeline } from 'node:stream/promises'
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

/**
 * Local filesystem storage adapter using Node.js fs APIs
 */
export class LocalStorageAdapter implements StorageAdapter {
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

    // Ensure directory exists
    await mkdir(dir, { recursive: true })

    if (typeof contents === 'string') {
      await writeFile(fullPath, contents, 'utf8')
    }
    else if (contents instanceof Buffer) {
      await writeFile(fullPath, contents)
    }
    else if (contents instanceof Uint8Array) {
      await writeFile(fullPath, contents)
    }
    else {
      // ReadableStream
      const writeStream = createWriteStream(fullPath)
      await pipeline(contents as any, writeStream)
    }
  }

  async read(path: string): Promise<FileContents> {
    const fullPath = this.resolvePath(path)
    return await readFile(fullPath)
  }

  async readToString(path: string): Promise<string> {
    const fullPath = this.resolvePath(path)
    return await readFile(fullPath, 'utf8')
  }

  async readToBuffer(path: string): Promise<Buffer> {
    const fullPath = this.resolvePath(path)
    return await readFile(fullPath)
  }

  async readToUint8Array(path: string): Promise<Uint8Array> {
    const fullPath = this.resolvePath(path)
    const buffer = await readFile(fullPath)
    return new Uint8Array(buffer)
  }

  async deleteFile(path: string): Promise<void> {
    const fullPath = this.resolvePath(path)
    await unlink(fullPath)
  }

  async deleteDirectory(path: string): Promise<void> {
    const fullPath = this.resolvePath(path)
    await rm(fullPath, { recursive: true, force: true })
  }

  async createDirectory(path: string): Promise<void> {
    const fullPath = this.resolvePath(path)
    await mkdir(fullPath, { recursive: true })
  }

  async moveFile(from: string, to: string): Promise<void> {
    const fromPath = this.resolvePath(from)
    const toPath = this.resolvePath(to)
    const toDir = dirname(toPath)

    // Ensure destination directory exists
    await mkdir(toDir, { recursive: true })

    await rename(fromPath, toPath)
  }

  async copyFile(from: string, to: string): Promise<void> {
    const fromPath = this.resolvePath(from)
    const toPath = this.resolvePath(to)
    const toDir = dirname(toPath)

    // Ensure destination directory exists
    await mkdir(toDir, { recursive: true })

    await copyFile(fromPath, toPath)
  }

  async stat(path: string): Promise<StatEntry> {
    const fullPath = this.resolvePath(path)
    const stats = await lstat(fullPath)

    return {
      path,
      type: stats.isDirectory() ? 'directory' : 'file',
      visibility: await this.visibility(path),
      size: stats.size,
      lastModified: stats.mtimeMs,
      mimeType: stats.isFile() ? await this.detectMimeType(fullPath) : undefined,
    }
  }

  list(path: string, options: ListOptions = {}): DirectoryListing {
    return this.createAsyncIterator(path, options.deep || false)
  }

  private async *createAsyncIterator(path: string, deep: boolean): DirectoryListing {
    const fullPath = this.resolvePath(path)

    try {
      await access(fullPath, constants.R_OK)
    }
    catch {
      // Directory doesn't exist or isn't readable
      return
    }

    const entries = await this.readDirectoryRecursive(fullPath, deep)
    yield* createDirectoryListing(entries)
  }

  private async readDirectoryRecursive(dirPath: string, deep: boolean): Promise<DirectoryEntry[]> {
    const entries: DirectoryEntry[] = []

    try {
      const items = await readdir(dirPath, { withFileTypes: true })

      for (const item of items) {
        const itemPath = join(dirPath, item.name)
        const relativePath = relative(this.root, itemPath)

        entries.push({
          path: relativePath,
          type: item.isDirectory() ? 'directory' : 'file',
        })

        if (deep && item.isDirectory()) {
          const subEntries = await this.readDirectoryRecursive(itemPath, true)
          entries.push(...subEntries)
        }
      }
    }
    catch (error) {
      // Skip directories that can't be read
    }

    return entries
  }

  async changeVisibility(_path: string, _visibility: Visibility): Promise<void> {
    // Node.js doesn't have a simple visibility concept
    // Would need to use chmod and translate visibility to permissions
    // For now, this is a no-op
  }

  async visibility(_path: string): Promise<Visibility> {
    // Would need to check file permissions and translate to visibility
    // For now, default to private
    return 'private' as Visibility
  }

  async fileExists(path: string): Promise<boolean> {
    const fullPath = this.resolvePath(path)

    try {
      const stats = await lstat(fullPath)
      return stats.isFile()
    }
    catch {
      return false
    }
  }

  async directoryExists(path: string): Promise<boolean> {
    const fullPath = this.resolvePath(path)

    try {
      const stats = await lstat(fullPath)
      return stats.isDirectory()
    }
    catch {
      return false
    }
  }

  async publicUrl(path: string, options: PublicUrlOptions = {}): Promise<string> {
    const domain = options.domain || 'http://localhost'
    return `${domain}/${path}`
  }

  async temporaryUrl(path: string, options: TemporaryUrlOptions): Promise<string> {
    // For local storage, we'd need a separate service to handle temporary URLs
    const expiry = normalizeExpiryToDate(options.expiresIn)
    const token = Buffer.from(`${path}:${expiry.getTime()}`).toString('base64url')
    return `http://localhost/temp/${token}`
  }

  async checksum(path: string, options: ChecksumOptions = {}): Promise<string> {
    const algorithm = options.algorithm || 'sha256'
    const fullPath = this.resolvePath(path)
    const content = await readFile(fullPath)

    const hasher = new Bun.CryptoHasher(algorithm)
    hasher.update(content)
    return hasher.digest('hex')
  }

  async mimeType(path: string, options: MimeTypeOptions = {}): Promise<string> {
    const fullPath = this.resolvePath(path)
    return await this.detectMimeType(fullPath)
  }

  private async detectMimeType(filePath: string): Promise<string> {
    // Simple MIME type detection based on extension
    const ext = basename(filePath).split('.').pop()?.toLowerCase()

    const mimeTypes: Record<string, string> = {
      txt: 'text/plain',
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      json: 'application/json',
      xml: 'application/xml',
      pdf: 'application/pdf',
      zip: 'application/zip',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      mp4: 'video/mp4',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
    }

    return mimeTypes[ext || ''] || 'application/octet-stream'
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

/**
 * Create a local storage adapter instance
 */
export function createLocalStorage(config: StorageAdapterConfig = {}): LocalStorageAdapter {
  return new LocalStorageAdapter(config)
}
