import { expect, test } from 'bun:test'
import { SqliteCacheStore } from '../src/drivers/sqlite'
import { StacksCache } from '../src/drivers'

const invalidTtls = [NaN, Infinity, -Infinity, -1, Number.MAX_VALUE, null as unknown as number]

test('mget retains every own special key on an ordinary record', async () => {
  const store = new SqliteCacheStore({ path: ':memory:' })
  try {
    const keys = ['__proto__', 'constructor', 'toString', 'hasOwnProperty']
    for (const key of keys) await store.set(key, { key })
    const result = await store.mget(keys)
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
    expect(Object.keys(result).sort()).toEqual(keys.sort())
    for (const key of keys) expect(Object.hasOwn(result, key)).toBe(true)
    expect(JSON.parse(JSON.stringify(result)).__proto__).toEqual({ key: '__proto__' })
  }
  finally { await store.close() }
})

test('SQLite rejects invalid default and per-entry TTLs, rolling back batches', async () => {
  for (const stdTTL of invalidTtls)
    expect(() => new SqliteCacheStore({ path: ':memory:', stdTTL })).toThrow(RangeError)
  const store = new SqliteCacheStore({ path: ':memory:', stdTTL: 2 })
  try {
    await store.set('existing', 'original', 0)
    for (const ttl of invalidTtls) {
      await expect(store.set('existing', 'bad', ttl)).rejects.toThrow(RangeError)
      await expect(store.ttl('missing', ttl)).rejects.toThrow(RangeError)
      await expect(store.mset([{ key: 'existing', value: 'updated' }, { key: 'bad', value: 'bad', ttl }])).rejects.toThrow(RangeError)
      expect(await store.get('existing')).toBe('original')
      expect(await store.has('bad')).toBe(false)
    }
    await store.set('default', 'value')
    expect(await store.getTtl('default')).toBeGreaterThan(Date.now())
    expect(await store.getTtl('existing')).toBe(0)
  }
  finally { await store.close() }
})

test('expired TTL metadata agrees with reads, key listings and stats at the boundary', async () => {
  const store = new SqliteCacheStore({ path: ':memory:' })
  const realNow = Date.now
  try {
    Date.now = () => 1000
    await store.set('short', 'value', 0.5)
    await store.set('forever', 'value', 0)
    expect(await store.getTtl('short')).toBe(1500)
    Date.now = () => 1499
    expect(await store.has('short')).toBe(true)
    Date.now = () => 1500
    expect(await store.getTtl('short')).toBeUndefined()
    expect(await store.ttl('short', 2)).toBe(false)
    expect(await store.get('short')).toBeUndefined()
    expect(await store.keys()).toEqual(['forever'])
    expect((await store.getStats()).keys).toBe(1)
    expect(await store.getTtl('forever')).toBe(0)
  }
  finally { Date.now = realNow; await store.close() }
})

test('SQLite key globs are case-sensitive and only asterisk is a wildcard', async () => {
  const store = new SqliteCacheStore({ path: ':memory:', prefix: 'Tenant' })
  try {
    const keys = ['Case', 'case', 'a?x', 'a[x', 'a]x', 'a%x', 'a_x', 'a\\x', 'abx', '']
    for (const key of keys) await store.set(key, key)
    expect(await store.keys('Case')).toEqual(['Case'])
    expect(await store.keys('C*')).toEqual(['Case'])
    expect(await store.keys('c*')).toEqual(['case'])
    for (const key of keys) expect(await store.keys(key)).toEqual([key])
    expect((await store.keys('a*x')).length).toBe(7)
    const cache = new StacksCache(store)
    await cache.tags(['Case']).put('upper', 1)
    await cache.tags(['case']).put('lower', 2)
    await cache.tags(['Case']).flush()
    expect(await cache.get('upper')).toBeUndefined()
    expect(await cache.get('lower')).toBe(2)
  }
  finally { await store.close() }
})
