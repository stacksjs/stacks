import type {
  ChecksumOptions,
  DirectoryListing,
  FileContents,
  GetStreamOptions,
  ListOptions,
  MimeTypeOptions,
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
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { REST_VERSION, serviceSasQuery, sharedKeyAuthorization } from '../azure-signing'
import { extensionForContentType, mimeFromExtension } from '../mime-from-extension'
import { sanitizePresignedDir, sanitizePresignedFilename } from '../path-sanitize'
import { normalizeExpiryToMilliseconds } from '../types'

/**
 * Azure Blob Storage adapter (stacksjs/stacks#1896).
 *
 * The third of the three drivers that issue asked for, and the only one that
 * needed a driver at all: R2, GCS, Filebase, Backblaze, Hetzner and MinIO are
 * all S3-compatible and reuse `S3StorageAdapter` behind a different endpoint
 * (see `r2Disk`, `gcsDisk` and friends in `types/filesystem.ts`). Azure has its
 * own REST surface, so this speaks it directly - Shared Key authorization for
 * server-side calls, service SAS for signed URLs, both from `azure-signing.ts`.
 *
 * Three things behave differently from S3, and none of them can be papered
 * over, so they are named here rather than discovered at runtime:
 *
 * 1. **Visibility is a property of the container, not the blob.** Azure has no
 *    per-object ACL. `changeVisibility` therefore refuses rather than silently
 *    doing nothing, and `visibility()` reports the container's public-access
 *    level, which is the honest answer for every blob in it.
 * 2. **There are no directories.** Same as S3: a "folder" is a name prefix, so
 *    `createDirectory` is a no-op and `deleteDirectory` deletes by prefix.
 * 3. **A block blob is capped at 50,000 blocks.** Anything over the single-PUT
 *    limit goes through Put Block / Put Block List, which is what `putStream`
 *    does; with the default 4 MiB block that reaches ~190 GiB.
 */
export interface AzureStorageAdapterConfig {
  /** Storage account name, e.g. `mystorageaccount`. */
  account: string
  /**
   * Account key, base64 as the portal presents it.
   *
   * Optional only when `sasToken` is supplied: without either, there is nothing
   * to authorize a request with, and the adapter says so at construction rather
   * than failing on the first call.
   */
  accountKey?: string
  /**
   * A pre-minted SAS token to authorize with instead of an account key,
   * with or without its leading `?`.
   *
   * Signed URLs are unavailable on this path - minting a SAS requires the
   * account key - so `signedUrl` and `temporaryUrl` refuse rather than handing
   * back a URL carrying the caller's own token, which would grant whatever that
   * token grants, to whoever the URL reaches.
   */
  sasToken?: string
  /** Blob container the disk is rooted at. */
  container: string
  /** Name prefix applied to every path, so one container can hold several disks. */
  prefix?: string
  /**
   * Public base URL for {@link AzureBlobStorageAdapter.publicUrl} - a CDN or a
   * custom domain mapped to the container. Defaults to the account's blob
   * endpoint, which is correct when the container allows public access.
   */
  url?: string
  /**
   * Blob service endpoint, for Azurite or a sovereign cloud. Defaults to
   * `https://<account>.blob.core.windows.net`.
   *
   * Azurite's endpoint carries the account in its path
   * (`http://127.0.0.1:10000/devstoreaccount1`), which is exactly what this
   * option is for.
   */
  endpoint?: string
}

/** Azure's cap on a single Put Blob request. Larger uploads must be blocked. */
const MAX_SINGLE_PUT_BYTES = 256 * 1024 * 1024

/** Default block size for a blocked upload. Azure's own maximum is 4000 MiB. */
const DEFAULT_BLOCK_BYTES = 4 * 1024 * 1024

/** Azure's cap on the number of blocks in one block blob. */
const MAX_BLOCKS = 50_000

/** Service SAS lifetimes Azure accepts, matching the bounds the S3 adapter enforces. */
const MIN_EXPIRY_SECONDS = 60
const MAX_EXPIRY_SECONDS = 7 * 24 * 60 * 60

interface AzureResponse {
  status: number
  headers: Headers
  body: ArrayBuffer
}

export class AzureBlobStorageAdapter implements StorageAdapter {
  private account: string
  private accountKey?: string
  private sasToken?: string
  private container: string
  private prefix: string
  private endpoint: string
  private publicBaseUrl?: string

  constructor(config: AzureStorageAdapterConfig) {
    if (!config.account)
      throw new Error('[storage/azure] a storage account name is required')
    if (!config.container)
      throw new Error('[storage/azure] a container name is required')
    if (!config.accountKey && !config.sasToken) {
      throw new Error(
        '[storage/azure] one of `accountKey` or `sasToken` is required - '
        + 'there is no anonymous write path, and a read-only disk still has to authorize its reads.',
      )
    }

    this.account = config.account
    this.accountKey = config.accountKey
    this.sasToken = config.sasToken?.replace(/^\?/, '')
    this.container = config.container
    this.prefix = config.prefix?.replace(/^\/+|\/+$/g, '') ?? ''
    this.endpoint = (config.endpoint ?? `https://${config.account}.blob.core.windows.net`).replace(/\/+$/, '')
    this.publicBaseUrl = config.url?.replace(/\/+$/, '')
  }

  // ===========================================================================
  // Request plumbing
  // ===========================================================================

  private blobName(path: string): string {
    const clean = path.replace(/^\/+/, '')
    return this.prefix ? `${this.prefix}/${clean}`.replace(/\/{2,}/g, '/') : clean
  }

  private stripPrefix(blob: string): string {
    if (!this.prefix)
      return blob
    const withSlash = `${this.prefix}/`
    return blob.startsWith(withSlash) ? blob.slice(withSlash.length) : blob
  }

  /**
   * The URL for a blob or for the container itself.
   *
   * Each path segment is encoded separately: `encodeURIComponent` on the whole
   * name would escape the slashes that make a blob look like it is in a folder,
   * and Azure would then hold one blob literally named `a%2Fb.txt`.
   */
  private blobUrl(blob?: string, query: Record<string, string> = {}): URL {
    const segments = blob ? blob.split('/').map(encodeURIComponent).join('/') : ''
    const url = new URL(`${this.endpoint}/${this.container}${segments ? `/${segments}` : ''}`)
    for (const [name, value] of Object.entries(query))
      url.searchParams.set(name, value)
    return url
  }

  /**
   * Issue an authorized request.
   *
   * Shared Key signs the exact URL, so the query string has to be final before
   * signing; a SAS is appended instead, and is not signed over. `x-ms-date` is
   * always sent - Azure rejects a request whose clock is more than 15 minutes
   * out, and it is the header the signature reads.
   */
  private async request(
    method: string,
    url: URL,
    options: { headers?: Record<string, string>, body?: Buffer | Uint8Array, expect?: number[] } = {},
  ): Promise<AzureResponse> {
    const headers: Record<string, string> = {
      'x-ms-date': new Date().toUTCString(),
      'x-ms-version': REST_VERSION,
      ...options.headers,
    }

    if (options.body !== undefined)
      headers['Content-Length'] = String(options.body.byteLength)

    const target = new URL(url)

    if (this.accountKey) {
      headers.Authorization = sharedKeyAuthorization(
        { account: this.account, accountKey: this.accountKey },
        { method, url: target, headers },
      )
    }
    else if (this.sasToken) {
      for (const [name, value] of new URLSearchParams(this.sasToken))
        target.searchParams.set(name, value)
    }

    const response = await fetch(target, {
      method,
      headers,
      body: options.body ? new Uint8Array(options.body) : undefined,
    })

    const body = await response.arrayBuffer()
    const expected = options.expect ?? [200, 201, 202, 204, 206]

    if (!expected.includes(response.status)) {
      // Azure's error body is XML carrying a `<Message>` that is far more
      // specific than the status - `AuthenticationFailed` versus
      // `ContainerNotFound` versus `BlobNotFound` all arrive as 4xx.
      const text = new TextDecoder().decode(body)
      const code = text.match(/<Code>([^<]+)<\/Code>/)?.[1]
      const message = text.match(/<Message>([^<]+)<\/Message>/)?.[1]?.split('\n')[0]
      throw new Error(
        `[storage/azure] ${method} ${target.pathname} failed with ${response.status}`
        + `${code ? ` (${code})` : ''}${message ? `: ${message}` : ''}`,
      )
    }

    return { status: response.status, headers: response.headers, body }
  }

  private async contentsToBuffer(contents: FileContents): Promise<Buffer> {
    if (typeof contents === 'string')
      return Buffer.from(contents, 'utf8')
    if (contents instanceof Buffer)
      return contents
    if (contents instanceof Uint8Array)
      return Buffer.from(contents)

    // Web-standard ReadableStream only, narrowed before consuming so a Node
    // `stream.Readable` fails with a clear message rather than a late
    // `contents.getReader is not a function` (stacksjs/stacks#1873 S-15).
    const maybeStream = contents as unknown as { getReader?: ReadableStream['getReader'] }
    if (typeof maybeStream.getReader !== 'function') {
      throw new TypeError(
        '[storage/azure] contents must be a web-standard ReadableStream '
        + '(with .getReader()), not a Node stream.Readable. '
        + 'Convert via Readable.toWeb(nodeStream) before passing.',
      )
    }

    return Buffer.concat(await collect(contents as ReadableStream<Uint8Array>))
  }

  // ===========================================================================
  // Reads and writes
  // ===========================================================================

  async write(path: string, contents: FileContents): Promise<PutResult> {
    const body = await this.contentsToBuffer(contents)
    const contentType = mimeFromExtension(path)

    if (body.byteLength > MAX_SINGLE_PUT_BYTES) {
      return await this.putStream(path, streamOf(body), { contentType })
    }

    const response = await this.request('PUT', this.blobUrl(this.blobName(path)), {
      headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': contentType },
      body,
      expect: [201],
    })

    return {
      path,
      size: body.byteLength,
      contentType,
      etag: response.headers.get('etag') ?? undefined,
      lastModified: lastModifiedFrom(response.headers),
    }
  }

  async read(path: string): Promise<FileContents> {
    const response = await this.request('GET', this.blobUrl(this.blobName(path)), { expect: [200, 206] })
    return Buffer.from(response.body)
  }

  async readToString(path: string): Promise<string> {
    return (await this.readToBuffer(path)).toString('utf8')
  }

  async readToBuffer(path: string): Promise<Buffer> {
    return Buffer.from(await this.read(path) as Buffer)
  }

  async readToUint8Array(path: string): Promise<Uint8Array> {
    return new Uint8Array(await this.readToBuffer(path))
  }

  /**
   * Read a blob as a stream.
   *
   * Genuinely incremental, unlike the S3 adapter - which buffers the whole
   * object because ts-cloud exposes no chunked read - because `fetch` already
   * hands back a streaming body. A 4 GiB blob costs one chunk of memory at a
   * time here and 4 GiB there.
   */
  async getStream(path: string, options?: GetStreamOptions): Promise<ReadableStream<Uint8Array>> {
    const headers: Record<string, string> = {
      'x-ms-date': new Date().toUTCString(),
      'x-ms-version': REST_VERSION,
    }

    const url = this.blobUrl(this.blobName(path))

    if (this.accountKey) {
      headers.Authorization = sharedKeyAuthorization(
        { account: this.account, accountKey: this.accountKey },
        { method: 'GET', url, headers },
      )
    }
    else if (this.sasToken) {
      for (const [name, value] of new URLSearchParams(this.sasToken))
        url.searchParams.set(name, value)
    }

    const response = await fetch(url, { method: 'GET', headers, signal: options?.signal })

    if (!response.ok || !response.body)
      throw new Error(`[storage/azure] failed to open a stream for ${path}: ${response.status}`)

    return response.body
  }

  /**
   * Upload a stream, choosing between a single Put Blob and a blocked upload.
   *
   * Blocks are staged with Put Block and committed in one Put Block List, which
   * is what makes the write atomic: a caller reading the blob mid-upload sees
   * either the previous version or nothing, never a partial one. Uncommitted
   * blocks from an abandoned upload are garbage collected by Azure after a
   * week, so a failure needs no explicit abort - unlike S3's multipart, where
   * they would be billed indefinitely.
   */
  async putStream(path: string, stream: ReadableStream<Uint8Array>, options?: PutStreamOptions): Promise<PutResult> {
    const blob = this.blobName(path)
    const contentType = options?.contentType ?? mimeFromExtension(path)
    const blockSize = Math.max(1, Math.min(options?.partSize ?? DEFAULT_BLOCK_BYTES, 4000 * 1024 * 1024))

    const reader = stream.getReader()
    const blockIds: string[] = []
    let pending: Buffer[] = []
    let pendingBytes = 0
    let total = 0

    const flush = async (): Promise<void> => {
      if (pendingBytes === 0)
        return
      if (blockIds.length >= MAX_BLOCKS) {
        throw new RangeError(
          `[storage/azure] a block blob holds at most ${MAX_BLOCKS} blocks; `
          + `raise \`partSize\` above ${blockSize} bytes for an upload this large.`,
        )
      }

      // Block ids must be equal-length base64 strings, so they are zero-padded
      // to a fixed width before encoding. Azure orders the blob by the list
      // submitted at commit time, not by id, but a varying id length is
      // rejected outright.
      const id = Buffer.from(String(blockIds.length).padStart(6, '0')).toString('base64')
      const body = Buffer.concat(pending)
      pending = []
      pendingBytes = 0

      await this.request('PUT', this.blobUrl(blob, { comp: 'block', blockid: id }), { body, expect: [201] })
      blockIds.push(id)
    }

    try {
      while (true) {
        options?.signal?.throwIfAborted()
        const { done, value } = await reader.read()
        if (done)
          break
        if (!value?.length)
          continue

        total += value.length
        pending.push(Buffer.from(value))
        pendingBytes += value.length

        if (pendingBytes >= blockSize)
          await flush()
      }
      await flush()
    }
    finally {
      reader.releaseLock()
    }

    const list = `<?xml version="1.0" encoding="utf-8"?><BlockList>${
      blockIds.map(id => `<Latest>${id}</Latest>`).join('')
    }</BlockList>`

    const response = await this.request('PUT', this.blobUrl(blob, { comp: 'blocklist' }), {
      headers: { 'Content-Type': 'application/xml', 'x-ms-blob-content-type': contentType },
      body: Buffer.from(list, 'utf8'),
      expect: [201],
    })

    return {
      path,
      size: total,
      contentType,
      etag: response.headers.get('etag') ?? undefined,
      lastModified: lastModifiedFrom(response.headers),
    }
  }

  async deleteFile(path: string): Promise<void> {
    await this.request('DELETE', this.blobUrl(this.blobName(path)), { expect: [202] })
  }

  /**
   * Delete every blob under a prefix.
   *
   * Azure has no batch delete on the blob endpoint that is worth the added
   * multipart-batch encoding here, so this is one request per blob - the same
   * shape as the S3 adapter's `deleteDirectory`.
   */
  async deleteDirectory(path: string): Promise<void> {
    for await (const entry of this.list(path, { deep: true }))
      await this.deleteFile(entry.path)
  }

  /**
   * A no-op: Azure has no directories, only blob names containing slashes.
   * Same as S3, and for the same reason.
   */
  async createDirectory(_path: string): Promise<void> {
    // Intentionally empty.
  }

  async moveFile(from: string, to: string): Promise<void> {
    await this.copyFile(from, to)
    await this.deleteFile(from)
  }

  /**
   * Server-side copy.
   *
   * Copy Blob is asynchronous in general, but a copy within the same account
   * completes synchronously and answers `x-ms-copy-status: success`. Anything
   * else would need polling, so a pending status is reported rather than
   * silently treated as done.
   */
  async copyFile(from: string, to: string): Promise<void> {
    const source = this.blobUrl(this.blobName(from))
    const response = await this.request('PUT', this.blobUrl(this.blobName(to)), {
      headers: { 'x-ms-copy-source': source.toString() },
      expect: [202],
    })

    const status = response.headers.get('x-ms-copy-status')
    if (status && status !== 'success')
      throw new Error(`[storage/azure] copy of ${from} to ${to} did not complete synchronously (status: ${status})`)
  }

  async stat(path: string): Promise<StatEntry> {
    const response = await this.request('HEAD', this.blobUrl(this.blobName(path)), { expect: [200] })

    return {
      path,
      type: 'file',
      visibility: await this.visibility(path),
      size: Number(response.headers.get('content-length') ?? 0),
      lastModified: lastModifiedFrom(response.headers),
      mimeType: response.headers.get('content-type') ?? undefined,
    }
  }

  list(path: string, options: ListOptions = {}): DirectoryListing {
    return this.listBlobs(path, options.deep ?? false)
  }

  /**
   * List Blobs, paged by the continuation marker Azure returns.
   *
   * A shallow listing passes `delimiter=/`, which makes Azure fold everything
   * below a level into `BlobPrefix` entries - the closest thing the service has
   * to a directory, and what lets this yield `type: 'directory'` at all.
   */
  private async *listBlobs(path: string, deep: boolean): DirectoryListing {
    const { XMLParser } = await import('@stacksjs/ts-xml')
    const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true })

    const scoped = this.blobName(path.replace(/\/+$/, ''))
    const prefix = scoped ? `${scoped}/` : ''
    let marker: string | undefined

    do {
      const query: Record<string, string> = { restype: 'container', comp: 'list' }
      if (prefix)
        query.prefix = prefix
      if (!deep)
        query.delimiter = '/'
      if (marker)
        query.marker = marker

      const response = await this.request('GET', this.blobUrl(undefined, query), { expect: [200] })
      const parsed = parser.parse(new TextDecoder().decode(response.body)) as EnumerationResult

      const blobs = parsed?.EnumerationResults?.Blobs
      for (const blob of asArray(blobs?.Blob)) {
        if (!blob?.Name)
          continue
        yield {
          path: this.stripPrefix(blob.Name),
          type: 'file',
        }
      }

      for (const folder of asArray(blobs?.BlobPrefix)) {
        if (!folder?.Name)
          continue
        yield {
          path: this.stripPrefix(folder.Name.replace(/\/+$/, '')),
          type: 'directory',
        }
      }

      marker = parsed?.EnumerationResults?.NextMarker || undefined
    } while (marker)
  }

  /**
   * Refuses, because Azure cannot do it.
   *
   * Public access is a property of the container (`x-ms-blob-public-access`),
   * not of a blob, so there is no request that makes one blob public while its
   * neighbours stay private. The alternatives were both worse: doing nothing
   * silently is how a caller ends up believing a file is served publicly when
   * it is not, and flipping the whole container would make one blob's write
   * expose every other blob in it.
   *
   * A per-object grant on Azure is a SAS, which is what {@link signedUrl} is.
   */
  async changeVisibility(_path: string, _visibility: Visibility): Promise<void> {
    throw new Error(
      '[storage/azure] visibility is a property of the container, not the blob - Azure has no per-blob ACL. '
      + 'Set the container\'s public access level in Azure, or hand out a time-limited URL with `signedUrl()`.',
    )
  }

  /**
   * The container's public access level, which is every blob's answer.
   *
   * `container` and `blob` both make blob content readable anonymously and map
   * to `public`; the absence of the header means private.
   */
  async visibility(_path: string): Promise<Visibility> {
    const response = await this.request('GET', this.blobUrl(undefined, { restype: 'container', comp: 'acl' }), { expect: [200] })
    const level = response.headers.get('x-ms-blob-public-access')
    return ((level === 'container' || level === 'blob') ? 'public' : 'private') as Visibility
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      await this.request('HEAD', this.blobUrl(this.blobName(path)), { expect: [200] })
      return true
    }
    catch {
      // HEAD carries no body, so a missing blob and a permissions problem are
      // both bare 4xx here. Reporting "does not exist" is what every other
      // adapter does with the same ambiguity.
      return false
    }
  }

  async directoryExists(path: string): Promise<boolean> {
    for await (const _entry of this.list(path, { deep: true }))
      return true
    return false
  }

  /**
   * A public URL for a blob.
   *
   * The account's blob endpoint is the right answer whenever the container
   * allows public access, unlike R2 - where the API host never serves objects -
   * so this derives rather than refusing. Set `url` to route through a CDN or a
   * custom domain instead.
   */
  async publicUrl(path: string, options: PublicUrlOptions = {}): Promise<string> {
    const blob = this.blobName(path)
    const base = options.domain?.replace(/\/+$/, '') ?? this.publicBaseUrl

    if (base)
      return `${base}/${blob}`

    return this.blobUrl(blob).toString()
  }

  async temporaryUrl(path: string, options: TemporaryUrlOptions): Promise<string> {
    return this.signUrl(path, Math.floor(normalizeExpiryToMilliseconds(options.expiresIn) / 1000), 'r')
  }

  /**
   * A time-limited read URL, as a service SAS.
   *
   * @example
   * ```ts
   * const url = await Storage.disk('azure').signedUrl('reports/q1.pdf', { expiresIn: 3600 })
   * ```
   */
  async signedUrl(path: string, options: SignedUrlOptions): Promise<string> {
    return this.signUrl(path, Math.floor(normalizeExpiryToMilliseconds(options.expiresIn) / 1000), 'r')
  }

  /**
   * A SAS URL a browser can PUT straight to.
   *
   * `cw` grants create and write, which is what Put Blob needs; the client must
   * send `x-ms-blob-type: BlockBlob` along with the bytes. The signed
   * `Content-Type` is advisory in the same way S3's is - Azure stores what the
   * client sends and never inspects the bytes - so a server that cares must
   * re-verify after the upload, via `verifyUploadedMime`.
   */
  async presignedUploadUrl(options: PresignedUploadUrlOptions): Promise<PresignedUploadUrl> {
    if (!options.contentType)
      throw new Error('[storage/azure] presignedUploadUrl requires `contentType` - the SAS signs against it.')

    // Sanitized before concatenation, for the reason spelled out in the S3
    // adapter (stacksjs/stacks#1873 S-1, S-2): a blob name is an opaque string,
    // so `dir: '../../secrets'` lands verbatim rather than resolving away, and
    // a `filename` containing a slash turns into a sub-path the caller does not
    // own. Both throw `PathSanitizeError`, which callers map to a 400.
    const safeDir = sanitizePresignedDir(options.dir)
    const safeFilename = options.filename !== undefined
      ? sanitizePresignedFilename(options.filename)
      : `${crypto.randomUUID().replace(/-/g, '')}${extensionForContentType(options.contentType)}`
    const path = safeDir ? `${safeDir}/${safeFilename}` : safeFilename

    const url = await this.signUrl(path, Math.floor(options.expiresIn), 'cw', options.contentType)

    return {
      url,
      path,
      key: this.blobName(path),
      contentType: options.contentType,
      maxBytes: options.maxBytes,
    }
  }

  private async signUrl(path: string, expiresIn: number, permissions: string, contentType?: string): Promise<string> {
    if (!this.accountKey) {
      throw new Error(
        '[storage/azure] signing a URL needs the account key. This disk is configured with a SAS token, '
        + 'and re-serving that token would hand out its full grant rather than a scoped one.',
      )
    }

    if (!Number.isFinite(expiresIn) || expiresIn < MIN_EXPIRY_SECONDS || expiresIn > MAX_EXPIRY_SECONDS)
      throw new RangeError(`[storage/azure] expiresIn must be between 60s and 7 days (got ${expiresIn}s)`)

    const query = serviceSasQuery(
      { account: this.account, accountKey: this.accountKey },
      {
        container: this.container,
        blob: this.blobName(path),
        permissions,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        contentType,
      },
    )

    return `${this.blobUrl(this.blobName(path)).toString()}?${query}`
  }

  // ===========================================================================
  // Derived metadata
  // ===========================================================================

  /**
   * A checksum of the blob's contents.
   *
   * Computed locally from the bytes rather than read from the ETag: Azure's
   * ETag is opaque, and `Content-MD5` is only present when the uploader sent
   * it. Downloading to hash is the only answer that is right for every blob,
   * which is the same trade the S3 adapter makes - including its `sha256`
   * default, so a checksum does not change meaning with the disk it came from.
   */
  async checksum(path: string, options: ChecksumOptions = {}): Promise<string> {
    const contents = await this.readToBuffer(path)
    return createHash(options.algorithm || 'sha256').update(contents).digest('hex')
  }

  async mimeType(path: string, _options: MimeTypeOptions = {}): Promise<string> {
    const stats = await this.stat(path)
    return stats.mimeType ?? mimeFromExtension(path)
  }

  async lastModified(path: string): Promise<number> {
    return (await this.stat(path)).lastModified
  }

  async fileSize(path: string): Promise<number> {
    return (await this.stat(path)).size
  }
}

