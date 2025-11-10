import type { Buffer } from 'node:buffer'
import type { ReadableStream } from 'node:stream/web'

/**
 * File contents can be a string, Buffer, Uint8Array, or ReadableStream
 */
export type FileContents = string | Buffer | Uint8Array | ReadableStream

/**
 * Visibility options for files
 */
export type Visibility = 'public' | 'private'

/**
 * File stat entry information
 */
export interface StatEntry {
  path: string
  type: 'file' | 'directory'
  visibility: Visibility
  size: number
  lastModified: number
  mimeType?: string
  metadata?: Record<string, any>
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
 * Options for generating public URLs
 */
export interface PublicUrlOptions {
  domain?: string
}

/**
 * Options for generating temporary URLs
 */
export interface TemporaryUrlOptions {
  expiresIn: number | Date
}

/**
 * Checksum algorithm options
 */
export interface ChecksumOptions {
  algorithm?: 'md5' | 'sha1' | 'sha256'
}

/**
 * MIME type detection options
 */
export interface MimeTypeOptions {
  useExtension?: boolean
}

export interface StorageOptions {
  /**
   * **Storage Driver**
   *
   * The storage driver to utilize.
   *
   * @default string 'local'
   * @see https://stacksjs.org/docs/storage
   */
  driver: 's3' | 'efs' | 'local' | 'bun' | 'memory'
}

export type StorageConfig = Partial<StorageOptions>

export interface StorageDriver {
  list: (path: string, options?: any) => DirectoryListing
  changeVisibility: (path: string, visibility: Visibility) => Promise<void>
  visibility: (path: string) => Promise<Visibility>
  fileExists: (path: string) => Promise<boolean>
  directoryExists: (path: string) => Promise<boolean>
  publicUrl: (path: string, options: PublicUrlOptions) => Promise<string>
  temporaryUrl: (path: string, options: TemporaryUrlOptions) => Promise<string>
  checksum: (path: string, options: ChecksumOptions) => Promise<string>
  mimeType: (path: string, options: MimeTypeOptions) => Promise<string>
  lastModified: (path: string) => Promise<number>
  fileSize: (path: string) => Promise<number>
  read: (path: string) => Promise<FileContents>
  readToString: (path: string) => Promise<string>
  readToBuffer: (path: string) => Promise<Buffer>
  readToUint8Array: (path: string) => Promise<Uint8Array>
  deleteFile: (path: string) => Promise<void>
  copyFile: (from: string, to: string) => Promise<void>
  moveFile: (from: string, to: string) => Promise<void>
  stat: (path: string) => Promise<StatEntry>
  createDirectory: (path: string) => Promise<void>
  write: (path: string, contents: FileContents) => Promise<void>
}
