/**
 * Per-tenant prefix scoping wrapper (stacksjs/stacks#1887 S-11).
 *
 * Background: multi-tenant apps had to manually prefix every
 * storage path with the tenant id. A bug in one call site that
 * forgot the prefix silently wrote to a shared root where other
 * tenants could see it. The framework had no "this disk is scoped
 * to tenant X" abstraction.
 *
 * Fix: a `ScopedStorageAdapter` that wraps any `StorageAdapter`
 * and:
 *
 *   - Prepends the scope prefix to every path before passing
 *     through to the underlying adapter
 *   - Strips the prefix from paths returned by `list()` and
 *     metadata returns so callers see the tenant-relative view
 *   - Rejects path-traversal that would escape the scope
 *
 * Works with every existing adapter (local / memory / bun / s3)
 * because it consumes the same `StorageAdapter` interface. Apps
 * get tenant isolation as a zero-runtime-cost wrapper instead of
 * reimplementing it per call site.
 */

import type {
  ChecksumOptions,
  DirectoryEntry,
  DirectoryListing,
  FileContents,
  GetStreamOptions,
  ListOptions,
  MimeTypeOptions,
  PresignedUploadPolicy,
  PresignedUploadPolicyOptions,
  PresignedUploadUrl,
  PresignedUploadUrlOptions,
  PublicUrlOptions,
  PutResult,
  PutStreamOptions,
  SignedUrlOptions,
  StatEntry,
  StorageAdapter,
  TemporaryUrlOptions,
  Visibility,
} from '../types'

/**
 * Configuration for a scoped adapter.
 */
export interface ScopedAdapterOptions {
  /**
   * The scope prefix prepended to every path. Trailing slashes
   * are normalized away. Use a stable identifier — tenant id, user
   * id, organization slug.
   *
   * Example: `'tenant-42'` produces paths like `tenant-42/avatar.jpg`
   * on the underlying disk.
   */
  scope: string
  /**
   * Allowed prefix character set. Defaults to alphanumerics +
   * `-` / `_`. Customize if your tenant identifiers include other
   * chars (UUIDs already match the default).
   */
  scopePattern?: RegExp
}

const DEFAULT_SCOPE_PATTERN = /^[a-z0-9_-]+$/i

/**
 * Wrap any `StorageAdapter` to scope every operation under a
 * per-tenant prefix. The wrapped instance presents the same
 * `StorageAdapter` interface so the session middleware /
 * `Storage.disk()` / cross-disk copy all work transparently.
 *
 * Construction validates the scope against
 * {@link ScopedAdapterOptions.scopePattern} so a hostile or
 * malformed tenant id can't escape via `..` segments or path
 * separators.
 *
 * @example
 * ```ts
 * const tenantDisk = new ScopedStorageAdapter(
 *   Storage.disk('s3'),
 *   { scope: `tenant-${tenantId}` },
 * )
 * await tenantDisk.write('avatar.jpg', file)  // → tenant-42/avatar.jpg
 * ```
 */
export class ScopedStorageAdapter implements StorageAdapter {
  private readonly inner: StorageAdapter
  private readonly scope: string
  private readonly scopeWithSlash: string

  constructor(inner: StorageAdapter, options: ScopedAdapterOptions) {
    const pattern = options.scopePattern ?? DEFAULT_SCOPE_PATTERN
    const cleaned = String(options.scope).replace(/^\/+|\/+$/g, '')
    if (!cleaned) throw new Error('[storage/scoped] scope is required')
    if (!pattern.test(cleaned))
      throw new Error(`[storage/scoped] scope '${cleaned}' contains disallowed characters`)
    if (cleaned.includes('..') || cleaned.includes('/'))
      throw new Error(`[storage/scoped] scope '${cleaned}' cannot contain path separators or traversal`)

    this.inner = inner
    this.scope = cleaned
    this.scopeWithSlash = `${cleaned}/`
  }