/** The shape of a List Blobs response, as far as this adapter reads it. */
interface EnumerationResult {
  EnumerationResults?: {
    NextMarker?: string
    Blobs?: {
      Blob?: { Name?: string } | Array<{ Name?: string }>
      BlobPrefix?: { Name?: string } | Array<{ Name?: string }>
    }
  }
}

/**
 * XML has no way to say "a list of one", so a parser gives back the element
 * itself when a container holds exactly one blob and an array when it holds
 * two. Normalizing here is what stops a single-file listing from iterating the
 * characters of a name.
 */
function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null)
    return []
  return Array.isArray(value) ? value : [value]
}

/** Azure reports `Last-Modified` as an HTTP date; callers want epoch millis. */
function lastModifiedFrom(headers: Headers): number {
  const raw = headers.get('last-modified')
  const parsed = raw ? Date.parse(raw) : Number.NaN
  return Number.isNaN(parsed) ? Date.now() : parsed
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Buffer[]> {
  const reader = stream.getReader()
  const chunks: Buffer[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done)
      break
    if (value)
      chunks.push(Buffer.from(value))
  }
  return chunks
}

function streamOf(body: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(body))
      controller.close()
    },
  })
}

/** Create an Azure Blob Storage adapter instance. */
export function createAzureStorage(config: AzureStorageAdapterConfig): AzureBlobStorageAdapter {
  return new AzureBlobStorageAdapter(config)
}
