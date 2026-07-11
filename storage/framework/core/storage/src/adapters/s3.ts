import { Buffer } from 'node:buffer'
import { basename } from 'node:path'
import type { S3Client } from '@stacksjs/ts-cloud'
import type {
  ChecksumOptions,
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
  StorageAdapterConfig,
  TemporaryUrlOptions,
  Visibility,
} from '../types'
import { normalizeExpiryToMilliseconds } from '../types'
import { sanitizePresignedDir, sanitizePresignedFilename } from '../path-sanitize'
import { signS3PresignedPost } from '../s3-presigned-post'
import process from 'node:process'

const S3_MIN_PART_SIZE = 5 * 1024 * 1024
const S3_MAX_PART_SIZE = 5 * 1024 * 1024 * 1024

function clampPartSize(requested: number): number {
  if (!Number.isFinite(requested)) return S3_MIN_PART_SIZE
  return Math.max(S3_MIN_PART_SIZE, Math.min(Math.floor(requested), S3_MAX_PART_SIZE))
}

/**
 * Append-and-take byte buffer used by the multipart pipeline
 * (stacksjs/stacks#1886). Holds incoming chunks until they reach
 * the configured part size, then yields them as a single Uint8Array
 * via `take(n)` or `flush()`.
 */
class ChunkBuffer {
  private chunks: Uint8Array[] = []
  private total = 0
  constructor(_partSize: number) { /* size is advisory; the buffer grows as needed */ }
  get length(): number { return this.total }
  push(c: Uint8Array): void { this.chunks.push(c); this.total += c.length }
  take(n: number): Uint8Array {
    const out = new Uint8Array(n)
    let written = 0
    while (written < n && this.chunks.length > 0) {
      const head = this.chunks[0]!
      const need = n - written
      if (head.length <= need) {
        out.set(head, written)
        written += head.length
        this.chunks.shift()
      }
      else {
        out.set(head.subarray(0, need), written)
        this.chunks[0] = head.subarray(need)
        written += need
      }
    }
    this.total -= n
    return out
  }
  flush(): Uint8Array {
    const out = new Uint8Array(this.total)
    let off = 0
    for (const c of this.chunks) { out.set(c, off); off += c.length }
    this.chunks = []
    this.total = 0
    return out
  }
}

/**
 * Has the promise already settled (either resolved or rejected)?
 * Used by the multipart pipeline to prune the `inflight` array
 * after `Promise.race` so it doesn't grow unbounded across the
 * upload's lifetime.
 */
async function isSettled(p: Promise<unknown>): Promise<boolean> {
  const sentinel = Symbol('pending')
  const result = await Promise.race([
    p.then(() => 'settled' as const, () => 'settled' as const),
    Promise.resolve(sentinel),
  ])
  return result !== sentinel
}

/**
 * AWS S3 storage adapter using ts-cloud S3Client
 */
export class S3StorageAdapter implements StorageAdapter {
  private _client: S3Client | null
  private _clientPromise: Promise<S3Client> | null = null
  private bucket: string
  private prefix: string
  private region: string
  /**
   * Caller-supplied credentials, kept so we can issue presigned POST
   * policies (which need access to the signing key — ts-cloud's
   * S3Client doesn't expose its own credentials via a public method).
   * When omitted at construction time, falls back to env vars at
   * sign time. See stacksjs/stacks#1888 Phase B.
   */
  private credentials?: StorageAdapterConfig['credentials']

  // Accepts a pre-built client (back-compat) or `null` to build one lazily
  // from `config.region` on first use. The lazy path keeps `@stacksjs/ts-cloud`
  // (and its AWS-shaped client) off the eager import graph of
  // `@stacksjs/storage`, which sits on the dev-server boot critical path.
  constructor(client: S3Client | null, config: StorageAdapterConfig) {
    this._client = client
    this.bucket = config.bucket || ''
    this.prefix = config.prefix || ''
    this.region = config.region || 'us-east-1'
    this.credentials = config.credentials

    if (!this.bucket) {
      throw new Error('S3 bucket name is required')
    }
  }

