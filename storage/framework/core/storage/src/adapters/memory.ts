import type { Buffer } from 'node:buffer'
import { basename } from 'node:path'
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
  TemporaryUrlOptions,
  Visibility,
} from '../types'
import { createDirectoryListing, normalizeExpiryToDate } from '../types'

interface MemoryFile {
  contents: Uint8Array
  visibility: Visibility
  mimeType: string
  lastModified: number
}

/**
 * In-memory storage adapter for testing and temporary storage
 */
export class InMemoryStorageAdapter implements StorageAdapter {
  private files: Map<string, MemoryFile>
  private directories: Set<string>

  constructor() {
    this.files = new Map()
    this.directories = new Set()
    this.directories.add('') // Root directory
  }

  private normalizePath(path: string): string {
    return path.replace(/^\/+/, '').replace(/\/+$/, '')
  }

  private getDirectoryPath(path: string): string {
    const parts = path.split('/').filter(Boolean)
    parts.pop() // Remove filename
    return parts.join('/')
  }

  private async contentsToUint8Array(contents: FileContents): Promise<Uint8Array> {
    if (typeof contents === 'string') {
      return new TextEncoder().encode(contents)
    }
    else if (contents instanceof Buffer) {
      return new Uint8Array(contents)
    }
    else if (contents instanceof Uint8Array) {
      return contents
    }
    else {
      // ReadableStream
      const reader = contents.getReader()
      const chunks: Uint8Array[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done)
          break
        if (value)
          chunks.push(value)
      }

      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
      const result = new Uint8Array(totalLength)
      let offset = 0

      for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.length
      }

