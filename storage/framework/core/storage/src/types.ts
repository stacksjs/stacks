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
  /** AWS credentials */
  credentials?: {
    accessKeyId: string
    secretAccessKey: string
  }
}

/**
 * Base storage adapter interface
 */
export interface StorageAdapter {
  /** Write file contents */
  write(path: string, contents: FileContents): Promise<void>

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
