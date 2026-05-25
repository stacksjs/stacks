/**
 * Storage Facade
 *
 * Laravel-style storage management with support for multiple disk drivers.
 * Configure disks via config/storage.ts or environment variables.
 *
 * @example
 * ```ts
 * // Use default disk
 * await Storage.put('file.txt', 'Hello World')
 *
 * // Use specific disk
 * await Storage.disk('s3').put('uploads/file.txt', contents)
 *
 * // Get file from public disk
 * const content = await Storage.disk('public').get('images/logo.png')
 * ```
 */

import { resolve } from 'node:path'
import process from 'node:process'
import { filesystems, app as appConfig } from '@stacksjs/config'
import { S3Client } from '@stacksjs/ts-cloud'
import type { GetStreamOptions, PresignedUploadPolicy, PresignedUploadPolicyOptions, PresignedUploadUrl, PresignedUploadUrlOptions, PutResult, PutStreamOptions, SignedUrlOptions, StatEntry, StorageAdapter } from './types'
import { createLocalStorage } from './adapters/local'
import { S3StorageAdapter } from './adapters/s3'
import { parseDiskPath } from './path-sanitize'
import { putUploadedFile } from './put-file'
import type { PutFileOptions, UploadedFileLike } from './put-file'
import type {
  DiskConfig,
  FilesystemConfig,
  LocalDiskConfig,
  S3DiskConfig,
} from './types/filesystem'

// =============================================================================
// Configuration Builder
// =============================================================================

/**
 * Build filesystem config from @stacksjs/config
 * Called lazily to ensure config is loaded
 */
function buildConfig(): FilesystemConfig {
  const cwd = process.cwd()
  const rootDir = filesystems.root || cwd
  const s3Config = filesystems.s3
  const appUrl = appConfig?.url || ''

  const config: FilesystemConfig = {
    default: filesystems.driver || 'local',

    disks: {
      // Local disk - private storage
      local: {
        driver: 'local',
        root: resolve(rootDir, 'storage/app'),
        visibility: filesystems.defaultVisibility || 'private',
      },

      // Public disk - web accessible
      public: {
        driver: 'local',
        root: resolve(rootDir, 'public'),
        url: appUrl ? `${appUrl}/storage` : '/storage',
        visibility: 'public',
      },
    },
  }

  // Add S3 disk if configured
  if (s3Config?.bucket) {
    config.disks.s3 = {
      driver: 's3',
      bucket: s3Config.bucket,
      region: s3Config.region || 'us-east-1',
      prefix: s3Config.prefix,
      endpoint: s3Config.endpoint,
      url: filesystems.publicUrl?.domain,
      usePathStyleEndpoint: !!s3Config.endpoint,
      visibility: filesystems.defaultVisibility || 'private',
      credentials: s3Config.credentials
        ? { key: s3Config.credentials.accessKeyId, secret: s3Config.credentials.secretAccessKey }
        : undefined,
    }
  }

  return config
}

// =============================================================================
// Storage Manager
// =============================================================================

class StorageManager {
  private _config: FilesystemConfig | null = null
  private disks: Map<string, StorageAdapter> = new Map()
  private s3Clients: Map<string, S3Client> = new Map()
  private customConfig: Partial<FilesystemConfig> | null = null

  /**
   * Get config lazily to ensure env vars are loaded
   */
  private get config(): FilesystemConfig {
    if (!this._config) {
      const builtConfig = buildConfig()
      this._config = this.customConfig
        ? {
            default: this.customConfig.default || builtConfig.default,
            disks: { ...builtConfig.disks, ...this.customConfig.disks },
          }
        : builtConfig
    }
    return this._config
  }

  /**
   * Initialize with custom config (optional)
   * Call this early if you need to override env-based config
   */
  init(config: Partial<FilesystemConfig>): this {
    this.customConfig = config
    this._config = null // Reset so it rebuilds on next access
    this.disks.clear()
    this.s3Clients.clear()
    return this
  }

  /**
   * Get a disk instance by name
   */
  disk(name?: string): StorageAdapter {
    const diskName = name || this.config.default

    // Return cached disk
    if (this.disks.has(diskName)) {
      return this.disks.get(diskName)!
    }

    const diskConfig = this.config.disks[diskName]
    if (!diskConfig) {
      const available = Object.keys(this.config.disks).join(', ')
      throw new Error(`Disk [${diskName}] is not configured. Available: ${available}`)
    }

    const adapter = this.createAdapter(diskName, diskConfig)
    this.disks.set(diskName, adapter)

    return adapter
  }

  /**
   * Create a storage adapter from config
   */
  private createAdapter(name: string, config: DiskConfig): StorageAdapter {
    switch (config.driver) {
      case 'local':
        return this.createLocalAdapter(config)
      case 's3':
        return this.createS3Adapter(name, config)
      default:
        throw new Error(`Unsupported driver: ${(config as any).driver}`)
    }
  }

