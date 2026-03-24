import { beforeEach, describe, expect, test } from 'bun:test'
import { cache, createMemoryCache } from '../src/drivers/index'

describe('Cache Integration', () => {
  beforeEach(async () => {
    await cache.clear()
  })

  test('set and get a value', async () => {
    await cache.set('user:1', { name: 'Chris', role: 'admin' })
    const result = await cache.get('user:1')
    expect(result).toEqual({ name: 'Chris', role: 'admin' })
  })

  test('get returns undefined for missing key', async () => {
    const result = await cache.get('nonexistent')
    expect(result).toBeUndefined()
  })

  test('has returns true/false correctly', async () => {
    expect(await cache.has('key')).toBe(false)
    await cache.set('key', 'value')
    expect(await cache.has('key')).toBe(true)
  })

  test('missing is inverse of has', async () => {
    expect(await cache.missing('key')).toBe(true)
    await cache.set('key', 'value')
    expect(await cache.missing('key')).toBe(false)
  })

  test('delete removes a key', async () => {
    await cache.set('key', 'value')
    await cache.del('key')
    expect(await cache.has('key')).toBe(false)
  })

  test('clear removes all keys', async () => {
    await cache.set('a', 1)
    await cache.set('b', 2)
    await cache.set('c', 3)
    await cache.clear()
    expect(await cache.has('a')).toBe(false)
    expect(await cache.has('b')).toBe(false)
  })

  test('mset and mget for batch operations', async () => {
    await cache.mset([
      { key: 'x', value: 10 },
      { key: 'y', value: 20 },
      { key: 'z', value: 30 },
    ])
    const result = await cache.mget(['x', 'y', 'z'])
    expect(result.x).toBe(10)
    expect(result.y).toBe(20)
    expect(result.z).toBe(30)
  })

  test('take gets and deletes atomically', async () => {
    await cache.set('temp', 'data')
    const val = await cache.take('temp')
    expect(val).toBe('data')
    expect(await cache.has('temp')).toBe(false)
  })

  test('setForever persists without TTL', async () => {
    await cache.setForever('permanent', 'stays')
    expect(await cache.get('permanent')).toBe('stays')
  })

  test('remember caches callback result', async () => {
    let callCount = 0
    const result1 = await cache.remember('computed', 60, () => {
      callCount++
      return 'expensive-value'
    })
    const result2 = await cache.remember('computed', 60, () => {
      callCount++
      return 'should-not-run'
    })
    expect(result1).toBe('expensive-value')
    expect(result2).toBe('expensive-value')
    expect(callCount).toBe(1) // callback only ran once
  })

  test('rememberForever caches permanently', async () => {
    let called = 0
    await cache.rememberForever('perm', () => { called++; return 42 })
    await cache.rememberForever('perm', () => { called++; return 99 })
    expect(called).toBe(1)
    expect(await cache.get('perm')).toBe(42)
  })

  test('getOrSet works like remember', async () => {
    const val = await cache.getOrSet('auto', () => 'computed', 60)
    expect(val).toBe('computed')
    const val2 = await cache.getOrSet('auto', () => 'new', 60)
    expect(val2).toBe('computed') // cached
  })

  test('getStats tracks hits and misses', async () => {
    await cache.set('tracked', 'data')
    await cache.get('tracked') // hit
    await cache.get('nope') // miss
    const stats = await cache.getStats()
    expect(stats.hits).toBeGreaterThan(0)
    expect(stats.keys).toBeGreaterThan(0)
  })

  test('separate instances are independent', async () => {
    const cache1 = createMemoryCache({ prefix: 'c1:' })
    const cache2 = createMemoryCache({ prefix: 'c2:' })
    await cache1.set('key', 'from-1')
    await cache2.set('key', 'from-2')
    expect(await cache1.get('key')).toBe('from-1')
    expect(await cache2.get('key')).toBe('from-2')
  })

  test('stores different data types', async () => {
    await cache.set('string', 'hello')
    await cache.set('number', 42)
    await cache.set('bool', true)
    await cache.set('array', [1, 2, 3])
    await cache.set('object', { nested: { deep: true } })
    await cache.set('null', null)

    expect(await cache.get('string')).toBe('hello')
    expect(await cache.get('number')).toBe(42)
    expect(await cache.get('bool')).toBe(true)
    expect(await cache.get('array')).toEqual([1, 2, 3])
    expect(await cache.get('object')).toEqual({ nested: { deep: true } })
    expect(await cache.get('null')).toBeNull()
  })

  test('del returns count of deleted keys', async () => {
    await cache.set('d1', 'v1')
    await cache.set('d2', 'v2')
    const count = await cache.del(['d1', 'd2'])
    expect(count).toBe(2)
  })

  test('overwrite existing key with set', async () => {
    await cache.set('ow', 'first')
    await cache.set('ow', 'second')
    expect(await cache.get('ow')).toBe('second')
  })
})
