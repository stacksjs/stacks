import type { Ref } from '@stacksjs/stx'
import { ref } from '@stacksjs/stx'

/**
 * useQuery / useMutation / queryClient (stacksjs/stacks#1939 — Phase A).
 *
 * Cache + dedup + invalidation primitives. Mirrors TanStack Query shape
 * so adopters transfer immediately. Phase A intentionally omits:
 *   - `refetchOnFocus` / `refetchOnReconnect` (DOM listener coupling)
 *   - automatic GC of unsubscribed cache entries
 *   - query key partial-match invalidation via predicate functions
 * Those land in Phase B. Prefix-match invalidation IS supported
 * (`invalidate(['judges'])` matches `['judges', filterObj]` etc).
 */

export type QueryKey = readonly unknown[]

/**
 * Stable JSON serialization with sorted object keys — so
 * `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` hash to the same string.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value as Record<string, unknown>).sort()
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(',')}}`
}

function hashKey(key: QueryKey): string {
  return stableStringify(key)
}

interface CacheEntry<T = unknown> {
  key: QueryKey
  hash: string
  data: T | undefined
  error: Error | null
  updatedAt: number
  status: 'idle' | 'fetching' | 'success' | 'error'
  inflight: Promise<T> | null
  /** Set by invalidate() — subscribers refetch on next notify when true. */
  invalidated: boolean
  subscribers: Set<() => unknown>
}

/**
 * Matcher for `invalidate`. Either a `QueryKey` (prefix match, the common
 * case) or a predicate run against every cached key (stacksjs/stacks#1939
 * Phase B) — e.g. invalidate everything tagged a given entity:
 * `invalidate({ predicate: k => k.includes('judges') })`.
 */
export type QueryMatcher = QueryKey | { predicate: (key: QueryKey) => boolean }

export interface CreateQueryClientOptions {
  /**
   * How long (ms) a cache entry survives after its LAST subscriber
   * unsubscribes before it's garbage-collected. `Infinity` disables
   * auto-GC (entries live until `clear()`/`gc()`). Default 5 minutes.
   */
  gcTime?: number
}

/**
 * Central cache. Hold one per app (the default `queryClient` export)
 * or create scoped ones for tests.
 */
export interface QueryClient {
  /** Read the cached value for `key`, or undefined if not cached. */
  get: <T = unknown>(key: QueryKey) => T | undefined
  /** Write the cached value for `key`. Accepts a value or updater fn. */
  set: <T = unknown>(key: QueryKey, value: T | ((old: T | undefined) => T)) => void
  /**
   * Invalidate matching cached keys (prefix or predicate). Subscribers of
   * matched keys refetch.
   */
  invalidate: (matcher: QueryMatcher) => Promise<void>
  /** Remove every cache entry. Mostly for tests. */
  clear: () => void
  /**
   * Garbage-collect now: drop every entry with no subscribers and no
   * in-flight fetch. Returns the number removed. Auto-GC (gcTime) calls
   * this implicitly; exposed for deterministic control + manual sweeps.
   */
  gc: () => number
  /** Internal: subscribe to changes for a key. Returns unsubscribe fn. */
  _subscribe: (hash: string, fn: () => unknown) => () => void
  /** Internal: get-or-create the entry for a key. */
  _entry: <T = unknown>(key: QueryKey) => CacheEntry<T>
  /** Internal: notify subscribers of a key that data changed. */
  _notify: (hash: string) => void
}

