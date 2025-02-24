// base-cache-driver.ts
import type { CacheDriver } from '@stacksjs/types'
import type { BentoCache } from 'bentocache'
import type { GetOptions } from 'bentocache/types'

/**
 * Base implementation of the cache driver interface.
 * Provides common implementation for all cache drivers.
 */
export abstract class BaseCacheDriver implements CacheDriver {
  constructor(protected client: BentoCache<Record<string, any>>) {}

  async set(key: string, value: string, ttl?: number): Promise<void> {
    const data: { key: string, value: string, gracePeriod?: { enabled: boolean, duration: string } } = {
      key,
      value,
    }

    if (ttl) {
      data.gracePeriod = {
        enabled: true,
        duration: `${ttl}m`,
      }
    }

    await this.client.set(data)
  }

  async setForever(key: string, value: string): Promise<void> {
    await this.client.setForever({
      key,
      value,
    })
  }

  async get<T>(key: GetOptions<T>): Promise<T> {
    return await this.client.get<T>(key)
  }

  async getOrSet<T>(key: string, value: T): Promise<T> {
    return await this.client.getOrSet<T>({
      key,
      factory: async () => value,
    })
  }

  async del(key: string): Promise<void> {
    await this.client.delete({ key })
  }

  async deleteMany(keys: string[]): Promise<void> {
    await this.client.deleteMany({ keys })
  }

  async remove(key: string): Promise<void> {
    await this.client.delete({ key })
  }

  async has(key: string): Promise<boolean> {
    return await this.client.has({ key })
  }

  async missing(key: string): Promise<boolean> {
    return await this.client.missing({ key })
  }

  async deleteAll(): Promise<void> {
    await this.client.clear()
  }

  async clear(): Promise<void> {
    await this.client.clear()
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect()
  }

  get bentoCacheClient(): BentoCache<Record<string, any>> {
    return this.client
  }
}
