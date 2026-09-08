/**
 * Per-request batching for model lookups. Synchronous calls for distinct IDs
 * share a query; repeated IDs reuse the pending or settled result. Both the
 * queue and its cache belong to the request and model object that created them.
 * Outside a request, each call performs an independent single-ID lookup.
 */

import { getCurrentRequest } from '@stacksjs/router'

interface BatchModel<TKey, TValue> {
  name?: string
  findMany?: (ids: TKey[]) => Promise<TValue[]>
  find?: (id: TKey) => Promise<TValue | undefined>
}

interface PendingBatch<TKey, TValue> {
  keys: TKey[]
  resolvers: Array<{ key: TKey, resolve: (v: TValue | undefined) => void, reject: (err: unknown) => void }>
}

interface ModelBatches<TKey, TValue> {
  cache: Map<TKey, Promise<TValue | undefined>>
  pending?: PendingBatch<TKey, TValue>
}

// Models have different key and row types. Recover those types only after
// looking up the same request and model identities that own the state.
const requests = new WeakMap<object, WeakMap<object, unknown>>()

function indexRows<TValue>(rows: TValue[]): Map<unknown, TValue> {
  const byKey = new Map<unknown, TValue>()
  for (const row of rows) {
    // Model primary keys use `id`, matching the existing batchLoad contract.
    const id = (row as Record<string, unknown> | null | undefined)?.id
    if (id !== undefined) byKey.set(id, row)
  }
  return byKey
}

async function loadSingle<TKey, TValue>(model: BatchModel<TKey, TValue>, key: TKey): Promise<TValue | undefined> {
  if (typeof model.find === 'function') return model.find(key)
  const rows = await model.findMany?.([key])
  return indexRows(rows ?? []).get(key)
}

async function drainBatch<TKey, TValue>(
  model: BatchModel<TKey, TValue>,
  state: ModelBatches<TKey, TValue>,
  batch: PendingBatch<TKey, TValue>,
): Promise<void> {
  // A later lookup may start a new batch while this query is in flight.
  state.pending = undefined
  try {
    const rows = typeof model.findMany === 'function'
      ? await model.findMany(batch.keys)
      : await Promise.all(batch.keys.map(key => model.find?.(key)))
    const byKey = indexRows(rows ?? [])
    for (const entry of batch.resolvers) entry.resolve(byKey.get(entry.key))
  }
  catch (error) {
    for (const entry of batch.resolvers) entry.reject(error)
  }
}

/**
 * Batch model lookups within the current request. Model objects and keys retain
 * their identities, including the distinction between numeric and string IDs.
 *
 * @example
 * ```ts
 * const users = await Promise.all(orderUserIds.map(id => batchLoad(User, id)))
 * ```
 */
export function batchLoad<TKey = number | string, TValue = Record<string, unknown>>(
  model: BatchModel<TKey, TValue>,
  key: TKey,
): Promise<TValue | undefined> {
  const request = getCurrentRequest()
  if (!request) return loadSingle(model, key)

  let models = requests.get(request)
  if (!models) {
    models = new WeakMap()
    requests.set(request, models)
  }
  let state = models.get(model) as ModelBatches<TKey, TValue> | undefined
  if (!state) {
    state = { cache: new Map() }
    models.set(model, state)
  }
  const existing = state.cache.get(key)
  if (existing) return existing.then()

  let batch = state.pending
  if (!batch) {
    batch = { keys: [], resolvers: [] }
    state.pending = batch
    const pending = batch
    const owner = state
    queueMicrotask(() => { void drainBatch(model, owner, pending) })
  }
  const promise = new Promise<TValue | undefined>((resolve, reject) => {
    batch.keys.push(key)
    batch.resolvers.push({ key, resolve, reject })
  })
  state.cache.set(key, promise)
  const cache = state.cache
  promise.catch(() => cache.delete(key))
  // Keep rejection handling per caller while sharing only the query operation.
  return promise.then()
}
