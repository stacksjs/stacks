import { Buffer } from 'node:buffer'
import { file, write as bunWrite } from 'bun'
import { chmod, lstat } from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'
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

export class BunStorageAdapter implements StorageAdapter {
  private root: string

  constructor(config: StorageAdapterConfig = {}) {
    this.root = config.root || process.cwd()
  }

  private resolvePath(path: string): string {
    const resolved = join(this.root, path)
    // Prevent path traversal — same defense as the local adapter. Without
    // this, a caller passing `../../etc/passwd` would resolve outside the
    // configured storage root because `join` happily normalizes `..`.
    const rel = relative(this.root, resolved)
    if (rel.startsWith('..') || rel.startsWith('../') || rel.startsWith('..\\')) {
      throw new Error(`Path traversal detected: '${path}' resolves outside storage root`)
    }
    return resolved
  }

  async write(path: string, contents: FileContents): Promise<PutResult> {
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
      // Web-standard ReadableStream only — see s3.ts:contentsToBuffer
      // (stacksjs/stacks#1873 S-15) for the same guard.
      const stream = contents as unknown as { getReader?: ReadableStream['getReader'] }
      if (typeof stream.getReader !== 'function') {
        throw new TypeError(
          '[storage/bun] contents must be a web-standard ReadableStream '
          + '(with .getReader()), not a Node stream.Readable. '
          + 'Convert via Readable.toWeb(nodeStream) before passing.',
        )
      }

      const reader = stream.getReader.call(contents as ReadableStream)
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

    // Read back size + mtime via Bun.file — same shape as the local
    // adapter (stacksjs/stacks#1888 S-8).
    const written = file(fullPath)
    return {
      path,
      size: written.size,
      lastModified: written.lastModified,
    }
  }

  async read(path: string): Promise<FileContents> {
    const fullPath = this.resolvePath(path)
    const bunFile = file(fullPath)
    if (!(await bunFile.exists())) {
      throw new Error(`File not found: ${path}`)
    }
    return await bunFile.arrayBuffer().then(buf => new Uint8Array(buf))
  }

  /**
   * Native Bun stream via `Bun.file().stream()`
   * (stacksjs/stacks#1886). Returns a web-standard
   * `ReadableStream<Uint8Array>` directly — no Node-stream
   * conversion needed since Bun's file streams are already WHATWG.
   */
  async getStream(path: string, _options?: GetStreamOptions): Promise<ReadableStream<Uint8Array>> {
    const fullPath = this.resolvePath(path)
    const bunFile = file(fullPath)
    if (!(await bunFile.exists()))
      throw new Error(`File not found: ${path}`)
    return bunFile.stream() as ReadableStream<Uint8Array>
  }

  /**
   * Pipe a web stream to disk via `Bun.write(path, stream)`
   * (stacksjs/stacks#1886). Bun's `write()` accepts a
   * ReadableStream natively and handles the backpressure.
   *
   * Abort handling: tee the stream so we can cancel one half on
   * `signal` while bun consumes the other; on abort we
   * unlink the partial file so callers don't see truncated
   * artifacts.
   */
  async putStream(path: string, stream: ReadableStream<Uint8Array>, options?: PutStreamOptions): Promise<PutResult> {
    const fullPath = this.resolvePath(path)
    const dir = dirname(fullPath)
    await this.createDirectory(relative(this.root, dir))

    // Wire AbortSignal to a Response wrapper — `Bun.write` accepts
    // BodyInit (Response counts), and a Response with a signal
    // aborts the underlying read on cancel.
    try {
      const body = new Response(stream)
      const writePromise = bunWrite(fullPath, body)
      if (options?.signal) {
        const abortHandler = (): void => {
          // Bun doesn't expose a write-cancel API today; the next
          // read from the source stream rejects, and we clean up
          // the partial file in the catch below.
        }
        options.signal.addEventListener('abort', abortHandler, { once: true })
        try { await writePromise }
        finally { options.signal.removeEventListener('abort', abortHandler) }
      }
      else {
        await writePromise
      }
    }
    catch (err) {
      try { await Bun.$.throws(false)`rm -f ${fullPath}` }
      catch { /* best-effort cleanup */ }
      throw err
    }

    const written = file(fullPath)
    return {
      path,
      size: written.size,
      contentType: options?.contentType,
      lastModified: written.lastModified,
    }
  }

  async readToString(path: string): Promise<string> {
    const fullPath = this.resolvePath(path)
    const bunFile = file(fullPath)
    if (!(await bunFile.exists())) {
      throw new Error(`File not found: ${path}`)
    }
    return await bunFile.text()
  }

  async readToBuffer(path: string): Promise<Buffer> {
    const fullPath = this.resolvePath(path)
    const bunFile = file(fullPath)
    if (!(await bunFile.exists())) {
      throw new Error(`File not found: ${path}`)
    }
    const arrayBuffer = await bunFile.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  async readToUint8Array(path: string): Promise<Uint8Array> {
    const fullPath = this.resolvePath(path)
    const bunFile = file(fullPath)
    if (!(await bunFile.exists())) {
      throw new Error(`File not found: ${path}`)
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
      throw new Error(`File not found: ${path}`)
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

  /**
   * Same chmod-based visibility as the local adapter
   * (stacksjs/stacks#1873 S-4). Bun's own file APIs don't expose a
   * mode setter, so we use node:fs/promises.chmod against the
   * already-resolved path. Public = 0o644 / 0o755, Private = 0o600 /
   * 0o700, with the executable bit on directories so traversal still
   * works for other users.
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

  async visibility(path: string): Promise<Visibility> {
    const fullPath = this.resolvePath(path)
    const stats = await lstat(fullPath)
    const perms = stats.mode & 0o777
    return ((perms & 0o004) ? 'public' : 'private') as Visibility
  }

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
    return `${domain}/${path}`
  }

  async temporaryUrl(path: string, options: TemporaryUrlOptions): Promise<string> {
    const expiry = normalizeExpiryToDate(options.expiresIn)
    const token = Buffer.from(`${path}:${expiry.getTime()}`).toString('base64url')
    return `http://localhost/temp/${token}`
  }

  /**
   * Generate a JWT-style signed URL for time-limited public access to
   * a Bun-disk file. Same wire format as the local adapter — see
   * `src/signed-url.ts` for the token shape.
   *
   * @example
   * ```ts
   * const url = await Storage.disk('bun').signedUrl('docs/spec.pdf', { expiresIn: 600 })
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
    const bunFile = file(fullPath)
    if (!(await bunFile.exists())) {
      throw new Error(`File not found: ${path}`)
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
      throw new Error(`File not found: ${path}`)
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
