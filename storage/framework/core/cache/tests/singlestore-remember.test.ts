/**
 * `remember()` and `getOrSet()` work on the SingleStore cache.
 *
 * `StacksCache` emits a `fetch` event through its store after storing a
 * computed value. The SingleStore store was handed in through
 * `as unknown as CacheManager` and had no `emit`, so every `remember()` wrote
 * its value and then threw `this.manager.emit is not a function` - on every
 * cache miss, which is the only time remember does any work.
 *
 * The connection is an in-memory stand-in answering the store's three
 * statements, as in singlestore-ttl.test.ts: `CREATE ROWSTORE TABLE` is
 * SingleStore syntax no local MySQL accepts, and no SingleStore runs in CI.
 */

import { describe, expect, test } from 'bun:test'
import { StacksCache } from '../src/drivers'
import { SingleStoreCacheStore } from '../src/drivers/singlestore'

function singleStoreCache(): { cache: StacksCache, store: SingleStoreCacheStore, rows: Map<string, { value: string, expires_at: number | null }> } {
  const rows = new Map<string, { value: string, expires_at: number | null }>()
  const store = new SingleStoreCacheStore({ database: 'test_cache' })
  ;(store as any).ready = Promise.resolve()
  ;(store as any).sql = {
    async unsafe(query: string, params: unknown[] = []) {
      if (/^\s*SELECT value, expires_at/i.test(query)) {
        const row = rows.get(String(params[0]))
        return row ? [row] : []
      }
      if (/^\s*INSERT INTO/i.test(query)) {
        rows.set(String(params[0]), { value: String(params[1]), expires_at: params[2] as number | null })
        return { affectedRows: 1 }
      }
      throw new Error(`unexpected statement: ${query}`)
    },
  }
  return { cache: new StacksCache(store), store, rows }
}

describe('the SingleStore cache', () => {
  test('remember() computes once, stores, and returns the value', async () => {
    const { cache, rows } = singleStoreCache()
    let computed = 0

    expect(await cache.remember('report', 60, () => { computed++; return { total: 3 } })).toEqual({ total: 3 })
    expect(await cache.remember('report', 60, () => { computed++; return { total: 4 } })).toEqual({ total: 3 })

    expect(computed).toBe(1)
    expect([...rows.keys()]).toHaveLength(1)
  })

  test('the store hears the fetch, as ts-cache listeners do', async () => {
    const { cache, store } = singleStoreCache()
    const heard: unknown[][] = []
    store.on('fetch', (...args: unknown[]) => heard.push(args))

    await cache.getOrSet('greeting', () => 'hello', 30)

    expect(heard).toEqual([['greeting', 'hello', 30]])
  })
})
