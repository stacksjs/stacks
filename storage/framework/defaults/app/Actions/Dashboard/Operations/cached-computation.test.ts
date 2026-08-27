import { describe, expect, it } from 'bun:test'
import { cachedComputation } from './cached-computation'

function counter() {
  let calls = 0
  let clock = 1_000
  const cache = cachedComputation({
    ttlMs: 30_000,
    now: () => clock,
    compute: async () => {
      calls += 1
      return `value-${calls}`
    },
  })
  return {
    cache,
    calls: () => calls,
    advance: (ms: number) => { clock += ms },
  }
}

describe('cachedComputation', () => {
  it('computes once and serves the same value inside the window', async () => {
    const { cache, calls } = counter()

    expect(await cache.get()).toBe('value-1')
    expect(await cache.get()).toBe('value-1')
    expect(await cache.get()).toBe('value-1')
    expect(calls()).toBe(1)
  })

  it('recomputes once the value has aged past the TTL', async () => {
    const { cache, calls, advance } = counter()

    await cache.get()
    advance(29_999)
    expect(await cache.get()).toBe('value-1')
    expect(calls()).toBe(1)

    advance(1)
    expect(await cache.get()).toBe('value-2')
    expect(calls()).toBe(2)
  })

  it('recomputes on demand and reseeds the cache with that value', async () => {
    const { cache, calls } = counter()

    await cache.get()
    expect(await cache.get({ fresh: true })).toBe('value-2')
    expect(calls()).toBe(2)

    // The forced read is not a one-off: later readers get what it computed,
    // rather than the value it replaced.
    expect(await cache.get()).toBe('value-2')
    expect(calls()).toBe(2)
  })

  it('recomputes after an explicit invalidation', async () => {
    const { cache, calls } = counter()

    await cache.get()
    cache.invalidate()
    expect(await cache.get()).toBe('value-2')
    expect(calls()).toBe(2)
  })

  it('collapses concurrent readers onto one computation', async () => {
    // The case this exists for: both operations pages loading at once used to
    // run the same model-versus-schema diff twice for identical output.
    let calls = 0
    let release: (value: string) => void = () => {}
    const gate = new Promise<string>((resolve) => { release = resolve })
    const cache = cachedComputation({
      ttlMs: 30_000,
      compute: async () => {
        calls += 1
        return await gate
      },
    })

    const readers = [cache.get(), cache.get(), cache.get()]
    release('shared')

    expect(await Promise.all(readers)).toEqual(['shared', 'shared', 'shared'])
    expect(calls).toBe(1)
  })

  it('does not wedge later readers onto a computation that failed', async () => {
    let attempt = 0
    const cache = cachedComputation({
      ttlMs: 30_000,
      compute: async () => {
        attempt += 1
        if (attempt === 1)
          throw new Error('first attempt failed')
        return 'recovered'
      },
    })

    await expect(cache.get()).rejects.toThrow('first attempt failed')
    expect(await cache.get()).toBe('recovered')
    expect(attempt).toBe(2)
  })

  it('does not let a forced read adopt a computation that started before it', async () => {
    // `fresh` exists for callers gating a write on the answer. Joining a read
    // already in flight would hand back a value computed before whatever made
    // them ask, which is the staleness the flag is there to avoid.
    let calls = 0
    const releases: Array<(value: string) => void> = []
    const cache = cachedComputation({
      ttlMs: 30_000,
      compute: async () => {
        calls += 1
        return await new Promise<string>((resolve) => { releases.push(resolve) })
      },
    })

    const slowReader = cache.get()
    const forced = cache.get({ fresh: true })
    expect(calls).toBe(2)

    releases[0]('stale')
    releases[1]('current')
    expect(await slowReader).toBe('stale')
    expect(await forced).toBe('current')
  })
})
