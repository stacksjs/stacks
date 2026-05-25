import { createModel, type ModelDefinition as BQBModelDefinition, registerModel } from '@stacksjs/query-builder'
import type { InferRelationNames } from '@stacksjs/query-builder'
import type { SearchOptions } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import { snakeCase } from '@stacksjs/strings'
import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Event-suppression scope. When the current async context's store reports
 * `suppressed: true`, every model lifecycle dispatcher (`creating`,
 * `created`, `updating`, `updated`, `saving`, `saved`, `deleting`,
 * `deleted`, `restoring`, `restored`) becomes a no-op.
 *
 * Used by `Model.withoutEvents(fn)` and `inst.saveQuietly()` to suppress
 * downstream observers during bulk imports / backfills / migration jobs
 * where firing every per-row event would either overwhelm the queue or
 * cause feedback loops (e.g., an `updated` listener that itself updates
 * the row).
 */
const eventSuppression = new AsyncLocalStorage<{ suppressed: boolean }>()

function eventsAreSuppressed(): boolean {
  return eventSuppression.getStore()?.suppressed === true
}

/**
 * Run a callback with model lifecycle events suppressed for its entire
 * (synchronous + async) duration. Any nested awaits inside the callback
 * inherit the suppression via the AsyncLocalStorage propagation.
 *
 * @example
 * ```ts
 * await User.withoutEvents(async () => {
 *   for (const row of importedRows) await User.create(row) // no events fire
 * })
 * ```
 */
export function withoutEvents<T>(fn: () => T | Promise<T>): Promise<T> {
  return Promise.resolve(eventSuppression.run({ suppressed: true }, fn as () => Promise<T>))
}

// Extended model definition that provides proper contextual typing for factory callbacks.
// BrowserModelDefinition from bun-query-builder uses BrowserTypedAttribute<unknown> which
// prevents TypeScript from providing contextual types for callback parameters.
/**
 * Built-in cast types for model attributes.
 *
 * ### Timezone contract (stacksjs/stacks#1876 O-5, D-5)
 *
 * `datetime` and `date` casts persist values in **UTC** regardless of
 * which driver is connected. The `set` direction uses
 * `Date.toISOString()`, which always emits `Z`-suffixed UTC. The
 * `get` direction parses the stored string back into a JavaScript
 * `Date`, which represents an instant on the universal timeline —
 * timezone presentation is the caller's responsibility (typically via
 * `Intl.DateTimeFormat` at the render layer, or a Temporal-API
 * adapter).
 *
 * **Why UTC-only:** Per-driver behavior diverges sharply on
 * timezone-aware columns. PostgreSQL has `timestamptz` (timezone-
 * aware); MySQL stores `TIMESTAMP` as UTC but presents in the
 * session timezone; SQLite has no timezone concept at all and stores
 * ISO strings verbatim. The ORM normalizes them to a single
 * convention (UTC on the wire) so multi-driver apps behave the same
 * across environments. Apps that need original-timezone preservation
 * should store the user's TZ as a separate column and convert at
 * the render layer.
 */
export type CastType = 'string' | 'number' | 'boolean' | 'json' | 'datetime' | 'date' | 'array' | 'integer' | 'float'

/**
 * Custom caster interface for user-defined attribute transformations.
 */
export interface CasterInterface {
  get(value: unknown): unknown
  set(value: unknown): unknown
}

// Track which JSON-cast columns have already logged a parse failure so
// a corrupted row doesn't spam the log on every read
// (stacksjs/stacks#1876 O-4). Set is keyed by `${typeof v}:${preview}`
// so genuinely different corruptions each get logged once.
const jsonParseFailureSeen = new Set<string>()

function logJsonParseFailure(raw: unknown, err: unknown): void {
  const preview = typeof raw === 'string' ? raw.slice(0, 80) : String(raw)
  const key = `${typeof raw}:${preview}`
  if (jsonParseFailureSeen.has(key)) return
  jsonParseFailureSeen.add(key)
  const message = err instanceof Error ? err.message : String(err)
  // eslint-disable-next-line no-console
  console.error(`[orm] JSON cast failed to parse value (returning null): ${message} — value preview: ${JSON.stringify(preview)}`)
}

const builtInCasters: Record<CastType, CasterInterface> = {
  string: {
    get: (v) => v != null ? String(v) : null,
    set: (v) => v != null ? String(v) : null,
  },
  number: {
    get: (v) => v != null ? Number(v) : null,
    set: (v) => v != null ? Number(v) : null,
  },
  integer: {
    get: (v) => v != null ? Math.trunc(Number(v)) : null,
    set: (v) => v != null ? Math.trunc(Number(v)) : null,
  },
  float: {
    get: (v) => v != null ? Number.parseFloat(String(v)) : null,
    set: (v) => v != null ? Number.parseFloat(String(v)) : null,
  },
  boolean: {
    get: (v) => v === 1 || v === '1' || v === true || v === 'true',
    set: (v) => (v === true || v === 1 || v === '1' || v === 'true') ? 1 : 0,
  },
  json: {
    get: (v) => {
      if (v == null) return null
      if (typeof v === 'string') {
        try {
          return JSON.parse(v)
        }
        catch (err) {
          // Previously the catch returned the unparsed string, so callers
          // expecting `typeof row.config === 'object'` silently
          // type-cast wrong and crashed downstream
          // (stacksjs/stacks#1876 O-4). Now: log the corruption once
          // per distinct shape so it's visible, and return null (the
          // typed default) so consumers don't accidentally string-`.length`
          // a malformed JSON column.
          logJsonParseFailure(v, err)
          return null
        }
      }
      return v
    },
    set: (v) => {
      if (v == null) return null
      return typeof v === 'string' ? v : JSON.stringify(v)
    },
  },
  datetime: {
    // UTC-only by contract (see CastType docstring). The returned
    // `Date` is timezone-agnostic; convert via `toLocaleString(tz)`
    // or Intl at render time when local-time display is needed.
    get: (v) => v ? new Date(v as string) : null,
    set: (v) => v instanceof Date ? v.toISOString() : v,
  },
  date: {
    // Date-only field, persisted as YYYY-MM-DD derived from the UTC
    // calendar day. A noon-local Date in UTC-5 stored as a `date`
    // becomes the next day's UTC date — that's the trade-off of the
    // UTC-only contract. Callers that need local-calendar-day
    // semantics should convert to UTC at the boundary themselves
    // (e.g. `new Date(Date.UTC(y, m, d))` from local Y/M/D parts).
    get: (v) => v ? new Date(v as string) : null,
    set: (v) => v instanceof Date ? v.toISOString().split('T')[0] : v,
  },
  array: {
    get: (v) => {
      if (v == null) return []
      if (Array.isArray(v)) return v
      if (typeof v === 'string') { try { return JSON.parse(v) } catch { return [] } }
      return []
    },
    set: (v) => {
      if (v == null) return null
      return Array.isArray(v) ? JSON.stringify(v) : v
    },
  },
}

function resolveCaster(cast: CastType | CasterInterface): CasterInterface {
  return typeof cast === 'string' ? builtInCasters[cast] : cast
}

function castAttributes(row: any, casts: Record<string, CastType | CasterInterface>, direction: 'get' | 'set'): any {
  if (!row || typeof row !== 'object') return row
  const result = { ...row }
  for (const [attr, castDef] of Object.entries(casts)) {
    if (attr in result) {
      const caster = resolveCaster(castDef)
      result[attr] = caster[direction](result[attr])
    }
  }
  return result
}

/**
 * Internal keys on bun-query-builder's ModelInstance that should NOT leak
 * through attribute-access proxies (would let `{ ...model }` dump the
 * model's private bookkeeping into a response payload).
 */
const MODEL_INSTANCE_INTERNAL_KEYS = new Set([
  '_attributes', '_original', '_definition', '_hasSaved', '_relations',
])

const STACKS_PROXY_TAG = Symbol.for('stacks.modelInstanceProxy')

/**
 * Wrap a bun-query-builder ModelInstance in a Proxy that:
 *
 *   1. Forwards attribute reads to `_attributes` so `user.password` /
 *      `car.slug` work (instead of returning undefined and silently
 *      breaking auth, ownership checks, etc.).
 *   2. Cleans up `{ ...instance }` spreads — only attribute keys appear,
 *      not the model's private `_attributes` / `_original` / etc. fields.
 *   3. Keeps every instance method (.update, .save, .toJSON, etc.) bound
 *      to the underlying instance.
 *
 * Hidden fields (`hidden: true` attrs) are NOT auto-stripped — call
 * `toAttrs(instance)` or `instance.toJSON()` for that. This proxy is about
 * making direct property access work, not about output sanitization.
 */
