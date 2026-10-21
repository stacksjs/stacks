import { describe, expect, it } from 'bun:test'
import { cacheFromConfig, memory } from '../src'

/*
 * `cache` follows config/cache.ts. It was the memory instance whatever the
 * config said, so `driver: 'redis'` (or `'sqlite'`, to keep entries across a
 * deploy) changed nothing.
 */
describe('the configured cache', () => {
  it('is the memory instance itself for memory, and when nothing is configured', () => {
    expect(cacheFromConfig({ driver: 'memory' })).toBe(memory)
    expect(cacheFromConfig(undefined)).toBe(memory)
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
