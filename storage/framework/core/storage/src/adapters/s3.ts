import { Buffer } from 'node:buffer'
import { basename } from 'node:path'
import { S3Client } from '@stacksjs/ts-cloud'
import type {
  ChecksumOptions,
  DirectoryListing,
  FileContents,
  ListOptions,
  MimeTypeOptions,
  PublicUrlOptions,
  StatEntry,
  StorageAdapter,
  StorageAdapterConfig,
  TemporaryUrlOptions,
  Visibility,
} from '../types'
import { normalizeExpiryToMilliseconds } from '../types'

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
      // ReadableStream - convert to Buffer
      const reader = contents.getReader()
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

    // getObject returns a raw response, read it as text then convert to buffer
    const text = typeof response === 'string' ? response : await response.text?.() || ''
    return Buffer.from(text)
  }

  async readToString(path: string): Promise<string> {
    const key = this.prefixPath(path)
    const response = await this.client.getObject(this.bucket, key)
    if (typeof response === 'string') return response
    return await response.text?.() || ''
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
    const keys = objects.map((obj: any) => obj.Key || obj.key)

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
      bucket: this.bucket,
      key: toKey,
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
          path: this.stripPrefix(obj.Key || obj.key),
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
            path: this.stripPrefix(obj.Key || obj.key),
            type: 'file',
          }
        }

        continuationToken = result.nextContinuationToken
      } while (continuationToken)
    }
  }

  async changeVisibility(_path: string, _visibility: Visibility): Promise<void> {
    // Would need to use putObjectAcl to change ACLs
  }

  async visibility(_path: string): Promise<Visibility> {
    return 'private' as Visibility
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

    return await this.client.getSignedUrl({
      bucket: this.bucket,
      key,
      expiresIn,
      operation: 'getObject',
    })
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
