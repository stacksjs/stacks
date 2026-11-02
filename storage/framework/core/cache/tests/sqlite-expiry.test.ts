import { expect, test } from 'bun:test'
import { SqliteCacheStore } from '../src/drivers/sqlite'

test('changing TTL cannot resurrect an expired entry', async () => {
  const store = new SqliteCacheStore({ path: ':memory:' })
  const realNow = Date.now
  const now = realNow()
  try {
    Date.now = () => now
    await store.set('expired', 'stale', 1)
    await store.set('taken', 'stale', 1)
    Date.now = () => now + 2000
    expect(await store.ttl('expired', 60)).toBe(false)
    expect(await store.get('expired')).toBeUndefined()
    expect(await store.take('taken')).toBeUndefined()
  }
  finally {
    Date.now = realNow
    await store.close()
  }
})
