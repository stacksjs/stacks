import type { Buffer } from 'node:buffer'
import { basename } from 'node:path'
import { Readable } from 'node:stream'
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type {
  ChecksumOptions,
  DirectoryEntry,
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
import { createDirectoryListing, normalizeExpiryToMilliseconds } from '../types'

/**
 * AWS S3 storage adapter
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
    return path.replace(new RegExp(`^${this.prefix}/`), '')
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = []
    return new Promise((resolve, reject) => {
      stream.on('data', chunk => chunks.push(Buffer.from(chunk)))
      stream.on('error', reject)
      stream.on('end', () => resolve(Buffer.concat(chunks)))
    })
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

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: this.detectMimeType(path),
      }),
    )
  }

  async read(path: string): Promise<FileContents> {
    const key = this.prefixPath(path)

    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    )

    if (!response.Body) {
      throw new Error(`Failed to read file: ${path}`)
    }

    return await this.streamToBuffer(response.Body as Readable)
  }

  async readToString(path: string): Promise<string> {
    const buffer = await this.readToBuffer(path)
    return buffer.toString('utf8')
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

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    )
  }

  async deleteDirectory(path: string): Promise<void> {
    const prefix = this.prefixPath(path)

    // List all objects in the directory
    const listResponse = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix.endsWith('/') ? prefix : `${prefix}/`,
      }),
    )

    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      return
    }

    // Delete all objects
    await Promise.all(
      listResponse.Contents.map(obj =>
        obj.Key
          ? this.client.send(
            new DeleteObjectCommand({
              Bucket: this.bucket,
              Key: obj.Key,
            }),
          )
          : Promise.resolve(),
      ),
    )
  }

  async createDirectory(_path: string): Promise<void> {
    // S3 doesn't have actual directories, they're implicit
    // No-op for S3
  }

  async moveFile(from: string, to: string): Promise<void> {
    await this.copyFile(from, to)
    await this.deleteFile(from)
  }

  async copyFile(from: string, to: string): Promise<void> {
    const fromKey = this.prefixPath(from)
    const toKey = this.prefixPath(to)

    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${fromKey}`,
        Key: toKey,
      }),
    )
  }

  async stat(path: string): Promise<StatEntry> {
    const key = this.prefixPath(path)

    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      )

      return {
        path,
        type: 'file',
        visibility: 'private' as Visibility, // S3 ACLs would need to be checked for actual visibility
        size: response.ContentLength || 0,
        lastModified: response.LastModified?.getTime() || Date.now(),
        mimeType: response.ContentType,
        metadata: response.Metadata,
      }
    }
    catch (error: any) {
      if (error.name === 'NotFound') {
        throw new Error(`File not found: ${path}`)
      }
      throw error
    }
  }

  list(path: string, options: ListOptions = {}): DirectoryListing {
    return this.createAsyncIterator(path, options.deep || false)
  }

  private async *createAsyncIterator(path: string, deep: boolean): DirectoryListing {
    const prefix = this.prefixPath(path)
    const delimiter = deep ? undefined : '/'

    let continuationToken: string | undefined

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix ? `${prefix}/` : undefined,
          Delimiter: delimiter,
          ContinuationToken: continuationToken,
        }),
      )

      // Files
      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key) {
            yield {
              path: this.stripPrefix(obj.Key),
              type: 'file',
            }
          }
        }
      }

      // Directories (common prefixes)
      if (response.CommonPrefixes) {
        for (const prefix of response.CommonPrefixes) {
          if (prefix.Prefix) {
            yield {
              path: this.stripPrefix(prefix.Prefix.replace(/\/$/, '')),
              type: 'directory',
            }
          }
        }
      }

      continuationToken = response.NextContinuationToken
    } while (continuationToken)
  }

  async changeVisibility(_path: string, _visibility: Visibility): Promise<void> {
    // Would need to use PutObjectAclCommand to change ACLs
    // For now, this is a no-op
  }

  async visibility(_path: string): Promise<Visibility> {
    // Would need to check object ACLs
    return 'private' as Visibility
  }

  async fileExists(path: string): Promise<boolean> {
    const key = this.prefixPath(path)

    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      )
      return true
    }
    catch {
      return false
    }
  }

  async directoryExists(path: string): Promise<boolean> {
    const prefix = this.prefixPath(path)

    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: `${prefix}/`,
        MaxKeys: 1,
      }),
    )

    return (response.Contents?.length || 0) > 0 || (response.CommonPrefixes?.length || 0) > 0
  }

  async publicUrl(path: string, options: PublicUrlOptions = {}): Promise<string> {
    const key = this.prefixPath(path)
    const domain = options.domain || `https://${this.bucket}.s3.${this.region}.amazonaws.com`
    return `${domain}/${key}`
  }

  async temporaryUrl(path: string, options: TemporaryUrlOptions): Promise<string> {
    const key = this.prefixPath(path)
    const expiresIn = Math.floor(normalizeExpiryToMilliseconds(options.expiresIn) / 1000)

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    })

    return await getSignedUrl(this.client, command, { expiresIn })
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
