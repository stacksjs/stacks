import type { Buffer } from 'node:buffer'
import type { ReadableStream } from 'node:stream/web'

/**
 * File contents can be a string, Buffer, Uint8Array, or ReadableStream
 */
export type FileContents = string | Buffer | Uint8Array | ReadableStream

/**
 * Visibility options for files
 */
export enum Visibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

/**
 * File stat entry information
 */
export interface StatEntry {
  /** File path */
  path: string
  /** File type: 'file' or 'directory' */
  type: 'file' | 'directory'
  /** File visibility */
  visibility: Visibility
  /** File size in bytes */
  size: number
  /** Last modified timestamp in milliseconds */
  lastModified: number
  /** MIME type (if available) */
  mimeType?: string
  /** Additional metadata */
  metadata?: Record<string, any>
}

/**
 * Options for `Storage.getStream(path, options?)`
 * (stacksjs/stacks#1886).
 */
export interface GetStreamOptions {
  /** Abort signal — cancels the read mid-stream. */
  signal?: AbortSignal
}

/**
 * Options for `Storage.putStream(path, stream, options?)`
 * (stacksjs/stacks#1886). All fields are optional; the S3 driver
 * reads them to tune its multipart pipeline, other drivers
 * generally only honor `contentType` and `signal`.
 */
export interface PutStreamOptions {
  /**
   * MIME type to record on the upload. Drivers that auto-detect
   * from the path extension still use that as the default; this
   * field overrides.
   */
  contentType?: string
  /**
   * Abort the upload mid-flight. On S3 this triggers
   * AbortMultipartUpload so partial uploads don't accrue storage
   * charges.
   */
  signal?: AbortSignal
  /**
   * S3 multipart part size in bytes. Default 5 MiB (S3's minimum
   * part size except for the final part). Larger values reduce
   * the per-part overhead at the cost of more buffered memory
   * per concurrent upload. Capped at 5 GiB per S3's max part
   * size.
   */
  partSize?: number
  /**
   * S3 multipart upload concurrency — how many parts to upload
   * in parallel. Default 4. Higher values increase throughput on
   * fast networks but use more memory (`concurrency * partSize`
   * peak).
   */
  concurrency?: number
  /**
   * S3 multipart per-part retry attempts before aborting the
   * whole upload. Default 3.
   */
  maxRetries?: number
}

/**
 * Result returned from `Storage.put()` (stacksjs/stacks#1888 S-8).
 *
 * Pre-fix `put()` returned `Promise<void>` — callers that wanted to
 * record an etag for cache-invalidation or a size for storage-quota
 * accounting had to issue a second `.stat()` round-trip. This shape
 * carries the metadata back from the write itself.
 *
 * Fields beyond `path` are best-effort: drivers that don't expose
 * (or can't cheaply compute) a value omit it rather than synthesizing
 * a fake one. Callers should treat them as nullable.
 */
export interface PutResult {
  /** Storage-relative path the file was written to. */
  path: string
  /** Bytes written. */
  size: number
  /** MIME type recorded for the write (driver-detected or caller-supplied). */
  contentType?: string
  /**
   * Last-modified timestamp the driver reports for the written object,
   * in milliseconds since epoch. Useful for cache-control headers and
   * change detection without a follow-up `stat()`.
   */
  lastModified?: number
  /**
   * Driver-reported strong-validator (S3 ETag, content hash, etc.).
   * Use for HTTP `If-None-Match` / `If-Match` conditional requests.
   * Omitted by drivers that don't compute one.
   */
  etag?: string
}

/**
 * Directory listing entry
 */
export interface DirectoryEntry {
  path: string
  type: 'file' | 'directory'
}

/**
 * Directory listing iterator
 */
export interface DirectoryListing extends AsyncIterable<DirectoryEntry> {
  [Symbol.asyncIterator](): AsyncIterator<DirectoryEntry>
}

/**
 * Options for listing directories
 */
export interface ListOptions {
  /** Whether to list recursively */
  deep?: boolean
}

/**
 * Options for generating public URLs
 */
export interface PublicUrlOptions {
  /** Custom domain for the URL */
  domain?: string
}

/**
 * Options for generating temporary URLs
 */
export interface TemporaryUrlOptions {
  /** Expiry time in seconds or a Date object */
  expiresIn: number | Date
}

