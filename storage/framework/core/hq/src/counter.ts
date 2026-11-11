import type { MeterPolicy, MeterPolicyName, UsageEvaluation } from './policy'
import process from 'node:process'
import { periodOf } from './period'
import { evaluate, graceCeiling } from './policy'

/**
 * Buffered usage counting for a hot path.
 *
 * The constraint that shapes this: it runs on ingest, the busiest endpoint a
 * service has. Metering must add ZERO database round-trips there. So `record`
 * and `admit` touch Maps and return, and a timer folds the accumulated deltas
 * into the store every ten seconds.
 *
 * The fold is additive on the database's side (see `sqlCounterStore`), and
 * its answer is the new durable total, which is how the in-memory view is
 * refreshed. Nothing reads the table to decide an event.
 *
 * A lost flush (SIGKILL, a crash) costs at most one flush interval of counts,
 * not the month, because the durable total already lives in the table.
 */

export interface CounterKey {
  owner: string
  meter: string
  /** `YYYY-MM`, UTC. */
  period: string
}

export interface CounterDelta extends CounterKey {
  delta: number
}

export interface CounterStore {
  /**
   * Add `delta` to the stored total, on the store's side rather than as a
   * read-modify-write, and answer the new total (or `null` if unknown).
   */
  add: (delta: CounterDelta) => Promise<number | null>
  /** The stored total; `0` when there is no row. */
  read: (key: CounterKey) => Promise<number>
}

export interface CounterOptions {
  store: CounterStore
  /** How often buffered deltas are folded into the store. `0` turns the timer off. Default 10 seconds. */
  flushMs?: number
  /** Flush on SIGTERM and SIGINT. Defaults to on whenever the timer is. */
  flushOnExit?: boolean
  now?: () => Date
  /** Told about a failed flush or read. Defaults to `console.error`. */
  onError?: (error: unknown, key: CounterKey) => void
}

export interface Admission extends UsageEvaluation {
  meter: string
  /** Whether to keep the event. Equal to `allowed`, named for the call site. */
  accept: boolean
}

export interface UsageCounter {
  /** Note `quantity` units. A Map lookup and an addition; never awaits. A null owner is not metered. */
  record: (owner: string | number | null | undefined, meter: string, quantity?: number) => void
  /**
   * What this process last knew the owner had used this period, plus anything
   * buffered since. Never queries. `null` means nothing is known yet, which a
   * caller should read as "no reason to act", not as zero.
   */
  usageOf: (owner: string | number | null | undefined, meter: string) => number | null
  /**
   * Decide one ingest event against `limit` and count it, in memory.
   * A kept event is counted under `meter`; a dropped one under
   * `droppedMeter(meter)`, so `used` stays "what we stored" while the 1-in-10
   * sequence still advances on every event received.
   */
  admit: (owner: string | number | null | undefined, meter: string, limit: number | null, policy?: MeterPolicy | MeterPolicyName) => Admission
  /** Load the durable total so the first decisions after a restart are not made from zero. */
  prime: (owner: string | number, meter: string) => Promise<void>
  /** Fold buffered deltas into the store. Safe to call while `record` runs. */
  flush: () => Promise<void>
  /** The durable total plus anything buffered, for surfaces that may pay for a query. */
  read: (owner: string | number, meter: string, period?: string) => Promise<number>
  /** Stop the timer and the signal handlers. Does not flush. */
  stop: () => void
}

/** The meter that counts events an ingest policy dropped. */
export function droppedMeter(meter: string): string {
  return `${meter}.dropped`
}

const SEPARATOR = '\u0000'

function ownerId(owner: string | number | null | undefined): string | null {
  if (owner === null || owner === undefined)
    return null
  if (typeof owner === 'number')
    return Number.isFinite(owner) ? String(owner) : null
  return owner.length > 0 && !owner.includes(SEPARATOR) ? owner : null
}

function keyOf(key: CounterKey): string {
  return `${key.period}${SEPARATOR}${key.owner}${SEPARATOR}${key.meter}`
}

function parseKey(id: string): CounterKey {
  const [period, owner, meter] = id.split(SEPARATOR) as [string, string, string]
  return { owner, meter, period }
}

