/**
 * A prefixed SingleStore cache flushes and lists its own namespace only.
 *
 * The namespace is matched with `LIKE '<prefix>:%'`, and `_` and `%` in a
 * prefix are LIKE wildcards: `tenant_1` also matched `tenantX1:...`, so its
 * `flush()` deleted another namespace's entries and `keys()` listed them.
 *
 * As in singlestore-ttl.test.ts no SingleStore runs here. The statements the
 * store issues are executed by SQLite, with `ESCAPE '\'` added to stand in for
 * the backslash that SingleStore and MySQL use as LIKE's default escape.
 */

import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { SingleStoreCacheStore } from '../src/drivers/singlestore'

function storeOver(db: Database, prefix: string): SingleStoreCacheStore {
  const store = new SingleStoreCacheStore({ database: 'test_cache', table: 'cache', prefix })
  ;(store as any).ready = Promise.resolve()
  ;(store as any).sql = {
    async unsafe(query: string, params: unknown[] = []) {
      const sqlite = query.replace(/LIKE \?/g, `LIKE ? ESCAPE '\\'`)
      if (/^\s*SELECT/i.test(sqlite))
        return db.query(sqlite).all(...(params as any[]))
      return { affectedRows: db.query(sqlite).run(...(params as any[])).changes }
    },
  }
  return store
}

function tableWith(keys: string[]): Database {
  const db = new Database(':memory:')
  db.run('CREATE TABLE cache (cache_key TEXT PRIMARY KEY, value TEXT, expires_at INTEGER)')
  for (const key of keys)
    db.query('INSERT INTO cache VALUES (?, ?, NULL)').run(key, '"v"')
  return db
}

describe('SingleStoreCacheStore namespaces', () => {
  test('a prefix holding a LIKE wildcard keeps to its own keys', async () => {
    const db = tableWith(['tenant_1:item', 'tenantX1:item', 'tenant%1:item'])
    const store = storeOver(db, 'tenant_1')

    expect(await store.keys()).toEqual(['item'])

    await store.flush()
    const left = db.query('SELECT cache_key FROM cache ORDER BY cache_key').all().map((row: any) => row.cache_key)
    expect(left).toEqual(['tenant%1:item', 'tenantX1:item'])
  })

  test('a pattern passed to keys() keeps its own escapes', async () => {
    const store = storeOver(tableWith(['app:foo_1', 'app:fooX1']), 'app')

    expect(await store.keys('foo\\_1')).toEqual(['foo_1'])
    expect((await store.keys('foo_1')).sort()).toEqual(['fooX1', 'foo_1'])
  })
})
