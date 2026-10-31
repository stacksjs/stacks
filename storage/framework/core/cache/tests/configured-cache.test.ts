import { describe, expect, it } from 'bun:test'
import { cacheFromConfig, memory } from '../src'

/*
 * `cache` follows config/cache.ts. It was the memory instance whatever the
 * config said, so `driver: 'redis'` (or `'sqlite'`, to keep entries across a
 * deploy) changed nothing.
 */
describe('the configured cache', () => {
  it('is the memory instance itself for a bare memory driver, and when nothing is configured', () => {
    expect(cacheFromConfig({ driver: 'memory' })).toBe(memory)
    expect(cacheFromConfig({})).toBe(memory)
  })

  it('reads the application config when given none, which the shipped file makes a configured memory cache', async () => {
    const cache = cacheFromConfig(undefined)
    await cache.set('probe', 'v')
    expect(await cache.get('probe')).toBe('v')
    // The shipped config/cache.ts sets a TTL, so the default driver now honours it.
    expect(await cache.getTtl('probe')).toBeGreaterThan(Date.now())
    await cache.close?.()
  })

  // stacksjs/stacks#3072: the shipped config set ttl, prefix and maxKeys, and the default driver ignored all three.
  it('applies the configured ttl to memory as the default expiry, and an explicit ttl still wins', async () => {
    const cache = cacheFromConfig({ driver: 'memory', ttl: 1, prefix: 'probe' })
    expect(cache).not.toBe(memory)
    await cache.set('k', 'v')
    await cache.set('long', 'v', 60)
    expect(await cache.getTtl('k')).toBeGreaterThan(Date.now())
    await Bun.sleep(1500)
    expect(await cache.get('k')).toBeUndefined()
    expect(await cache.get('long')).toBe('v')
    await cache.close?.()
  })

  it('applies maxKeys and useClones to memory, from the top level or from drivers.memory', async () => {
    const small = cacheFromConfig({ driver: 'memory', maxKeys: 1 })
    await small.set('a', 1)
    await expect(Promise.resolve().then(() => small.set('b', 2))).rejects.toThrow()
    const nested = cacheFromConfig({ driver: 'memory', drivers: { memory: { maxKeys: 1 } } })
    await nested.set('a', 1)
    await expect(Promise.resolve().then(() => nested.set('b', 2))).rejects.toThrow()

    const object = { n: 1 }
    const shared = cacheFromConfig({ driver: 'memory', useClones: false })
    await shared.set('o', object)
    expect(await shared.get('o')).toBe(object)
    const cloned = cacheFromConfig({ driver: 'memory', useClones: true })
    await cloned.set('o', object)
    expect(await cloned.get('o')).not.toBe(object)
  })

  it('keeps one memory cache per configuration, so two configured caches do not share entries', async () => {
    const a = cacheFromConfig({ driver: 'memory', ttl: 60 })
    const b = cacheFromConfig({ driver: 'memory', ttl: 60 })
    await a.set('k', 'v')
    expect(await b.get('k')).toBeUndefined()
  })

  it('builds the SQLite driver from its options, with the configured prefix and TTL', async () => {
    const sqlite = cacheFromConfig({ driver: 'sqlite', prefix: 'app', ttl: 60, drivers: { sqlite: { path: ':memory:' } } })
    expect(sqlite).not.toBe(memory)
    await sqlite.set('k', 'v')
    expect(await sqlite.get('k')).toBe('v')
    expect(await memory.get('k')).toBeUndefined()
    // The configured TTL is the default expiry.
    expect(await sqlite.getTtl('k')).toBeGreaterThan(Date.now())
    await sqlite.close?.()
  })

  it('builds Redis and SingleStore drivers without connecting until used', () => {
    expect(cacheFromConfig({ driver: 'redis', drivers: { redis: { host: '127.0.0.1', port: 6399 } } })).not.toBe(memory)
    expect(cacheFromConfig({ driver: 'singlestore', drivers: { singlestore: { host: '127.0.0.1', port: 3399 } } })).not.toBe(memory)
  })
})
