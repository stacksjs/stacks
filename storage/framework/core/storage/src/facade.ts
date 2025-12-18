import { resolve } from 'node:path'
import process from 'node:process'
import type { StorageAdapter } from './types'
import { createLocalStorage } from './adapters/local'

export interface DiskConfig {
  driver: 'local' | 's3' | 'memory'
  root?: string
  bucket?: string
  region?: string
  prefix?: string
  url?: string
  visibility?: 'public' | 'private'
  credentials?: {
    accessKeyId: string
    secretAccessKey: string
  }
}

export interface StorageConfig {
  default: string
  disks: Record<string, DiskConfig>
}

const defaultConfig: StorageConfig = {
  default: 'local',
  disks: {
    local: {
      driver: 'local',
      root: resolve(process.cwd(), 'storage/app'),
      visibility: 'private',
    },
    public: {
      driver: 'local',
      root: resolve(process.cwd(), 'public'),
      url: '/storage',
      visibility: 'public',
    },
  },
}

class StorageManager {
  private config: StorageConfig
  private disks: Map<string, StorageAdapter> = new Map()

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = {
      ...defaultConfig,
      ...config,
      disks: { ...defaultConfig.disks, ...config.disks },
    }
  }

  disk(name?: string): StorageAdapter {
    const diskName = name || this.config.default

    if (this.disks.has(diskName)) {
      return this.disks.get(diskName)!
    }

    const diskConfig = this.config.disks[diskName]
    if (!diskConfig) {
      throw new Error(`Disk [${diskName}] is not configured`)
    }

    const adapter = this.createAdapter(diskConfig)
    this.disks.set(diskName, adapter)

    return adapter
  }

  private createAdapter(config: DiskConfig): StorageAdapter {
    switch (config.driver) {
      case 'local':
        return createLocalStorage({ root: config.root })
      case 's3':
        throw new Error('S3 driver not yet implemented')
      case 'memory':
        throw new Error('Memory driver not yet implemented')
      default:
        throw new Error(`Unsupported driver: ${config.driver}`)
    }
  }

  /** Write file to default disk */
  async put(path: string, contents: string | Uint8Array | Buffer): Promise<void> {
    return this.disk().write(path, contents)
  }

  /** Read file from default disk */
  async get(path: string): Promise<string> {
    return this.disk().readToString(path)
  }

  /** Check if file exists on default disk */
  async exists(path: string): Promise<boolean> {
    return this.disk().fileExists(path)
  }

  /** Delete file from default disk */
  async delete(path: string): Promise<void> {
    return this.disk().deleteFile(path)
  }

  /** Copy file on default disk */
  async copy(from: string, to: string): Promise<void> {
    return this.disk().copyFile(from, to)
  }

  /** Move file on default disk */
  async move(from: string, to: string): Promise<void> {
    return this.disk().moveFile(from, to)
  }

  /** Get public URL for file */
  async url(path: string): Promise<string> {
    return this.disk().publicUrl(path)
  }

  /** Get file size */
  async size(path: string): Promise<number> {
    return this.disk().fileSize(path)
  }

  /** Get last modified time */
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

  /** Delete directory */
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

  /** Configure a new disk */
  configure(name: string, config: DiskConfig): void {
    this.config.disks[name] = config
    this.disks.delete(name)
  }

  /** Set default disk */
  setDefault(name: string): void {
    if (!this.config.disks[name]) {
      throw new Error(`Disk [${name}] is not configured`)
    }
    this.config.default = name
  }

  /** Get disk configuration */
  getDiskConfig(name?: string): DiskConfig | undefined {
    return this.config.disks[name || this.config.default]
  }
}

export const Storage = new StorageManager()
export { StorageManager }
