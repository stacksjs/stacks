import { Buffer } from 'node:buffer'
import { basename } from 'node:path'
import { S3Client } from '@stacksjs/ts-cloud'
import type {
  ChecksumOptions,
  DirectoryListing,
  FileContents,
  ListOptions,
  MimeTypeOptions,
  PresignedUploadUrl,
  PresignedUploadUrlOptions,
  PublicUrlOptions,
  SignedUrlOptions,
  StatEntry,
  StorageAdapter,
  StorageAdapterConfig,
  TemporaryUrlOptions,
  Visibility,
} from '../types'
import { normalizeExpiryToMilliseconds } from '../types'
import { sanitizePresignedDir, sanitizePresignedFilename } from '../path-sanitize'

/**
 * AWS S3 storage adapter using ts-cloud S3Client
 */
export class S3StorageAdapter implements StorageAdapter {
  private client: S3Client
  private bucket: string
  private prefix: string
  private region: string

  constructor(client: S3Client, config: StorageAdapterConfig) {
    this.client = client
    this.bucket = config.bucket || ''
    this.prefix = config.prefix || ''
    this.region = config.region || 'us-east-1'

    if (!this.bucket) {
      throw new Error('S3 bucket name is required')
    }
  }

  private prefixPath(path: string): string {
    if (!this.prefix)
      return path
    return `${this.prefix}/${path}`.replace(/\/+/g, '/')
  }

  private stripPrefix(path: string): string {
    if (!this.prefix)
      return path
    const prefixWithSlash = `${this.prefix}/`
    return path.startsWith(prefixWithSlash) ? path.slice(prefixWithSlash.length) : path
  }

