import { expect, test } from 'bun:test'
import { SqliteCacheStore } from '../src/drivers/sqlite'

test('concurrent takers receive a cached item only once', async () => {
  const store = new SqliteCacheStore({ path: ':memory:' })
  try {
    await store.set('claim', { id: 42 })
    const results = await Promise.all([store.take('claim'), store.take('claim')])
    expect(results.filter(value => value !== undefined)).toEqual([{ id: 42 }])
    expect(await store.get('claim')).toBeUndefined()
  }
  finally { await store.close() }
})