export function createQueryClient(options: CreateQueryClientOptions = {}): QueryClient {
  const entries = new Map<string, CacheEntry>()
  const gcTime = options.gcTime ?? 5 * 60 * 1000
  const gcTimers = new Map<string, ReturnType<typeof setTimeout>>()

  function collectable(e: CacheEntry): boolean {
    return e.subscribers.size === 0 && e.inflight === null
  }

  function removeIfCollectable(hash: string): void {
    const e = entries.get(hash)
    if (e && collectable(e)) entries.delete(hash)
    gcTimers.delete(hash)
  }

  function scheduleGc(hash: string): void {
    const existing = gcTimers.get(hash)
    if (existing) clearTimeout(existing)
    if (!Number.isFinite(gcTime)) return
    if (gcTime <= 0) {
      removeIfCollectable(hash)
      return
    }
    const t = setTimeout(() => removeIfCollectable(hash), gcTime)
    // Don't keep the process alive just for a cache sweep (Node/Bun).
    ;(t as { unref?: () => void }).unref?.()
    gcTimers.set(hash, t)
  }

  function cancelGc(hash: string): void {
    const t = gcTimers.get(hash)
    if (t) { clearTimeout(t); gcTimers.delete(hash) }
  }

  function entry<T>(key: QueryKey): CacheEntry<T> {
    const hash = hashKey(key)
    let e = entries.get(hash) as CacheEntry<T> | undefined
    if (!e) {
      e = {
        key,
        hash,
        data: undefined,
        error: null,
        updatedAt: 0,
        status: 'idle',
        inflight: null,
        invalidated: false,
        subscribers: new Set(),
      }
      entries.set(hash, e as CacheEntry)
    }
    return e
  }

  function notify(hash: string): void {
    const e = entries.get(hash)
    if (!e) return
    for (const fn of e.subscribers) fn()
  }

  function prefixMatches(prefix: QueryKey, candidate: QueryKey): boolean {
    if (prefix.length > candidate.length) return false
    for (let i = 0; i < prefix.length; i++) {
      if (stableStringify(prefix[i]) !== stableStringify(candidate[i])) return false
    }
    return true
  }

  return {
    get<T>(key: QueryKey): T | undefined {
      const hash = hashKey(key)
      return entries.get(hash)?.data as T | undefined
    },

    set<T>(key: QueryKey, value: T | ((old: T | undefined) => T)): void {
      const e = entry<T>(key)
      const next = typeof value === 'function' ? (value as (old: T | undefined) => T)(e.data) : value
      e.data = next
      e.updatedAt = Date.now()
      e.status = 'success'
      e.error = null
      e.invalidated = false
      notify(e.hash)
    },

    async invalidate(matcher: QueryMatcher): Promise<void> {
      // `Array.isArray` doesn't narrow a `readonly unknown[]` union member, so
      // guard explicitly: a non-array matcher is the `{ predicate }` form.
      const matches: (key: QueryKey) => boolean = Array.isArray(matcher)
        ? (key: QueryKey) => prefixMatches(matcher as QueryKey, key)
        : (matcher as { predicate: (key: QueryKey) => boolean }).predicate
      const refetches: Promise<void>[] = []
      for (const e of entries.values()) {
        if (!matches(e.key)) continue
        e.updatedAt = 0
        e.invalidated = true
        for (const fn of e.subscribers) {
          // Subscribers return `unknown`: a refetching observer returns its
          // refetch Promise so `invalidate()` can await it; others return void.
          const result: unknown = fn()
          if (result && typeof (result as { then?: unknown }).then === 'function') {
            refetches.push(result as Promise<void>)
          }
        }
      }
      await Promise.all(refetches)
    },

    clear(): void {
      for (const t of gcTimers.values()) clearTimeout(t)
      gcTimers.clear()
      entries.clear()
    },

    gc(): number {
      let removed = 0
      for (const [hash, e] of entries) {
        if (collectable(e)) {
          entries.delete(hash)
          cancelGc(hash)
          removed++
        }
      }
      return removed
    },

    _subscribe(hash: string, fn: () => unknown): () => void {
      const e = entries.get(hash)
      if (!e) return () => {}
      cancelGc(hash) // a fresh observer cancels any pending collection
      e.subscribers.add(fn)
      return () => {
        e.subscribers.delete(fn)
        if (e.subscribers.size === 0) scheduleGc(hash)
      }
    },

    _entry: entry as <T>(key: QueryKey) => CacheEntry<T>,
    _notify: notify,
  }
}