  private async contentsToBuffer(contents: FileContents): Promise<Buffer> {
    if (typeof contents === 'string') {
      return Buffer.from(contents, 'utf8')
    }
    else if (contents instanceof Buffer) {
      return contents
    }
    else if (contents instanceof Uint8Array) {
      return Buffer.from(contents)
    }
    else {
      // ReadableStream — narrow to web-standard before consuming so a
      // Node `stream.Readable` (no `.getReader()`) fails with a clear
      // message instead of the confusing
      // `contents.getReader is not a function` late-throw
      // (stacksjs/stacks#1873 S-15).
      const stream = contents as unknown as { getReader?: ReadableStream['getReader'] }
      if (typeof stream.getReader !== 'function') {
        throw new TypeError(
          '[storage/s3] contents must be a web-standard ReadableStream '
          + '(with .getReader()), not a Node stream.Readable. '
          + 'Convert via Readable.toWeb(nodeStream) before passing.',
        )
      }

      const reader = stream.getReader.call(contents as ReadableStream)
      const chunks: Uint8Array[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done)
          break
        if (value)
          chunks.push(value)
      }

      return Buffer.concat(chunks.map(c => Buffer.from(c)))
    }
  }

  async write(path: string, contents: FileContents): Promise<void> {
    const key = this.prefixPath(path)
    const body = await this.contentsToBuffer(contents)

    await this.client.putObject({
      bucket: this.bucket,
      key,
      body,
      contentType: this.detectMimeType(path),
    })
  }

  async read(path: string): Promise<FileContents> {
    const key = this.prefixPath(path)
    const response = await this.client.getObject(this.bucket, key)

    if (!response) {
      throw new Error(`Failed to read file: ${path}`)
    }

    // getObject returns a string
    return Buffer.from(response)
  }

  async readToString(path: string): Promise<string> {
    const key = this.prefixPath(path)
    const response = await this.client.getObject(this.bucket, key)

    if (!response) {
      throw new Error(`Failed to read file: ${path}`)
    }

    return response
  }

  async readToBuffer(path: string): Promise<Buffer> {
    const contents = await this.read(path)
    return contents as Buffer
  }

  async readToUint8Array(path: string): Promise<Uint8Array> {
    const buffer = await this.readToBuffer(path)
    return new Uint8Array(buffer)
  }

  async deleteFile(path: string): Promise<void> {
    const key = this.prefixPath(path)
    await this.client.deleteObject(this.bucket, key)
  }

  async deleteDirectory(path: string): Promise<void> {
    const prefix = this.prefixPath(path)
    const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`

    const objects = await this.client.listAllObjects({ bucket: this.bucket, prefix: normalizedPrefix })
    const keys = (objects as Array<{ Key?: string }>).map(obj => obj.Key).filter((k): k is string => typeof k === 'string')

    if (keys.length === 0) {
      return
    }

    await this.client.deleteObjects(this.bucket, keys)
  }

  async createDirectory(_path: string): Promise<void> {
    // S3 doesn't have actual directories, they're implicit
  }

  async moveFile(from: string, to: string): Promise<void> {
    await this.copyFile(from, to)
    await this.deleteFile(from)
  }

  async copyFile(from: string, to: string): Promise<void> {
    const fromKey = this.prefixPath(from)
    const toKey = this.prefixPath(to)

    await this.client.copyObject({
      sourceBucket: this.bucket,
      sourceKey: fromKey,
      destinationBucket: this.bucket,
      destinationKey: toKey,
    })
  }

  async stat(path: string): Promise<StatEntry> {
    const key = this.prefixPath(path)

    const result = await this.client.headObject(this.bucket, key)

    if (!result) {
      throw new Error(`File not found: ${path}`)
    }

    return {
      path,
      type: 'file',
      visibility: 'private' as Visibility,
      size: result.ContentLength || 0,
      lastModified: result.LastModified ? new Date(result.LastModified).getTime() : Date.now(),
      mimeType: result.ContentType,
    }
  }

  list(path: string, options: ListOptions = {}): DirectoryListing {
    return this.createAsyncIterator(path, options.deep || false)
  }

  private async *createAsyncIterator(path: string, deep: boolean): DirectoryListing {
    const prefix = this.prefixPath(path)
    const normalizedPrefix = prefix ? `${prefix}/` : undefined

    if (deep) {
      const objects = await this.client.listAllObjects({ bucket: this.bucket, prefix: normalizedPrefix })
      for (const obj of objects) {
        yield {
          path: this.stripPrefix(obj.Key),
          type: 'file',
        }
      }
    }
    else {
      let continuationToken: string | undefined

      do {
        const result = await this.client.listObjects({
          bucket: this.bucket,
          prefix: normalizedPrefix,
          continuationToken,
        })

        for (const obj of result.objects || []) {
          yield {
            path: this.stripPrefix(obj.Key),
            type: 'file',
          }
        }

        continuationToken = result.nextContinuationToken
      } while (continuationToken)
    }
  }

  /**
   * Translate the abstract "public / private" visibility into an S3
   * canned ACL via `putObjectAcl` (stacksjs/stacks#1873 S-4). Maps:
   *
   *  - public  → `'public-read'`
   *  - private → `'private'`
   *
   * **Bucket Object Ownership matters.** Modern S3 buckets default to
   * "Bucket Owner Enforced," which disables per-object ACLs entirely.
   * In that case, `putObjectAcl` returns `AccessControlListNotSupported`
   * — that's not our bug, but the error message AWS returns is opaque
   * (`"The bucket does not allow ACLs"`). Recommend bucket policies
   * + presigned URLs instead.
   *
   * Previously a silent no-op with a TODO comment, so callers thought
   * "I set the file public, why isn't it served?" was a config issue.
   */
  async changeVisibility(path: string, vis: Visibility): Promise<void> {
    const key = this.prefixPath(path)
    const acl = (vis === ('public' as Visibility)) ? 'public-read' : 'private'
    await this.client.putObjectAcl(this.bucket, key, acl)
  }

  /**
   * Read back the ACL via `getObjectAcl` and detect whether any
   * `READ` grant is targeted at the `AllUsers` group — that's the
   * canonical "public" signal in S3. Anything else (private,
   * authenticated-read, custom user grants) collapses to `'private'`
   * because the facade only models the binary public/private split.
   */
  async visibility(path: string): Promise<Visibility> {
    const key = this.prefixPath(path)
    const acl = await this.client.getObjectAcl(this.bucket, key)
    const grants = (acl as { Grants?: Array<{ Grantee?: { URI?: string }; Permission?: string }> })?.Grants ?? []
    const isPublic = grants.some(g =>
      g.Grantee?.URI === 'http://acs.amazonaws.com/groups/global/AllUsers'
      && (g.Permission === 'READ' || g.Permission === 'FULL_CONTROL'),
    )
    return (isPublic ? 'public' : 'private') as Visibility
  }

  async fileExists(path: string): Promise<boolean> {
    const key = this.prefixPath(path)
    try {
      const result = await this.client.headObject(this.bucket, key)
      return !!result
    }
    catch (error: any) {
      // Expected for non-existent files (404/NoSuchKey)
      if (!error.message?.includes('404') && !error.message?.includes('NoSuchKey') && !error.message?.includes('NotFound')) {
        console.debug(`[s3] Unexpected error checking file existence for ${path}: ${error.message}`)
      }
      return false
    }
  }

  async directoryExists(path: string): Promise<boolean> {
    const prefix = this.prefixPath(path)
    const result = await this.client.listObjects({
      bucket: this.bucket,
      prefix: `${prefix}/`,
      maxKeys: 1,
    })

    return (result.objects || []).length > 0
  }

  async publicUrl(path: string, options: PublicUrlOptions = {}): Promise<string> {
    const key = this.prefixPath(path)
    const domain = options.domain || `https://${this.bucket}.s3.${this.region}.amazonaws.com`
    return `${domain}/${key}`
  }

  async temporaryUrl(path: string, options: TemporaryUrlOptions): Promise<string> {
    const key = this.prefixPath(path)
    const expiresIn = Math.floor(normalizeExpiryToMilliseconds(options.expiresIn) / 1000)

    // S3 pre-signed URLs are clamped to [60s, 7 days]. Anything outside
    // that range is silently rejected by AWS at sign time and surfaces as
    // a 403 to the eventual viewer — better to fail loudly here so the
    // caller fixes their config.
    const MIN_EXPIRY = 60
    const MAX_EXPIRY = 7 * 24 * 60 * 60
    if (!Number.isFinite(expiresIn) || expiresIn < MIN_EXPIRY || expiresIn > MAX_EXPIRY) {
      throw new RangeError(`[storage/s3] temporaryUrl expiresIn must be between 60s and 7 days (got ${expiresIn}s)`)
    }

    return await this.client.getSignedUrl({
      bucket: this.bucket,
      key,
      expiresIn,
      operation: 'getObject',
    })
  }

  /**
   * Generate an AWS-presigned GET URL for time-limited public access
   * to a private S3 object. Wraps `temporaryUrl` so callers can use
   * the unified `signedUrl` API across drivers — for S3 the
   * implementation is identical (presigned GET), the wrapper just
   * normalizes the options shape.
   *
   * @example
   * ```ts
   * const url = await Storage.disk('s3').signedUrl('reports/2024-01.pdf', {
   *   expiresIn: 3600, // 1 hour
   * })
   * ```
   */
  async signedUrl(path: string, options: SignedUrlOptions): Promise<string> {
    return this.temporaryUrl(path, { expiresIn: options.expiresIn })
  }

  /**
   * Mint a presigned PUT URL for direct browser-to-S3 uploads
   * (stacksjs/stacks#1856 Stage 6). Pairs with the `useDirectUpload`
   * frontend composable in `defaults/functions/uploads.ts`.
   *
   * Returns `{ url, path, key, contentType, maxBytes? }`. The browser
   * PUTs the bytes to `url` with `Content-Type: contentType`; the
   * server persists `key` alongside the user record once the upload
   * resolves.
   *
   * `maxBytes` is echoed back for the client to advise on size but is
   * NOT enforced by the signed URL itself — presigned PUTs can't carry
   * a Content-Length-Range condition (that's a presigned POST policy
   * thing). For untrusted clients, scan post-upload or fall back to a
   * server-proxied multipart endpoint.
   *
   * **Content-Type is caller-attested.** AWS only checks that the
   * PUT's `Content-Type` header matches what was signed — it never
   * inspects the bytes. A hostile caller can request `image/jpeg`,
   * receive a `.jpg`-suffixed key, then PUT executable bytes. Server
   * code MUST re-verify the actual MIME after the upload completes —
   * use `verifyUploadedMime(path, contentType)` for binary formats
   * (PNG/JPEG/GIF/WebP/PDF/MP4/etc.), or parse-validate for text
   * formats. See stacksjs/stacks#1873 S-3.
   */
  async presignedUploadUrl(options: PresignedUploadUrlOptions): Promise<PresignedUploadUrl> {
    if (!options.contentType)
      throw new Error('[storage/s3] presignedUploadUrl requires `contentType` — S3 signs against the exact header.')

    const expiresIn = Math.floor(options.expiresIn)
    const MIN_EXPIRY = 60
    const MAX_EXPIRY = 7 * 24 * 60 * 60
    if (!Number.isFinite(expiresIn) || expiresIn < MIN_EXPIRY || expiresIn > MAX_EXPIRY) {
      throw new RangeError(`[storage/s3] presignedUploadUrl expiresIn must be between 60s and 7 days (got ${expiresIn}s)`)
    }

    // Sanitize caller-controlled `dir` and `filename` BEFORE concatenation
    // (stacksjs/stacks#1873 S-1, S-2). Without this:
    //   - `dir: '../../sensitive'` escapes the configured prefix because
    //     S3 keys are opaque strings — there's no filesystem `..` to
    //     resolve against, so the bad segment lands verbatim in the key.
    //   - `filename: 'foo/bar.exe'` injects a separator that flips the
    //     "filename" into a sub-path the caller doesn't own, and the
    //     `.exe` extension overrides whatever extension contentType
    //     would have produced.
    // Both throw `PathSanitizeError` (a subclass of `Error`) so callers
    // can map them to 400s; the storage layer never sees the dangerous
    // shape.
    const safeDir = sanitizePresignedDir(options.dir)
    const safeFilename = options.filename !== undefined
      ? sanitizePresignedFilename(options.filename)
      : `${crypto.randomUUID().replace(/-/g, '')}${this.extensionForContentType(options.contentType)}`
    const path = safeDir ? `${safeDir}/${safeFilename}` : safeFilename
    const key = this.prefixPath(path)

    const url = await this.client.getSignedUrl({
      bucket: this.bucket,
      key,
      expiresIn,
      operation: 'putObject',
    })

    return {
      url,
      path,
      key,
      contentType: options.contentType,
      maxBytes: options.maxBytes,
    }
  }

  /**
   * Map MIME → extension for presigned upload URL filenames. Mirrors
   * the short list in `putUploadedFile()`; kept private here so the
   * adapter stays self-contained.
   */
  private extensionForContentType(contentType: string): string {
    const mime = contentType.toLowerCase().split(';')[0]?.trim() ?? ''
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/avif': '.avif',
      'image/svg+xml': '.svg',
      'application/pdf': '.pdf',
      'application/json': '.json',
      'application/zip': '.zip',
      'text/plain': '.txt',
      'text/csv': '.csv',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
    }
    return map[mime] ?? ''
  }

  async checksum(path: string, options: ChecksumOptions = {}): Promise<string> {
    const algorithm = options.algorithm || 'sha256'
    const content = await this.readToUint8Array(path)

    const hasher = new Bun.CryptoHasher(algorithm)
    hasher.update(content)
    return hasher.digest('hex')
  }

  async mimeType(path: string, _options: MimeTypeOptions = {}): Promise<string> {
    const stats = await this.stat(path)
    return stats.mimeType || this.detectMimeType(path)
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
}

/**
 * Create an S3 storage adapter instance
 */
export function createS3Storage(client: S3Client, config: StorageAdapterConfig): S3StorageAdapter {
  return new S3StorageAdapter(client, config)
}