      return result
    }
  }

  async write(path: string, contents: FileContents): Promise<void> {
    const normalized = this.normalizePath(path)
    const dirPath = this.getDirectoryPath(normalized)

    // Ensure parent directory exists
    if (dirPath) {
      await this.createDirectory(dirPath)
    }

    const data = await this.contentsToUint8Array(contents)

    this.files.set(normalized, {
      contents: data,
      visibility: 'private' as Visibility,
      mimeType: this.detectMimeType(normalized),
      lastModified: Date.now(),
    })
  }

  async read(path: string): Promise<FileContents> {
    const normalized = this.normalizePath(path)
    const file = this.files.get(normalized)

    if (!file) {
      throw new Error(`File not found: ${path}`)
    }

    return file.contents
  }

  async readToString(path: string): Promise<string> {
    const data = await this.read(path)
    return new TextDecoder().decode(data as Uint8Array)
  }

  async readToBuffer(path: string): Promise<Buffer> {
    const data = await this.read(path)
    return Buffer.from(data as Uint8Array)
  }

  async readToUint8Array(path: string): Promise<Uint8Array> {
    const data = await this.read(path)
    return data as Uint8Array
  }

  async deleteFile(path: string): Promise<void> {
    const normalized = this.normalizePath(path)

    if (!this.files.has(normalized)) {
      throw new Error(`File not found: ${path}`)
    }

    this.files.delete(normalized)
  }

  async deleteDirectory(path: string): Promise<void> {
    const normalized = this.normalizePath(path)
    const prefix = normalized ? `${normalized}/` : ''

    // Delete all files in directory
    for (const filePath of this.files.keys()) {
      if (filePath === normalized || filePath.startsWith(prefix)) {
        this.files.delete(filePath)
      }
    }

    // Delete all subdirectories
    for (const dir of this.directories) {
      if (dir === normalized || dir.startsWith(prefix)) {
        this.directories.delete(dir)
      }
    }
  }

  async createDirectory(path: string): Promise<void> {
    const normalized = this.normalizePath(path)

    if (!normalized)
      return

    // Create all parent directories
    const parts = normalized.split('/').filter(Boolean)
    let current = ''

    for (const part of parts) {
      current = current ? `${current}/${part}` : part
      this.directories.add(current)
    }
  }

  async moveFile(from: string, to: string): Promise<void> {
    const normalizedFrom = this.normalizePath(from)
    const normalizedTo = this.normalizePath(to)

    const file = this.files.get(normalizedFrom)

    if (!file) {
      throw new Error(`File not found: ${from}`)
    }

    // Ensure destination directory exists
    const toDir = this.getDirectoryPath(normalizedTo)
    if (toDir) {
      await this.createDirectory(toDir)
    }

    this.files.set(normalizedTo, { ...file, lastModified: Date.now() })
    this.files.delete(normalizedFrom)
  }

  async copyFile(from: string, to: string): Promise<void> {
    const normalizedFrom = this.normalizePath(from)
    const normalizedTo = this.normalizePath(to)

    const file = this.files.get(normalizedFrom)

    if (!file) {
      throw new Error(`File not found: ${from}`)
    }

    // Ensure destination directory exists
    const toDir = this.getDirectoryPath(normalizedTo)
    if (toDir) {
      await this.createDirectory(toDir)
    }

    // Create a copy of the contents
    const contentsCopy = new Uint8Array(file.contents)

    this.files.set(normalizedTo, {
      ...file,
      contents: contentsCopy,
      lastModified: Date.now(),
    })
  }

  async stat(path: string): Promise<StatEntry> {
    const normalized = this.normalizePath(path)

    // Check if it's a file
    const file = this.files.get(normalized)
    if (file) {
      return {
        path: normalized,
        type: 'file',
        visibility: file.visibility,
        size: file.contents.length,
        lastModified: file.lastModified,
        mimeType: file.mimeType,
      }
    }

    // Check if it's a directory
    if (this.directories.has(normalized) || normalized === '') {
      return {
        path: normalized,
        type: 'directory',
        visibility: 'private' as Visibility,
        size: 0,
        lastModified: Date.now(),
      }
    }

    throw new Error(`Path not found: ${path}`)
  }

  list(path: string, options: ListOptions = {}): DirectoryListing {
    return this.createAsyncIterator(path, options.deep || false)
  }

  private async *createAsyncIterator(path: string, deep: boolean): DirectoryListing {
    const normalized = this.normalizePath(path)
    const prefix = normalized ? `${normalized}/` : ''
    const entries: DirectoryEntry[] = []
    const seen = new Set<string>()

    // List files
    for (const [filePath] of this.files) {
      if (filePath.startsWith(prefix) || prefix === '') {
        const relativePath = prefix ? filePath.slice(prefix.length) : filePath

        if (!deep) {
          // Only include direct children
          const parts = relativePath.split('/').filter(Boolean)
          if (parts.length === 1) {
            entries.push({
              path: filePath,
              type: 'file',
            })
          }
        }
        else {
          // Include all descendants
          entries.push({
            path: filePath,
            type: 'file',
          })
        }
      }
    }

    // List directories
    for (const dir of this.directories) {
      if ((dir.startsWith(prefix) || prefix === '') && dir !== normalized) {
        const relativePath = prefix ? dir.slice(prefix.length) : dir

        if (!deep) {
          // Only include direct children
          const parts = relativePath.split('/').filter(Boolean)
          if (parts.length === 1 && !seen.has(dir)) {
            entries.push({
              path: dir,
              type: 'directory',
            })
            seen.add(dir)
          }
        }
        else if (!seen.has(dir)) {
          // Include all descendants
          entries.push({
            path: dir,
            type: 'directory',
          })
          seen.add(dir)
        }
      }
    }

    yield* createDirectoryListing(entries)
  }

  async changeVisibility(path: string, visibility: Visibility): Promise<void> {
    const normalized = this.normalizePath(path)
    const file = this.files.get(normalized)

    if (!file) {
      throw new Error(`File not found: ${path}`)
    }

    file.visibility = visibility
  }

  async visibility(path: string): Promise<Visibility> {
    const normalized = this.normalizePath(path)
    const file = this.files.get(normalized)

    if (!file) {
      throw new Error(`File not found: ${path}`)
    }

    return file.visibility
  }

  async fileExists(path: string): Promise<boolean> {
    const normalized = this.normalizePath(path)
    return this.files.has(normalized)
  }

  async directoryExists(path: string): Promise<boolean> {
    const normalized = this.normalizePath(path)
    return this.directories.has(normalized) || normalized === ''
  }

  async publicUrl(path: string, options: PublicUrlOptions = {}): Promise<string> {
    const domain = options.domain || 'http://localhost'
    return `${domain}/${this.normalizePath(path)}`
  }

  async temporaryUrl(path: string, options: TemporaryUrlOptions): Promise<string> {
    const expiry = normalizeExpiryToDate(options.expiresIn)
    const token = Buffer.from(`${path}:${expiry.getTime()}`).toString('base64url')
    return `http://localhost/temp/${token}`
  }

  async checksum(path: string, options: ChecksumOptions = {}): Promise<string> {
    const algorithm = options.algorithm || 'sha256'
    const data = await this.readToUint8Array(path)

    const hasher = new Bun.CryptoHasher(algorithm)
    hasher.update(data)
    return hasher.digest('hex')
  }

  async mimeType(path: string, _options: MimeTypeOptions = {}): Promise<string> {
    const normalized = this.normalizePath(path)
    const file = this.files.get(normalized)

    if (!file) {
      throw new Error(`File not found: ${path}`)
    }

    return file.mimeType
  }

  private detectMimeType(path: string): string {
    const ext = basename(path).split('.').pop()?.toLowerCase()

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

  /**
   * Clear all files and directories (useful for testing)
   */
  clear(): void {
    this.files.clear()
    this.directories.clear()
    this.directories.add('') // Keep root
  }
}

/**
 * Create an in-memory storage adapter instance
 */
export function createMemoryStorage(): InMemoryStorageAdapter {
  return new InMemoryStorageAdapter()
}
