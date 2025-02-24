// memory-cache-driver.ts
import { BentoCache, bentostore } from 'bentocache'
import { memoryDriver } from 'bentocache/drivers/memory'
import { BaseCacheDriver } from './base'

export class MemoryCacheDriver extends BaseCacheDriver {
  constructor(options: { maxSize?: number, maxItems?: number } = {}) {
    const client = new BentoCache({
      default: 'memory',
      stores: {
        memory: bentostore().useL1Layer(
          memoryDriver({
            maxSize: options.maxSize ?? 10 * 1024 * 1024, // Default: 10MB
            maxItems: options.maxItems ?? 1000,
          }),
        ),
      },
    })

    super(client)
  }
}

// Export a singleton instance with default config
export const memory: MemoryCacheDriver = new MemoryCacheDriver()
