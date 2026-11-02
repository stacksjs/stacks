import { expect, test } from 'bun:test'
import { StacksCache } from '../src/drivers'
import { SqliteCacheStore } from '../src/drivers/sqlite'

test('a remember hit cannot expire the tag index before a forever value', async () => {
  const store = new SqliteCacheStore({ path: ':memory:' })
  const cache = new StacksCache(store)
  const realNow = Date.now
  const now = realNow()
  try {
    Date.now = () => now
    await cache.tags(['items']).setForever('item', 'value')
    expect(await cache.tags(['items']).remember('item', 1, () => 'unused')).toBe('value')
    Date.now = () => now + 2000
    expect(await cache.tags(['items']).flush()).toBe(1)
    expect(await cache.get('item')).toBeUndefined()
  }
  finally {
    Date.now = realNow
    await cache.close()
  }
})

test('a shorter remember TTL cannot orphan an existing finite-lived value', async () => {
  const store = new SqliteCacheStore({ path: ':memory:' })
  const cache = new StacksCache(store)
  const realNow = Date.now
  const now = realNow()
  try {
    Date.now = () => now
    await cache.set('item', 'value', 60)
    await cache.tags(['items']).remember('item', 1, () => 'unused')
    Date.now = () => now + 2000
    expect(await cache.tags(['items']).flush()).toBe(1)
    expect(await cache.get('item')).toBeUndefined()
  }
  finally {
    Date.now = realNow
    await cache.close()
  }
})
