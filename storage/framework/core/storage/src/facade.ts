/**
 * Storage Facade
 *
 * Laravel-style storage management with support for multiple disk drivers.
 * Configure disks via environment variables or programmatically.
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
import { S3Client } from '@aws-sdk/client-s3'
import type { StorageAdapter } from './types'
import { createLocalStorage } from './adapters/local'
import { S3StorageAdapter } from './adapters/s3'
import type {
  DiskConfig,
  FilesystemConfig,
  LocalDiskConfig,
  S3DiskConfig,
} from './types/filesystem'

// =============================================================================
// Default Configuration
// =============================================================================

function getDefaultConfig(): FilesystemConfig {
  const cwd = process.cwd()

  return {
    default: process.env.FILESYSTEM_DISK || 'local',

    disks: {
      local: {
        driver: 'local',
        root: resolve(cwd, 'storage/app'),
        visibility: 'private',
      },

      public: {
        driver: 'local',
        root: resolve(cwd, 'public'),
        url: process.env.APP_URL ? `${process.env.APP_URL}/storage` : '/storage',
        visibility: 'public',
      },

      // S3 disk (configured from environment)
      ...(process.env.AWS_BUCKET ? {
        s3: {
          driver: 's3' as const,
          bucket: process.env.AWS_BUCKET,
          region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
          endpoint: process.env.AWS_ENDPOINT,
          url: process.env.AWS_URL,
          usePathStyleEndpoint: process.env.AWS_USE_PATH_STYLE_ENDPOINT === 'true',
          visibility: 'private' as const,
          credentials: process.env.AWS_ACCESS_KEY_ID ? {
            key: process.env.AWS_ACCESS_KEY_ID,
            secret: process.env.AWS_SECRET_ACCESS_KEY || '',
          } : undefined,
        },
      } : {}),
    },
  }
}

// =============================================================================
// Storage Manager
// =============================================================================

class StorageManager {
  private config: FilesystemConfig
  private disks: Map<string, StorageAdapter> = new Map()
  private s3Clients: Map<string, S3Client> = new Map()

  constructor(config?: Partial<FilesystemConfig>) {
    const defaultConfig = getDefaultConfig()
    this.config = {
      default: config?.default || defaultConfig.default,
      disks: { ...defaultConfig.disks, ...config?.disks },
    }
  }

  /**
   * Get a disk instance by name
   *
   * @example
   * ```ts
   * const disk = Storage.disk('s3')
   * await disk.put('file.txt', 'content')
   * ```
   */
  disk(name?: string): StorageAdapter {
    const diskName = name || this.config.default

    // Return cached disk
    if (this.disks.has(diskName)) {
      return this.disks.get(diskName)!
    }

    const diskConfig = this.config.disks[diskName]
    if (!diskConfig) {
      throw new Error(`Disk [${diskName}] is not configured. Available disks: ${Object.keys(this.config.disks).join(', ')}`)
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

  /**
   * Create local storage adapter
   */
  private createLocalAdapter(config: LocalDiskConfig): StorageAdapter {
    return createLocalStorage({ root: config.root })
  }

  /**
   * Create S3 storage adapter
   */
  private createS3Adapter(name: string, config: S3DiskConfig): StorageAdapter {
    // Get or create S3 client
    let client = this.s3Clients.get(name)

    if (!client) {
      const clientConfig: any = {
        region: config.region || 'us-east-1',
      }

      // Add endpoint for S3-compatible services
      if (config.endpoint) {
        clientConfig.endpoint = config.endpoint
        clientConfig.forcePathStyle = config.usePathStyleEndpoint ?? true
      }

      // Add credentials if provided
      if (config.credentials) {
        clientConfig.credentials = {
          accessKeyId: config.credentials.key,
          secretAccessKey: config.credentials.secret,
        }
      }

      client = new S3Client(clientConfig)
      this.s3Clients.set(name, client)
    }

    return new S3StorageAdapter(client, {
      bucket: config.bucket,
      region: config.region,
      prefix: config.prefix,
    })
  }

  // ===========================================================================
  // Convenience Methods (delegate to default disk)
  // ===========================================================================

  /** Write file to default disk */
  async put(path: string, contents: string | Uint8Array | Buffer): Promise<void> {
    return this.disk().write(path, contents)
  }

  /** Read file from default disk */
  async get(path: string): Promise<string> {
    return this.disk().readToString(path)
  }

  /** Check if file exists */
  async exists(path: string): Promise<boolean> {
    return this.disk().fileExists(path)
  }

  /** Check if file is missing */
  async missing(path: string): Promise<boolean> {
    return !(await this.exists(path))
  }

  /** Delete file */
  async delete(path: string): Promise<void> {
    return this.disk().deleteFile(path)
  }

  /** Copy file */
  async copy(from: string, to: string): Promise<void> {
    return this.disk().copyFile(from, to)
  }

  /** Move file */
  async move(from: string, to: string): Promise<void> {
    return this.disk().moveFile(from, to)
  }

  /** Get public URL */
  async url(path: string): Promise<string> {
    return this.disk().publicUrl(path)
  }

  /** Get file size in bytes */
  async size(path: string): Promise<number> {
    return this.disk().fileSize(path)
  }

  /** Get last modified timestamp */
  async lastModified(path: string): Promise<number> {
    return this.disk().lastModified(path)
  }

  /** Get MIME type */
  async mimeType(path: string): Promise<string> {
    return this.disk().mimeType(path)
  }

  /** Get file checksum */
  async checksum(path: string, algorithm?: 'md5' | 'sha1' | 'sha256'): Promise<string> {
    return this.disk().checksum(path, { algorithm })
  }

  /** Create directory */
  async makeDirectory(path: string): Promise<void> {
    return this.disk().createDirectory(path)
  }

  /** Delete directory and contents */
  async deleteDirectory(path: string): Promise<void> {
    return this.disk().deleteDirectory(path)
  }

  /** List files in directory */
  files(path: string = ''): AsyncIterable<{ path: string; type: 'file' | 'directory' }> {
    return this.disk().list(path)
  }

  /** List all files recursively */
  allFiles(path: string = ''): AsyncIterable<{ path: string; type: 'file' | 'directory' }> {
    return this.disk().list(path, { deep: true })
  }

  // ===========================================================================
  // Configuration Methods
  // ===========================================================================

  /** Add or update a disk configuration */
  configure(name: string, config: DiskConfig): this {
    this.config.disks[name] = config
    this.disks.delete(name) // Clear cached adapter
    this.s3Clients.delete(name) // Clear cached S3 client
    return this
  }

  /** Set the default disk */
  setDefaultDisk(name: string): this {
    if (!this.config.disks[name]) {
      throw new Error(`Disk [${name}] is not configured`)
    }
    this.config.default = name
    return this
  }

  /** Get disk configuration */
  getDiskConfig(name?: string): DiskConfig | undefined {
    return this.config.disks[name || this.config.default]
  }

  /** Get all configured disk names */
  getConfiguredDisks(): string[] {
    return Object.keys(this.config.disks)
  }

  /** Get the default disk name */
  getDefaultDisk(): string {
    return this.config.default
  }
}

// =============================================================================
// Exports
// =============================================================================

/** Global storage instance */
export const Storage = new StorageManager()

/** Export class for custom instances */
export { StorageManager }

/** Re-export types */
export type {
  DiskConfig,
  FilesystemConfig,
  LocalDiskConfig,
  S3DiskConfig,
} from './types/filesystem'