  private createLocalAdapter(config: LocalDiskConfig): StorageAdapter {
    return createLocalStorage({ root: config.root })
  }

  private createS3Adapter(name: string, config: S3DiskConfig): StorageAdapter {
    let client = this.s3Clients.get(name)

    if (!client) {
      client = new S3Client(config.region || 'us-east-1')
      this.s3Clients.set(name, client)
    }

    return new S3StorageAdapter(client, {
      bucket: config.bucket,
      region: config.region,
      prefix: config.prefix,
    })
  }

  // ===========================================================================
  // Convenience Methods
  // ===========================================================================

  /**
   * Write contents to the default disk at the given path. The original
   * low-level overload — `Storage.put('logs/today.txt', text)` — stays
   * as-is for code that already has a path + bytes.
   */
  async put(path: string, contents: string | Uint8Array | Buffer): Promise<PutResult>
  /**
   * Write an `UploadedFile` (typically `req.file('avatar')` or one entry
   * from `req.files`) to a disk and return both the storage path and the
   * resulting public URL. Derives a safe filename so callers don't have
   * to write the same uuid + extension boilerplate in every upload
   * action. See stacksjs/stacks#1856.
   *
   * @example
   * ```ts
   * const file = req.file('avatar')!
   * const { path, url, size, etag } = await Storage.put(file, { disk: 'public', dir: 'avatars' })
   * await db.updateTable('users').set({ avatar: url, avatar_size: size }).where('id', '=', userId).execute()
   * ```
   */
  async put(file: UploadedFileLike, opts?: PutFileOptions): Promise<PutResult & { url: string }>
  async put(
    pathOrFile: string | UploadedFileLike,
    contentsOrOpts?: string | Uint8Array | Buffer | PutFileOptions,
  ): Promise<PutResult | (PutResult & { url: string })> {
    if (typeof pathOrFile === 'string') {
      // `write()` now returns PutResult with size/lastModified/contentType
      // captured at the adapter (stacksjs/stacks#1888 S-8) — callers
      // that want to record metadata against a domain model no longer
      // need a follow-up `stat()` round-trip.
      return this.disk().write(pathOrFile, contentsOrOpts as string | Uint8Array | Buffer)
    }
    const opts = (contentsOrOpts as PutFileOptions | undefined) ?? {}
    return putUploadedFile(this, pathOrFile, opts)
  }

  /**
   * Return the full {@link StatEntry} for a file (size, mime,
   * lastModified, visibility, etc.) — convenience wrapper around the
   * existing per-adapter `stat()`. Use this for callers that need
   * multiple pieces of metadata in one round-trip; the granular
   * `size()` / `mimeType()` / `lastModified()` helpers stay for code
   * that just wants one field.
   *
   * stacksjs/stacks#1888 S-8.
   */
  async stat(path: string): Promise<StatEntry> {
    return this.disk().stat(path)
  }

  /**
   * Read a file as a web-standard `ReadableStream<Uint8Array>`
   * (stacksjs/stacks#1886). Use this when the file might be too
   * large to fit in memory — local / bun adapters stream from disk
   * chunk-by-chunk; S3 currently buffers (single chunk) pending
   * upstream chunked-read support.
   *
   * @example
   * ```ts
   * const stream = await Storage.getStream('exports/big.csv')
   * for await (const chunk of stream) {
   *   // process bytes
   * }
   * ```
   */
  async getStream(path: string, options?: GetStreamOptions): Promise<ReadableStream<Uint8Array>> {
    const adapter = this.disk()
    if (typeof adapter.getStream !== 'function') {
      throw new Error(`[storage] disk '${this.config.default}' does not support getStream — adapter is missing the optional method`)
    }
    return adapter.getStream(path, options)
  }

  /**
   * Stream a `ReadableStream<Uint8Array>` into the configured
   * disk (stacksjs/stacks#1886). S3 automatically uses multipart
   * upload for streams larger than `options.partSize` (default 5
   * MiB), so files up to 5 TB work without buffering the whole
   * body in memory.
   *
   * @example
   * ```ts
   * // Pipe a fetch response straight to S3
   * const res = await fetch(remoteUrl)
   * if (res.body)
   *   await Storage.putStream('imports/data.csv', res.body)
   *
   * // Cross-disk pipe (combines #1888 with this PR)
   * const src = await Storage.disk('local').getStream('big.csv')
   * await Storage.disk('s3').putStream('archive/big.csv', src, {
   *   partSize: 10 * 1024 * 1024, // 10 MiB parts for big files
   * })
   * ```
   */
  async putStream(path: string, stream: ReadableStream<Uint8Array>, options?: PutStreamOptions): Promise<PutResult> {
    const adapter = this.disk()
    if (typeof adapter.putStream !== 'function') {
      throw new Error(`[storage] disk '${this.config.default}' does not support putStream — adapter is missing the optional method`)
    }
    return adapter.putStream(path, stream, options)
  }

