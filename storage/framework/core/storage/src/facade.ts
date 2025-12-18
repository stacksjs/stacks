/**
 * Storage Facade
 *
 * Laravel-style storage management with support for multiple disk drivers.
 * Configure disks via config/storage.ts or environment variables.
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
import { filesystems, app as appConfig } from '@stacksjs/config'
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
// Configuration Builder
// =============================================================================

/**
 * Build filesystem config from @stacksjs/config
 * Called lazily to ensure config is loaded
 */
function buildConfig(): FilesystemConfig {
  const cwd = process.cwd()
  const rootDir = filesystems.root || cwd
  const s3Config = filesystems.s3
  const appUrl = appConfig?.url || ''

  const config: FilesystemConfig = {
    default: filesystems.driver || 'local',

    disks: {
      // Local disk - private storage
      local: {
        driver: 'local',
        root: resolve(rootDir, 'storage/app'),
        visibility: filesystems.defaultVisibility || 'private',
      },

      // Public disk - web accessible
      public: {
        driver: 'local',
        root: resolve(rootDir, 'public'),
        url: appUrl ? `${appUrl}/storage` : '/storage',
        visibility: 'public',
      },
    },
  }

  // Add S3 disk if configured
  if (s3Config?.bucket) {
    config.disks.s3 = {
      driver: 's3',
      bucket: s3Config.bucket,
      region: s3Config.region || 'us-east-1',
      prefix: s3Config.prefix,
      endpoint: s3Config.endpoint,
      url: filesystems.publicUrl?.domain,
      usePathStyleEndpoint: !!s3Config.endpoint,
      visibility: filesystems.defaultVisibility || 'private',
      credentials: s3Config.credentials
        ? { key: s3Config.credentials.accessKeyId, secret: s3Config.credentials.secretAccessKey }
        : undefined,
    }
  }

  return config
}

// =============================================================================
// Storage Manager
// =============================================================================

class StorageManager {
  private _config: FilesystemConfig | null = null
  private disks: Map<string, StorageAdapter> = new Map()
  private s3Clients: Map<string, S3Client> = new Map()
  private customConfig: Partial<FilesystemConfig> | null = null

  /**
   * Get config lazily to ensure env vars are loaded
   */
  private get config(): FilesystemConfig {
    if (!this._config) {
      const builtConfig = buildConfig()
      this._config = this.customConfig
        ? {
            default: this.customConfig.default || builtConfig.default,
            disks: { ...builtConfig.disks, ...this.customConfig.disks },
          }
        : builtConfig
    }
    return this._config
  }

  /**
   * Initialize with custom config (optional)
   * Call this early if you need to override env-based config
   */
  init(config: Partial<FilesystemConfig>): this {
    this.customConfig = config
    this._config = null // Reset so it rebuilds on next access
    this.disks.clear()
    this.s3Clients.clear()
    return this
  }

  /**
   * Get a disk instance by name
   */
  disk(name?: string): StorageAdapter {
    const diskName = name || this.config.default

    // Return cached disk
    if (this.disks.has(diskName)) {
      return this.disks.get(diskName)!
    }

    const diskConfig = this.config.disks[diskName]
    if (!diskConfig) {
      const available = Object.keys(this.config.disks).join(', ')
      throw new Error(`Disk [${diskName}] is not configured. Available: ${available}`)
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

  private createLocalAdapter(config: LocalDiskConfig): StorageAdapter {
    return createLocalStorage({ root: config.root })
  }

  private createS3Adapter(name: string, config: S3DiskConfig): StorageAdapter {
    let client = this.s3Clients.get(name)

    if (!client) {
      const clientConfig: any = {
        region: config.region || 'us-east-1',
      }

      if (config.endpoint) {
        clientConfig.endpoint = config.endpoint
        clientConfig.forcePathStyle = config.usePathStyleEndpoint ?? true
      }

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
  // Convenience Methods
  // ===========================================================================

  async put(path: string, contents: string | Uint8Array | Buffer): Promise<void> {
    return this.disk().write(path, contents)
  }

  async get(path: string): Promise<string> {
    return this.disk().readToString(path)
  }

  async exists(path: string): Promise<boolean> {
    return this.disk().fileExists(path)
  }

  async missing(path: string): Promise<boolean> {
    return !(await this.exists(path))
  }

  async delete(path: string): Promise<void> {
    return this.disk().deleteFile(path)
  }

  async copy(from: string, to: string): Promise<void> {
    return this.disk().copyFile(from, to)
  }

  async move(from: string, to: string): Promise<void> {
    return this.disk().moveFile(from, to)
  }

  async url(path: string): Promise<string> {
    return this.disk().publicUrl(path)
  }

  async size(path: string): Promise<number> {
    return this.disk().fileSize(path)
  }

  async lastModified(path: string): Promise<number> {
    return this.disk().lastModified(path)
  }

  async mimeType(path: string): Promise<string> {
    return this.disk().mimeType(path)
  }

  async checksum(path: string, algorithm?: 'md5' | 'sha1' | 'sha256'): Promise<string> {
    return this.disk().checksum(path, { algorithm })
  }

  async makeDirectory(path: string): Promise<void> {
    return this.disk().createDirectory(path)
  }

  async deleteDirectory(path: string): Promise<void> {
    return this.disk().deleteDirectory(path)
  }

  files(path: string = ''): AsyncIterable<{ path: string; type: 'file' | 'directory' }> {
    return this.disk().list(path)
  }

  allFiles(path: string = ''): AsyncIterable<{ path: string; type: 'file' | 'directory' }> {
    return this.disk().list(path, { deep: true })
  }

  // ===========================================================================
  // Configuration Methods
  // ===========================================================================

  configure(name: string, config: DiskConfig): this {
    // Ensure config is loaded
    const currentConfig = this.config
    currentConfig.disks[name] = config
    this.disks.delete(name)
    this.s3Clients.delete(name)
    return this
  }

  setDefaultDisk(name: string): this {
    if (!this.config.disks[name]) {
      throw new Error(`Disk [${name}] is not configured`)
    }
    this.config.default = name
    return this
  }

  getDiskConfig(name?: string): DiskConfig | undefined {
    return this.config.disks[name || this.config.default]
  }

  getConfiguredDisks(): string[] {
    return Object.keys(this.config.disks)
  }

  getDefaultDisk(): string {
    return this.config.default
  }

  /**
   * Reset the storage manager (useful for testing)
   */
  reset(): this {
    this._config = null
    this.customConfig = null
    this.disks.clear()
    this.s3Clients.clear()
    return this
  }
}

// =============================================================================
// Exports
// =============================================================================

export const Storage = new StorageManager()
export { StorageManager }

export type {
  DiskConfig,
  FilesystemConfig,
  LocalDiskConfig,
  S3DiskConfig,
} from './types/filesystem'
