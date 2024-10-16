import type { ChecksumOptions, DirectoryListing, FileContents, MimeTypeOptions, PublicUrlOptions, StatEntry, TemporaryUrlOptions } from '@flystorage/file-storage'
import type { Buffer } from 'node:buffer'

export interface StorageOptions {
  /**
   * **Storage Driver**
   *
   * The storage driver to utilize.
   *
   * @default string 's3'
   * @see https://stacksjs.org/docs/storage
   */
  driver: 's3' | 'efs' | 'local'
}

export type StorageConfig = Partial<StorageOptions>

export interface StorageDriver {
  list: (path: string, options?: any) => DirectoryListing
  changeVisibility: (path: string, visibility: string) => Promise<void>
  visibility: (path: string) => Promise<string>
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