  /**
   * Copy a file across disks using the `<disk>:<path>` reference form
   * (stacksjs/stacks#1888 S-7). Same-disk copies use the adapter's
   * native `copyFile()`. Cross-disk copies stream the contents from
   * source to destination through a buffer.
   *
   * @example
   * ```ts
   * await Storage.copyAcross('s3:user-uploads/foo.jpg', 'local:processed/foo.jpg')
   * await Storage.copyAcross('s3:src/bar.bin', 's3:dest/bar.bin') // native CopyObject path
   * ```
   *
   * Future enhancement: same-bucket s3→s3 copies should issue
   * CopyObject (no transit) — tracked alongside the streaming work
   * in #1886.
   */
  async copyAcross(source: string, dest: string): Promise<PutResult> {
    const src = parseDiskPath(source)
    const dst = parseDiskPath(dest)

    // Same-disk shortcut — use the adapter's native copy so the disk
    // can pick the fastest path (S3 CopyObject, local fs.copyFile,
    // etc.) without a read/write round-trip.
    if (src.disk === dst.disk) {
      const adapter = this.disk(src.disk)
      await adapter.copyFile(src.path, dst.path)
      return adapter.stat(dst.path).then(entry => ({
        path: dst.path,
        size: entry.size,
        contentType: entry.mimeType,
        lastModified: entry.lastModified,
      }))
    }

    // Cross-disk: read from source then write to destination. The
    // adapter's `read()` returns a Buffer / Uint8Array; we don't
    // pre-stream because the streaming surface (#1886) doesn't exist
    // yet. Once streaming lands, swap this for `getStream` +
    // `putStream` so the whole file doesn't have to fit in memory.
    const contents = await this.disk(src.disk).read(src.path)
    return this.disk(dst.disk).write(dst.path, contents)
  }

  /**
   * Move a file across disks. Equivalent to `copyAcross()` followed
   * by deleting the source. Source delete is best-effort with a
   * thrown error — the destination write is the commit point, so a
   * dest-write failure aborts; a source-delete failure surfaces but
   * the file has already been copied.
   *
   * @example
   * ```ts
   * await Storage.moveAcross('s3:user-uploads/foo.jpg', 'r2:archive/foo.jpg')
   * ```
   */
  async moveAcross(source: string, dest: string): Promise<PutResult> {
    const src = parseDiskPath(source)
    const result = await this.copyAcross(source, dest)
    await this.disk(src.disk).deleteFile(src.path)
    return result
  }

  async get(path: string): Promise<string> {
    return this.disk().readToString(path)
  }

  async exists(path: string): Promise<boolean> {
    return this.disk().fileExists(path)
  }

  async missing(path: string): Promise<boolean> {
    return !(await this.exists(path))
  }

  async delete(path: string): Promise<void> {
    return this.disk().deleteFile(path)
  }

  async copy(from: string, to: string): Promise<void> {
    return this.disk().copyFile(from, to)
  }

  async move(from: string, to: string): Promise<void> {
    return this.disk().moveFile(from, to)
  }

  async url(path: string): Promise<string> {
    return this.disk().publicUrl(path)
  }

  /**
   * Generate a time-limited signed URL for the given path on the
   * default disk. Useful for granting external/anonymous access to
   * private files (download links, embeddable images, report exports)
   * without making them publicly listable.
   *
   * Throws if the underlying adapter doesn't support signed URLs
   * (e.g. the in-memory mock).
   *
   * @example
   * ```ts
   * // Grant 1-hour access to a private upload
   * const url = await Storage.signedUrl('uploads/2024/report.pdf', {
   *   expiresIn: 3600,
   * })
   *
   * // Or pick a specific disk
   * const url = await Storage.disk('s3').signedUrl('private/keys.json', {
   *   expiresIn: 60,
   * })
   * ```
   */
  async signedUrl(path: string, options: SignedUrlOptions): Promise<string> {
    const adapter = this.disk()
    if (typeof adapter.signedUrl !== 'function') {
      throw new Error(`[storage] disk '${this.config.default}' does not support signedUrl`)
    }
    return adapter.signedUrl(path, options)
  }

