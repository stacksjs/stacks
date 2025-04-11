// filesystem-cache-driver.ts
import { BentoCache, bentostore } from 'bentocache'
import { fileDriver } from 'bentocache/drivers/file'
import { BaseCacheDriver } from './base'

export interface FileSystemOptions {
  directory?: string
  pruneInterval?: string
}

export class FileSystemCacheDriver extends BaseCacheDriver {
  constructor(options: FileSystemOptions = {}) {
    const client = new BentoCache({
      default: 'file',
      stores: {
        file: bentostore().useL2Layer(
          fileDriver({
            directory: options.directory ?? './cache',
            pruneInterval: options.pruneInterval ?? '1h',
          }),
        ),
      },
    })

    super(client)
  }
}

// Export a singleton instance with default config
export const fileSystem: FileSystemCacheDriver = new FileSystemCacheDriver()
