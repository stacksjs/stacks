import { describe, expect, mock, test } from 'bun:test'
import { createQueryClient, queryClient, useMutation, useQuery } from '../src/useQuery'

/**
 * Tests for useQuery / useMutation / queryClient (stacksjs/stacks#1939
 * Phase A). Covers: cache, dedup, stale-while-revalidate, prefix
 * invalidation, optimistic + rollback via the documented pattern.
 */

function tick(ms = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

describe('queryClient — cache + invalidate', () => {
  test('get/set round-trips', () => {
    const c = createQueryClient()
    c.set(['users'], [{ id: 1 }])
    expect(c.get(['users'])).toEqual([{ id: 1 }])
  })

  test('set with updater fn sees the previous value', () => {
    const c = createQueryClient()
    c.set(['count'], 1)
    c.set<number>(['count'], old => (old ?? 0) + 1)
    expect(c.get(['count'])).toBe(2)
  })

  test('stable key hashing — object key order does not matter', () => {
    const c = createQueryClient()
    c.set(['judges', { practiceArea: 'tax', state: 'CA' }], ['A'])
    expect(c.get(['judges', { state: 'CA', practiceArea: 'tax' }])).toEqual(['A'])
  })

  test('invalidate matches by prefix', async () => {
    const c = createQueryClient()
    c.set(['judges'], ['root'])
    c.set(['judges', { state: 'CA' }], ['ca'])
    c.set(['judges', { state: 'NY' }], ['ny'])
    c.set(['other'], ['no-match'])

    let calls = 0
    const subs: Array<() => void> = []
    for (const key of [['judges'], ['judges', { state: 'CA' }], ['judges', { state: 'NY' }], ['other']]) {
      const e = c._entry(key)
      subs.push(c._subscribe(e.hash, () => { calls++ }))
    }

    await c.invalidate(['judges'])
    expect(calls).toBe(3)
    subs.forEach(off => off())
  })

  test('clear empties the cache', () => {
    const c = createQueryClient()
    c.set(['a'], 1)
    c.set(['b'], 2)
    c.clear()
    expect(c.get(['a'])).toBeUndefined()
    expect(c.get(['b'])).toBeUndefined()
  })
})

describe('useQuery — fetch + cache + dedup', () => {
  test('first fetch populates data + clears isLoading', async () => {
    const c = createQueryClient()
    const q = useQuery({
      queryKey: ['x'],
      queryFn: async () => ({ x: 1 }),
      client: c,
    })
    expect(q.isLoading.value).toBe(true)
    await tick(5)
    expect(q.data.value).toEqual({ x: 1 })
    expect(q.isLoading.value).toBe(false)
    expect(q.isFetching.value).toBe(false)
    expect(q.error.value).toBeNull()
  })

  test('error surfaces on error ref', async () => {
    const c = createQueryClient()
    const q = useQuery({
      queryKey: ['fail'],
      queryFn: async () => { throw new Error('boom') },
      client: c,
    })
    await tick(5)
    expect(q.error.value?.message).toBe('boom')
    expect(q.data.value).toBeUndefined()
    expect(q.isFetching.value).toBe(false)
  })

  test('staleTime serves cached data without refetch', async () => {
    const c = createQueryClient()
    const fn = mock(async () => ({ n: Date.now() }))
    const q1 = useQuery({ queryKey: ['s'], queryFn: fn, staleTime: 60_000, client: c })
    await tick(5)
    expect(fn).toHaveBeenCalledTimes(1)
    const first = q1.data.value

    const q2 = useQuery({ queryKey: ['s'], queryFn: fn, staleTime: 60_000, client: c })
    await tick(5)
    expect(fn).toHaveBeenCalledTimes(1) // dedup — same fresh cache
    expect(q2.data.value).toEqual(first)
  })

  test('refetch bypasses staleTime', async () => {
    const c = createQueryClient()
    let n = 0
    const q = useQuery({
      queryKey: ['r'],
      queryFn: async () => ++n,
      staleTime: 60_000,
      client: c,
    })
    await tick(5)
    expect(q.data.value).toBe(1)
    await q.refetch()
    expect(q.data.value).toBe(2)
  })

  test('concurrent fetches dedup into one in-flight promise', async () => {
    const c = createQueryClient()
    let inflightCalls = 0
    const fn = mock(async () => {
      inflightCalls++
      await tick(20)
      return { ok: true }
    })

    const q1 = useQuery({ queryKey: ['d'], queryFn: fn, client: c })
    const q2 = useQuery({ queryKey: ['d'], queryFn: fn, client: c })
    await tick(40)
    expect(inflightCalls).toBe(1)
    expect(q1.data.value).toEqual({ ok: true })
    expect(q2.data.value).toEqual({ ok: true })
  })

  test('invalidate triggers active queries to refetch', async () => {
    const c = createQueryClient()
    let n = 0
    const q = useQuery({
      queryKey: ['inv', { tag: 'a' }],
      queryFn: async () => ++n,
      client: c,
    })
    await tick(5)
    expect(q.data.value).toBe(1)

    await c.invalidate(['inv'])
    await tick(5)
    expect(q.data.value).toBe(2)
  })

  test('enabled=false skips initial fetch; refetch still works', async () => {
    const c = createQueryClient()
    const fn = mock(async () => 'lazy')
    const q = useQuery({ queryKey: ['lazy'], queryFn: fn, enabled: false, client: c })
    await tick(5)
    expect(fn).toHaveBeenCalledTimes(0)
    expect(q.data.value).toBeUndefined()
    expect(q.isLoading.value).toBe(false)

    await q.refetch()
    expect(q.data.value).toBe('lazy')
  })

  test('signal passes through to queryFn so callers can abort', async () => {
    const c = createQueryClient()
    let sawSignal: AbortSignal | undefined
    useQuery({
      queryKey: ['sig'],
      queryFn: async ({ signal }) => {
        sawSignal = signal
        return 1
      },
      client: c,
    })
    await tick(5)
    expect(sawSignal).toBeInstanceOf(AbortSignal)
  })
})

describe('useMutation — write + optimistic + rollback', () => {
  test('mutateAsync resolves with data', async () => {
    const m = useMutation({
      mutationFn: async (id: number) => ({ id, done: true }),
    })
    const result = await m.mutateAsync(7)
    expect(result).toEqual({ id: 7, done: true })
    expect(m.data.value).toEqual({ id: 7, done: true })
    expect(m.isPending.value).toBe(false)
  })

  test('fire-and-forget mutate sets data + clears pending', async () => {
    const m = useMutation({
      mutationFn: async (s: string) => `hi ${s}`,
    })
    m.mutate('there')
    expect(m.isPending.value).toBe(true)
    await tick(5)
    expect(m.data.value).toBe('hi there')
    expect(m.isPending.value).toBe(false)
  })

  test('error surfaces on error ref + invokes onError', async () => {
    let caughtCtx: unknown
    const m = useMutation({
      mutationFn: async () => { throw new Error('fail') },
      onMutate: () => ({ snapshot: 'before' }),
      onError: (_err, _vars, ctx) => { caughtCtx = ctx },
    })
    m.mutate(undefined as unknown as void)
    await tick(5)
    expect(m.error.value?.message).toBe('fail')
    expect(caughtCtx).toEqual({ snapshot: 'before' })
  })

  test('optimistic + rollback via queryClient (the canonical pattern)', async () => {
    const c = createQueryClient()
    c.set<{ id: number, followed: boolean }[]>(['judges'], [
      { id: 1, followed: false },
      { id: 2, followed: false },
    ])

    const followJudge = useMutation<unknown, number, { prev: unknown }>({
      mutationFn: async () => { throw new Error('server says no') },
      onMutate: (judgeId) => {
        const prev = c.get(['judges'])
        c.set<{ id: number, followed: boolean }[]>(['judges'], old =>
          (old ?? []).map(j => j.id === judgeId ? { ...j, followed: true } : j))
        return { prev }
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.prev !== undefined) c.set(['judges'], ctx.prev as unknown[])
      },
    })

    followJudge.mutate(1)
    await tick(5)

    // Optimistic update was rolled back
    expect(c.get(['judges'])).toEqual([
      { id: 1, followed: false },
      { id: 2, followed: false },
    ])
    expect(followJudge.error.value?.message).toBe('server says no')
  })

  test('onSettled fires on both success and error', async () => {
    let settled = 0
    const ok = useMutation({
      mutationFn: async () => 'ok',
      onSettled: () => { settled++ },
    })
    await ok.mutateAsync(undefined as unknown as void)

    const bad = useMutation({
      mutationFn: async () => { throw new Error('x') },
      onSettled: () => { settled++ },
    })
    bad.mutate(undefined as unknown as void)
    await tick(5)

    expect(settled).toBe(2)
  })

  test('reset() clears data + error + pending', async () => {
    const m = useMutation({ mutationFn: async () => 'v' })
    await m.mutateAsync(undefined as unknown as void)
    expect(m.data.value).toBe('v')
    m.reset()
    expect(m.data.value).toBeUndefined()
    expect(m.error.value).toBeNull()
    expect(m.isPending.value).toBe(false)
  })
})

describe('default queryClient is usable but isolated per test via clear()', () => {
  test('exported queryClient holds + clears state', () => {
    queryClient.clear()
    queryClient.set(['ping'], 1)
    expect(queryClient.get(['ping'])).toBe(1)
    queryClient.clear()
    expect(queryClient.get(['ping'])).toBeUndefined()
  })
})
