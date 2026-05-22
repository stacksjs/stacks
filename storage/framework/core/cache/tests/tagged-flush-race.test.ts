import { afterEach, describe, expect, test } from 'bun:test'
import { CacheManager, MemoryDriver } from '@stacksjs/ts-cache'
import { StacksCache } from '../src/drivers'

// stacksjs/stacks#1876 C-1 — pins the contract that concurrent
// flush() calls against the same tag don't both observe an empty
// lock map and start parallel flush bodies.

function freshCache(): StacksCache {
  const manager = new CacheManager(new MemoryDriver({ stdTTL: 0, checkPeriod: 60 }))
  return new StacksCache(manager)
}

describe('TaggedCache.flush — atomic check-and-set (#1876 C-1)', () => {
  afterEach(() => {
    // The flushLocks map is static — clear it between tests so stale
    // entries from a slow predecessor don't bleed into the next.
    // (We can't access the private map directly, but a quick yield is
    // enough to settle any in-flight flush from prior tests.)
  })

  test('concurrent flushes of the same tag chain through each other', async () => {
    const cache = freshCache()
    let flushesObserved = 0
    let activeFlushes = 0
    let maxConcurrent = 0

    // Wrap the cache's internal del to count overlapping flush bodies.
    // The tagged-flush sequence calls del(keys) then del(tagK) — if
    // two flushes are running in parallel, we'll observe activeFlushes > 1
    // before either decrements.
    const originalDel = cache.del.bind(cache)
    cache.del = async (keys: string | string[]) => {
      activeFlushes++
      maxConcurrent = Math.max(maxConcurrent, activeFlushes)
      // Yield to give a concurrent flush a chance to interleave.
      await new Promise(r => setTimeout(r, 5))
      try {
        return await originalDel(keys)
      }
      finally {
        activeFlushes--
        if (Array.isArray(keys) ? keys.length > 0 : true)
          flushesObserved++
      }
    }

    // Seed the tag index with a couple of keys.
    await cache.tags(['users']).put('user:1', { id: 1 })
    await cache.tags(['users']).put('user:2', { id: 2 })

    // Fire 5 concurrent flushes. With the race fix, the first sets the
    // lock, the next 4 chain through it.
    await Promise.all([
      cache.tags(['users']).flush(),
      cache.tags(['users']).flush(),
      cache.tags(['users']).flush(),
      cache.tags(['users']).flush(),
      cache.tags(['users']).flush(),
    ])

    // Cleanup the wrapper.
    cache.del = originalDel

    // With the race, multiple flush bodies would run concurrently
    // (maxConcurrent > 1). With the fix, they serialize and max is 1.
    expect(maxConcurrent).toBeLessThanOrEqual(1)
  })

  test('a write between two flushes is captured by the second flush', async () => {
    const cache = freshCache()
    await cache.tags(['tag-a']).put('key-1', 'value-1')

    const flush1 = cache.tags(['tag-a']).flush()
    // Concurrent write to the same tag while flush1 is in progress.
    const write = cache.tags(['tag-a']).put('key-2', 'value-2')
    // Concurrent second flush — should chain on flush1 and observe key-2.
    const flush2 = cache.tags(['tag-a']).flush()

    await Promise.all([flush1, write, flush2])

    // key-2 was written after flush1 started but before flush2; flush2
    // should have caught it via the serialized chain.
    expect(await cache.get('key-1')).toBeUndefined()
    expect(await cache.get('key-2')).toBeUndefined()
  })
})