/** Default app-wide client. Tests should pass their own via `client:`. */
export const queryClient: QueryClient = createQueryClient()

export interface UseQueryOptions<T> {
  queryKey: QueryKey
  queryFn: (ctx: { signal: AbortSignal }) => Promise<T>
  /** Serve cached data for N ms before triggering a background refetch. */
  staleTime?: number
  /** If false, don't auto-fetch. Caller must call refetch() manually. */
  enabled?: boolean
  /**
   * Refetch when the window regains focus (stacksjs/stacks#1939 Phase B).
   * Only refetches if the cached data is stale per `staleTime`. Default false.
   */
  refetchOnFocus?: boolean
  /**
   * Refetch when the network reconnects (the `online` event). Only refetches
   * if stale. Default false.
   */
  refetchOnReconnect?: boolean
  /**
   * Event target for the focus/online listeners. Defaults to the global
   * `window`. Inject a target in non-DOM environments (and tests).
   */
  window?: EventTarget
  /** Override the default global client (mostly for tests). */
  client?: QueryClient
}

export interface UseQueryResult<T> {
  data: Ref<T | undefined>
  error: Ref<Error | null>
  /** True on the very first fetch (no cached data yet). */
  isLoading: Ref<boolean>
  /** True whenever a fetch is in-flight (incl. background revalidation). */
  isFetching: Ref<boolean>
  /** Force a fresh fetch, bypassing staleTime. */
  refetch: () => Promise<void>
  /** Stop listening for cache updates (for ad-hoc usage). */
  unsubscribe: () => void
}

/**
 * Reactive query with cache + dedup + stale-while-revalidate.
 *
 * @example
 * ```ts
 * const judges = useQuery({
 *   queryKey: ['judges', { practiceArea: filter() }],
 *   queryFn: async ({ signal }) => {
 *     const res = await fetch('/api/judges', { signal })
 *     return res.json() as Promise<Judge[]>
 *   },
 *   staleTime: 30_000,
 * })
 * ```
 */
export function useQuery<T>(opts: UseQueryOptions<T>): UseQueryResult<T> {
  const client = opts.client ?? queryClient
  const staleTime = opts.staleTime ?? 0
  const enabled = opts.enabled ?? true

  const e = client._entry<T>(opts.queryKey)

  const data = ref<T | undefined>(e.data) as Ref<T | undefined>
  const error = ref<Error | null>(e.error) as Ref<Error | null>
  const isLoading = ref<boolean>(e.data === undefined && enabled)
  const isFetching = ref<boolean>(false)

  function sync(): void {
    data.value = e.data
    error.value = e.error
    isFetching.value = e.status === 'fetching'
    if (e.data !== undefined || e.error !== null) {
      isLoading.value = false
    }
  }

  async function doFetch(force: boolean): Promise<void> {
    if (!force) {
      const fresh = e.data !== undefined && Date.now() - e.updatedAt < staleTime
      if (fresh) {
        sync()
        return
      }
    }

    if (e.inflight) {
      try { await e.inflight }
      catch { /* error already on entry */ }
      sync()
      return
    }

    const controller = new AbortController()
    e.status = 'fetching'
    isFetching.value = true
    if (e.data === undefined) isLoading.value = true

    const p = opts.queryFn({ signal: controller.signal })
      .then((result) => {
        e.data = result
        e.error = null
        e.updatedAt = Date.now()
        e.status = 'success'
        e.invalidated = false
        return result
      })
      .catch((err: unknown) => {
        e.error = err instanceof Error ? err : new Error(String(err))
        e.status = 'error'
        e.invalidated = false
        throw e.error
      })
      .finally(() => {
        e.inflight = null
        client._notify(e.hash)
      })

    e.inflight = p
    try { await p }
    catch { /* surfaced via error ref */ }
    sync()
  }

  const unsubscribeCache = client._subscribe(e.hash, () => {
    if (e.invalidated && enabled && e.status !== 'fetching') {
      // Return the Promise so `client.invalidate()` can await the refetch.
      return doFetch(true)
    }
    sync()
    return undefined
  })

  // Refetch-on-focus / -reconnect (Phase B). A stale-only refetch: respects
  // staleTime, so a focus event right after a fetch is a cheap no-op.
  const target: EventTarget | undefined = opts.window
    ?? (typeof window !== 'undefined' ? window : undefined)
  const winListeners: Array<[string, () => void]> = []
  if (target && enabled) {
    const onWake = (): void => { if (e.status !== 'fetching') void doFetch(false) }
    if (opts.refetchOnFocus) winListeners.push(['focus', onWake])
    if (opts.refetchOnReconnect) winListeners.push(['online', onWake])
    for (const [evt, fn] of winListeners) target.addEventListener(evt, fn)
  }

  function unsubscribe(): void {
    unsubscribeCache()
    if (target) {
      for (const [evt, fn] of winListeners) target.removeEventListener(evt, fn)
    }
  }

  if (enabled) void doFetch(false)
  else sync()

  return {
    data,
    error,
    isLoading,
    isFetching,
    refetch: () => doFetch(true),
    unsubscribe,
  }
}

