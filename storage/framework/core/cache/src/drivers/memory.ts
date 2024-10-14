import type { CacheDriver } from './type'
import { BentoCache, bentostore } from 'bentocache'
import { memoryDriver } from 'bentocache/drivers/memory'

const client = new BentoCache({
  default: 'memory',
  stores: {
    memory: bentostore().useL1Layer(
      memoryDriver({
        maxSize: 10 * 1024 * 1024,
        maxItems: 1000,
      }),
    ),
  },
})

export const memory: CacheDriver = {
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
  async get(key: string): Promise<string | undefined | null> {
    const items = await client.get<string>(key)

    return items
  },
  async getOrSet(key: string, value: string): Promise<string | undefined | null> {
    const items = await client.getOrSet(key, () => value)

    return items
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
