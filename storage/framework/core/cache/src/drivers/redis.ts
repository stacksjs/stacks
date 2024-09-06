import { BentoCache, bentostore } from 'bentocache'
import { redisDriver } from 'bentocache/drivers/redis'
import type { RedisCacheDriver } from './type'

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

export const redis: RedisCacheDriver = {
  async set(key: string, value: string, ttl?: number): Promise<void> {
    await client.set({
      key,
      value,
      gracePeriod: { enabled: true, duration: '5m' },
    })
  },
  async setForever(key: string, value: string, ttl?: number): Promise<void> {
    await client.setForever({
      key,
      value,
      gracePeriod: { enabled: true, duration: '5m' },
    })
  },
  async get(key: string): Promise<string | undefined | null> {
    const items = await client.get<string>(key)

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
    return await client.has({ key })
  },
  async deleteAll(): Promise<void> {
    await client.clear()
  },
  async disconnect(): Promise<void> {
    await client.disconnect()
  },
  client,
}