  /**
   * Mint a presigned URL the browser can PUT to directly, bypassing
   * the app server (stacksjs/stacks#1856 Stage 6). Use with the
   * `useDirectUpload({ presignEndpoint })` frontend composable.
   *
   * Only adapters that can serve URLs (S3, etc.) implement this — the
   * local-disk and in-memory adapters throw a clear "not supported"
   * error rather than returning a useless localhost URL.
   *
   * @example
   * ```ts
   * // In a `/api/me/avatar/presign` action:
   * const { url, path } = await Storage.disk('s3').presignedUploadUrl({
   *   contentType: req.body.contentType,
   *   expiresIn: 60,
   *   dir: 'avatars',
   * })
   * return { url, path }
   * ```
   */
  async presignedUploadUrl(options: PresignedUploadUrlOptions): Promise<PresignedUploadUrl> {
    const adapter = this.disk()
    if (typeof adapter.presignedUploadUrl !== 'function') {
      throw new Error(`[storage] disk '${this.config.default}' does not support presignedUploadUrl — only S3-style adapters do. Use \`Storage.put(file, opts)\` for local/proxied uploads.`)
    }
    return adapter.presignedUploadUrl(options)
  }

  /**
   * Mint an S3 presigned-POST policy with server-side
   * `Content-Length-Range` enforcement (stacksjs/stacks#1888
   * Phase B). The browser POSTs a multipart form (not a PUT body),
   * and S3 rejects anything that violates the embedded conditions
   * before storing — the missing maxBytes-enforcement piece called
   * out by the original S-12 doc-only fix.
   *
   * Currently S3-only; other adapters throw a clear error. Use
   * `presignedUploadUrl()` for the PUT-form (no size enforcement)
   * or `Storage.put(file, opts)` for server-proxied uploads.
   *
   * @example
   * ```ts
   * const policy = await Storage.presignedUploadPolicy({
   *   key: { startsWith: 'avatars/' },
   *   contentType: { startsWith: 'image/' },
   *   contentLengthRange: { min: 0, max: 5 * 1024 * 1024 },
   *   expiresIn: 3600,
   * })
   *
   * // Frontend:
   * const fd = new FormData()
   * Object.entries(policy.fields).forEach(([k, v]) => fd.append(k, v))
   * fd.append('file', file)   // MUST be last
   * await fetch(policy.url, { method: 'POST', body: fd })
   * ```
   */
  async presignedUploadPolicy(options: PresignedUploadPolicyOptions): Promise<PresignedUploadPolicy> {
    const adapter = this.disk()
    if (typeof adapter.presignedUploadPolicy !== 'function') {
      throw new Error(`[storage] disk '${this.config.default}' does not support presignedUploadPolicy — S3-only. Use \`presignedUploadUrl\` for the PUT-form, or \`Storage.put(file, opts)\` for server-proxied uploads.`)
    }
    return adapter.presignedUploadPolicy(options)
  }

  async size(path: string): Promise<number> {
    return this.disk().fileSize(path)
  }

  async lastModified(path: string): Promise<number> {
    return this.disk().lastModified(path)
  }

  async mimeType(path: string): Promise<string> {
    return this.disk().mimeType(path)
  }

  async checksum(path: string, algorithm?: 'md5' | 'sha1' | 'sha256'): Promise<string> {
    return this.disk().checksum(path, { algorithm })
  }

  async makeDirectory(path: string): Promise<void> {
    return this.disk().createDirectory(path)
  }

  async deleteDirectory(path: string): Promise<void> {
    return this.disk().deleteDirectory(path)
  }

  files(path: string = ''): AsyncIterable<{ path: string; type: 'file' | 'directory' }> {
    return this.disk().list(path)
  }

  allFiles(path: string = ''): AsyncIterable<{ path: string; type: 'file' | 'directory' }> {
    return this.disk().list(path, { deep: true })
  }

  // ===========================================================================
  // Configuration Methods
  // ===========================================================================

  configure(name: string, config: DiskConfig): this {
    // Ensure config is loaded
    const currentConfig = this.config
    currentConfig.disks[name] = config
    this.disks.delete(name)
    this.s3Clients.delete(name)
    return this
  }

  setDefaultDisk(name: string): this {
    if (!this.config.disks[name]) {
      throw new Error(`Disk [${name}] is not configured`)
    }
    this.config.default = name
    return this
  }

  getDiskConfig(name?: string): DiskConfig | undefined {
    return this.config.disks[name || this.config.default]
  }

  getConfiguredDisks(): string[] {
    return Object.keys(this.config.disks)
  }

  getDefaultDisk(): string {
    return this.config.default
  }

  /**
   * Reset the storage manager (useful for testing)
   */
  reset(): this {
    this._config = null
    this.customConfig = null
    this.disks.clear()
    this.s3Clients.clear()
    return this
  }
}

// =============================================================================
// Exports
// =============================================================================

export const Storage = new StorageManager()
export { StorageManager }

export type {
  DiskConfig,
  FilesystemConfig,
  LocalDiskConfig,
  S3DiskConfig,
} from './types/filesystem'