function wrapModelInstance<T extends object>(
  instance: T,
  casts?: Record<string, CastType | CasterInterface>,
): T {
  if (!instance || typeof instance !== 'object') return instance
  if ((instance as any)[STACKS_PROXY_TAG]) return instance
  const attrs = (instance as any)._attributes
  if (!attrs || typeof attrs !== 'object') return instance

  // Apply read-side casts to attribute values once at wrap-time so every
  // downstream access (`car.charges_enabled`, `{ ...car }`, `car.toJSON()`)
  // sees the same correctly-typed value. SQLite stores booleans as 0/1
  // strings — without this, `!!"0"` is `true` and ownership / capability
  // checks silently invert.
  if (casts && Object.keys(casts).length > 0) {
    for (const [attr, castDef] of Object.entries(casts)) {
      if (Object.prototype.hasOwnProperty.call(attrs, attr)) {
        attrs[attr] = resolveCaster(castDef).get(attrs[attr])
      }
    }
  }

  return new Proxy(instance, {
    get(target, prop, recv) {
      if (prop === STACKS_PROXY_TAG) return true

      // saveAsync()/updateAsync(): async-aware variants that resolve
      // Promise-returning user setters before delegating to the sync
      // `save()` underneath. Without these, `inst.password = 'plain';
      // inst.save()` on a model with `set: { password: bcrypt }` either
      // throws (post-fix) or silently writes a Promise (pre-fix). These
      // synthetic methods are returned from the proxy `get` instead of
      // being patched onto the instance so they don't interfere with
      // type-aware model definitions.
      if (prop === 'saveAsync') {
        return async function () {
          const def = (target as any)._definition
          const setters = def?.set as Record<string, (attrs: Record<string, unknown>) => unknown> | undefined
          if (setters && typeof (target as any).isDirty === 'function') {
            for (const [key, fn] of Object.entries(setters)) {
              if (typeof fn !== 'function') continue
              if (!(target as any).isDirty(key)) continue
              const result = fn((target as any)._attributes as Record<string, unknown>)
              const value = (result && typeof (result as { then?: unknown }).then === 'function')
                ? await result
                : result
              ;(target as any)._attributes[key] = value
            }
            // Suppress the sync save's own setter pass — we already did
            // it (and awaited it). Restore on a `finally` so a thrown
            // save() doesn't leave the model definition in a wonky state
            // (which would stick across other instances since the def
            // is shared).
            const original = def.set
            def.set = {}
            try {
              return (target as any).save()
            }
            finally {
              def.set = original
            }
          }
          return (target as any).save()
        }
      }

      if (prop === 'updateAsync') {
        return async function (data: Record<string, unknown>) {
          // fill() then saveAsync() — same flow as instance.update() but
          // async-aware. The proxy `set` trap does the per-key write,
          // which means our `set:` hook bookkeeping survives.
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            for (const [k, v] of Object.entries(data)) {
              ;(recv as any)[k] = v
            }
          }
          // Re-fetch saveAsync via the same proxy (so 'this'-binding
          // matches what the user would call directly).
          return (recv as any).saveAsync()
        }
      }

      // Quiet variants — wrap save / saveAsync / update / updateAsync /
      // delete in `withoutEvents()` so listeners don't fire for the
      // surrounding call. Eloquent's `saveQuietly` / `deleteQuietly`
      // pattern, useful for bulk imports / backfills where firing every
      // per-row event would either overwhelm a queue or trigger a
      // feedback loop (e.g., an `updated` listener that itself updates).
      if (prop === 'saveQuietly') {
        return function () {
          return withoutEvents(() => (target as any).save())
        }
      }
      if (prop === 'saveAsyncQuietly') {
        return function () {
          return withoutEvents(() => (recv as any).saveAsync())
        }
      }
      if (prop === 'updateQuietly') {
        return function (data: Record<string, unknown>) {
          return withoutEvents(() => (target as any).update(data))
        }
      }
      if (prop === 'updateAsyncQuietly') {
        return function (data: Record<string, unknown>) {
          return withoutEvents(() => (recv as any).updateAsync(data))
        }
      }
      if (prop === 'deleteQuietly') {
        return function () {
          return withoutEvents(() => (target as any).delete())
        }
      }

      if (prop === 'toSearchableObject') {
        return function toSearchableObject() {
          const def = (target as any)._definition as { traits?: { useSearch?: boolean | SearchOptions } } | undefined
          const search = def?.traits?.useSearch
          if (!search || typeof search !== 'object') return null

          const attrs = (target as any)._attributes as Record<string, unknown> | undefined
          if (!attrs) return null

          const doc: Record<string, unknown> = {}
          const keys = search.displayable?.length
            ? search.displayable
            : [...search.searchable ?? [], ...search.filterable ?? [], ...search.sortable ?? [], 'id']

          for (const key of keys) {
            const snake = snakeCase(key)
            doc[snake] = attrs[snake] ?? attrs[key]
          }

          if (attrs.id != null) doc.id = String(attrs.id)
          return doc
        }
      }

      if (typeof prop === 'string' && !MODEL_INSTANCE_INTERNAL_KEYS.has(prop)) {
        const a = (target as any)._attributes
        if (a && Object.prototype.hasOwnProperty.call(a, prop)) return a[prop]
        // Eloquent-style relation access: after `Booking.query().with('user').first()`
        // the renter is reachable as `booking.user` instead of forcing every
        // call site through `booking.getRelation('user')`. If the relation
        // wasn't eager-loaded, this still returns undefined — callers should
        // either load it via `.with(name)` or use the explicit accessor.
        const rels = (target as any)._relations
        if (rels && Object.prototype.hasOwnProperty.call(rels, prop)) {
          const related = rels[prop]
          if (Array.isArray(related)) return related.map(x => wrapModelInstance(x, casts))
          return wrapModelInstance(related, casts)
        }
      }
      const v = Reflect.get(target, prop, target)
      return typeof v === 'function' ? v.bind(target) : v
    },
    set(target, prop, value, recv) {
      // Writes to existing attribute keys go through to `_attributes` so
      // `inst.status = 'x'; await inst.save()` actually persists. Without
      // this, the default-set lands the value as an own property on the
      // underlying instance — invisible to save() (which iterates
      // `_attributes`) AND triggering a Proxy invariant violation on the
      // next read because our getOwnPropertyDescriptor still claims the
      // value comes from `_attributes`.
      //
      // We delegate to the instance's `set(key, value)` method when present
      // because it also snapshots `_original` for dirty tracking — without
      // that snapshot, getChanges() returns `{}` and save() becomes a no-op.
      if (typeof prop === 'string' && !MODEL_INSTANCE_INTERNAL_KEYS.has(prop)) {
        const a = (target as any)._attributes
        const setter = (target as any).set
        if (a && Object.prototype.hasOwnProperty.call(a, prop)) {
          if (typeof setter === 'function') setter.call(target, prop, value)
          else a[prop] = value
          return true
        }
        // New attribute key not yet in _attributes — still write through
        // so `inst.newField = x` followed by save() works.
        if (a && !(prop in (target as object))) {
          if (typeof setter === 'function') setter.call(target, prop, value)
          else a[prop] = value
          return true
        }
      }
      return Reflect.set(target, prop, value, recv)
    },
    has(target, prop) {
      if (typeof prop === 'string' && !MODEL_INSTANCE_INTERNAL_KEYS.has(prop)) {
        const a = (target as any)._attributes
        if (a && Object.prototype.hasOwnProperty.call(a, prop)) return true
        const rels = (target as any)._relations
        if (rels && Object.prototype.hasOwnProperty.call(rels, prop)) return true
      }
      return Reflect.has(target, prop)
    },
    deleteProperty(target, prop) {
      if (typeof prop === 'string' && !MODEL_INSTANCE_INTERNAL_KEYS.has(prop)) {
        const a = (target as any)._attributes
        if (a && Object.prototype.hasOwnProperty.call(a, prop)) {
          delete a[prop]
          return true
        }
      }
      return Reflect.deleteProperty(target, prop)
    },
    ownKeys(target) {
      const a = (target as any)._attributes
      return a ? Object.keys(a) : []
    },
    getOwnPropertyDescriptor(target, prop) {
      if (typeof prop === 'string') {
        const a = (target as any)._attributes
        if (a && Object.prototype.hasOwnProperty.call(a, prop)) {
          return { configurable: true, enumerable: true, value: a[prop], writable: true }
        }
      }
      return Object.getOwnPropertyDescriptor(target, prop)
    },
  }) as T
}

/**
 * Wrap every read method on the static model so that returned ModelInstances
 * (singletons or arrays) get the attribute-access proxy. Affects find,
 * first, get, all, paginate, etc.
 *
 * Also wraps chainable `where(...)` / `query()` entry points so that the
 * resulting ModelQueryBuilder applies the same proxy at each terminator
 * — `Car.where(...).first()` should return a proxied instance, not a raw
 * one.
 */
const QB_TERMINATORS = new Set(['get', 'first', 'last', 'firstOrFail', 'find', 'findOrFail', 'all', 'paginate'])
const STACKS_QB_PROXY_TAG = Symbol.for('stacks.queryBuilderProxy')

function wrapQueryBuilder(qb: any, casts?: Record<string, CastType | CasterInterface>): any {
  if (!qb || typeof qb !== 'object') return qb
  // Skip re-wrapping. Without this guard, chains like
  // `Model.query().where().with().orderBy().first()` build O(N) nested
  // Proxies — each `.where()` returns a wrapped builder, the next
  // `.with()` wraps the wrapper, and so on. The stack of traps fires
  // once per layer on every property access, which shows up as visible
  // overhead in tight loops.
  if (qb[STACKS_QB_PROXY_TAG]) return qb
  return new Proxy(qb, {
    get(target, prop, recv) {
      if (prop === STACKS_QB_PROXY_TAG) return true
      const v = Reflect.get(target, prop, recv)
      if (typeof v !== 'function') return v
      // eslint-disable-next-line pickier/no-unused-vars
      return function (this: any, ...args: any[]) {
        const result = v.apply(target, args)
        const finalize = (r: any) => {
          if (QB_TERMINATORS.has(String(prop))) {
            if (Array.isArray(r)) return r.map(x => wrapModelInstance(x, casts))
            // paginate returns an object like { data: [...], meta: {...} }
            if (r && Array.isArray((r as any).data)) {
              return { ...r, data: (r as any).data.map((x: any) => wrapModelInstance(x, casts)) }
            }
            return wrapModelInstance(r, casts)
          }
          // Chainable — re-wrap if QueryBuilder-shaped
          if (r && typeof r === 'object' && typeof (r as any).get === 'function') {
            return wrapQueryBuilder(r, casts)
          }
          return r
        }
        if (result && typeof (result as any).then === 'function') {
          return (result as Promise<any>).then(finalize)
        }
        return finalize(result)
      }
    },
  })
}