/**
 * Options for generating signed (JWT-style) URLs.
 *
 * Distinct from `TemporaryUrlOptions` so adapters that don't natively
 * support the richer claims set (in-memory mocks) can throw a clear
 * "unsupported" error rather than silently returning a useless URL.
 */
export interface SignedUrlOptions {
  /** Expiry time in seconds (relative to now) or an absolute Date. */
  expiresIn: number | Date
  /**
   * Optional issuer claim. Defaults to `'stacks'`. Mostly useful when
   * multiple Stacks deployments share the same `APP_KEY` (e.g. blue/green
   * cutovers) and need to disambiguate which one issued a token.
   */
  issuer?: string
  /**
   * Optional override for the URL host/origin. Falls back to
   * `process.env.APP_URL` when omitted.
   */
  baseUrl?: string
}

/**
 * Options for `presignedUploadPolicy()` — the POST-form upload
 * primitive that S3 can enforce server-side (stacksjs/stacks#1888
 * Phase B). Distinct from {@link PresignedUploadUrlOptions} (PUT-
 * form): the POST policy carries a `Content-Length-Range` condition
 * that S3 enforces server-side, so this is the right primitive when
 * you genuinely need a size cap against an untrusted client.
 */
export interface PresignedUploadPolicyOptions {
  /**
   * Either an exact key the upload must land at, or a `{ startsWith
   * }` prefix when the client picks the final suffix.
   */
  key: string | { startsWith: string }
  /**
   * Required Content-Type the upload must submit. Pass an exact
   * string OR `{ startsWith: 'image/' }` for prefix-matching.
   */
  contentType: string | { startsWith: string }
  /**
   * S3-enforced size range in bytes. The whole reason to use POST-
   * form over PUT-form is that S3 actually rejects uploads outside
   * this range — no post-upload cleanup required.
   */
  contentLengthRange?: { min: number, max: number }
  /** ACL on the resulting object. Default `'private'`. */
  acl?: 'private' | 'public-read' | 'public-read-write' | 'authenticated-read' | 'bucket-owner-read' | 'bucket-owner-full-control'
  /** Policy expiry in seconds. Clamped to [60, 7 * 24 * 60 * 60]. */
  expiresIn: number
  /**
   * Extra strict-equality conditions to embed in the policy AND
   * include in the returned `fields` map.
   */
  fields?: Record<string, string>
}

/**
 * What the caller hands to the browser. Submit as
 * `multipart/form-data` to `url` with every entry of `fields` as a
 * form field, then the actual file LAST under the field name
 * `'file'`. `key` is what the upload will land at — store on the
 * domain record.
 */
export interface PresignedUploadPolicy {
  url: string
  fields: Record<string, string>
  key: string
}

/**
 * Options for `presignedUploadUrl()` (stacksjs/stacks#1856 Stage 6).
 */
export interface PresignedUploadUrlOptions {
  /**
   * MIME type the browser will send as `Content-Type` on the PUT.
   * AWS signs the request against this exact string — any mismatch on
   * upload returns 403. Required so the signed URL is unambiguous.
   */
  contentType: string

  /**
   * URL lifetime in seconds. S3 clamps to [60, 7 * 24 * 60 * 60] —
   * shorter is better for security since a leaked URL is a
   * write-anywhere primitive until it expires.
   */
  expiresIn: number

  /**
   * Sub-directory inside the disk (e.g. `'avatars'`). The adapter
   * appends the filename to this.
   */
  dir?: string

  /**
   * Optional explicit filename. When omitted, the adapter generates a
   * uuid-based name and derives an extension from `contentType`.
   * Mirrors the filename derivation in `Storage.put(file, opts)`.
   */
  filename?: string

