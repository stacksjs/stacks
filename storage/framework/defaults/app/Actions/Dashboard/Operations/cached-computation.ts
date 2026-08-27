/**
 * A single cached value with a time budget and no duplicate work in flight.
 *
 * Written for the dashboard's migration plan, which costs a full
 * model-versus-schema diff plus a ledger audit to produce. Two read endpoints
 * built one per request, so a page load cost seconds and moving between the
 * two pages paid it again.
 *
 * Kept separate from the plan itself so the caching rules can be tested
 * without a database behind them: pass a `now` and the TTL boundary is exact
 * rather than a sleep.
 */
export interface CachedComputationOptions<T> {
  /** How long a computed value may be handed to a reader, in milliseconds. */
  ttlMs: number
  compute: () => Promise<T>
  /** Injectable clock. Tests drive the TTL boundary with it. */
  now?: () => number
}

export interface CachedComputation<T> {
  /**
   * Return the cached value, computing one if there is none or it has aged
   * out. `fresh` forces a recomputation and reseeds the cache with it - for
   * callers whose answer gates a write and so cannot be a moment old.
   */
  get: (options?: { fresh?: boolean }) => Promise<T>
  /** Forget the cached value. The next `get` recomputes. */
  invalidate: () => void
}

export function cachedComputation<T>(options: CachedComputationOptions<T>): CachedComputation<T> {
  const now = options.now ?? Date.now
  let cached: { value: T, computedAt: number } | null = null
  let inFlight: Promise<T> | null = null

  async function run(): Promise<T> {
    // Callers arriving mid-computation join the one already running instead of
    // starting a second. Without this the two operations pages loading
    // together ran the same expensive diff concurrently for identical output.
    if (inFlight)
      return await inFlight

    inFlight = options.compute()
    try {
      const value = await inFlight
      cached = { value, computedAt: now() }
      return value
    }
    finally {
      // Cleared on failure too, so one rejected computation does not wedge
      // every later caller onto the same rejected promise.
      inFlight = null
    }
  }

  return {
    async get(getOptions: { fresh?: boolean } = {}): Promise<T> {
      if (getOptions.fresh) {
        cached = null
        // Deliberately not joined to an in-flight read: that one may have
        // started before whatever made this caller ask for a fresh value.
        inFlight = null
        return await run()
      }

      if (cached && now() - cached.computedAt < options.ttlMs)
        return cached.value

      return await run()
    },
    invalidate(): void {
      cached = null
    },
  }
}