function wrapReadsWithProxy(baseModel: Record<string, unknown>, casts?: Record<string, CastType | CasterInterface>) {
  const directReads = ['find', 'first', 'last', 'all', 'firstOrFail', 'findOrFail', 'findMany']
  for (const method of directReads) {
    const original = baseModel[method]
    if (typeof original !== 'function') continue
    baseModel[method] = function (...args: any[]) {
      const result = (original as Function).apply(this, args)
      const apply = (r: any) => Array.isArray(r) ? r.map(x => wrapModelInstance(x, casts)) : wrapModelInstance(r, casts)
      if (result && typeof (result as any).then === 'function') return (result as Promise<any>).then(apply)
      return apply(result)
    }
  }

  // Writes also return ModelInstances. Wrapping them too means
  // `const car = await Car.create(...); car.slug` works without the
  // caller having to remember that create() comes back un-proxied.
  const writeReturningInstance = ['create', 'firstOrCreate', 'updateOrCreate', 'make']
  for (const method of writeReturningInstance) {
    const original = baseModel[method]
    if (typeof original !== 'function') continue
    baseModel[method] = function (...args: any[]) {
      const result = (original as Function).apply(this, args)
      const apply = (r: any) => Array.isArray(r) ? r.map(x => wrapModelInstance(x, casts)) : wrapModelInstance(r, casts)
      if (result && typeof (result as any).then === 'function') return (result as Promise<any>).then(apply)
      return apply(result)
    }
  }

  const queryBuilderEntrypoints = [
    'query', 'where', 'orWhere', 'whereIn', 'whereNotIn', 'whereNull', 'whereNotNull',
    'whereLike', 'whereBetween', 'whereNotBetween', 'orderBy', 'orderByDesc',
    'select', 'with', 'limit', 'take', 'skip', 'latest', 'oldest',
  ]
  for (const method of queryBuilderEntrypoints) {
    const original = baseModel[method]
    if (typeof original !== 'function') continue
    baseModel[method] = function (...args: any[]) {
      const qb = (original as Function).apply(this, args)
      return wrapQueryBuilder(qb, casts)
    }
  }
}

/**
 * Thrown by `Model.findOrFail(id)` (and other strict lookups) when no row matches.
 * Callers can `instanceof` against this to distinguish "missing" from other errors.
 */
export class ModelNotFoundError extends Error {
  readonly model: string
  readonly id: number | string | undefined

  constructor(model: string, id?: number | string) {
    super(id != null ? `[ORM] ${model} not found for id=${String(id)}` : `[ORM] No matching ${model} row`)
    this.name = 'ModelNotFoundError'
    this.model = model
    this.id = id
  }
}

/**
 * Thrown when a write payload (`Model.create` / `Model.update` /
 * `firstOrCreate` / `updateOrCreate`) contains an attribute the model
 * forbids from mass assignment. There are two reasons this fires:
 *
 *   • `guarded`  — the attribute is explicitly marked `guarded: true`.
 *   • `not-fillable` — the model is in *allowlist* mode (at least one
 *     attribute has `fillable: true`) and the write payload contains a
 *     non-allowlisted field.
 *
 * The check exists to stop unfiltered request payloads from landing
 * directly in the DB. If you genuinely need to write a normally-protected
 * column, use the `force*` escape hatches (`Model.forceCreate(...)`,
 * `Model.forceUpdate(id, ...)`) — those bypass the check by design and
 * make the bypass auditable in code review.
 */
export class MassAssignmentException extends Error {
  readonly model: string
  readonly attribute: string
  readonly reason: 'guarded' | 'not-fillable'

  constructor(model: string, attribute: string, reason: 'guarded' | 'not-fillable') {
    const why = reason === 'guarded'
      ? `'${attribute}' is marked guarded`
      : `'${attribute}' is not in the fillable allowlist`
    super(`[ORM] Mass assignment to ${model} forbidden: ${why}. Use ${model}.forceCreate(...) / .forceUpdate(...) to bypass.`)
    this.name = 'MassAssignmentException'
    this.model = model
    this.attribute = attribute
    this.reason = reason
  }
}

/**
 * Columns the runtime always allows through mass assignment regardless of
 * `fillable`/`guarded` markings. Built-in framework bookkeeping that the
 * developer would never explicitly mark fillable but that nevertheless
 * has to be writeable from internal pathways.
 */
const MASS_ASSIGNMENT_SYSTEM_COLUMNS = new Set([
  'id', 'created_at', 'updated_at', 'deleted_at', 'uuid',
])

/**
 * Apply mass-assignment rules to a write payload. Returns the validated
 * payload (unchanged) or throws `MassAssignmentException` on the first
 * forbidden field it sees.
 *
 * Mode resolution mirrors Laravel:
 *
 *   • If any attribute carries `fillable: true` → allowlist mode. Fields
 *     not on the allowlist (or in the system-column / FK exemption set)
 *     throw `not-fillable`.
 *   • Else, `guarded: true` attrs throw `guarded`; everything else passes.
 *   • Else, the model has no opinion on mass assignment → permissive
 *     (matches the framework's pre-fix behavior so existing apps that
 *     declare neither don't suddenly start throwing).
 *
 * `_id`-suffixed columns are always allowed through (FK columns); the
 * model usually doesn't list them in `attributes`, so blocking them
 * would break every belongsTo write.
 *
 * Callers can opt out per-call via `{ force: true }` — used by the
 * `forceCreate` / `forceUpdate` static helpers.
 */
function applyMassAssignmentRules(
  definition: BQBModelDefinition,
  data: Record<string, unknown>,
  options: { force?: boolean } = {},
): Record<string, unknown> {
  if (options.force) return data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data

  const attrs = (definition as any).attributes as Record<string, { fillable?: boolean, guarded?: boolean }> | undefined
  if (!attrs) return data

  const fillable = new Set<string>()
  const guarded = new Set<string>()
  for (const [k, a] of Object.entries(attrs)) {
    const col = snakeCase(k)
    if (a?.fillable === true) fillable.add(col)
    if (a?.guarded === true) guarded.add(col)
  }

  const allowlistMode = fillable.size > 0

  for (const key of Object.keys(data)) {
    if (MASS_ASSIGNMENT_SYSTEM_COLUMNS.has(key)) continue
    if (key.endsWith('_id')) continue // foreign keys

    if (guarded.has(key))
      throw new MassAssignmentException(definition.name, key, 'guarded')

    if (allowlistMode && !fillable.has(key))
      throw new MassAssignmentException(definition.name, key, 'not-fillable')
  }

  return data
}

/**
 * Run a model's user-defined `set:` hooks against an arbitrary write
 * payload. Used by Model.update(id, data) (and the auto-CRUD update path
 * via the duplicated helper in routes.ts) to keep static-write call sites
 * from bypassing the same hashing / serialization the instance.save()
 * pipeline would have applied.
 *
 * For each `set: { foo: (attrs) => ... }` declared on the model, when
 * `data.foo` is present, replaces it with the setter's result. The setter
 * is called with the merged-attribute view so it can read sibling fields
 * if needed (e.g. password setter that wants the user's email for salting).
 */
async function applyDefinedSetters(
  definition: BQBModelDefinition,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const setters = (definition as any).set as Record<string, (attrs: Record<string, unknown>) => unknown> | undefined
  if (!setters || typeof setters !== 'object') return data
  const out: Record<string, unknown> = { ...data }
  for (const [key, fn] of Object.entries(setters)) {
    if (typeof fn !== 'function' || !(key in out)) continue
    try {
      out[key] = await fn(out)
    }
    catch (err) {
      log.error(`[orm] ${definition.name}.set.${key} threw — skipping setter`, err)
    }
  }
  return out
}

/**
 * Add Laravel-style static CRUD sugar to a Stacks model.
 *
 * bun-query-builder ships only the query-builder/instance forms
 * (`instance.update(data)`, `query.update(data)`, `query.delete()`), which
 * means the common static call sites used across Stacks app actions
 * (`Model.update(id, payload)`, `Model.delete(id)`, `Model.findOrFail(id)`,
 * `Model.firstOrCreate(...)`, `Model.updateOrCreate(...)`) all silently
 * 404 or throw confusing errors. This installs the missing helpers and
 * leaves any upstream-provided implementation untouched.
 */