export function createCounter(options: CounterOptions): UsageCounter {
  const { store } = options
  const now = options.now ?? (() => new Date())
  const onError = options.onError ?? ((error, key) => {
    console.error('[hq:meter] counter store failed for', `${key.owner}/${key.meter}`, error instanceof Error ? error.message : error)
  })
  const flushMs = options.flushMs ?? 10_000

  /** Deltas not yet handed to the store. */
  const pending = new Map<string, number>()
  /** Deltas handed to the store whose answer has not come back. */
  const inFlight = new Map<string, number>()
  /** Last durable totals, refreshed by each flush's answer. */
  const known = new Map<string, number>()
  const priming = new Map<string, Promise<void>>()

  const bump = (map: Map<string, number>, id: string, by: number): void => {
    const next = (map.get(id) ?? 0) + by
    if (next === 0)
      map.delete(id)
    else
      map.set(id, next)
  }

  const current = (owner: string, meter: string): CounterKey => ({ owner, meter, period: periodOf(now()) })

  function local(id: string): number | null {
    if (!known.has(id) && !pending.has(id) && !inFlight.has(id))
      return null
    return (known.get(id) ?? 0) + (inFlight.get(id) ?? 0) + (pending.get(id) ?? 0)
  }

  function record(owner: string | number | null | undefined, meter: string, quantity = 1): void {
    const id = ownerId(owner)
    if (id === null || !meter || !Number.isFinite(quantity) || quantity <= 0)
      return
    bump(pending, keyOf(current(id, meter)), quantity)
  }

  function usageOf(owner: string | number | null | undefined, meter: string): number | null {
    const id = ownerId(owner)
    return id === null ? null : local(keyOf(current(id, meter)))
  }

  function prime(owner: string | number, meter: string): Promise<void> {
    const id = ownerId(owner)
    if (id === null)
      return Promise.resolve()
    const key = current(id, meter)
    const keyId = keyOf(key)
    if (known.has(keyId))
      return Promise.resolve()
    let running = priming.get(keyId)
    if (!running) {
      running = store.read(key)
        .then((total) => {
          // A flush that answered while this read was out is newer; keep it.
          if (!known.has(keyId))
            known.set(keyId, Number.isFinite(total) ? total : 0)
        })
        .catch(error => onError(error, key))
        .finally(() => priming.delete(keyId))
      priming.set(keyId, running)
    }
    return running
  }

  function admit(owner: string | number | null | undefined, meter: string, limit: number | null, policy?: MeterPolicy | MeterPolicyName): Admission {
    const id = ownerId(owner)
    // An event with no owner to bill is not metered, and never dropped for it.
    if (id === null)
      return { ...evaluate(0, null, policy), meter, accept: true }

    const kept = local(keyOf(current(id, meter)))
    if (kept === null) {
      // First sight since boot: decide from zero now, learn the real total
      // behind the request. The next event sees it.
      void prime(id, meter)
      void prime(id, droppedMeter(meter))
    }
    const dropped = local(keyOf(current(id, droppedMeter(meter)))) ?? 0
    const candidate = (kept ?? 0) + 1
    const ceiling = graceCeiling(limit, policy)
    const sequence = ceiling === null ? undefined : candidate + dropped - ceiling
    const evaluation = evaluate(candidate, limit, policy, sequence)

    record(id, evaluation.allowed ? meter : droppedMeter(meter))
    return { ...evaluation, used: evaluation.allowed ? candidate : candidate - 1, meter, accept: evaluation.allowed }
  }

  async function flush(): Promise<void> {
    if (pending.size === 0)
      return
    // Snapshot and clear first. If a write then fails, those counts are gone,
    // deliberately: re-queueing them would let a sustained outage grow the
    // buffer without bound on the hottest path in the app, and one interval of
    // counts is a far cheaper loss than unbounded memory.
    const batch = [...pending.entries()]
    pending.clear()
    for (const [id, delta] of batch)
      bump(inFlight, id, delta)

    const period = periodOf(now())
    await Promise.all(batch.map(async ([id, delta]) => {
      const key = parseKey(id)
      try {
        const total = await store.add({ ...key, delta })
        if (typeof total === 'number' && Number.isFinite(total))
          known.set(id, total)
        else
          known.set(id, (known.get(id) ?? 0) + delta)
      }
      catch (error) {
        onError(error, key)
      }
      finally {
        bump(inFlight, id, -delta)
      }
    }))

    // Totals for a period that has ended will never be asked for again.
    for (const id of known.keys()) {
      if (!id.startsWith(`${period}${SEPARATOR}`))
        known.delete(id)
    }
  }

  async function read(owner: string | number, meter: string, period?: string): Promise<number> {
    const id = ownerId(owner)
    if (id === null)
      return 0
    const key = { owner: id, meter, period: period ?? periodOf(now()) }
    const keyId = keyOf(key)
    const buffered = (inFlight.get(keyId) ?? 0) + (pending.get(keyId) ?? 0)
    try {
      return await store.read(key) + buffered
    }
    catch (error) {
      onError(error, key)
      return (known.get(keyId) ?? 0) + buffered
    }
  }

  let timer: ReturnType<typeof setInterval> | undefined
  const onSignal = (): void => {
    void flush()
  }
  const signals = ['SIGTERM', 'SIGINT'] as const

  if (flushMs > 0) {
    timer = setInterval(() => {
      void flush()
    }, flushMs)
    // Never hold the process open for a counter.
    if (typeof timer === 'object' && timer && 'unref' in timer)
      (timer as { unref: () => void }).unref()
  }
  const exitHooks = options.flushOnExit ?? flushMs > 0
  if (exitHooks) {
    // A clean shutdown should not lose the last window. Best effort: if the
    // write cannot finish before the process goes, the loss is one interval.
    for (const signal of signals) {
      try {
        process.on(signal, onSignal)
      }
      catch { /* not every runtime allows signal handlers */ }
    }
  }

  function stop(): void {
    if (timer !== undefined)
      clearInterval(timer)
    timer = undefined
    if (exitHooks) {
      for (const signal of signals) {
        try {
          process.off(signal, onSignal)
        }
        catch { /* see above */ }
      }
    }
  }

  return { record, usageOf, admit, prime, flush, read, stop }
}

/** A `CounterStore` held in memory, for tests and for local development. */
export function createMemoryCounterStore(): CounterStore & { totals: () => CounterDelta[] } {
  const totals = new Map<string, number>()
  return {
    async add(delta) {
      const next = (totals.get(keyOf(delta)) ?? 0) + delta.delta
      totals.set(keyOf(delta), next)
      return next
    },
    async read(key) {
      return totals.get(keyOf(key)) ?? 0
    },
    totals: () => [...totals.entries()].map(([id, delta]) => ({ ...parseKey(id), delta })),
  }
}
