import { expect, test } from 'bun:test'
import { SingleStoreCacheStore } from '../src/drivers/singlestore'

// The SQL service boundary fails its first request, then recovers. No module
// mocks: other tests keep their own real SQLite or Redis connections.
test('SingleStore initialization retries after a transient service failure', async () => {
  const store = new SingleStoreCacheStore()
  let requests = 0
  // The driver currently constructs Bun.SQL internally, as in its other
  // provider contract tests. Only the external service transport is replaced.
  Object.assign(store, { sql: {
    async unsafe(query: string) {
      requests++
      if (requests === 1) throw new Error('temporary connection failure')
      if (query.startsWith('CREATE')) return []
      return [{ value: '"recovered"', expires_at: null }]
    },
  } })
  await expect(store.get('key')).rejects.toThrow('temporary connection failure')
  expect(await store.get('key')).toBe('recovered')
})
