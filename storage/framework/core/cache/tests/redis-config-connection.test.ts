import { afterAll, describe, expect, test } from 'bun:test'
import process from 'node:process'
import type { CacheSettings } from '../src/drivers/index'
import { cacheFromConfig } from '../src/drivers/index'

// stacksjs/stacks#3071. The Redis driver reached REDIS_URL or localhost:6379
// whatever config/cache.ts said, so an app with Redis anywhere else had no
// setting that worked. REDIS_URL names the server here, and is hidden while
// each cache is built, so a cache can only get there from config's parts.

const live = new URL(process.env.REDIS_URL || 'redis://127.0.0.1:6379/0')
const parts = {
  host: live.hostname,
  port: Number(live.port || 6379),
  username: live.username ? decodeURIComponent(live.username) : '',
  password: live.password ? decodeURIComponent(live.password) : '',
  database: Number(live.pathname.slice(1) || 0),
}

function build(redis: NonNullable<CacheSettings['drivers']>['redis']): ReturnType<typeof cacheFromConfig> {
  const redisUrl = process.env.REDIS_URL
  delete process.env.REDIS_URL
  try {
    return cacheFromConfig({ driver: 'redis', prefix: `stacks:config-connection:${process.pid}`, drivers: { redis } })
  }
  finally {
    if (redisUrl !== undefined)
      process.env.REDIS_URL = redisUrl
  }
}

// No url at all, as config/cache.ts had: this is the case that went to
// localhost:6379 before ts-cache 0.1.8.
const withoutUrl = build(parts)
// An empty url, as config/cache.ts has now when REDIS_URL is unset.
const withEmptyUrl = build({ url: '', ...parts })

afterAll(async () => {
  for (const cache of [withoutUrl, withEmptyUrl]) {
    await cache.del('reached')
    await cache.close?.()
  }
})

describe('the Redis cache config/cache.ts describes', () => {
  test('reaches the host and port it names when there is no url', async () => {
    expect(await withoutUrl.set('reached', { by: 'parts' }, 30)).toBe(true)
    expect(await withoutUrl.get('reached')).toEqual({ by: 'parts' })
  })

  test('reaches them too when the url is empty', async () => {
    expect(await withEmptyUrl.set('reached', { by: 'empty url' }, 30)).toBe(true)
    expect(await withEmptyUrl.get('reached')).toEqual({ by: 'empty url' })
  })
})
