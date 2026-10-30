import { afterAll, describe, expect, spyOn, test } from 'bun:test'
import { RedisClient } from 'bun'
import process from 'node:process'
import cacheConfig from '../../../../../config/cache'
import queueConfig from '../../../../../config/queue'
import realtimeConfig from '../../../../../config/realtime'
import { cacheFromConfig, redisNamespacesInside } from '../src/drivers/index'

// stacksjs/stacks#3075. The cache lists its keys as `<prefix>:*`, and the
// shipped prefix was `stacks`, under which the queue (`stacks:queue`), failed
// jobs, batches and realtime all keep theirs. On a shared Redis, flush()
// deleted every queued job.

const shipped = { cache: cacheConfig, queue: queueConfig, realtime: realtimeConfig }

describe('the Redis namespaces the shipped config gives each subsystem', () => {
  test('the cache prefix holds none of the others', () => {
    expect(redisNamespacesInside(cacheConfig.prefix, shipped)).toEqual([])
  })

  test('a cache prefix of `stacks` holds all of them', () => {
    expect(redisNamespacesInside('stacks', shipped).sort()).toEqual(['stacks:batches', 'stacks:failed', 'stacks:queue', 'stacks:realtime:'])
  })

  test('no cache prefix at all means the whole database', () => {
    expect(redisNamespacesInside('', shipped)).toHaveLength(4)
  })
})

// Live: keys shaped like the other subsystems', on the same Redis as a cache
// using the shipped prefix. Its flush may only take its own.
const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379/0'
const tag = `ns-${process.pid}`
const admin = new RedisClient(url)
const others = [`stacks:queue:${tag}:wait`, `stacks:failed:${tag}`, `stacks:batches:${tag}`, `stacks:realtime:${tag}`]
const cache = cacheFromConfig({ driver: 'redis', prefix: cacheConfig.prefix, drivers: { redis: { url } } }, shipped)

afterAll(async () => {
  await admin.send('DEL', others)
  await cache.close?.()
  admin.close()
})

describe('flushing the cache on a Redis the queue and realtime share', () => {
  test('deletes the cache entries and leaves every other namespace alone', async () => {
    for (const key of others)
      await admin.send('SET', [key, 'kept'])
    await cache.set(`${tag}:entry`, 'cached')

    await cache.flush()

    expect(await cache.get(`${tag}:entry`)).toBeUndefined()
    expect(await admin.send('EXISTS', others)).toBe(others.length)
  })
})

describe('an app whose own config/cache.ts still says `stacks`', () => {
  test('is warned once that its cache holds the other namespaces', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const first = cacheFromConfig({ driver: 'redis', prefix: 'stacks', drivers: { redis: { url } } }, shipped)
      const second = cacheFromConfig({ driver: 'redis', prefix: 'stacks', drivers: { redis: { url } } }, shipped)
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0]?.[0])).toContain('stacks:queue')
      await first.close?.()
      await second.close?.()
    }
    finally {
      warn.mockRestore()
    }
  })
})
