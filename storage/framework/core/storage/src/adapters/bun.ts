import { Buffer } from 'node:buffer'
import { file, write as bunWrite } from 'bun'
import { chmod, copyFile, lstat, mkdir, rename, rm, unlink } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
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
import { publicUrlFor, signedUrlBase, writeAtomically } from './filesystem-common'

export class BunStorageAdapter implements StorageAdapter {
  private root: string
  private url?: string
  private disk?: string

  constructor(config: StorageAdapterConfig = {}) {
    this.root = config.root || process.cwd()
    this.url = config.url
    this.disk = config.disk
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

    if (!(typeof contents === 'string' || contents instanceof Uint8Array)) {
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
    }

    // Through a temporary file renamed into place, as on the local disk: a
    // stream that fails part-way leaves the previous file whole. A stream is
    // written as it arrives rather than collected into memory first.
    await writeAtomically(fullPath, async (temporary) => {
      if (typeof contents === 'string' || contents instanceof Uint8Array)
        await bunWrite(temporary, contents)
      else
        await bunWrite(temporary, new Response(contents as ReadableStream<Uint8Array>))
    })

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
   * Pipe a web stream to disk via `Bun.write` (stacksjs/stacks#1886),
   * through a temporary file renamed into place, so an upload that fails or
   * is aborted leaves the previous file whole.
   *
   * `options.signal` aborts the copy: the stream is piped through a
   * pass-through with the signal, so the write sees the abort as a read
   * error. The signal used to be handed to a listener that did nothing, so
   * an aborted upload ran to completion.
   */
  async putStream(path: string, stream: ReadableStream<Uint8Array>, options?: PutStreamOptions): Promise<PutResult> {
    const fullPath = this.resolvePath(path)
    const signal = options?.signal
    signal?.throwIfAborted()

    await writeAtomically(fullPath, async (temporary) => {
      const source = signal
        ? stream.pipeThrough(new TransformStream<Uint8Array, Uint8Array>(), { signal })
        : stream
      await bunWrite(temporary, new Response(source))
    })

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

  // The filesystem calls below throw. They were shell commands run with
  // `.throws(false)`, so a delete that failed - a read-only mount, a file
  // owned by another user - reported success with the file still there, and
  // a directory that could not be created surfaced later as a confusing
  // write error. A file that is already gone is still not an error.
  async deleteFile(path: string): Promise<void> {
    const fullPath = this.resolvePath(path)
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
    await mkdir(dirname(toPath), { recursive: true })
    await rename(fromPath, toPath)
  }

  async copyFile(from: string, to: string): Promise<void> {
    const fromPath = this.resolvePath(from)
    const toPath = this.resolvePath(to)
    await mkdir(dirname(toPath), { recursive: true })
    await copyFile(fromPath, toPath)
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
      // Read from the mode bits, as visibility() does: this said 'private'
      // for every file, public ones included.
      visibility: await this.visibility(path),
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

  /**
   * Same resolution as the local disk: `options.domain`, the disk's `url`,
   * `APP_URL`, then localhost. It went straight from `domain` to localhost,
   * so a production app's public links pointed at localhost, and its paths
   * went unencoded.
   */
  async publicUrl(path: string, options: PublicUrlOptions = {}): Promise<string> {
    return publicUrlFor(path, { domain: options.domain, diskUrl: this.url })
  }

  /**
   * The signed `/__storage` URL, which the framework serves. It was
   * `http://localhost/temp/<token>`, which nothing served, and the token was
   * an unsigned base64 of the path and expiry that anyone could mint.
   */
  async temporaryUrl(path: string, options: TemporaryUrlOptions): Promise<string> {
    return await this.signedUrl(path, { expiresIn: options.expiresIn })
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
    // The disk goes into the token: `/__storage` read every signed URL from
    // the default disk, so a URL signed on any other disk served whatever the
    // default disk held at that path - another file, or a 404.
    const token = createSignedStorageToken(path, { ...options, disk: options.disk ?? this.disk })
    return `${signedUrlBase(options.baseUrl)}/__storage/${encodeURIComponent(path)}?token=${token}`
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
