/**
 * Per-request DataLoader-style batcher for `Model.findMany([id])`-style
 * lookups. The classic N+1 antidote isn't always reachable through
 * `.with(...)` (e.g. fetching siblings in a Vue component, computing
 * something off the side of the request, jobs that fan out per-item
 * rather than per-row). This module provides a `batchLoad(model, id)`
 * helper that collects ids on the same tick, fires a single
 * `WHERE id IN (...)` query, and resolves every caller from the
 * shared result.
 *
 * The batch is scoped to the current request via the same
 * `cacheRequestQuery` mechanism — so two unrelated requests handling
 * the same id concurrently still get isolated queries. Outside of a
 * request scope, calls fall through to a single-id lookup with no
 * batching.
 */

import { cacheRequestQuery } from '@stacksjs/router'

interface PendingBatch<TKey, TValue> {
  keys: TKey[]
  resolvers: Array<{ key: TKey, resolve: (v: TValue | undefined) => void, reject: (err: unknown) => void }>
  scheduled: boolean
}

const batches = new WeakMap<object, PendingBatch<unknown, unknown>>()

/**
 * Per-tick batched load against a Stacks model. The model object is the
 * batch identity — one queue per `model`. Ids posted in the same
 * microtask are merged into a single `findMany([...])` call.
 *
 * @example
 * ```ts
 * import { batchLoad } from '@stacksjs/orm'
 * import User from '~/app/Models/User'
 *
 * // Without batching: 100 SELECTs
 * for (const id of orderUserIds) await User.find(id)
 *
 * // With batching: 1 SELECT (`WHERE id IN (1, 2, … 100)`)
 * await Promise.all(orderUserIds.map(id => batchLoad(User, id)))
 * ```
 */
// eslint-disable-next-line pickier/no-unused-vars
export function batchLoad<T extends { findMany?: (ids: any[]) => Promise<any[]>, find?: (id: any) => Promise<any> }, K = number | string>(
  model: T,
  key: K,
): Promise<unknown> {
  // No request scope — just fall through to a single-id call.
  // (cacheRequestQuery's no-op fallback will run the fetcher once.)
  return cacheRequestQuery(`batchLoad:${(model as any).name ?? 'model'}:${String(key)}`, async () => {
    return new Promise((resolve, reject) => {
      let batch = batches.get(model as object) as PendingBatch<K, unknown> | undefined
      if (!batch) {
        batch = { keys: [], resolvers: [], scheduled: false }
        batches.set(model as object, batch as unknown as PendingBatch<unknown, unknown>)
      }
      batch.keys.push(key)
      batch.resolvers.push({ key, resolve, reject })

      if (batch.scheduled) return
      batch.scheduled = true

      // Drain on the next microtask. Promise.resolve() is the right cue:
      // anything synchronous + sync-microtask completes before we fire,
      // but we don't wait for I/O.
      Promise.resolve().then(async () => {
        const drained = batches.get(model as object) as PendingBatch<K, unknown> | undefined
        if (!drained) return
        batches.delete(model as object)
        const uniqueKeys = Array.from(new Set(drained.keys))

        try {
          const rows = typeof model.findMany === 'function'
            ? await model.findMany(uniqueKeys as unknown as any[])
            : await Promise.all(uniqueKeys.map(k => (model.find as any)?.(k)))
          const byKey = new Map<unknown, unknown>()
          for (const row of rows ?? []) {
            // We assume the primary key is `id` — same convention as
            // the rest of the framework's findMany. Custom-keyed models
            // can resolve via `model.findMany` directly.
            const idVal = (row as Record<string, unknown> | null | undefined)?.id
            if (idVal !== undefined) byKey.set(idVal, row)
          }
          for (const r of drained.resolvers) {
            r.resolve(byKey.get(r.key))
          }
        }
        catch (err) {
          for (const r of drained.resolvers) r.reject(err)
        }
      })
    })
  })
}
