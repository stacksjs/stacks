import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { createRedisCache } from '../src'
import { startRedisServer, stopRedisServer } from './scripts/redis-server'

// Create a Redis cache instance for testing
const redis = createRedisCache({
  host: '127.0.0.1',
  port: 6379,
})

beforeAll(async () => {
  await startRedisServer()
})

beforeEach(async () => {
  await redis.clear()
})

afterAll(async () => {
  await redis.disconnect()
  stopRedisServer()
})

describe('@stacksjs/cache - Redis', () => {
  it('should set and get a redis cache value', async () => {
    await redis.set('key1', 'value1')
    expect(await redis.get('key1')).toBe('value1')
  })

  it('should set a redis cache value with no TTL and get it', async () => {
    await redis.setForever('key2', 'value2')
    expect(await redis.get('key2')).toBe('value2')
  })

  it('should get or set a redis cache value if not set', async () => {
    expect(await redis.get('key3')).toBeUndefined()
    await redis.getOrSet('key3', async () => 'value3')
    expect(await redis.get('key3')).toBe('value3')
  })

  it('should delete a redis cache value', async () => {
    await redis.set('key4', 'value4')
    await redis.del('key4')
    expect(await redis.get('key4')).toBeUndefined()
  })

  it('should delete multiple redis cache values', async () => {
    await redis.set('key5', 'value5')
    await redis.set('key6', 'value6')
    await redis.deleteMany(['key5', 'key6'])
    expect(await redis.get('key5')).toBeUndefined()
    expect(await redis.get('key6')).toBeUndefined()
  })

  it('should check if a key exists in redis cache', async () => {
    await redis.set('key7', 'value7')
    expect(await redis.has('key7')).toBe(true)
  })

  it('should return false if a key is missing in redis cache', async () => {
    expect(await redis.missing('nonExistentKey')).toBe(true)
    await redis.set('key8', 'value8')
    expect(await redis.missing('key8')).toBe(false)
  })

  it('should clear all redis cache values', async () => {
    await redis.set('key9', 'value9')
    await redis.set('key10', 'value10')
    await redis.clear()
    expect(await redis.get('key9')).toBeUndefined()
    expect(await redis.get('key10')).toBeUndefined()
  })

  it('should remove a specific redis cache value', async () => {
    await redis.set('key11', 'value11')
    await redis.remove('key11')
    expect(await redis.get('key11')).toBeUndefined()
  })

  it('should support batch operations', async () => {
    await redis.mset([
      { key: 'batch1', value: 'v1' },
      { key: 'batch2', value: 'v2' },
    ])

    const values = await redis.mget(['batch1', 'batch2'])
    expect(values.batch1).toBe('v1')
    expect(values.batch2).toBe('v2')
  })

  it('should take (get and delete) a value', async () => {
    await redis.set('take-key', 'take-value')
    const value = await redis.take('take-key')
    expect(value).toBe('take-value')
    expect(await redis.has('take-key')).toBe(false)
  })

  it('should get cache statistics', async () => {
    await redis.set('stats-key', 'value')
    await redis.get('stats-key')

    const stats = await redis.getStats()
    expect(stats).toHaveProperty('hits')
    expect(stats).toHaveProperty('misses')
    expect(stats).toHaveProperty('keys')
  })
})