  private async getClient(): Promise<S3Client> {
    if (this._client)
      return this._client
    if (!this._clientPromise) {
      this._clientPromise = import('@stacksjs/ts-cloud').then((cloud) => {
        this._client = new cloud.S3Client(this.region)
        return this._client
      })
    }
    return this._clientPromise
  }

  /**
   * Resolve credentials for SigV4 signing in the same order ts-cloud
   * does: explicit constructor config → env vars. Throws when neither
   * source supplies a key (the alternative would be silently signing
   * with an empty key and producing a URL S3 rejects).
   */
  private resolveCredentials(): NonNullable<StorageAdapterConfig['credentials']> {
    if (this.credentials?.accessKeyId && this.credentials.secretAccessKey)
      return this.credentials
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
    const sessionToken = process.env.AWS_SESSION_TOKEN
    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        '[storage/s3] presignedUploadPolicy requires AWS credentials — '
        + 'pass them via S3DiskConfig.credentials or set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY.',
      )
    }
    return { accessKeyId, secretAccessKey, sessionToken }
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

      const reader = (contents as ReadableStream<Uint8Array>).getReader()
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

  async write(path: string, contents: FileContents): Promise<PutResult> {
    const key = this.prefixPath(path)
    const body = await this.contentsToBuffer(contents)
    const contentType = this.detectMimeType(path)

    // ts-cloud's putObject returns void today (the upstream SDK
    // surface doesn't expose the PutObject response shape yet).
    // We still report what we can compute locally — size + the
    // contentType we sent — and synthesize lastModified from wall
    // clock. ETag stays omitted until ts-cloud exposes the response.
    await (await this.getClient()).putObject({
      bucket: this.bucket,
      key,
      body,
      contentType,
    })

    return {
      path,
      size: body.length,
      contentType,
      lastModified: Date.now(),
    }
  }

  async read(path: string): Promise<FileContents> {
    const key = this.prefixPath(path)
    const response = await (await this.getClient()).getObject(this.bucket, key)

    if (!response) {
      throw new Error(`Failed to read file: ${path}`)
    }

    // getObject returns a string
    return Buffer.from(response)
  }

  /**
   * Read an S3 object as a stream (stacksjs/stacks#1886).
   *
   * **Today**: ts-cloud's `getObjectBuffer` returns the full body
   * as a single Buffer; we wrap that as a one-chunk
   * `ReadableStream<Uint8Array>` so the interface is uniform
   * across adapters. Memory budget is the full object size.
   *
   * **Tomorrow**: when ts-cloud exposes a true chunked-read API
   * (or we direct-import the AWS SDK's GetObject stream), this
   * implementation swaps to true chunked streaming without
   * changing the caller signature.
   */
  async getStream(path: string, _options?: GetStreamOptions): Promise<ReadableStream<Uint8Array>> {
    const key = this.prefixPath(path)
    const buf = await (await this.getClient()).getObjectBuffer(this.bucket, key)
    if (!buf) throw new Error(`Failed to read file: ${path}`)
    const bytes = new Uint8Array(buf)
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      },
    })
  }

  /**
   * Stream an upload to S3 with automatic single-PUT vs multipart
   * selection (stacksjs/stacks#1886). Small streams (≤ part size)
   * are buffered + sent via `putObject`; larger streams go through
   * the CreateMultipartUpload → UploadPart × N →
   * CompleteMultipartUpload pipeline so files up to 5 TB work.
   *
   * Part size defaults to 5 MiB (S3's minimum part size); cap at
   * 5 GiB. Concurrency defaults to 4 parts uploading in parallel.
   * Failed parts retry up to 3 times before the whole upload
   * aborts via `AbortMultipartUpload` so partial-upload
   * artifacts don't accrue storage charges.
   */
  async putStream(path: string, stream: ReadableStream<Uint8Array>, options?: PutStreamOptions): Promise<PutResult> {
    const key = this.prefixPath(path)
    const contentType = options?.contentType ?? this.detectMimeType(path)
    const partSize = clampPartSize(options?.partSize ?? 5 * 1024 * 1024)
    const concurrency = Math.max(1, Math.min(options?.concurrency ?? 4, 100))
    const maxRetries = Math.max(0, options?.maxRetries ?? 3)
    const signal = options?.signal

    // Read enough to decide: small body (single PUT) or large (multipart).
    // We buffer up to one part's worth before committing — if the stream
    // closes within that window we avoid the multipart overhead.
    const reader = stream.getReader()
    let firstChunk: Uint8Array | null = null
    let firstDone = false
    {
      const buf = new ChunkBuffer(partSize)
      while (!firstDone && buf.length < partSize) {
        if (signal?.aborted) {
          try { reader.releaseLock() } catch { /* ignore */ }
          throw new Error('aborted')
        }
        const { value, done } = await reader.read()
        if (done) { firstDone = true; break }
        if (value) buf.push(value)
      }
      firstChunk = buf.flush()
    }

    // Single-PUT path: stream fit inside one part.
    if (firstDone) {
      try { reader.releaseLock() } catch { /* ignore */ }
      await (await this.getClient()).putObject({
        bucket: this.bucket,
        key,
        body: Buffer.from(firstChunk!),
        contentType,
      })
      return { path, size: firstChunk!.length, contentType, lastModified: Date.now() }
    }

    // Multipart path. Initiate, upload-with-bounded-concurrency,
    // complete. On any failure (including abort) we MUST issue
    // AbortMultipartUpload so the partial parts don't accrue
    // storage charges.
    const { UploadId: uploadId } = await (await this.getClient()).createMultipartUpload(this.bucket, key, { contentType })
    const completedParts: Array<{ PartNumber: number, ETag: string }> = []
    let totalBytes = 0
    let partNumber = 1
    const inflight: Array<Promise<void>> = []

    const uploadOne = async (body: Uint8Array, n: number): Promise<void> => {
      let attempt = 0
      while (true) {
        if (signal?.aborted) throw new Error('aborted')
        try {
          const { ETag } = await (await this.getClient()).uploadPart(this.bucket, key, uploadId, n, Buffer.from(body))
          completedParts.push({ PartNumber: n, ETag })
          totalBytes += body.length
          return
        }
        catch (err) {
          if (attempt >= maxRetries) throw err
          attempt += 1
        }
      }
    }

    try {
      // Submit the first chunk (already buffered).
      inflight.push(uploadOne(firstChunk!, partNumber++))
      firstChunk = null

      // Stream the rest, buffering to partSize before each upload.
      const buf = new ChunkBuffer(partSize)
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (signal?.aborted) throw new Error('aborted')
        const { value, done } = await reader.read()
        if (done) break
        if (value) buf.push(value)
        while (buf.length >= partSize) {
          const part = buf.take(partSize)
          // Bound concurrency: wait for the oldest in-flight task
          // when at capacity before queuing the next.
          if (inflight.length >= concurrency) {
            await Promise.race(inflight.map((p, i) => p.then(() => i)))
            for (let i = inflight.length - 1; i >= 0; i--) {
              if (await isSettled(inflight[i]!)) inflight.splice(i, 1)
            }
          }
          inflight.push(uploadOne(part, partNumber++))
        }
      }
      try { reader.releaseLock() } catch { /* ignore */ }

      // Drain any trailing bytes < partSize as the final part.
      const tail = buf.flush()
      if (tail.length > 0) inflight.push(uploadOne(tail, partNumber++))

      await Promise.all(inflight)
      completedParts.sort((a, b) => a.PartNumber - b.PartNumber)
      await (await this.getClient()).completeMultipartUpload(this.bucket, key, uploadId, completedParts)
      return { path, size: totalBytes, contentType, lastModified: Date.now() }
    }
    catch (err) {
      // Best-effort abort. The error from abortMultipartUpload is
      // swallowed because the original error is more useful to
      // the caller.
      try { await (await this.getClient()).abortMultipartUpload(this.bucket, key, uploadId) }
      catch { /* best-effort */ }
      throw err
    }
  }

  async readToString(path: string): Promise<string> {
    const key = this.prefixPath(path)
    const response = await (await this.getClient()).getObject(this.bucket, key)

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
    await (await this.getClient()).deleteObject(this.bucket, key)
  }

  async deleteDirectory(path: string): Promise<void> {
    const prefix = this.prefixPath(path)
    const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`

    const objects = await (await this.getClient()).listAllObjects({ bucket: this.bucket, prefix: normalizedPrefix })
    const keys = (objects as Array<{ Key?: string }>).map(obj => obj.Key).filter((k): k is string => typeof k === 'string')

    if (keys.length === 0) {
      return
    }

    await (await this.getClient()).deleteObjects(this.bucket, keys)
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

    await (await this.getClient()).copyObject({
      sourceBucket: this.bucket,
      sourceKey: fromKey,
      destinationBucket: this.bucket,
      destinationKey: toKey,
    })
  }

  async stat(path: string): Promise<StatEntry> {
    const key = this.prefixPath(path)

    const result = await (await this.getClient()).headObject(this.bucket, key)

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
      const objects = await (await this.getClient()).listAllObjects({ bucket: this.bucket, prefix: normalizedPrefix })
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
        const result = await (await this.getClient()).listObjects({
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
    await (await this.getClient()).putObjectAcl(this.bucket, key, acl)
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
    const acl = await (await this.getClient()).getObjectAcl(this.bucket, key)
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
      const result = await (await this.getClient()).headObject(this.bucket, key)
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
    const result = await (await this.getClient()).listObjects({
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

    return await (await this.getClient()).getSignedUrl({
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

    const url = await (await this.getClient()).getSignedUrl({
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
   * Mint an S3 presigned-POST policy with server-side enforced
   * `Content-Length-Range` (stacksjs/stacks#1888 Phase B). The
   * companion to {@link presignedUploadUrl} — use this when you
   * genuinely need a max-size cap against an untrusted client,
   * since the PUT-form URL can't carry that condition.
   *
   * Browser-side: submit a multipart form to `url` with every
   * `fields` entry as a form field, then the file LAST under the
   * field name `'file'`. S3 rejects anything that violates the
   * embedded conditions before storing.
   *
   * @example
   * ```ts
   * const policy = await Storage.disk('s3').presignedUploadPolicy?.({
   *   key: { startsWith: 'avatars/' },
   *   contentType: { startsWith: 'image/' },
   *   contentLengthRange: { min: 0, max: 5 * 1024 * 1024 },
   *   expiresIn: 3600,
   * })
   * ```
   */
  async presignedUploadPolicy(options: PresignedUploadPolicyOptions): Promise<PresignedUploadPolicy> {
    const credentials = this.resolveCredentials()

    // Prefix the bucket prefix onto the policy's key so the upload
    // lands in the same namespace `put()` writes to. Both exact-key
    // and prefix forms get the same treatment.
    const scopedKey = typeof options.key === 'string'
      ? this.prefixPath(options.key)
      : { startsWith: this.prefixPath(options.key.startsWith) }

    return signS3PresignedPost({
      bucket: this.bucket,
      region: this.region,
      credentials,
      key: scopedKey,
      contentType: options.contentType,
      contentLengthRange: options.contentLengthRange,
      acl: options.acl,
      expiresIn: options.expiresIn,
      fields: options.fields,
    })
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
export function createS3Storage(client: S3Client | null, config: StorageAdapterConfig): S3StorageAdapter {
  return new S3StorageAdapter(client, config)
}
