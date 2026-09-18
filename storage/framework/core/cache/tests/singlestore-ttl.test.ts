/**
 * `ttl()` must not read an affected-row count as "is this key here".
 * stacksjs/stacks#2639.
 *
 * SingleStore speaks the MySQL wire protocol, which reports rows a statement
 * CHANGED rather than rows it MATCHED. Writing an expiry a key already carries
 * therefore reports zero, and `ttl(key, 0)` on a key that never had one writes
 * NULL over NULL, which is the most ordinary call there is. Measured over that
 * protocol: `ttl(key, 60)` answered true and an immediate repeat answered
 * false, for a key sitting in the table with exactly the requested expiry.
 *
 * The connection is stubbed rather than live. `CREATE ROWSTORE TABLE` is
 * SingleStore syntax that MySQL rejects outright, so the store cannot
 * initialise against a plain MySQL server, and no SingleStore runs in CI. What
 * is pinned here is this class's own logic against the reporting contract the
 * protocol documents, not SingleStore's behaviour: the counts below are what
 * the wire protocol returns.
 */

import { describe, expect, test } from 'bun:test'
import { SingleStoreCacheStore } from '../src/drivers/singlestore'

interface Issued { query: string, params: unknown[] }

/**
 * A store whose connection answers writes with `affectedRows` and reads with
 * rows, recording every statement. `ready` is pre-resolved so the ROWSTORE DDL
 * never runs.
 */
function storeWith(options: { affectedRows: number, exists: boolean }): { store: SingleStoreCacheStore, issued: Issued[] } {
  const issued: Issued[] = []
  const store = new SingleStoreCacheStore({ database: 'test_cache' })

  ;(store as any).ready = Promise.resolve()
  ;(store as any).sql = {
    async unsafe(query: string, params: unknown[] = []) {
      issued.push({ query, params })
      if (/^\s*SELECT/i.test(query))
        return options.exists ? [{ 1: 1 }] : []
      return { affectedRows: options.affectedRows }
    },
  }

  return { store, issued }
}

describe('SingleStoreCacheStore.ttl (#2639)', () => {
  test('a changed expiry reports success without a second read', async () => {
    const { store, issued } = storeWith({ affectedRows: 1, exists: true })

    expect(await store.ttl('k', 60)).toBe(true)
    // Only the zero path pays for the existence check.
    expect(issued).toHaveLength(1)
    expect(issued[0].query).toContain('UPDATE')
  })

  test('re-writing the expiry a key already has still reports success', async () => {
    // MySQL changed nothing, so it reported zero. The key is still there.
    const { store, issued } = storeWith({ affectedRows: 0, exists: true })

    expect(await store.ttl('k', 60)).toBe(true)
    expect(issued).toHaveLength(2)
    expect(issued[1].query).toContain('SELECT')
    expect(issued[1].params).toEqual(['k'])
  })

  test('clearing the expiry of a key that never had one reports success', async () => {
    // ttl(key, 0) writes NULL over NULL: nothing changed, everything matched.
    const { store, issued } = storeWith({ affectedRows: 0, exists: true })

    expect(await store.ttl('k', 0)).toBe(true)
    expect(issued[0].params[0]).toBeNull()
  })

  test('a key that is not there still reports failure', async () => {
    const { store } = storeWith({ affectedRows: 0, exists: false })

    expect(await store.ttl('missing', 60)).toBe(false)
  })

  test('the prefix reaches the existence check too', async () => {
    const { store, issued } = storeWith({ affectedRows: 0, exists: true })
    ;(store as any).prefix = 'app'

    expect(await store.ttl('k', 60)).toBe(true)
    expect(issued[1].params).toEqual(['app:k'])
  })
})