function addStaticHelpers(baseModel: Record<string, unknown>, definition: BQBModelDefinition) {
  const pk = definition.primaryKey || 'id'

  // Capture the un-wrapped `create` reference at install time. Later
  // `wrapWritesWithMassAssignment` rebinds `baseModel.create` to a wrapper
  // that throws on guarded fields — `forceCreate` needs to reach the
  // *underlying* create so the escape hatch actually escapes.
  const unwrappedCreate = baseModel.create

  function getWhere(method: string): Function {
    const w = baseModel.where
    if (typeof w !== 'function')
      throw new Error(`[ORM] ${definition.name}.${method} needs a working where(): the underlying query builder did not expose one`)
    return w as Function
  }

  function getFind(method: string): Function {
    const f = baseModel.find
    if (typeof f !== 'function')
      throw new Error(`[ORM] ${definition.name}.${method} needs a working find(): the underlying query builder did not expose one`)
    return f as Function
  }

  function getCreate(method: string): Function {
    const c = baseModel.create
    if (typeof c !== 'function')
      throw new Error(`[ORM] ${definition.name}.${method} cannot create: the underlying query builder did not expose create()`)
    return c as Function
  }

  // Model.update(id, data) — wrap where(pk, id).update(data) and re-read.
  // Pre-checks that the row exists so we don't issue a no-op UPDATE that
  // looks successful but actually changed nothing — callers who want
  // strict semantics still see the same null vs row distinction, but
  // misuse like `Model.update(undefined, ...)` now throws loudly instead
  // of silently writing nothing.
  //
  // SECURITY: also runs user-defined `set:` hooks (e.g. User.set.password
  // = bcrypt). Without this, `User.update(id, { password: 'plain' })`
  // would store plaintext because raw query.update() bypasses the
  // ModelInstance.save() pipeline entirely.
  //
  // SECURITY 2: filters the payload through the mass-assignment rules
  // (`fillable`/`guarded`). Pre-fix, an unfiltered `req.json()` could land
  // straight in the DB — a request body with `is_admin: true` would write
  // it even on models that mark the column guarded. Use `forceUpdate` to
  // bypass when intentional.
  if (typeof baseModel.update !== 'function') {
    baseModel.update = async function (id: number | string, data: Record<string, unknown>) {
      if (id == null) throw new Error(`[ORM] ${definition.name}.update requires an id as the first argument`)
      if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new Error(`[ORM] ${definition.name}.update requires a data object as the second argument`)
      if (Object.keys(data).length === 0) {
        log.debug(`[orm] ${definition.name}.update called with empty data — short-circuiting and returning current row`)
        const f = baseModel.find as Function | undefined
        return typeof f === 'function' ? await f.call(baseModel, id) : null
      }

      applyMassAssignmentRules(definition, data)
      const finalData = await applyDefinedSetters(definition, data)

      await getWhere('update').call(baseModel, pk, id).update(finalData)
      const f = baseModel.find as Function | undefined
      return typeof f === 'function' ? await f.call(baseModel, id) : null
    }
  }

  // Model.forceUpdate(id, data) — bypass mass-assignment rules. Used for
  // internal pathways (background jobs, console commands) that need to
  // touch guarded columns intentionally.
  if (typeof baseModel.forceUpdate !== 'function') {
    baseModel.forceUpdate = async function (id: number | string, data: Record<string, unknown>) {
      if (id == null) throw new Error(`[ORM] ${definition.name}.forceUpdate requires an id as the first argument`)
      if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new Error(`[ORM] ${definition.name}.forceUpdate requires a data object as the second argument`)
      const finalData = await applyDefinedSetters(definition, data)
      await getWhere('forceUpdate').call(baseModel, pk, id).update(finalData)
      const f = baseModel.find as Function | undefined
      return typeof f === 'function' ? await f.call(baseModel, id) : null
    }
  }

  // Model.forceCreate(data) — bypass mass-assignment for create as well.
  // Calls the un-wrapped `create` captured above, NOT `baseModel.create`
  // (which is rebound to the rule-enforcing wrapper later).
  if (typeof baseModel.forceCreate !== 'function') {
    baseModel.forceCreate = async function (data: Record<string, unknown>) {
      if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new Error(`[ORM] ${definition.name}.forceCreate requires a data object`)
      if (typeof unwrappedCreate !== 'function')
        throw new Error(`[ORM] ${definition.name}.forceCreate cannot create: the underlying query builder did not expose create()`)
      return await (unwrappedCreate as Function).call(baseModel, data)
    }
  }

  // Model.delete(id) — wrap where(pk, id).delete() and report whether a row went away.
  if (typeof baseModel.delete !== 'function') {
    baseModel.delete = async function (id: number | string): Promise<boolean> {
      if (id == null) throw new Error(`[ORM] ${definition.name}.delete requires an id as the first argument`)
      const existed = await getFind('delete').call(baseModel, id)
      if (!existed) return false
      await getWhere('delete').call(baseModel, pk, id).delete()
      return true
    }
  }

  // Model.findOrFail(id) — strict variant that throws ModelNotFoundError.
  if (typeof baseModel.findOrFail !== 'function') {
    baseModel.findOrFail = async function (id: number | string) {
      const row = await getFind('findOrFail').call(baseModel, id)
      if (row == null) throw new ModelNotFoundError(definition.name, id)
      return row
    }
  }

  // Model.exists(id) — efficient `where(pk, id).count() > 0` check.
  if (typeof baseModel.exists !== 'function') {
    baseModel.exists = async function (id: number | string): Promise<boolean> {
      if (id == null) return false
      const q: any = getWhere('exists').call(baseModel, pk, id)
      if (typeof q.count === 'function') {
        const n = await q.count()
        return Number(n) > 0
      }
      const f = baseModel.find as Function | undefined
      return typeof f === 'function' ? (await f.call(baseModel, id)) != null : false
    }
  }

  // Model.firstOrCreate(where, defaults?) — find by attrs, otherwise insert.
  // Mass-assignment rules apply to the *insert* payload, not the where
  // clause: looking up by `email` is fine on a guarded `email`, but
  // *writing* a new row with a guarded field still needs the escape hatch.
  if (typeof baseModel.firstOrCreate !== 'function') {
    baseModel.firstOrCreate = async function (
      attrs: Record<string, unknown>,
      defaults: Record<string, unknown> = {},
    ) {
      if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs))
        throw new Error(`[ORM] ${definition.name}.firstOrCreate requires a where-attrs object`)

      const q: any = getWhere('firstOrCreate').call(baseModel, attrs)
      const existing = typeof q.first === 'function' ? await q.first() : await q
      if (existing) return existing

      const payload = { ...attrs, ...defaults }
      applyMassAssignmentRules(definition, payload)
      return await getCreate('firstOrCreate').call(baseModel, payload)
    }
  }

  // Model.updateOrCreate(where, attrs) — update if found, else create.
  if (typeof baseModel.updateOrCreate !== 'function') {
    baseModel.updateOrCreate = async function (
      attrs: Record<string, unknown>,
      values: Record<string, unknown>,
    ) {
      if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs))
        throw new Error(`[ORM] ${definition.name}.updateOrCreate requires a where-attrs object`)
      if (!values || typeof values !== 'object' || Array.isArray(values))
        throw new Error(`[ORM] ${definition.name}.updateOrCreate requires a values object`)

      const q: any = getWhere('updateOrCreate').call(baseModel, attrs)
      const existing = typeof q.first === 'function' ? await q.first() : await q
      if (existing) {
        applyMassAssignmentRules(definition, values)
        const id = (existing as Record<string, unknown>)[pk]
        await getWhere('updateOrCreate').call(baseModel, pk, id).update(values)
        const f = baseModel.find as Function | undefined
        return typeof f === 'function' ? await f.call(baseModel, id) : { ...existing, ...values }
      }

      const payload = { ...attrs, ...values }
      applyMassAssignmentRules(definition, payload)
      return await getCreate('updateOrCreate').call(baseModel, payload)
    }
  }

  // Model.count() — total row count.
  if (typeof baseModel.count !== 'function') {
    baseModel.count = async function (): Promise<number> {
      const q: any = baseModel
      if (typeof q.query === 'function') {
        const builder = q.query()
        if (typeof builder?.count === 'function') {
          const n = await builder.count()
          return Number(n) || 0
        }
      }
      const all = baseModel.all as Function | undefined
      const get = baseModel.get as Function | undefined
      if (typeof all === 'function') return ((await all.call(baseModel)) || []).length
      if (typeof get === 'function') return ((await get.call(baseModel)) || []).length
      return 0
    }
  }

  // Model.pluck('column') — flat array of one column's values across all rows.
  if (typeof baseModel.pluck !== 'function') {
    baseModel.pluck = async function <T = unknown>(column: string): Promise<T[]> {
      if (!column || typeof column !== 'string')
        throw new Error(`[ORM] ${definition.name}.pluck requires a column name`)
      const all = baseModel.all as Function | undefined
      const rows = typeof all === 'function' ? await all.call(baseModel) : []
      return (rows || []).map((r: any) => r?.[column])
    }
  }

  // Model.whereIn(column, values) — rows whose column matches any value in the list.
  if (typeof baseModel.whereIn !== 'function') {
    baseModel.whereIn = async function (column: string, values: ReadonlyArray<number | string>) {
      if (!column || typeof column !== 'string')
        throw new Error(`[ORM] ${definition.name}.whereIn requires a column name`)
      if (!Array.isArray(values))
        throw new Error(`[ORM] ${definition.name}.whereIn requires an array of values`)
      if (values.length === 0) return []

      const w = baseModel.where as Function | undefined
      if (typeof w !== 'function') return []
      const q: any = w.call(baseModel, column, 'in', values)
      if (q && typeof q.get === 'function') return await q.get()
      return await q
    }
  }

  // Model.latest(column?='created_at') / Model.oldest — first row by timestamp.
  const orderHelpers: ReadonlyArray<readonly ['latest' | 'oldest', 'asc' | 'desc']> = [
    ['latest', 'desc'],
    ['oldest', 'asc'],
  ]
  for (const [name, dir] of orderHelpers) {
    if (typeof baseModel[name] !== 'function') {
      baseModel[name] = async function (column: string = 'created_at') {
        const q: any = baseModel
        const builder = typeof q.query === 'function' ? q.query() : q
        if (typeof builder?.orderBy === 'function') {
          const ordered = builder.orderBy(column, dir)
          if (typeof ordered.first === 'function') return await ordered.first()
          if (typeof ordered.get === 'function') {
            const rows = await ordered.get()
            return rows?.[0] ?? null
          }
        }
        const all = baseModel.all as Function | undefined
        if (typeof all !== 'function') return null
        const rows = (await all.call(baseModel)) || []
        const sorted = [...rows].sort((a: any, b: any) => {
          const av = a?.[column], bv = b?.[column]
          if (av === bv) return 0
          return (av > bv ? 1 : -1) * (dir === 'desc' ? -1 : 1)
        })
        return sorted[0] ?? null
      }
    }
  }
}

