import type { CacheDriver } from '@stacksjs/types'
import type { GetOptions } from 'bentocache/types'
import { BentoCache, bentostore } from 'bentocache'
import { redisDriver } from 'bentocache/drivers/redis'

const client = new BentoCache({
  default: 'redis',
  stores: {
    redis: bentostore().useL2Layer(
      redisDriver({
        connection: { host: '127.0.0.1', port: 6379 },
      }),
    ),
  },
})

export const redis: CacheDriver = {
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

    await client.set(data)
  },
  async setForever(key: string, value: string): Promise<void> {
    await client.setForever({
      key,
      value,
    })
  },
  async get<T>(key: GetOptions<T>): Promise<T> {
    const items = await client.get<T>(key)

    return items
  },
  async getOrSet<T>(key: string, value: T): Promise<T> {
    const result = await client.getOrSet<T>({
      key,
      factory: async () => value,
    })

    return result
  },
  async del(key: string): Promise<void> {
    await client.delete({ key })
  },
  async deleteMany(keys: string[]): Promise<void> {
    await client.deleteMany({ keys })
  },
  async remove(key: string): Promise<void> {
    await client.delete({ key })
  },
  async has(key: string): Promise<boolean> {
    return await client.has({ key })
  },
  async missing(key: string): Promise<boolean> {
    return await client.missing({ key })
  },
  async deleteAll(): Promise<void> {
    await client.clear()
  },
  async clear(): Promise<void> {
    await client.clear()
  },
  async disconnect(): Promise<void> {
    await client.disconnect()
  },
  client,
}
