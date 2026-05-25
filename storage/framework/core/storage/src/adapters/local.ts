import { Buffer } from 'node:buffer'
import { createHmac } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { access, chmod, constants, copyFile, lstat, mkdir, readdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type {
  ChecksumOptions,
  DirectoryEntry,
  DirectoryListing,
  FileContents,
  GetStreamOptions,
  ListOptions,
  MimeTypeOptions,
  PublicUrlOptions,
  PutResult,
  PutStreamOptions,
  SignedUrlOptions,
  StatEntry,
  StorageAdapter,
  StorageAdapterConfig,
  TemporaryUrlOptions,
  Visibility,
} from '../types'
import { createDirectoryListing, normalizeExpiryToDate } from '../types'
import { createSignedStorageToken } from '../signed-url'

/**
 * Local filesystem storage adapter using Node.js fs APIs
 */
export class LocalStorageAdapter implements StorageAdapter {
  private root: string

  constructor(config: StorageAdapterConfig = {}) {
    this.root = config.root || process.cwd()
  }

  private resolvePath(path: string): string {
    const resolved = join(this.root, path)
    // Prevent path traversal outside root directory.
    // `startsWith(this.root)` is wrong on two fronts:
    //   1. Windows: `\\` separator vs the `/` in `path` rolls into `\\..\\`
    //      sequences that resolve cleanly to a sibling but pass startsWith.
    //   2. Sibling-prefix collisions: root="/var/store" and resolved="/var/storefoo/..."
    //      pass startsWith but escape the intended root.
    // path.relative() returns something starting with `..` whenever the
    // target is outside `from`, regardless of platform.
    const rel = relative(this.root, resolved)
    if (rel.startsWith('..') || rel.startsWith('../') || rel.startsWith('..\\')) {
      throw new Error(`Path traversal detected: '${path}' resolves outside storage root`)
    }
    return resolved
  }

  async write(path: string, contents: FileContents): Promise<PutResult> {
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

    // Read back size + mtime in one syscall — cheaper than the
    // caller doing a separate `Storage.stat()` round-trip and lets
    // streaming writes (where size isn't known up front) still
    // report the on-disk total. See stacksjs/stacks#1888 S-8.
    const st = await stat(fullPath)
    return {
      path,
      size: st.size,
      lastModified: st.mtimeMs,
    }
  }

  async read(path: string): Promise<FileContents> {
    const fullPath = this.resolvePath(path)
    return await readFile(fullPath)
  }

  /**
   * Stream a file from disk (stacksjs/stacks#1886). Wraps Node's
   * fs.createReadStream into a web-standard `ReadableStream<Uint8Array>`
   * via `Readable.toWeb`, so callers get a portable type that
   * pipes cleanly into other adapters' `putStream`.
   *
   * Memory footprint is per-chunk (Node defaults to 64 KiB) — the
   * full file never sits in memory.
   */
  async getStream(path: string, options?: GetStreamOptions): Promise<ReadableStream<Uint8Array>> {
    const fullPath = this.resolvePath(path)
    // Existence check: createReadStream() is lazy, so a missing
    // file only surfaces when the consumer reads. Throwing here
    // matches the eager behavior of read() / readToBuffer().
    await access(fullPath, constants.R_OK)
    const nodeStream = createReadStream(fullPath, { signal: options?.signal })
    return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>
  }

  /**
   * Pipe a web stream into a file on disk
   * (stacksjs/stacks#1886). Uses `Readable.fromWeb` to bridge
   * back into Node's stream pipeline so backpressure flows
   * correctly — the file write paces with the source.
   *
   * Cancels via `options.signal` propagate to both the read and
   * write sides; the partial file gets removed on abort to avoid
   * leaving truncated artifacts.
   */
  async putStream(path: string, stream: ReadableStream<Uint8Array>, options?: PutStreamOptions): Promise<PutResult> {
    const fullPath = this.resolvePath(path)
    const dir = dirname(fullPath)
    await mkdir(dir, { recursive: true })

    const nodeReadable = Readable.fromWeb(stream as unknown as Parameters<typeof Readable.fromWeb>[0])
    const writeStream = createWriteStream(fullPath)
    try {
      await pipeline(nodeReadable, writeStream, { signal: options?.signal })
    }
    catch (err) {
      // Clean up the partial file so subsequent reads don't see
      // truncated content from a cancelled upload.
      try { await unlink(fullPath) }
      catch { /* best-effort cleanup */ }
      throw err
    }

    const st = await stat(fullPath)
    return {
      path,
      size: st.size,
      contentType: options?.contentType,
      lastModified: st.mtimeMs,
    }
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
    catch (error: any) {
      // Only skip permission errors — propagate other failures
      if (error?.code !== 'EACCES' && error?.code !== 'EPERM') {
        throw error
      }
    }

    return entries
  }

  /**
   * Translate the abstract "public / private" visibility into POSIX
   * mode bits and apply via chmod (stacksjs/stacks#1873 S-4).
   *
   *  - public  → 0o644 (rw-r--r--)  / 0o755 for directories
   *  - private → 0o600 (rw-------)  / 0o700 for directories
   *
   * Directories get the executable bit because POSIX requires it on
   * the lookup path; without it a `readdir` on a "public" directory
   * would still fail for other users.
   *
   * Previously a silent no-op — callers got "success" without any
   * mode change, which made bug reports a guessing game ("I called
   * `changeVisibility('public')` and the file is still 0600 — why?").
   */
  async changeVisibility(path: string, vis: Visibility): Promise<void> {
    const fullPath = this.resolvePath(path)
    const stats = await lstat(fullPath)
    const isDir = stats.isDirectory()
    const mode = (vis === ('public' as Visibility))
      ? (isDir ? 0o755 : 0o644)
      : (isDir ? 0o700 : 0o600)
    await chmod(fullPath, mode)
  }

  /**
   * Read POSIX mode bits and translate back to abstract visibility.
   * Any "world-readable" bit (0o004) flips the file to public; the
   * stricter "group-readable but world-blocked" cases collapse to
   * private since the storage facade has no group concept.
   */
  async visibility(path: string): Promise<Visibility> {
    const fullPath = this.resolvePath(path)
    const stats = await lstat(fullPath)
    // mode is the full st_mode field; mask to the permission bits.
    const perms = stats.mode & 0o777
    return ((perms & 0o004) ? 'public' : 'private') as Visibility
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
    // Resolution order (stacksjs/stacks#1873 S-9):
    //   1. explicit `options.domain`  — caller-controlled
    //   2. `APP_URL` env var          — matches signedUrl() behavior
    //   3. localhost fallback          — dev-mode safety net
    // Pre-fix step 2 was missing — production apps that set APP_URL
    // for every other framework URL got localhost-prefixed public
    // links pointing at files on disk, which broke whenever the
    // generated URL was emailed or stored.
    const base = (options.domain || process.env.APP_URL || 'http://localhost').replace(/\/$/, '')
    return `${base}/${path}`
  }

  async temporaryUrl(path: string, options: TemporaryUrlOptions): Promise<string> {
    const expiry = normalizeExpiryToDate(options.expiresIn)
    const payload = `${path}:${expiry.getTime()}`
    const appKey = process.env.APP_KEY || 'stacks-default-key'
    const signature = createHmac('sha256', appKey).update(payload).digest('hex')
    const token = Buffer.from(`${payload}:${signature}`).toString('base64url')
    return `http://localhost/temp/${token}`
  }

  /**
   * Generate a JWT-style signed URL for time-limited public access to
   * a local-disk file. The token is a JWT-shaped HMAC-SHA256 envelope
   * (header.payload.signature, base64url-encoded JSON parts) signed
   * with the app key. The accompanying route handler (registered
   * automatically at `/__storage/<path>?token=<jwt>`) verifies the
   * signature, checks expiry, and streams the file.
   *
   * Why JWT-shaped instead of an opaque blob:
   *  - Inspectable on both ends without a shared decoder.
   *  - Standard `iss` / `exp` claim semantics make access logs easier
   *    to audit ("who issued this token, when does it expire").
   *  - Lets us add `aud`/`sub` claims later without breaking clients.
   *
   * @example
   * ```ts
   * const url = await Storage.disk('local').signedUrl('private/report.pdf', {
   *   expiresIn: 3600,
   * })
   * // → 'https://app.example.com/__storage/private%2Freport.pdf?token=…'
   * ```
   */
  async signedUrl(path: string, options: SignedUrlOptions): Promise<string> {
    const token = createSignedStorageToken(path, options)
    const baseUrl = (options.baseUrl || process.env.APP_URL || 'http://localhost').replace(/\/$/, '')
    return `${baseUrl}/__storage/${encodeURIComponent(path)}?token=${token}`
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
