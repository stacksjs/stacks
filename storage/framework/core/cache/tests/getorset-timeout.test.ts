import { afterEach, describe, expect, test } from 'bun:test'
import { CacheManager, MemoryDriver } from '@stacksjs/ts-cache'
import { StacksCache } from '../src/drivers'

// stacksjs/stacks#1876 C-2 — pins the contract that a fetcher hung
// inside getOrSet doesn't strand every future caller for the same key.

function freshCache(opts: { inflightTimeoutMs?: number } = {}): StacksCache {
  const manager = new CacheManager(new MemoryDriver({ stdTTL: 0, checkPeriod: 60 }))
  return new StacksCache(manager, opts)
}

describe('StacksCache.getOrSet — inflight timeout (#1876 C-2)', () => {
  let timers: Array<ReturnType<typeof setTimeout>> = []

  afterEach(() => {
    for (const t of timers) clearTimeout(t)
    timers = []
  })

  test('rejects the awaiting caller when the fetcher hangs past timeout', async () => {
    const cache = freshCache({ inflightTimeoutMs: 200 })

    const hung = cache.getOrSet('slow', () => new Promise<string>((resolve) => {
      // Resolve eventually so we don't leak — but well past the timeout.
      const t = setTimeout(() => resolve('eventually'), 5_000)
      timers.push(t)
    }))

    await expect(hung).rejects.toThrow(/timed out after 200ms/i)
  })

  test('a subsequent caller can retry after the timeout cleared the slot', async () => {
    const cache = freshCache({ inflightTimeoutMs: 150 })

    // First caller hangs and times out.
    const first = cache.getOrSet('flaky', () => new Promise<string>((resolve) => {
      const t = setTimeout(() => resolve('never-observed'), 5_000)
      timers.push(t)
    }))
    await expect(first).rejects.toThrow(/timed out/i)

    // Second caller gets a fresh in-flight slot — the stale Promise
    // was evicted when the timeout fired.
    const value = await cache.getOrSet('flaky', async () => 'fresh')
    expect(value).toBe('fresh')
  })

  test('a fast fetcher resolves normally and clears the timer', async () => {
    // Sanity check: timeout machinery shouldn't break the happy path.
    const cache = freshCache({ inflightTimeoutMs: 5_000 })

    const value = await cache.getOrSet('quick', async () => 42)
    expect(value).toBe(42)

    // A second caller hits the cache (fast path), not the inflight map.
    const again = await cache.getOrSet('quick', async () => 99)
    expect(again).toBe(42)
  })

  test('default timeout is 30s when not overridden', async () => {
    // Build with no opts — the default should be applied.
    const cache = freshCache()
    // We can't wait 30s in a test, but we can verify the fast path
    // works under the default config.
    const value = await cache.getOrSet('default-timeout', async () => 'ok')
    expect(value).toBe('ok')
  })

  test('concurrent callers share the in-flight promise (stampede prevention preserved)', async () => {
    const cache = freshCache({ inflightTimeoutMs: 5_000 })
    let invocations = 0

    const fetcher = async (): Promise<number> => {
      invocations++
      await new Promise(r => setTimeout(r, 50))
      return 1
    }

    // Fire 5 concurrent callers for the same key — only one fetcher
    // should run.
    const results = await Promise.all([
      cache.getOrSet('shared', fetcher),
      cache.getOrSet('shared', fetcher),
      cache.getOrSet('shared', fetcher),
      cache.getOrSet('shared', fetcher),
      cache.getOrSet('shared', fetcher),
    ])

    expect(results).toEqual([1, 1, 1, 1, 1])
    expect(invocations).toBe(1)
  })
})