  /**
   * Maximum size in bytes the eventual upload should be.
   *
   * **⚠ ADVISORY ONLY — NOT SERVER-SIDE ENFORCED.** S3's presigned
   * PUT (the API this method generates) cannot carry a
   * `Content-Length-Range` constraint. Only S3's presigned POST
   * policy form can enforce server-side size limits.
   *
   * What this field actually does:
   *   1. Client-side composables (`useDirectUpload`) read it and
   *      reject the file before kicking off the PUT.
   *   2. The framework echoes it back on the returned
   *      {@link PresignedUploadUrl} so callers can record it for
   *      later post-upload verification.
   *
   * What this field does NOT do:
   *   - Stop an attacker who crafts their own PUT with a larger
   *     body. They will succeed and your bucket will accept the
   *     oversized file.
   *
   * For real size enforcement against untrusted clients, do one
   * of:
   *   - Run a server-side `HEAD` after upload and delete oversized
   *     objects (most common pattern; cheap because S3 charges by
   *     storage, not by short-lived blobs)
   *   - Switch to presigned POST policies (tracked separately —
   *     see stacksjs/stacks#1873 S-12 follow-up)
   *   - Front the bucket with a server endpoint that proxies the
   *     upload and counts bytes
   *
   * Audit context: stacksjs/stacks#1873 S-12.
   */
  maxBytes?: number
}

export interface PresignedUploadUrl {
  /** The presigned URL the browser PUTs to. */
  url: string
  /** Storage path the file lands at (without the disk root prefix). */
  path: string
  /** Stable key suitable for persisting alongside user records. */
  key: string
  /** Echoed back for the client to use as the `Content-Type` header. */
  contentType: string
  /** Echoed back so the client can advise on size before uploading. */
  maxBytes?: number
}

/**
 * Checksum algorithm options
 */
export interface ChecksumOptions {
  /** Algorithm to use: 'md5', 'sha1', 'sha256' */
  algorithm?: 'md5' | 'sha1' | 'sha256'
}

/**
 * MIME type detection options
 */
export interface MimeTypeOptions {
  /** Whether to use file extension for detection */
  useExtension?: boolean
}

/**
 * Storage adapter configuration
 */
export interface StorageAdapterConfig {
  /** Root directory for local storage */
  root?: string
  /** S3 bucket name */
  bucket?: string
  /** S3 region */
  region?: string
  /** S3 key prefix */
  prefix?: string
  /**
   * AWS credentials. When omitted the adapter falls back to the
   * standard env vars (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
   * `AWS_SESSION_TOKEN`) — same source as the S3Client itself.
   */
  credentials?: {
    accessKeyId: string
    secretAccessKey: string
    sessionToken?: string
  }
}

/**
 * Base storage adapter interface
 */
export interface StorageAdapter {
  /**
   * Write file contents. Returns a {@link PutResult} carrying the
   * size + driver-reported metadata so callers don't need a follow-up
   * `stat()` to record an etag / size against their domain models
   * (stacksjs/stacks#1888 S-8).
   *
   * Drivers that can't cheaply produce a value omit it rather than
   * synthesizing one — callers should treat the optional fields as
   * nullable.
   */
  write(path: string, contents: FileContents): Promise<PutResult>

  /** Read file contents */
  read(path: string): Promise<FileContents>

  /** Read file as string */
  readToString(path: string): Promise<string>

  /** Read file as Buffer */
  readToBuffer(path: string): Promise<Buffer>

  /** Read file as Uint8Array */
  readToUint8Array(path: string): Promise<Uint8Array>

  /** Delete a file */
  deleteFile(path: string): Promise<void>

  /** Delete a directory */
  deleteDirectory(path: string): Promise<void>

  /** Create a directory */
  createDirectory(path: string): Promise<void>

  /** Move a file */
  moveFile(from: string, to: string): Promise<void>

  /** Copy a file */
  copyFile(from: string, to: string): Promise<void>

  /** Get file statistics */
  stat(path: string): Promise<StatEntry>

  /** List directory contents */
  list(path: string, options?: ListOptions): DirectoryListing

  /** Change file visibility */
  changeVisibility(path: string, visibility: Visibility): Promise<void>

  /** Get file visibility */
  visibility(path: string): Promise<Visibility>

  /** Check if file exists */
  fileExists(path: string): Promise<boolean>

  /** Check if directory exists */
  directoryExists(path: string): Promise<boolean>

  /** Generate public URL */
  publicUrl(path: string, options?: PublicUrlOptions): Promise<string>

  /** Generate temporary URL */
  temporaryUrl(path: string, options: TemporaryUrlOptions): Promise<string>

  /**
   * Generate a signed URL granting time-limited GET access to a
   * private file. Adapters that can't produce a usable URL (in-memory
   * mocks, etc.) MUST throw — silent fall-through to an unsigned or
   * unusable URL would be a security footgun.
   */
  signedUrl?(path: string, options: SignedUrlOptions): Promise<string>