/**
 * Decrypt every `enc:`-prefixed value on a row's attribute bag in place.
 * Ignores values that are missing, null, or already plaintext (so the
 * mutator works against rows written before the trait was on, mid-migration).
 * Used by `wrapReadsWithEncryption()` and the cast-aware read wrappers.
 */
async function decryptAttrsInPlace(row: any, encryptedKeys: ReadonlyArray<string>): Promise<void> {
  if (!row || typeof row !== 'object') return
  // Stacks model instances carry their values on `_attributes`; plain rows
  // carry them at the top level. Try the proxy bag first.
  const bag: Record<string, unknown> = (row as { _attributes?: Record<string, unknown> })._attributes
    ?? (row as Record<string, unknown>)
  for (const key of encryptedKeys) {
    if (!(key in bag)) continue
    const value = bag[key]
    if (!isEncrypted(value)) continue // plaintext or null — leave alone
    // eslint-disable-next-line no-await-in-loop
    bag[key] = await decryptValue(value)
  }
}

/**
 * Install read wrappers that decrypt encrypted columns after each query
 * resolves. Runs in addition to the cast/proxy wrappers — those layers
 * see the already-decrypted plaintext, which means a `string` cast over
 * an encrypted column doesn't need any special handling.
 */
function wrapReadsWithEncryption(baseModel: Record<string, unknown>, encryptedKeys: ReadonlyArray<string>) {
  if (encryptedKeys.length === 0) return

  const decryptResult = async (r: unknown): Promise<unknown> => {
    if (Array.isArray(r)) {
      for (const item of r) await decryptAttrsInPlace(item, encryptedKeys)
      return r
    }
    // paginate-shaped results: { data: [...], meta }
    if (r && typeof r === 'object' && Array.isArray((r as { data?: unknown }).data)) {
      for (const item of (r as { data: unknown[] }).data) await decryptAttrsInPlace(item, encryptedKeys)
      return r
    }
    if (r) await decryptAttrsInPlace(r, encryptedKeys)
    return r
  }

  const directReads = ['find', 'first', 'last', 'all', 'firstOrFail', 'findOrFail', 'findMany']
  for (const method of directReads) {
    const original = baseModel[method]
    if (typeof original !== 'function') continue
    baseModel[method] = async function (...args: any[]) {
      const result = await (original as Function).apply(this, args)
      return await decryptResult(result)
    }
  }

  // Writes return rows too; the freshly-inserted row's encrypted columns
  // come back from the DB as ciphertext, so we have to decrypt those for
  // the caller's `const u = await User.create(...); u.ssn` access.
  const writeReturningInstance = ['create', 'firstOrCreate', 'updateOrCreate', 'make']
  for (const method of writeReturningInstance) {
    const original = baseModel[method]
    if (typeof original !== 'function') continue
    baseModel[method] = async function (...args: any[]) {
      const result = await (original as Function).apply(this, args)
      return await decryptResult(result)
    }
  }

  // Static `Model.update(id, data)` re-reads after writing — decrypt that.
  const origUpdate = baseModel.update
  if (typeof origUpdate === 'function') {
    baseModel.update = async function (id: number | string, data: Record<string, unknown>) {
      const result = await (origUpdate as Function).call(this, id, data)
      return await decryptResult(result)
    }
  }
}

/**
 * Install write wrappers that encrypt configured columns before each
 * insert/update lands in the database. Idempotent against already-encrypted
 * values (see `encryptValue` in utils/encrypted.ts) so backfill scripts
 * that run twice won't double-wrap the ciphertext.
 */
function wrapWritesWithEncryption(baseModel: Record<string, unknown>, encryptedKeys: ReadonlyArray<string>) {
  if (encryptedKeys.length === 0) return

  const encryptArg = async (data: unknown): Promise<unknown> => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return data
    const out = { ...(data as Record<string, unknown>) }
    for (const key of encryptedKeys) {
      if (key in out) out[key] = await encryptValue(out[key])
    }
    return out
  }

  const writeMethods = ['create', 'firstOrCreate', 'updateOrCreate']
  for (const method of writeMethods) {
    const original = baseModel[method]
    if (typeof original !== 'function') continue
    baseModel[method] = async function (...args: any[]) {
      args[0] = await encryptArg(args[0])
      // updateOrCreate / firstOrCreate take a second arg with values; encrypt
      // those too so backfilled defaults are safe.
      if (args[1]) args[1] = await encryptArg(args[1])
      return await (original as Function).apply(this, args)
    }
  }

  const origUpdate = baseModel.update
  if (typeof origUpdate === 'function') {
    baseModel.update = async function (id: number | string, data: Record<string, unknown>) {
      const enc = (await encryptArg(data)) as Record<string, unknown>
      return await (origUpdate as Function).call(this, id, enc)
    }
  }
}

/**
 * Wrap the static write entry points so every write payload is filtered
 * through `applyMassAssignmentRules` AND through `applyDefinedSetters`
 * before it can hit the database. The wrapper runs *before* the cast
 * wrappers so a thrown exception fires on the raw user input (most useful
 * in error messages); casts only see payloads that already passed the
 * rule check.
 *
 * `create` is the bun-query-builder built-in. Pre-fix it bypassed the
 * setter pipeline entirely — `User.create({ password: 'plain' })`
 * persisted plaintext because the static create path doesn't go through
 * `ModelInstance.save()` (which is where setters fire for instance-mode
 * writes). Now setters run here too, awaiting any async `set:` hooks
 * (e.g. `bcrypt`) before the row hits the DB.
 *
 * `firstOrCreate` / `updateOrCreate` / `update` are added by
 * `addStaticHelpers` and apply the mass-assignment rule themselves;
 * `update` already calls `applyDefinedSetters` in that path, but the
 * `firstOrCreate`/`updateOrCreate` create branches also need it — wrap
 * them here so all create flows are setter-aware.
 */
function wrapWritesWithMassAssignment(baseModel: Record<string, unknown>, definition: BQBModelDefinition): void {
  const origCreate = baseModel.create
  if (typeof origCreate === 'function') {
    baseModel.create = async function (this: unknown, data: Record<string, unknown>, ...rest: unknown[]) {
      applyMassAssignmentRules(definition, data)
      const finalData = await applyDefinedSetters(definition, data)
      return await (origCreate as Function).call(this, finalData, ...rest)
    }
  }

  // Wrap `firstOrCreate` / `updateOrCreate` to push their *create branch*
  // payloads through `applyDefinedSetters` too. The rule check is applied
  // by addStaticHelpers; the setter pass is the missing piece.
  for (const method of ['firstOrCreate', 'updateOrCreate'] as const) {
    const orig = baseModel[method]
    if (typeof orig !== 'function') continue
    // The orig fn was already installed by addStaticHelpers, which
    // internally calls baseModel.create — that call now lands on the
    // setter-aware wrapper above. So orig already runs setters via the
    // outer create chain; no extra work needed here. Keeping the loop as
    // a marker for the audit trail in case someone replaces the chain.
    void orig
  }
}

function wrapQueryMethodsWithCasts(baseModel: Record<string, unknown>, casts: Record<string, CastType | CasterInterface>) {
  // Read-side casts are handled inside `wrapModelInstance` so the proxy
  // (and its `toJSON`/`update`/etc. methods) survives. Wrapping reads here
  // again would `{ ...row }` the proxy and discard everything but the bare
  // attribute bag, breaking `instance.toJSON()` / `instance.update()`.
  const writeMethods = ['create', 'firstOrCreate', 'updateOrCreate']

  for (const method of writeMethods) {
    const original = baseModel[method]
    if (typeof original === 'function') {
      baseModel[method] = async function (...args: any[]) {
        log.debug(`[orm] ${method.charAt(0).toUpperCase() + method.slice(1)} ${String(baseModel.name || 'unknown')}`, args[0])
        // Cast the input data before writing (booleans → 0/1, dates → ISO, …)
        if (args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
          args[0] = castAttributes(args[0], casts, 'set')
        }
        return await (original as Function).apply(this, args)
      }
    }
  }

  // Static `Model.update(id, data)` is added by addStaticHelpers (it doesn't
  // exist on bun-query-builder's base model). Wrap separately so set-side
  // casts apply to its data argument.
  const origUpdate = baseModel.update
  if (typeof origUpdate === 'function') {
    baseModel.update = async function (id: number | string, data: Record<string, unknown>) {
      const cast = data && typeof data === 'object' && !Array.isArray(data)
        ? castAttributes(data, casts, 'set')
        : data
      return await (origUpdate as Function).call(this, id, cast)
    }
  }
}