  /**
   * Scope a caller-supplied path. Rejects absolute paths,
   * traversal segments, and null bytes BEFORE prepending — without
   * this, a caller passing `../other-tenant/file.txt` would resolve
   * outside their scope.
   */
  private scopePath(path: string): string {
    if (typeof path !== 'string') throw new Error('[storage/scoped] path must be a string')
    if (path.length === 0) return this.scope
    if (path.includes('\0')) throw new Error('[storage/scoped] path contains a null byte')
    if (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path))
      throw new Error(`[storage/scoped] path '${path}' is absolute — refusing to escape scope`)
    const segments = path.split(/[/\\]/)
    if (segments.some(s => s === '..'))
      throw new Error(`[storage/scoped] path '${path}' contains a '..' segment — refusing to escape scope`)
    return `${this.scope}/${path.replace(/^\/+/, '')}`
  }

  /**
   * Strip the scope prefix from a path returned by the underlying
   * adapter (used in `list()` and `stat()`). Returns the input
   * unchanged when it doesn't match the scope — defense against
   * adapter bugs where the underlying didn't actually scope.
   */
  private unscopePath(path: string): string {
    if (path === this.scope) return ''
    if (path.startsWith(this.scopeWithSlash)) return path.slice(this.scopeWithSlash.length)
    return path
  }

  // ---------------------------------------------------------------
  // Pass-throughs that prepend the scope
  // ---------------------------------------------------------------

  async write(path: string, contents: FileContents): Promise<PutResult> {
    const result = await this.inner.write(this.scopePath(path), contents)
    return { ...result, path: this.unscopePath(result.path) }
  }

  async read(path: string): Promise<FileContents> { return this.inner.read(this.scopePath(path)) }
  async readToString(path: string): Promise<string> { return this.inner.readToString(this.scopePath(path)) }
  async readToBuffer(path: string): Promise<Buffer> { return this.inner.readToBuffer(this.scopePath(path)) }
  async readToUint8Array(path: string): Promise<Uint8Array> { return this.inner.readToUint8Array(this.scopePath(path)) }

  async deleteFile(path: string): Promise<void> { return this.inner.deleteFile(this.scopePath(path)) }
  async deleteDirectory(path: string): Promise<void> { return this.inner.deleteDirectory(this.scopePath(path)) }
  async createDirectory(path: string): Promise<void> { return this.inner.createDirectory(this.scopePath(path)) }

  async moveFile(from: string, to: string): Promise<void> {
    return this.inner.moveFile(this.scopePath(from), this.scopePath(to))
  }

  async copyFile(from: string, to: string): Promise<void> {
    return this.inner.copyFile(this.scopePath(from), this.scopePath(to))
  }

  async stat(path: string): Promise<StatEntry> {
    const entry = await this.inner.stat(this.scopePath(path))
    return { ...entry, path: this.unscopePath(entry.path) }
  }

  list(path: string, options?: ListOptions): DirectoryListing {
    const inner = this.inner.list(this.scopePath(path), options)
    const unscope = this.unscopePath.bind(this)
    return (async function* (): AsyncGenerator<DirectoryEntry, void, void> {
      for await (const entry of inner) {
        yield { ...entry, path: unscope(entry.path) }
      }
    })()
  }

  async changeVisibility(path: string, visibility: Visibility): Promise<void> {
    return this.inner.changeVisibility(this.scopePath(path), visibility)
  }

  async visibility(path: string): Promise<Visibility> {
    return this.inner.visibility(this.scopePath(path))
  }

  async fileExists(path: string): Promise<boolean> { return this.inner.fileExists(this.scopePath(path)) }
  async directoryExists(path: string): Promise<boolean> { return this.inner.directoryExists(this.scopePath(path)) }

  async publicUrl(path: string, options?: PublicUrlOptions): Promise<string> {
    return this.inner.publicUrl(this.scopePath(path), options)
  }

  async temporaryUrl(path: string, options: TemporaryUrlOptions): Promise<string> {
    return this.inner.temporaryUrl(this.scopePath(path), options)
  }

  // ---------------------------------------------------------------
  // Optional methods: forwarded when the inner adapter supports them
  // ---------------------------------------------------------------

  async signedUrl(path: string, options: SignedUrlOptions): Promise<string> {
    if (typeof this.inner.signedUrl !== 'function')
      throw new Error('[storage/scoped] wrapped adapter does not support signedUrl')
    return this.inner.signedUrl(this.scopePath(path), options)
  }

  async presignedUploadUrl(options: PresignedUploadUrlOptions): Promise<PresignedUploadUrl> {
    if (typeof this.inner.presignedUploadUrl !== 'function')
      throw new Error('[storage/scoped] wrapped adapter does not support presignedUploadUrl')
    // The presigned URL's `dir` option already produces sub-paths
    // off the disk root; we scope by prepending `scope/` to it so
    // the upload still lands inside the tenant's space.
    const scopedDir = options.dir ? `${this.scope}/${options.dir.replace(/^\/+/, '')}` : this.scope
    const result = await this.inner.presignedUploadUrl({ ...options, dir: scopedDir })
    return { ...result, path: this.unscopePath(result.path), key: this.unscopePath(result.key) }
  }

  async presignedUploadPolicy(options: PresignedUploadPolicyOptions): Promise<PresignedUploadPolicy> {
    if (typeof this.inner.presignedUploadPolicy !== 'function')
      throw new Error('[storage/scoped] wrapped adapter does not support presignedUploadPolicy')
    // Scope the key prefix so a tenant's POST policy can't upload
    // outside their bucket region.
    const scopedKey = typeof options.key === 'string'
      ? this.scopePath(options.key)
      : { startsWith: this.scopePath(options.key.startsWith) }
    const result = await this.inner.presignedUploadPolicy({ ...options, key: scopedKey })
    return { ...result, key: this.unscopePath(result.key) }
  }

  async getStream(path: string, options?: GetStreamOptions): Promise<ReadableStream<Uint8Array>> {
    if (typeof this.inner.getStream !== 'function')
      throw new Error('[storage/scoped] wrapped adapter does not support getStream')
    return this.inner.getStream(this.scopePath(path), options)
  }

  async putStream(path: string, stream: ReadableStream<Uint8Array>, options?: PutStreamOptions): Promise<PutResult> {
    if (typeof this.inner.putStream !== 'function')
      throw new Error('[storage/scoped] wrapped adapter does not support putStream')
    const result = await this.inner.putStream(this.scopePath(path), stream, options)
    return { ...result, path: this.unscopePath(result.path) }
  }

  async checksum(path: string, options?: ChecksumOptions): Promise<string> {
    return this.inner.checksum(this.scopePath(path), options)
  }

  async mimeType(path: string, options?: MimeTypeOptions): Promise<string> {
    return this.inner.mimeType(this.scopePath(path), options)
  }

  async lastModified(path: string): Promise<number> {
    return this.inner.lastModified(this.scopePath(path))
  }

  async fileSize(path: string): Promise<number> {
    return this.inner.fileSize(this.scopePath(path))
  }
}

/**
 * Convenience factory — most app code reads cleaner with the
 * function form than `new ScopedStorageAdapter(...)`.
 *
 * @example
 * ```ts
 * const tenantDisk = scoped(Storage.disk('s3'), { scope: `tenant-${id}` })
 * ```
 */
export function scoped(inner: StorageAdapter, options: ScopedAdapterOptions): ScopedStorageAdapter {
  return new ScopedStorageAdapter(inner, options)
}