  /**
   * Generate a presigned URL for direct browser-to-cloud upload
   * (stacksjs/stacks#1856 Stage 6). Pairs with the
   * `useDirectUpload({ presignEndpoint })` frontend composable: the
   * server mints a URL, the browser PUTs the file bytes straight to
   * the storage backend without round-tripping through the app server.
   *
   * Optional because not every adapter can produce one — local-disk
   * uploads don't need this primitive, and in-memory mocks can't
   * service the URL. Implementing adapters MUST honour `contentType`
   * (the browser uses it as the `Content-Type` header on the PUT) and
   * MUST clamp `expiresIn` to a sane range. The returned `path` is
   * what the caller should persist; `url` is for the browser.
   */
  presignedUploadUrl?(options: PresignedUploadUrlOptions): Promise<PresignedUploadUrl>

  /**
   * Generate a presigned POST policy for direct browser-to-cloud
   * upload with server-side size enforcement (stacksjs/stacks#1888
   * Phase B). Distinct from {@link presignedUploadUrl}: the POST
   * policy embeds a `Content-Length-Range` condition that S3
   * actually enforces — uploads outside the range are rejected
   * before any bytes hit storage.
   *
   * S3-only today; local / memory / bun adapters don't need this
   * primitive (they don't expose a public POST endpoint). Callers
   * fall back to `presignedUploadUrl` when the disk doesn't support
   * POST policies.
   */
  presignedUploadPolicy?(options: PresignedUploadPolicyOptions): Promise<PresignedUploadPolicy>

  /**
   * Read a file as a web-standard `ReadableStream<Uint8Array>`
   * (stacksjs/stacks#1886). Use this for files that don't fit in
   * memory — the alternative `read()` / `readToBuffer()` methods
   * load the full contents up front.
   *
   * Drivers that genuinely can't stream (memory-only mocks) emit
   * a single chunk via `new Response(buf).body` rather than
   * advertising real streaming they can't deliver — the
   * abstraction still works, but callers shouldn't expect
   * partial-read behavior from those drivers.
   */
  getStream?(path: string, options?: GetStreamOptions): Promise<ReadableStream<Uint8Array>>

  /**
   * Write a web-standard `ReadableStream<Uint8Array>` to the
   * adapter (stacksjs/stacks#1886). Returns the same
   * {@link PutResult} shape as `write()` — size is reported as
   * the byte count consumed from the stream.
   *
   * On S3, streams larger than the configured part size
   * automatically use multipart upload (CreateMultipartUpload →
   * UploadPart × N → CompleteMultipartUpload) so files up to 5TB
   * are supported. Smaller streams use a single putObject for
   * lower overhead.
   *
   * `options.signal` aborts the upload — on S3 that means
   * issuing AbortMultipartUpload so partial uploads don't accrue
   * billable storage.
   */
  putStream?(path: string, stream: ReadableStream<Uint8Array>, options?: PutStreamOptions): Promise<PutResult>

  /** Calculate file checksum */
  checksum(path: string, options?: ChecksumOptions): Promise<string>

  /** Get MIME type */
  mimeType(path: string, options?: MimeTypeOptions): Promise<string>

  /** Get last modified timestamp */
  lastModified(path: string): Promise<number>

  /** Get file size */
  fileSize(path: string): Promise<number>
}

/**
 * Helper to create async iterable from array
 */
export async function* createDirectoryListing(entries: DirectoryEntry[]): DirectoryListing {
  for (const entry of entries) {
    yield entry
  }
}

/**
 * Convert expiry to milliseconds
 */
export function normalizeExpiryToMilliseconds(expiry: number | Date): number {
  if (expiry instanceof Date) {
    return expiry.getTime() - Date.now()
  }
  return expiry * 1000
}

/**
 * Convert expiry to Date
 */
export function normalizeExpiryToDate(expiry: number | Date): Date {
  if (expiry instanceof Date) {
    return expiry
  }
  return new Date(Date.now() + expiry * 1000)
}

/**
 * Check if entry is a file
 */
export function isFile(entry: DirectoryEntry | StatEntry): boolean {
  return entry.type === 'file'
}

/**
 * Check if entry is a directory
 */
export function isDirectory(entry: DirectoryEntry | StatEntry): boolean {
  return entry.type === 'directory'
}