export interface UseMutationOptions<TData, TVars, TCtx = unknown> {
  mutationFn: (vars: TVars) => Promise<TData>
  /** Runs before mutationFn. Return a context value passed to onError/onSettled. */
  onMutate?: (vars: TVars) => Promise<TCtx> | TCtx
  onSuccess?: (data: TData, vars: TVars, ctx: TCtx | undefined) => void | Promise<void>
  onError?: (error: Error, vars: TVars, ctx: TCtx | undefined) => void | Promise<void>
  onSettled?: (data: TData | undefined, error: Error | null, vars: TVars, ctx: TCtx | undefined) => void | Promise<void>
}

export interface UseMutationResult<TData, TVars> {
  data: Ref<TData | undefined>
  error: Ref<Error | null>
  isPending: Ref<boolean>
  /** Fire-and-forget. Errors surface via the `error` ref + `onError`. */
  mutate: (vars: TVars) => void
  /** Awaitable variant. Rejects on failure. */
  mutateAsync: (vars: TVars) => Promise<TData>
  reset: () => void
}

/**
 * Reactive write-side primitive. Pairs with `useQuery` via
 * `queryClient.invalidate(...)` inside `onSettled` for the canonical
 * optimistic-with-rollback pattern.
 */
export function useMutation<TData, TVars = void, TCtx = unknown>(
  opts: UseMutationOptions<TData, TVars, TCtx>,
): UseMutationResult<TData, TVars> {
  const data = ref<TData | undefined>(undefined) as Ref<TData | undefined>
  const error = ref<Error | null>(null) as Ref<Error | null>
  const isPending = ref<boolean>(false)

  async function run(vars: TVars): Promise<TData> {
    isPending.value = true
    error.value = null
    let ctx: TCtx | undefined
    try {
      if (opts.onMutate) ctx = await opts.onMutate(vars)
      const result = await opts.mutationFn(vars)
      data.value = result
      await opts.onSuccess?.(result, vars, ctx)
      await opts.onSettled?.(result, null, vars, ctx)
      return result
    }
    catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err))
      error.value = e
      await opts.onError?.(e, vars, ctx)
      await opts.onSettled?.(undefined, e, vars, ctx)
      throw e
    }
    finally {
      isPending.value = false
    }
  }

  return {
    data,
    error,
    isPending,
    mutate(vars: TVars): void {
      void run(vars).catch(() => { /* surfaced via error ref */ })
    },
    mutateAsync: run,
    reset(): void {
      data.value = undefined
      error.value = null
      isPending.value = false
    },
  }
}
