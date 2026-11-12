import { localDirectoryPage } from '../directory-page'
import type { DirectoryPage, DirectoryPageOptions } from '../types'
import { Buffer } from 'node:buffer'
import { createReadStream } from 'node:fs'
import { access, chmod, constants, copyFile, lstat, mkdir, readdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'
import { Readable } from 'node:stream'
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
import { createDirectoryListing } from '../types'
import { createSignedStorageToken } from '../signed-url'
import { publicUrlFor, resolveStoragePath, signedUrlBase, writeAtomically, writeStreamToFile } from '../filesystem-common'

/**
 * Local filesystem storage adapter using Node.js fs APIs
 */
export class LocalStorageAdapter implements StorageAdapter {
  private root: string
  private url?: string
  private disk?: string

  constructor(config: StorageAdapterConfig = {}) {
    this.root = config.root || process.cwd()
    this.url = config.url
    this.disk = config.disk
  }

  private resolvePath(path: string): string {
    return resolveStoragePath(this.root, path)
  }

  async write(path: string, contents: FileContents): Promise<PutResult> {
    const fullPath = this.resolvePath(path)

    await writeAtomically(fullPath, async (temporary) => {
      if (typeof contents === 'string') {
        await writeFile(temporary, contents, 'utf8')
      }
      else if (contents instanceof Uint8Array) {
        // A Buffer is a Uint8Array.
        await writeFile(temporary, contents)
      }
      else {
        // ReadableStream
        await writeStreamToFile(temporary, contents as ReadableStream<Uint8Array>)
      }
    })

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
    return Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>
  }

  /**
   * Write a web stream into a file on disk (stacksjs/stacks#1886),
   * a chunk at a time, so the file write paces with the source.
   *
   * `options.signal` aborts the copy. The stream lands in a temporary file renamed into
   * place on success (see `writeAtomically`), so an aborted upload
   * leaves whatever was at `path` before untouched.
   */
  async putStream(path: string, stream: ReadableStream<Uint8Array>, options?: PutStreamOptions): Promise<PutResult> {
    const fullPath = this.resolvePath(path)

    await writeAtomically(fullPath, async (temporary) => {
      await writeStreamToFile(temporary, stream, options?.signal)
    })

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
    // A file already gone is deleted; any other failure is one.
    await unlink(fullPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT')
        throw error
    })
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

  listPage(path: string, options: DirectoryPageOptions = {}): Promise<DirectoryPage> {
    return localDirectoryPage(this.resolvePath(path), path, options)
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
    return publicUrlFor(path, { domain: options.domain, diskUrl: this.url })
  }

  /**
   * A time-limited URL: the signed `/__storage` URL, which the framework
   * serves. It used to be `http://localhost/temp/<token>`, which nothing
   * served on any host, signed with a hardcoded fallback key when `APP_KEY`
   * was unset.
   */
  async temporaryUrl(path: string, options: TemporaryUrlOptions): Promise<string> {
    return await this.signedUrl(path, { expiresIn: options.expiresIn })
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
    // The disk goes into the token: `/__storage` read every signed URL from
    // the default disk, so a URL signed on any other disk served whatever the
    // default disk held at that path - another file, or a 404.
    const token = createSignedStorageToken(path, { ...options, disk: options.disk ?? this.disk })
    return `${signedUrlBase(options.baseUrl)}/__storage/${encodeURIComponent(path)}?token=${token}`
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
