import { afterAll, describe, expect, test } from 'bun:test'
import { createRedisCache } from '../src/drivers/index'

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379/0'
const prefix = `stacks:protocol:cache:${process.pid}:`
const cache = createRedisCache({ url: redisUrl, prefix })
const keys = ['round-trip', 'ttl', 'atomic-take', 'many-a', 'many-b']

afterAll(async () => {
  await cache.del(keys)
  await cache.close?.()
})

describe('Redis cache contract', () => {
  test('round-trips structured values without a memory fallback', async () => {
    expect(await cache.set('round-trip', { driver: 'redis', count: 2 })).toBe(true)
    expect(await cache.get('round-trip')).toEqual({ driver: 'redis', count: 2 })
  })

  test('retains TTL and atomic take semantics', async () => {
    await cache.set('ttl', 'expires', 30)
    const expiresAt = await cache.getTtl('ttl')
    expect(expiresAt).toBeGreaterThan(Date.now())
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 30_000)

    await cache.set('atomic-take', 'once')
    expect(await cache.take('atomic-take')).toBe('once')
    expect(await cache.get('atomic-take')).toBeUndefined()
  })

  test('performs multi-key operations against the live service', async () => {
    expect(await cache.mset([{ key: 'many-a', value: 1 }, { key: 'many-b', value: 2 }])).toBe(true)
    expect(await cache.mget<number>(['many-a', 'many-b'])).toEqual({ 'many-a': 1, 'many-b': 2 })
  })
})