interface StacksModelDefinition {
  name: string
  table: string
  primaryKey?: string
  autoIncrement?: boolean
  /**
   * Per-model declarative behaviors. Common entries:
   *   - `observe: true | ['create','update','delete']` — emit
   *     framework events (`<model>:created` etc.) on lifecycle hooks
   *   - `useAudit`, `useSoftDeletes`, `useTimestamps`, etc.
   *   - `broadcastOn(model): string | string[]` — channels to push
   *     model lifecycle events to via `@stacksjs/realtime`. Requires
   *     `broadcastWith` to be set too; only fires when `observe` is
   *     enabled (stacksjs/stacks#1874 F-10).
   *   - `broadcastWith(model): Record<string, unknown>` — payload
   *     shape the realtime subscribers receive. Lets you broadcast
   *     a curated public projection instead of the full row.
   *
   * @example
   * ```ts
   * traits: {
   *   observe: true,
   *   broadcastOn: post => [`user.${post.user_id}`, 'feed'],
   *   broadcastWith: post => ({ id: post.id, title: post.title, author: post.author?.name }),
   * }
   * ```
   */
  traits?: Record<string, unknown>
  indexes?: Array<{ name: string, columns: string[] }>
  casts?: Record<string, CastType | CasterInterface>
  attributes: {
    [key: string]: {
      factory?: (faker: any) => any
      [key: string]: any
    }
  }
  [key: string]: any
}

type ModelDefinition = StacksModelDefinition
import { createTaggableMethods } from './traits/taggable'
import { createCategorizableMethods } from './traits/categorizable'
import { createCommentableMethods } from './traits/commentable'
import { createBillableMethods } from './traits/billable'
import { createLikeableMethods } from './traits/likeable'
import { createTwoFactorMethods } from './traits/two-factor'
import { createSoftDeleteMethods, resolveSoftDeleteOptions, cascadeSoftDelete } from './traits/soft-deletes'
import { applyAudit, resolveAuditOptions } from './traits/audit'
import { collectEncryptedAttributes, decryptValue, encryptValue, isEncrypted } from './utils/encrypted'

/**
 * Stacks-enhanced model definition.
 *
 * Wraps bun-query-builder's `createModel()` with:
 * - Event dispatching via `traits.observe`
 * - Trait methods (billable, taggable, categorizable, commentable, likeable, 2FA)
 * - Full backward compatibility with generators (migration, routes, dashboard)
 *
 * ### Relationships
 * Each entry in `belongsTo`, `hasMany`, `hasOne`, `belongsToMany`,
 * `hasOneThrough`, and `hasManyThrough` declares a typed relation
 * usable via `.with('relationName')`:
 *
 * ```ts
 * defineModel({
 *   belongsTo: ['Author'],     // ↪ post.author
 *   hasMany:   ['Comment'],    // ↪ post.comments (lowercase + pluralized)
 *   hasOne:    ['Cover'],      // ↪ post.cover
 * })
 * ```
 *
 * After eager loading the related row(s) are reachable as a property
 * on the instance — `(await Post.with('author').first()).author`.
 *
 * @example
 * ```ts
 * import { defineModel } from '@stacksjs/orm'
 * import { schema } from '@stacksjs/validation'
 *
 * export default defineModel({
 *   name: 'Post',
 *   table: 'posts',
 *   attributes: {
 *     title: { type: 'string', fillable: true, validation: { rule: schema.string() } },
 *     views: { type: 'number', fillable: true, validation: { rule: schema.number() } },
 *   },
 *   belongsTo: ['Author'],
 *   hasMany: ['Tag', 'Category', 'Comment'],
 *   traits: { useTimestamps: true, useUuid: true },
 * } as const)
 *
 * // Result: Post.where('title', 'test') — 'title' narrowed to valid columns
 * // Result: Post.with('author') — 'author' narrowed to valid relations
 * ```
 */
export function defineModel<const TDef extends ModelDefinition>(definition: TDef) {
  log.debug(`[orm] Defining model: ${definition.name} (table: ${definition.table})`)

  // Build event hooks from observer configuration and search indexing
  const observeHooks = buildEventHooks(definition as unknown as BQBModelDefinition)
  const searchHooks = buildSearchHooks(definition as unknown as BQBModelDefinition)
  const hooks = mergeModelHooks(observeHooks, searchHooks)

  // Merge hooks into definition
  const defWithHooks = hooks
    ? { ...definition, hooks: { ...(definition as any).hooks, ...hooks } }
    : definition

  // Create the base model from bun-query-builder (provides all typed query methods)
  // Note: createModel's return type is declared as void in .d.ts but actually returns an object at runtime
  const baseModel = createModel(defWithHooks as TDef & BQBModelDefinition) as unknown as Record<string, unknown>

  // Make ModelInstance attribute access ergonomic: `user.password`,
  // `car.slug`, `{ ...booking }` all do the right thing instead of
  // returning undefined / leaking private fields. Casts (when declared)
  // are applied at the same boundary so `chargesEnabled === true` instead
  // of `"0" === truthy`.
  wrapReadsWithProxy(baseModel, definition.casts)

  // Provide Laravel-style static CRUD sugar (update, delete, findOrFail,
  // exists, firstOrCreate, updateOrCreate). Must run before the cast
  // wrapper so it picks up the new `update`/`delete` and applies
  // input/output casting consistently across both APIs.
  addStaticHelpers(baseModel, defWithHooks as BQBModelDefinition)

  // SECURITY: enforce fillable / guarded on every write. Wraps `create`
  // so an unfiltered `req.json()` payload with a guarded field throws
  // `MassAssignmentException` instead of landing in the DB. Static
  // helpers (`update`, `firstOrCreate`, `updateOrCreate`) apply the rule
  // internally; this wrapper covers the bun-query-builder `create` path.
  // Runs before the cast wrapper so the exception fires against the raw
  // user input rather than a cast-coerced view.
  wrapWritesWithMassAssignment(baseModel, defWithHooks as BQBModelDefinition)

  // Write-side casts (e.g. JSON serialization on save) still need the
  // legacy wrapper; reads are handled inside the proxy above.
  if (definition.casts && Object.keys(definition.casts).length > 0) {
    wrapQueryMethodsWithCasts(baseModel, definition.casts)
  }

  // Encrypted-attribute wrappers run AFTER cast wrappers so the encrypt
  // step sees the already-cast (post-`set`) value before persisting, and
  // the decrypt step yields plaintext into the cast layer's `get` for
  // type coercion. Models with no `encrypted: true` attributes pay nothing.
  const encryptedKeys = collectEncryptedAttributes(definition)
  if (encryptedKeys.length > 0) {
    wrapWritesWithEncryption(baseModel, encryptedKeys)
    wrapReadsWithEncryption(baseModel, encryptedKeys)
  }

  // Soft-deletes runs *before* trait methods so that the static
  // `delete` it installs survives any later wrapping. We also gate
  // entirely on the trait flag — without it, models keep their
  // existing hard-delete semantics.
  const softDeleteFlag = (definition as { traits?: { useSoftDeletes?: unknown } }).traits?.useSoftDeletes
  if (softDeleteFlag) {
    applySoftDeletes(baseModel, defWithHooks as BQBModelDefinition, softDeleteFlag)
  }

  // Audit trait must run AFTER soft-delete wiring so it wraps the final
  // `delete` (which the soft-delete trait may have aliased to softDelete).
  // Wrapping earlier would leave the softDelete shim's writes unaudited.
  //
  // `useAudit: true` keeps the legacy best-effort behavior. To opt
  // into transactional auditing (audit failure rolls back the user
  // write — required for compliance scenarios), declare
  // `traits.useAudit: { transactional: true }` instead
  // (stacksjs/stacks#1876 X-2).
  const useAuditDecl = (definition as { traits?: { useAudit?: unknown } }).traits?.useAudit
  if (useAuditDecl) {
    const auditOpts = resolveAuditOptions(useAuditDecl)
    applyAudit(baseModel, definition.name, definition.primaryKey || 'id', auditOpts)
  }

  // Build trait methods based on model config
  const traitMethods = buildTraitMethods(definition as unknown as BQBModelDefinition)

  // Static-level event suppression helpers. `Model.withoutEvents(fn)`
  // runs `fn` with the lifecycle-event ALS scope marked suppressed —
  // equivalent to the module-level `withoutEvents` but bound to the
  // model so it's discoverable via autocomplete.
  //
  // `Model.createQuietly(...)` / `Model.updateQuietly(...)` are sugar:
  // `await User.createQuietly(data)` is exactly `await
  // User.withoutEvents(() => User.create(data))`. The quiet variants
  // exist to spare callers the closure noise on the common case (single
  // bulk write, no surrounding logic).
  ;(baseModel as any).withoutEvents = function <T>(fn: () => T | Promise<T>): Promise<T> {
    return withoutEvents(fn)
  }

  for (const method of ['create', 'update', 'firstOrCreate', 'updateOrCreate', 'forceCreate', 'forceUpdate', 'delete', 'forceDelete', 'softDelete', 'restore'] as const) {
    const orig = (baseModel as any)[method]
    if (typeof orig !== 'function') continue
    const quietName = `${method}Quietly` as const
    if (typeof (baseModel as any)[quietName] === 'function') continue
    ;(baseModel as any)[quietName] = function (...args: unknown[]) {
      return withoutEvents(() => orig.apply(baseModel, args))
    }
  }

  // Merge: base model + trait methods + raw definition properties (for generators)
  // Spreading `definition` ensures `.name`, `.table`, `.attributes`, `.traits` etc.
  // remain accessible for migration/route/dashboard generators
  const finalModel = Object.assign(baseModel, traitMethods, {
    // Raw definition access
    ...definition,
    getDefinition: () => definition,
    _isStacksModel: true as const,
  })

  // Register in bun-query-builder's model registry so cross-model lookups
  // (`belongsToMany` resolving `'Athlete'` → Athlete model) succeed at
  // runtime. Without this, every belongsToMany / through-style relation
  // throws `[orm] related model 'X' is not registered` on the first
  // call. We bypass `bun-query-builder.defineModel` (which would also
  // register) because stacks needs to install its own wrappers around
  // the result of `createModel`.
  registerModel(definition.name, finalModel)

  return finalModel
}

