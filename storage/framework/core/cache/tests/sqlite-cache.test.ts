import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCache, SqliteCacheStore } from '../src'

const dirs: string[] = []
function file(): string {
  const dir = mkdtempSync(join(tmpdir(), 'stacks-sqlite-cache-'))
  dirs.push(dir)
  return join(dir, 'nested', 'cache.sqlite')
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

describe('the SQLite cache driver', () => {
  it('keeps what it computed across a restart: a new store on the same file has it', async () => {
    const path = file()
    let measured = 0
    const measure = async () => { measured++; return [{ mi: 0, ft: 4000 }, { mi: 3, ft: 4500 }] }
    const first = createCache('sqlite', { path })
    expect(await first.getOrSet('trail-profile:7', measure, 3600)).toEqual([{ mi: 0, ft: 4000 }, { mi: 3, ft: 4500 }])
    await first.close?.()

    // A deploy: a new process, the same file.
    const second = createCache('sqlite', { path })
    expect(await second.getOrSet('trail-profile:7', measure, 3600)).toEqual([{ mi: 0, ft: 4000 }, { mi: 3, ft: 4500 }])
    expect(measured).toBe(1)
  })

  it('expires an entry after its TTL, and keeps one without a TTL', async () => {
    const store = new SqliteCacheStore({ path: ':memory:' })
    await store.set('short', 'a', 1)
    await store.set('forever', 'b')
    expect(await store.get('short')).toBe('a')
    expect(await store.getTtl('forever')).toBe(0)
    const later = Date.now() + 1500
    const realNow = Date.now
    Date.now = () => later
    try {
      expect(await store.get('short')).toBeUndefined()
      expect(await store.get('forever')).toBe('b')
    }
    finally { Date.now = realNow }
  })

  it('round-trips JSON values, overwrites, deletes and takes', async () => {
    const store = new SqliteCacheStore({ path: ':memory:' })
    await store.set('k', { nested: [1, 'two', null] })
    expect(await store.get('k')).toEqual({ nested: [1, 'two', null] })
    await store.set('k', 'replaced')
    expect(await store.get('k')).toBe('replaced')
    expect(await store.take('k')).toBe('replaced')
    expect(await store.has('k')).toBe(false)
    await store.mset([{ key: 'a', value: 1 }, { key: 'b', value: 2 }])
    expect(await store.mget(['a', 'b', 'c'])).toEqual({ a: 1, b: 2 })
    expect(await store.del(['a', 'b'])).toBe(2)
  })

  it('answers ttl() for a key that is there even when the expiry does not change', async () => {
    const store = new SqliteCacheStore({ path: ':memory:' })
    await store.set('k', 1)
    expect(await store.ttl('k', 0)).toBe(true)
    expect(await store.ttl('k', 0)).toBe(true)
    expect(await store.ttl('missing', 60)).toBe(false)
  })

  it('keeps namespaces apart, and takes LIKE wildcards in a pattern literally', async () => {
    const path = file()
    const one = new SqliteCacheStore({ path, prefix: 'one' })
    const two = new SqliteCacheStore({ path, prefix: 'two' })
    await one.set('user_1', 'a')
    await one.set('user%2', 'b')
    await two.set('user_1', 'c')
    expect((await one.keys('user_*')).sort()).toEqual(['user_1'])
    expect((await one.keys()).sort()).toEqual(['user%2', 'user_1'])
    await one.flush()
    expect(await one.keys()).toEqual([])
    expect(await two.get('user_1')).toBe('c')
    expect((await two.getStats()).keys).toBe(1)
  })
})
