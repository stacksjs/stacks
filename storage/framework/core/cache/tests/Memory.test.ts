import { beforeEach, describe, expect, it } from 'bun:test'
import { createMemoryCache, memory } from '../src'

beforeEach(async () => {
  await memory.clear()
})

describe('@stacksjs/cache - Memory', () => {
  it('should set and get a memory cache value', async () => {
    await memory.set('key1', 'value1')
    expect(await memory.get('key1')).toBe('value1')
  })

  it('should set a memory cache value with no TTL and get it', async () => {
    await memory.setForever('key2', 'value2')
    expect(await memory.get('key2')).toBe('value2')
  })

  it('should get or set a memory cache value if not set', async () => {
    expect(await memory.get('key3')).toBeUndefined()

    await memory.getOrSet('key3', async () => 'value3')
    expect(await memory.get('key3')).toBe('value3')
  })

  it('should delete a memory cache value', async () => {
    await memory.set('key4', 'value4')
    await memory.del('key4')
    expect(await memory.get('key4')).toBeUndefined()
  })

  it('should delete multiple memory cache values', async () => {
    await memory.set('key5', 'value5')
    await memory.set('key6', 'value6')
    await memory.deleteMany(['key5', 'key6'])

    expect(await memory.get('key5')).toBeUndefined()
    expect(await memory.get('key6')).toBeUndefined()
  })

  it('should check if a key exists in memory cache', async () => {
    await memory.set('key7', 'value7')
    expect(await memory.has('key7')).toBe(true)
  })

  it('should return false if a key is missing in memory cache', async () => {
    expect(await memory.missing('nonExistentKey')).toBe(true)
    await memory.set('key8', 'value8')
    expect(await memory.missing('key8')).toBe(false)
  })

  it('should clear all memory cache values', async () => {
    await memory.set('key9', 'value9')
    await memory.set('key10', 'value10')
    await memory.clear()

    expect(await memory.get('key9')).toBeUndefined()
    expect(await memory.get('key10')).toBeUndefined()
  })

  it('should remove a specific memory cache value', async () => {
    await memory.set('key11', 'value11')
    await memory.remove('key11')

    expect(await memory.get('key11')).toBeUndefined()
  })

  it('should support batch operations', async () => {
    await memory.mset([
      { key: 'batch1', value: 'v1' },
      { key: 'batch2', value: 'v2' },
    ])

    const values = await memory.mget(['batch1', 'batch2'])
    expect(values.batch1).toBe('v1')
    expect(values.batch2).toBe('v2')
  })

  it('should take (get and delete) a value', async () => {
    await memory.set('take-key', 'take-value')
    const value = await memory.take('take-key')
    expect(value).toBe('take-value')
    expect(await memory.has('take-key')).toBe(false)
  })

  it('should get cache statistics', async () => {
    await memory.set('stats-key', 'value')
    await memory.get('stats-key')
    await memory.get('non-existent')

    const stats = await memory.getStats()
    expect(stats).toHaveProperty('hits')
    expect(stats).toHaveProperty('misses')
    expect(stats).toHaveProperty('keys')
  })

  it('should create a custom memory cache with factory', async () => {
    const customCache = createMemoryCache({
      maxKeys: 100,
      prefix: 'custom',
    })

    await customCache.set('custom-key', 'custom-value')
    expect(await customCache.get('custom-key')).toBe('custom-value')

    await customCache.close()
  })
})