function buildEventHooks(definition: BQBModelDefinition): BQBModelDefinition['hooks'] | undefined {
  const observe = definition.traits?.observe
  if (!observe) return undefined

  const modelName = definition.name.toLowerCase()

  // Lazy import to avoid circular dependency. Suppression check is done
  // INSIDE the dispatcher (rather than at the hook caller) so even
  // explicit `dispatchEvent` calls from elsewhere honour the
  // `withoutEvents` ALS scope without each call site having to remember.
  //
  // Re-throw listener errors by default (stacksjs/stacks#1876 O-2).
  // Previously this swallowed every exception and only logged to
  // console.error, which meant a queue dispatch failing inside an
  // `updated` listener looked like a successful save with a missing
  // background job — silent data drift. Now: the model save fails
  // when a listener fails, matching Laravel's semantics. Listeners
  // that are genuinely best-effort (analytics, observability) should
  // catch their own errors. Opt out globally via
  // `STACKS_ORM_EVENT_ERRORS=swallow` for legacy code that hasn't
  // audited its listeners yet.
  const dispatchEvent = async (event: string, data: any) => {
    if (eventsAreSuppressed()) return
    try {
      const { dispatch } = await import('@stacksjs/events')
      await dispatch(event, data)
    }
    catch (err) {
      // MODULE_NOT_FOUND is the expected shape when the events package
      // isn't installed (browser bundles, some test envs) — silence it.
      if (err && typeof err === 'object' && 'code' in err && err.code === 'MODULE_NOT_FOUND')
        return
      console.error(`[ORM] Event '${event}' handler error:`, err)
      if (process.env.STACKS_ORM_EVENT_ERRORS !== 'swallow') throw err
    }
  }

  // Model-level broadcasting (stacksjs/stacks#1874 F-10).
  //
  // Opt-in via `traits.broadcastOn` (channels) + `traits.broadcastWith`
  // (payload shape). When both are declared, the post-write hooks
  // dispatch to `@stacksjs/realtime` with the same event name shape
  // (`<model>:<verb>`) as the events bus uses, so subscribers see
  // consistent naming across both channels.
  //
  // Errors are LOGGED-AND-SWALLOWED by default — broadcasting is a
  // notification side-channel, not the source of truth, and a flaky
  // websocket layer must not break model saves. Opt in to throw via
  // `STACKS_ORM_BROADCAST_ERRORS=throw` for tests that want to
  // surface mis-wired broadcasts loudly.
  const broadcastOnFn = (definition as { traits?: { broadcastOn?: (model: any) => string | string[] } }).traits?.broadcastOn
  const broadcastWithFn = (definition as { traits?: { broadcastWith?: (model: any) => Record<string, unknown> } }).traits?.broadcastWith
  const broadcastingEnabled = typeof broadcastOnFn === 'function' && typeof broadcastWithFn === 'function'

  const dispatchBroadcast = async (event: string, model: any): Promise<void> => {
    if (!broadcastingEnabled) return
    if (eventsAreSuppressed()) return
    try {
      const channelsRaw = broadcastOnFn!(model)
      const channels = Array.isArray(channelsRaw) ? channelsRaw : [channelsRaw]
      const payload = broadcastWithFn!(model)
      const realtime = await import('@stacksjs/realtime').catch(() => null) as { broadcast?: (channel: string, event: string, data: unknown) => Promise<void> | void } | null
      const broadcast = realtime?.broadcast
      if (typeof broadcast !== 'function') return
      for (const channel of channels) {
        if (typeof channel !== 'string' || channel.length === 0) continue
        await broadcast(channel, event, payload)
      }
    }
    catch (err) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'MODULE_NOT_FOUND')
        return
      console.error(`[ORM] Broadcast '${event}' handler error:`, err)
      if (process.env.STACKS_ORM_BROADCAST_ERRORS === 'throw') throw err
    }
  }

  // Dispatches a before-event and returns false if the handler cancels
  // the operation. Same re-throw policy as `dispatchEvent` — a broken
  // `before*` listener used to silently allow the operation through
  // because the catch returned `true` (default-allow). Now: the save
  // fails on listener error unless STACKS_ORM_EVENT_ERRORS=swallow.
  const dispatchBeforeEvent = async (event: string, data: any): Promise<boolean> => {
    if (eventsAreSuppressed()) return true
    try {
      const { dispatchAsync } = await import('@stacksjs/events')
      // dispatchAsync awaits every matching handler and returns their results;
      // any explicit `false` return from a listener cancels the operation.
      const results = (await dispatchAsync(event as any, data)) as unknown[]
      if (Array.isArray(results) && results.some(r => r === false)) return false
    }
    catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'MODULE_NOT_FOUND')
        return true
      console.error(`[ORM] Before-event '${event}' handler error:`, err)
      if (process.env.STACKS_ORM_EVENT_ERRORS !== 'swallow') throw err
    }
    return true
  }

  const events = observe === true
    ? ['create', 'update', 'delete']
    : Array.isArray(observe) ? observe : []

  const hooks: NonNullable<BQBModelDefinition['hooks']> = {}

  if (events.includes('create')) {
    hooks.beforeCreate = async (model: any) => {
      log.debug(`[orm] Create ${modelName}`, model)
      // `saving` fires for every persist (insert OR update), `creating`
      // for inserts only — Eloquent semantics. Either listener can
      // cancel the operation by returning `false`.
      const savingOk = await dispatchBeforeEvent(`${modelName}:saving`, model)
      if (!savingOk) throw new Error(`[ORM] ${modelName}:saving event cancelled the operation`)
      const creatingOk = await dispatchBeforeEvent(`${modelName}:creating`, model)
      if (!creatingOk) throw new Error(`[ORM] ${modelName}:creating event cancelled the operation`)
    }
    hooks.afterCreate = async (model: any) => {
      // Order: `created` first (specific), then `saved` (general) — same
      // as Eloquent so a `saved` listener can rely on `created` having
      // already fired for the insert path.
      await dispatchEvent(`${modelName}:created`, model)
      await dispatchEvent(`${modelName}:saved`, model)
      // Broadcast AFTER the event dispatch so any event-listener-side
      // mutation of the model is reflected in the broadcast payload.
      await dispatchBroadcast(`${modelName}:created`, model)
    }
  }
  if (events.includes('update')) {
    hooks.beforeUpdate = async (model: any) => {
      log.debug(`[orm] Update ${modelName}#${model?.id ?? 'unknown'}`, model)
      const savingOk = await dispatchBeforeEvent(`${modelName}:saving`, model)
      if (!savingOk) throw new Error(`[ORM] ${modelName}:saving event cancelled the operation`)
      const updatingOk = await dispatchBeforeEvent(`${modelName}:updating`, model)
      if (!updatingOk) throw new Error(`[ORM] ${modelName}:updating event cancelled the operation`)
    }
    hooks.afterUpdate = async (model: any) => {
      await dispatchEvent(`${modelName}:updated`, model)
      await dispatchEvent(`${modelName}:saved`, model)
      await dispatchBroadcast(`${modelName}:updated`, model)
    }
  }
  if (events.includes('delete')) {
    hooks.beforeDelete = async (model: any) => {
      log.debug(`[orm] Delete ${modelName}#${model?.id ?? 'unknown'}`)
      const shouldProceed = await dispatchBeforeEvent(`${modelName}:deleting`, model)
      if (!shouldProceed) throw new Error(`[ORM] ${modelName}:deleting event cancelled the operation`)
    }
    hooks.afterDelete = async (model: any) => {
      await dispatchEvent(`${modelName}:deleted`, model)
      await dispatchBroadcast(`${modelName}:deleted`, model)
    }
  }

  return hooks
}

function mergeModelHooks(
  ...sets: Array<BQBModelDefinition['hooks'] | undefined>
): BQBModelDefinition['hooks'] | undefined {
  const merged: NonNullable<BQBModelDefinition['hooks']> = {}
  const names = new Set<string>()

  for (const set of sets) {
    if (!set) continue
    for (const name of Object.keys(set)) names.add(name)
  }

  for (const name of names) {
    const fns = sets.map(s => s?.[name as keyof NonNullable<BQBModelDefinition['hooks']>]).filter((fn): fn is (...args: any[]) => any => typeof fn === 'function')
    if (!fns.length) continue
    ;(merged as Record<string, (...args: any[]) => any>)[name] = async (...args: any[]) => {
      for (const fn of fns) await fn(...args)
    }
  }

  return Object.keys(merged).length ? merged : undefined
}

