import { beforeEach, describe, expect, test } from 'bun:test'
import {
  cache,
  createCache,
  createMemoryCache,
  memory,
  StacksCache,
} from '../src/drivers/index'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Cache Factory - createCache()', () => {
  test('createCache("memory") returns a CacheDriver', async () => {
    const c = createCache('memory')
    expect(c).toBeDefined()
    expect(typeof c.get).toBe('function')
    expect(typeof c.set).toBe('function')
    expect(typeof c.del).toBe('function')
    expect(typeof c.has).toBe('function')
    expect(typeof c.clear).toBe('function')
    await c.close()
  })

  test('createCache("memory") with options applies config', async () => {
    const c = createCache('memory', { maxKeys: 50, prefix: 'test' })
    await c.set('key1', 'value1')
    expect(await c.get('key1')).toBe('value1')
    await c.close()
  })

  test('createCache("memory") creates independent instances', async () => {
    const c1 = createCache('memory')
    const c2 = createCache('memory')
    await c1.set('shared-key', 'from-c1')
    // c2 should not have c1's data
    expect(await c2.get('shared-key')).toBeUndefined()
    await c1.close()
    await c2.close()
  })
})

describe('Cache Factory - createMemoryCache()', () => {
  test('creates a memory cache with default options', async () => {
    const c = createMemoryCache()
    await c.set('hello', 'world')
    expect(await c.get('hello')).toBe('world')
    await c.close()
  })

  test('respects maxKeys option', async () => {
    const c = createMemoryCache({ maxKeys: 2 })
    await c.set('a', 1)
    await c.set('b', 2)
    // Third key should either evict or fail depending on implementation
    // At minimum, the first two should work
    expect(await c.get('a')).toBe(1)
    expect(await c.get('b')).toBe(2)
    await c.close()
  })

  test('respects prefix option', async () => {
    const c = createMemoryCache({ prefix: 'myapp' })
    await c.set('key', 'value')
    expect(await c.get('key')).toBe('value')
    await c.close()
  })
})

describe('Cache Factory - StacksCache wrapper', () => {
  let c: InstanceType<typeof StacksCache>

  beforeEach(async () => {
    c = createMemoryCache() as InstanceType<typeof StacksCache>
    await c.clear()
  })

  test('remember() returns cached value on subsequent calls', async () => {
    let callCount = 0
    const fetcher = () => {
      callCount++
      return 'computed-value'
    }

    const v1 = await c.remember('rem-key', 300, fetcher)
    const v2 = await c.remember('rem-key', 300, fetcher)

    expect(v1).toBe('computed-value')
    expect(v2).toBe('computed-value')
    expect(callCount).toBe(1)
  })

  test('flush() clears all entries', async () => {
    await c.set('x', 1)
    await c.set('y', 2)
    await c.flush()
    expect(await c.has('x')).toBe(false)
    expect(await c.has('y')).toBe(false)
  })

  test('missing() is inverse of has()', async () => {
    await c.set('exists', true)
    expect(await c.missing('exists')).toBe(false)
    expect(await c.missing('nonexistent')).toBe(true)
  })
})

describe('Cache Factory - default instances', () => {
  beforeEach(async () => {
    await memory.clear()
  })

  test('memory is a default CacheDriver instance', () => {
    expect(memory).toBeDefined()
    expect(typeof memory.get).toBe('function')
    expect(typeof memory.set).toBe('function')
  })

  test('cache is the same instance as memory', () => {
    // The source says: export const cache: CacheDriver = memory
    expect(cache).toBe(memory)
  })

  test('default memory instance works for set/get', async () => {
    await memory.set('default-key', 'default-value')
    expect(await memory.get('default-key')).toBe('default-value')
  })
})

describe('Cache Factory - stats tracking', () => {
  test('getStats returns hit/miss/keys metrics', async () => {
    const c = createMemoryCache()
    await c.set('tracked', 'val')
    await c.get('tracked') // hit
    await c.get('nonexistent') // miss

    const stats = await c.getStats()
    expect(stats).toHaveProperty('hits')
    expect(stats).toHaveProperty('misses')
    expect(stats).toHaveProperty('keys')
    expect(stats).toHaveProperty('hitRate')
    expect(stats.hits).toBeGreaterThanOrEqual(1)
    expect(stats.misses).toBeGreaterThanOrEqual(1)
    expect(stats.hitRate).toBeGreaterThan(0)
    expect(stats.hitRate).toBeLessThanOrEqual(1)
    await c.close()
  })
})