/**
 * Scout-style search index sync when `traits.useSearch` is set.
 * Indexes on create/update and removes on delete without requiring `observe: true`.
 */
function buildSearchHooks(definition: BQBModelDefinition): BQBModelDefinition['hooks'] | undefined {
  const useSearch = definition.traits?.useSearch
  if (!useSearch) return undefined

  const tableName = definition.table || snakeCase(`${definition.name}s`)

  const syncDocument = async (model: any) => {
    if (eventsAreSuppressed()) return
    try {
      const { useSearchEngine } = await import('@stacksjs/search-engine')
      const wrapped = wrapModelInstance(model)
      const doc = (wrapped as any).toSearchableObject?.()
      if (doc) await useSearchEngine().addDocument(tableName, doc)
    }
    catch (err) {
      log.warn(`[orm/search] Failed to index ${definition.name}: ${(err as Error).message}`)
    }
  }

  const removeDocument = async (model: any) => {
    if (eventsAreSuppressed()) return
    const id = model?.id ?? model?._attributes?.id
    if (id == null) return
    try {
      const { useSearchEngine } = await import('@stacksjs/search-engine')
      await useSearchEngine().deleteDocument(tableName, Number(id))
    }
    catch (err) {
      log.warn(`[orm/search] Failed to remove ${definition.name}#${id}: ${(err as Error).message}`)
    }
  }

  return {
    afterCreate: syncDocument,
    afterUpdate: syncDocument,
    afterDelete: removeDocument,
  }
}

export interface TraitMethods {
  _taggable?: ReturnType<typeof createTaggableMethods>
  _categorizable?: ReturnType<typeof createCategorizableMethods>
  _commentable?: ReturnType<typeof createCommentableMethods>
  _billable?: ReturnType<typeof createBillableMethods>
  _likeable?: ReturnType<typeof createLikeableMethods>
  _twoFactor?: ReturnType<typeof createTwoFactorMethods>
  _softDeletes?: ReturnType<typeof createSoftDeleteMethods>
}

function buildTraitMethods(definition: BQBModelDefinition): TraitMethods {
  const methods: TraitMethods = {}
  const tableName = definition.table
  const traits = definition.traits

  if (!traits) return methods

  if (traits.taggable) {
    methods._taggable = createTaggableMethods(tableName)
  }

  if (traits.categorizable) {
    methods._categorizable = createCategorizableMethods(tableName)
  }

  if (traits.commentable) {
    methods._commentable = createCommentableMethods(tableName)
  }

  if (traits.billable) {
    methods._billable = createBillableMethods(tableName)
  }

  if (traits.likeable) {
    const likeableOpts = typeof traits.likeable === 'object' ? traits.likeable as { table?: string, foreignKey?: string } : undefined
    methods._likeable = createLikeableMethods(tableName, likeableOpts)
  }

  const useAuth = traits.useAuth || traits.authenticatable
  if (typeof useAuth === 'object' && useAuth && 'useTwoFactor' in useAuth && useAuth.useTwoFactor) {
    methods._twoFactor = createTwoFactorMethods()
  }

  return methods
}

/**
 * Apply the soft-deletes shim to a model's static surface. Called by
 * `defineModel()` when `traits.useSoftDeletes` is set on the definition.
 *
 * Accepts either the legacy `true` or the object form
 * `{ cascade: ['posts', 'comments'] }`. When `cascade` is set, soft-deleting
 * the parent also soft-deletes the named relations, and restoring the parent
 * restores them. See `cascadeSoftDelete` in `traits/soft-deletes.ts` for the
 * fan-out semantics.
 */
function applySoftDeletes(
  baseModel: Record<string, unknown>,
  definition: BQBModelDefinition,
  traitFlag: unknown,
): void {
  const helpers = createSoftDeleteMethods(baseModel as any, definition.primaryKey || 'id')
  const options = resolveSoftDeleteOptions(traitFlag)
  const parentDef = definition as unknown as { name: string, hasMany?: ReadonlyArray<string>, hasOne?: ReadonlyArray<string> }
  const modelName = definition.name.toLowerCase()

  // Lazy event-dispatch helpers, mirroring buildEventHooks but local to
  // soft-delete restore. We only fire these when the `observe` trait is
  // on (matching the rest of the lifecycle-event policy) — otherwise
  // restore() stays a quiet UPDATE.
  const observeOn = definition.traits?.observe != null && definition.traits?.observe !== false
  const fireRestoring = async (id: number | string): Promise<boolean> => {
    if (!observeOn || eventsAreSuppressed()) return true
    try {
      const { dispatchAsync } = await import('@stacksjs/events')
      const results = (await dispatchAsync(`${modelName}:restoring` as any, { id })) as unknown[]
      if (Array.isArray(results) && results.some(r => r === false)) return false
    }
    catch (err: any) {
      if (err?.code !== 'MODULE_NOT_FOUND')
        console.error(`[ORM] Before-event '${modelName}:restoring' handler error:`, err)
    }
    return true
  }
  const fireRestored = async (id: number | string): Promise<void> => {
    if (!observeOn || eventsAreSuppressed()) return
    try {
      const { dispatch } = await import('@stacksjs/events')
      await dispatch(`${modelName}:restored` as any, { id })
    }
    catch (err: any) {
      if (err?.code !== 'MODULE_NOT_FOUND')
        console.error(`[ORM] Event '${modelName}:restored' handler error:`, err)
    }
  }

  // Wrap the raw helpers with event dispatch + cascade. Pre-fix the
  // restore path wrote `deleted_at = null` directly with no observers
  // ever fired — the audit's #11 specifically called this out, since a
  // listener watching for "user came back" via `restored` was never going
  // to receive the event.
  //
  // Cascade is wrapped in a transaction (stacksjs/stacks#1876 O-3) so
  // a child-cascade failure rolls back the parent's soft-delete /
  // restore. Without this, the parent committed first and a failing
  // child left the schema in an inconsistent state with no signal to
  // the caller. The transaction is opt-out via
  // `STACKS_ORM_CASCADE_SWALLOW=true` (the cascadeChildren callsite
  // honors the same env var — same boundary, same opt-out).
  const transactional = process.env.STACKS_ORM_CASCADE_SWALLOW !== 'true'

  const softDeleteFn = async (id: number | string): Promise<boolean> => {
    if (!options.cascade?.length || !transactional) {
      const ok = await helpers.softDelete(id)
      if (ok && options.cascade?.length)
        await cascadeSoftDelete(parentDef, options, id, 'softDelete')
      return ok
    }
    const { db } = await import('@stacksjs/database')
    return await db.transaction(async () => {
      const ok = await helpers.softDelete(id)
      if (ok)
        await cascadeSoftDelete(parentDef, options, id, 'softDelete')
      return ok
    })
  }

  const restoreFn = async (id: number | string): Promise<boolean> => {
    const proceed = await fireRestoring(id)
    if (!proceed) return false
    if (!options.cascade?.length || !transactional) {
      const ok = await helpers.restore(id)
      if (ok) {
        if (options.cascade?.length)
          await cascadeSoftDelete(parentDef, options, id, 'restore')
        await fireRestored(id)
      }
      return ok
    }
    const { db } = await import('@stacksjs/database')
    const ok = await db.transaction(async () => {
      const inner = await helpers.restore(id)
      if (inner)
        await cascadeSoftDelete(parentDef, options, id, 'restore')
      return inner
    })
    // Fire `restored` AFTER the transaction commits — listeners that
    // run side effects (queue jobs, audit log) should observe the
    // restored state, not the in-flight transaction snapshot.
    if (ok) await fireRestored(id)
    return ok
  }

  // Replace `delete` with the soft-delete variant; expose the original
  // as `forceDelete` for the rare case callers want a real DELETE.
  baseModel.softDelete = softDeleteFn
  baseModel.restore = restoreFn
  baseModel.forceDelete = helpers.forceDelete
  baseModel.withTrashed = helpers.withTrashed
  baseModel.onlyTrashed = helpers.onlyTrashed
  // Override the static `delete` so the natural call path soft-deletes.
  // Callers that explicitly want a hard delete use `Model.forceDelete(id)`.
  baseModel.delete = softDeleteFn
}

/**
 * Normalize a ModelInstance (or array of them, or already-plain row) into
 * a serialization-ready plain object.
 *
 * Resolves the three shapes a Stacks model query can return:
 *   - ModelInstance (find/first/get)         → calls toJSON() → strips `hidden` attrs
 *   - Bare attribute bag with `_attributes`  → returns _attributes as-is
 *   - Plain row (already normalized)         → returns it unchanged
 *
 * Use `toAttrs(inst)` in actions instead of `inst._attributes ?? inst` —
 * the latter pattern silently leaks `hidden: true` fields (e.g. license_plate,
 * vin, password hashes) into responses.
 */
export function toAttrs<T = any>(value: any): T {
  if (value == null) return value
  if (Array.isArray(value)) return value.map(toAttrs) as unknown as T
  if (typeof value !== 'object') return value as T
  if (typeof value.toJSON === 'function') return value.toJSON()
  if (value._attributes && typeof value._attributes === 'object') return value._attributes as T
  return value as T
}

// Re-export types from bun-query-builder for convenience
export type { ModelDefinition, InferRelationNames, ModelAttributes, InferModelAttributes, SystemFields, ColumnName, AttributeKeys, FillableKeys, HiddenKeys, ModelInstance, ModelQueryBuilder } from '@stacksjs/query-builder'
