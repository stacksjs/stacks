import { createModel, type OrmModelDefinition as BQBModelDefinition, type OrmModelStatic, registerModel } from '@stacksjs/query-builder'
import type { InferRelationNames } from '@stacksjs/query-builder'
import type { Faker } from '@stacksjs/faker'
import type { ApiMiddleware, DashboardModelOptions, SearchOptions } from '@stacksjs/types'
import type { Validator } from '@stacksjs/validation'
import { log } from '@stacksjs/logging'
import { snakeCase } from '@stacksjs/strings'
import { AsyncLocalStorage } from 'node:async_hooks'
import { toCursorPaginator, toPaginator, toSimplePaginator } from '@stacksjs/pagination'
import { enrichPaginatorUrls, resolveCursorArgs, resolvePageArgs } from './paginator-request'
import { validateWriteBody } from './auto-crud'
import type { BelongsToForeignKeys } from './model-types'

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

/**
 * Validation-suppression scope, the same shape as {@link withoutEvents}.
 *
 * Declared `validation.rule`s run on every direct write. A bulk import or a
 * backfill sometimes needs to land rows that predate a rule, so this is the
 * escape hatch — deliberately an explicit scope rather than a per-call
 * `{ validate: false }`, so skipping validation is a visible decision about a
 * block of code rather than an option buried in one call site.
 */
const validationSuppression = new AsyncLocalStorage<{ suppressed: boolean }>()

function validationIsSuppressed(): boolean {
  return validationSuppression.getStore()?.suppressed === true
}

/**
 * Run a callback with model validation suppressed for its entire duration.
 *
 * @example
 * ```ts
 * await User.withoutValidation(async () => {
 *   for (const row of legacyRows) await User.create(row) // rules do not run
 * })
 * ```
 */
export function withoutValidation<T>(fn: () => T | Promise<T>): Promise<T> {
  return Promise.resolve(validationSuppression.run({ suppressed: true }, fn as () => Promise<T>))
}

/**
 * Thrown when a direct write fails a declared `validation.rule`.
 *
 * Carries `status = 422` and a per-field `errors` map, matching the shape the
 * generated REST routes already return, so a handler that catches this can
 * respond with the same body it would have produced through auto-CRUD. It is
 * duck-typed by `mapWriteError`, which preserves any integer `status` in
 * 400-599 — so an over-length value now surfaces as a 422 instead of the
 * driver's raw 22001 becoming a 500 (stacksjs/stacks#2233).
 */
/**
 * Where `defineModel` keeps the definition it was handed.
 *
 * `Symbol.for`, so two copies of the ORM in one process still agree — the
 * dist-only-app split makes that a real arrangement, not a hypothetical.
 */
export const MODEL_DEFINITION: unique symbol = Symbol.for('stacks.orm.modelDefinition') as never

export class ModelValidationError extends Error {
  readonly status = 422
  readonly errors: Record<string, string[]>

  constructor(modelName: string, errors: Record<string, string[]>) {
    const fields = Object.keys(errors).join(', ')
    super(`${modelName} validation failed: ${fields}`)
    this.name = 'ModelValidationError'
    this.errors = errors
  }
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
  console.error(`[orm] JSON cast failed to parse value (returning null): ${message} - value preview: ${JSON.stringify(preview)}`)
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
 * Maps each trait-bag method name to how it must be invoked when called on
 * a hydrated model instance (`user.checkout(...)`, `post.like(userId)`)
 * instead of the static bag (`User._billable.checkout(user, ...)`).
 *
 * `buildTraitMethods()` builds two shapes of trait function depending on
 * the trait:
 *   - 'id'    — taggable/categorizable/commentable/likeable functions take
 *               the row's primary key as their first argument.
 *   - 'model' — billable/twoFactor functions take the whole model (so they
 *               can read arbitrary columns like `stripe_id` and call
 *               `model.update(...)`) as their first argument.
 *
 * `likedBy` is intentionally omitted: it looks up every row liked *by* a
 * given user — a reverse, cross-row query unrelated to any single
 * instance's own id — so it stays reachable only via the static bag
 * (`Model._likeable.likedBy(userId)`).
 */
const TRAIT_INSTANCE_METHOD_BINDINGS: Record<string, { bag: keyof TraitMethods, mode: 'id' | 'model' }> = {
  tags: { bag: '_taggable', mode: 'id' },
  tagCount: { bag: '_taggable', mode: 'id' },
  addTag: { bag: '_taggable', mode: 'id' },
  activeTags: { bag: '_taggable', mode: 'id' },
  inactiveTags: { bag: '_taggable', mode: 'id' },
  removeTag: { bag: '_taggable', mode: 'id' },

  categories: { bag: '_categorizable', mode: 'id' },
  categoryCount: { bag: '_categorizable', mode: 'id' },
  addCategory: { bag: '_categorizable', mode: 'id' },
  activeCategories: { bag: '_categorizable', mode: 'id' },
  inactiveCategories: { bag: '_categorizable', mode: 'id' },
  removeCategory: { bag: '_categorizable', mode: 'id' },

  comments: { bag: '_commentable', mode: 'id' },
  commentCount: { bag: '_commentable', mode: 'id' },
  addComment: { bag: '_commentable', mode: 'id' },
  approvedComments: { bag: '_commentable', mode: 'id' },
  pendingComments: { bag: '_commentable', mode: 'id' },
  rejectedComments: { bag: '_commentable', mode: 'id' },

  likes: { bag: '_likeable', mode: 'id' },
  likeCount: { bag: '_likeable', mode: 'id' },
  like: { bag: '_likeable', mode: 'id' },
  unlike: { bag: '_likeable', mode: 'id' },
  isLiked: { bag: '_likeable', mode: 'id' },

  createStripeUser: { bag: '_billable', mode: 'model' },
  updateStripeUser: { bag: '_billable', mode: 'model' },
  deleteStripeUser: { bag: '_billable', mode: 'model' },
  createOrGetStripeUser: { bag: '_billable', mode: 'model' },
  retrieveStripeUser: { bag: '_billable', mode: 'model' },
  defaultPaymentMethod: { bag: '_billable', mode: 'model' },
  setDefaultPaymentMethod: { bag: '_billable', mode: 'model' },
  addPaymentMethod: { bag: '_billable', mode: 'model' },
  paymentMethods: { bag: '_billable', mode: 'model' },
  newSubscription: { bag: '_billable', mode: 'model' },
  updateSubscription: { bag: '_billable', mode: 'model' },
  cancelSubscription: { bag: '_billable', mode: 'model' },
  activeSubscription: { bag: '_billable', mode: 'model' },
  checkout: { bag: '_billable', mode: 'model' },
  createSetupIntent: { bag: '_billable', mode: 'model' },
  subscriptionHistory: { bag: '_billable', mode: 'model' },
  transactionHistory: { bag: '_billable', mode: 'model' },
  connectAccount: { bag: '_billable', mode: 'model' },
  createConnectAccount: { bag: '_billable', mode: 'model' },
  connectOnboardLink: { bag: '_billable', mode: 'model' },
  syncConnectStatus: { bag: '_billable', mode: 'model' },
  chargeWithSplit: { bag: '_billable', mode: 'model' },

  generateTwoFactorForModel: { bag: '_twoFactor', mode: 'model' },
  verifyTwoFactorCode: { bag: '_twoFactor', mode: 'model' },
}

/**
 * Walk a dot-separated path against a relations map and return the
 * resolved value, or `null` if any segment misses. Used by
 * `toSearchableObject` to pull denormalised cross-table fields out of
 * `_relations` without an extra database round-trip (the caller is
 * expected to have eager-loaded the relevant relations via
 * `.with(...)`). See stacksjs/stacks#1918.
 */
function resolveRelationPath(
  relations: Record<string, unknown> | undefined,
  path: string,
): unknown {
  if (!relations || !path) return null
  const segments = path.split('.')
  let current: unknown = relations
  for (const segment of segments) {
    if (current == null || typeof current !== 'object') return null
    const obj = current as Record<string, unknown>
    // Relations are wrapped instances — read from `_attributes` first
    // so the path-walk doesn't need to know about the proxy tag.
    if ('_attributes' in obj && obj._attributes && typeof obj._attributes === 'object') {
      const attrs = obj._attributes as Record<string, unknown>
      if (segment in attrs) {
        current = attrs[segment]
        continue
      }
    }
    if (segment in obj) {
      current = obj[segment]
      continue
    }
    return null
  }
  return current ?? null
}

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
/**
 * A model instance, in the terms this proxy reads it.
 *
 * `wrapModelInstance` is generic over `T extends object`, so nothing inside
 * the handler knew that its target carries `_attributes`, `save`, `isDirty`
 * and the rest - and it reached for them through 31 separate
 * `target` casts. Each one unchecked the whole instance, so a
 * renamed internal (`_attributes` is the one this file is built on) would
 * have gone unnoticed at every single site.
 *
 * Named once, and the target narrowed to it once, so the handler body is
 * checked against the members it genuinely depends on.
 */
/**
 * The shared model definition, as this handler mutates it.
 *
 * `saveAsync` blanks `def.set` around the inner `save()` so the sync path does
 * not run the setters a second time, then restores it on a `finally`. That
 * assignment is to a `readonly` field, and on an object the comment there
 * already notes is shared across every instance of the model - which the
 * `(target)` reads made invisible at the point of assignment.
 */
type MutableModelDefinition = Omit<ModelDefinition, 'set'> & {
  set?: ModelDefinition['set']
  /** Trait method bags, attached by the trait installers. */
  __traitMethods?: unknown
}

interface WrappedModelInstance {
  /** Guaranteed: `wrapModelInstance` returns early when it is absent. */
  _attributes: Record<string, unknown>
  _definition: MutableModelDefinition
  _relations?: Record<string, unknown>
  id?: unknown
  isDirty?: (_key?: string) => boolean
  save: () => unknown
  update: (_data: Record<string, unknown>) => unknown
  delete: () => unknown
  set?: (_key: string, _value: unknown) => unknown
}

function wrapModelInstance<T extends object>(
  instance: T,
  casts?: Record<string, CastType | CasterInterface>,
): T {
  if (!instance || typeof instance !== 'object') return instance

  // The same members the handler below reads, named the same way.
  const candidate = instance as T & WrappedModelInstance & { [STACKS_PROXY_TAG]?: boolean }

  if (candidate[STACKS_PROXY_TAG]) return instance
  const attrs = candidate._attributes
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
    get(rawTarget, prop, recv) {
      const target = rawTarget as T & WrappedModelInstance

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
          const def = target._definition
          const setters = def?.set as Record<string, (attrs: Record<string, unknown>) => unknown> | undefined
          if (setters && typeof target.isDirty === 'function') {
            for (const [key, fn] of Object.entries(setters)) {
              if (typeof fn !== 'function') continue
              if (!target.isDirty(key)) continue
              const result = fn(target._attributes as Record<string, unknown>)
              const value = (result && typeof (result as { then?: unknown }).then === 'function')
                ? await result
                : result
              ;target._attributes[key] = value
            }
            // Suppress the sync save's own setter pass — we already did
            // it (and awaited it). Restore on a `finally` so a thrown
            // save() doesn't leave the model definition in a wonky state
            // (which would stick across other instances since the def
            // is shared).
            const original = def.set
            def.set = {}
            try {
              return target.save()
            }
            finally {
              def.set = original
            }
          }
          return target.save()
        }
      }

      // Sync `save()` guard. If a model has `set: { x: async (...) }` and
      // the user does `inst.x = 'plain'; inst.save()` (no await), the
      // underlying bqb save() would call the setter and persist its raw
      // Promise — which surfaces deep in the SQLite driver as a cryptic
      // "Binding expected string, TypedArray, boolean…" error. We pre-run
      // each dirty setter, throw a helpful message if any is a Promise,
      // and otherwise stash the resolved values + suppress the underlying
      // setter pass so we don't double-apply.
      if (prop === 'save') {
        return function () {
          const def = target._definition
          const setters = def?.set as Record<string, (attrs: Record<string, unknown>) => unknown> | undefined
          if (setters && Object.keys(setters).length > 0 && typeof target.isDirty === 'function') {
            for (const [key, fn] of Object.entries(setters)) {
              if (typeof fn !== 'function') continue
              if (!target.isDirty(key)) continue
              const result = fn(target._attributes as Record<string, unknown>)
              if (result && typeof (result as { then?: unknown }).then === 'function') {
                throw new Error(
                  `Setter for "${key}" returned a Promise - use \`saveAsync()\` instead of \`save()\` when a model has async setters.`,
                )
              }
              ;target._attributes[key] = result
            }
            const original = def.set
            def.set = {}
            try {
              return target.save()
            }
            finally {
              def.set = original
            }
          }
          return target.save()
        }
      }

      if (prop === 'updateAsync') {
        return async function (data: Record<string, unknown>) {
          // fill() then saveAsync() — same flow as instance.update() but
          // async-aware. The proxy `set` trap does the per-key write,
          // which means our `set:` hook bookkeeping survives.
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            for (const [k, v] of Object.entries(data)) {
              ;(recv)[k] = v
            }
          }
          // Re-fetch saveAsync via the same proxy (so 'this'-binding
          // matches what the user would call directly).
          return (recv).saveAsync()
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
          return withoutEvents(() => target.save())
        }
      }
      if (prop === 'saveAsyncQuietly') {
        return function () {
          return withoutEvents(() => (recv).saveAsync())
        }
      }
      if (prop === 'updateQuietly') {
        return function (data: Record<string, unknown>) {
          return withoutEvents(() => target.update(data))
        }
      }
      if (prop === 'updateAsyncQuietly') {
        return function (data: Record<string, unknown>) {
          return withoutEvents(() => (recv).updateAsync(data))
        }
      }
      if (prop === 'deleteQuietly') {
        return function () {
          return withoutEvents(() => target.delete())
        }
      }

      if (prop === 'toSearchableObject') {
        return function toSearchableObject() {
          const def = target._definition as { traits?: { useSearch?: boolean | SearchOptions } } | undefined
          const search = def?.traits?.useSearch
          if (!search) return null

          const attrs = target._attributes as Record<string, unknown> | undefined
          if (!attrs) return null

          // Boolean form: `useSearch: true` indexes every attribute on
          // the row. Pre-fix this branch short-circuited to `null`
          // because `typeof true === 'boolean'`, which silently no-op'd
          // both the live observer hook AND `./buddy search-engine:
          // update` (the latter logged `imported 0, skipped N` and
          // exited 0). See stacksjs/stacks#1917.
          if (search === true) {
            const doc: Record<string, unknown> = { ...attrs }
            if (attrs.id != null) doc.id = String(attrs.id)
            return doc
          }

          // Object form: explicit `searchable` / `displayable` /
          // `filterable` / `sortable` arrays.
          const doc: Record<string, unknown> = {}
          const keys = search.displayable?.length
            ? search.displayable
            : [...search.searchable ?? [], ...search.filterable ?? [], ...search.sortable ?? [], 'id']

          // Pre-resolve any cross-table fields declared in `denormalize`
          // by walking the dot-path against `_relations`. Eager-loading
          // is the caller's job (`Model.query().with('court_house').
          // get()`); this loop just reads the already-loaded relation.
          // See stacksjs/stacks#1918 for the broader picture.
          const denormalize = search.denormalize ?? {}
          const relations = target._relations as Record<string, unknown> | undefined

          for (const key of keys) {
            const snake = snakeCase(key)

            // 1) Own attribute on the row — fast path, identical to
            //    pre-#1918 behaviour.
            const own = attrs[snake] ?? attrs[key]
            if (own !== undefined) {
              doc[snake] = own
              continue
            }

            // 2) Denormalised dot-path against `_relations`. Missing
            //    relation/segment resolves to `null` rather than
            //    `undefined` so the indexed document keeps the field
            //    (Meilisearch settings that declare a key as searchable
            //    expect every doc to carry it).
            const path = denormalize[key] ?? denormalize[snake]
            if (path) {
              doc[snake] = resolveRelationPath(relations, path)
              continue
            }

            doc[snake] = undefined
          }

          if (attrs.id != null) doc.id = String(attrs.id)
          return doc
        }
      }

      if (typeof prop === 'string' && !MODEL_INSTANCE_INTERNAL_KEYS.has(prop)) {
        const a = target._attributes
        if (a && Object.prototype.hasOwnProperty.call(a, prop)) return a[prop]
        // Eloquent-style relation access: after `Booking.query().with('user').first()`
        // the renter is reachable as `booking.user` instead of forcing every
        // call site through `booking.getRelation('user')`. If the relation
        // wasn't eager-loaded, this still returns undefined — callers should
        // either load it via `.with(name)` or use the explicit accessor.
        const rels = target._relations
        if (rels && Object.prototype.hasOwnProperty.call(rels, prop)) {
          const related = rels[prop]
          if (Array.isArray(related)) return related.map(x => wrapModelInstance(x as object, casts))
          // A relation is a row, a list of rows, or nothing. `wrapModelInstance`
          // returns anything non-object unchanged, so the guard is only here to
          // satisfy its `T extends object`.
          return related && typeof related === 'object' ? wrapModelInstance(related, casts) : related
        }

        // Trait instance methods (taggable/categorizable/commentable/
        // likeable/billable/twoFactor) — see TRAIT_INSTANCE_METHOD_BINDINGS.
        // `_definition.__traitMethods` is stamped per-model by
        // `defineModel()`, so a relation-traversed instance of a
        // *different* model (reached via `_relations` above) still
        // resolves its *own* model's trait bag here, not the parent's.
        const binding = TRAIT_INSTANCE_METHOD_BINDINGS[prop]
        if (binding) {
          const traitBags = target._definition?.__traitMethods as TraitMethods | undefined
          const bag = traitBags?.[binding.bag] as Record<string, (...args: any[]) => any> | undefined
          const fn = bag?.[prop]
          if (typeof fn === 'function') {
            return binding.mode === 'model'
              ? (...args: any[]) => fn(recv, ...args)
              : (...args: any[]) => fn(target.id, ...args)
          }
        }

        // Attributes are stored under their column name, but models declare
        // them in camelCase and every other surface accepts that spelling:
        // `create({ pollIntervalMinutes })` writes, `where('pollIntervalMinutes')`
        // queries, and `ModelRow` types the property as present. Only property
        // reads disagreed, returning undefined for every multi-word attribute
        // while typechecking clean — so the mistake was invisible and the value
        // usually vanished into a `|| default`.
        //
        // Resolved last, so it can never shadow a real attribute, relation, or
        // trait method: it only answers where the read was already undefined.
        // `ownKeys` deliberately still reports column names only, which keeps
        // spreads, `Object.keys`, and JSON responses byte-identical.
        if (a) {
          const column = snakeCase(prop)
          if (column !== prop && Object.prototype.hasOwnProperty.call(a, column))
            return a[column]
        }
      }
      const v = Reflect.get(target, prop, target)
      return typeof v === 'function' ? v.bind(target) : v
    },
    set(rawTarget, prop, value, recv) {
      const target = rawTarget as T & WrappedModelInstance

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
        const a = target._attributes
        const setter = target.set
        if (a && Object.prototype.hasOwnProperty.call(a, prop)) {
          if (typeof setter === 'function') setter.call(target, prop, value)
          else a[prop] = value
          return true
        }
        // `inst.pollIntervalMinutes = 5` must land on `poll_interval_minutes`.
        // Falling through to the new-attribute branch below would add a second
        // key under the camelCase name, which save() then tries to write as a
        // column that does not exist.
        if (a) {
          const column = snakeCase(prop)
          if (column !== prop && Object.prototype.hasOwnProperty.call(a, column)) {
            if (typeof setter === 'function') setter.call(target, column, value)
            else a[column] = value
            return true
          }
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
    has(rawTarget, prop) {
      const target = rawTarget as T & WrappedModelInstance

      if (typeof prop === 'string' && !MODEL_INSTANCE_INTERNAL_KEYS.has(prop)) {
        const a = target._attributes
        if (a && Object.prototype.hasOwnProperty.call(a, prop)) return true
        const rels = target._relations
        if (rels && Object.prototype.hasOwnProperty.call(rels, prop)) return true
        // Keep `in` agreeing with what `get` will actually resolve.
        if (a) {
          const column = snakeCase(prop)
          if (column !== prop && Object.prototype.hasOwnProperty.call(a, column)) return true
        }
      }
      return Reflect.has(target, prop)
    },
    deleteProperty(rawTarget, prop) {
      const target = rawTarget as T & WrappedModelInstance

      if (typeof prop === 'string' && !MODEL_INSTANCE_INTERNAL_KEYS.has(prop)) {
        const a = target._attributes
        if (a && Object.prototype.hasOwnProperty.call(a, prop)) {
          delete a[prop]
          return true
        }
      }
      return Reflect.deleteProperty(target, prop)
    },
    ownKeys(rawTarget) {
      const target = rawTarget as T & WrappedModelInstance

      const a = target._attributes
      return a ? Object.keys(a) : []
    },
    getOwnPropertyDescriptor(rawTarget, prop) {
      const target = rawTarget as T & WrappedModelInstance

      if (typeof prop === 'string') {
        const a = target._attributes
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
const QB_TERMINATORS = new Set([
  'get', 'first', 'last', 'firstOrFail', 'find', 'findOrFail', 'all',
  // Pagination terminators (stacksjs/stacks#1905 P1) — each one routes
  // its bqb-shaped return through the matching canonical adapter below
  // so userland sees `{ data, current_page, per_page, total, ... }`
  // instead of bqb's internal `{ data, meta: { perPage, page, ... } }`.
  'paginate', 'simplePaginate', 'cursorPaginate',
])
const PAGINATE_ADAPTERS: Record<string, (r: any) => any> = {
  paginate: toPaginator,
  simplePaginate: toSimplePaginator,
  cursorPaginate: toCursorPaginator,
}
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
        // P2 — when the caller invokes a pagination terminator without
        // explicit args, fill them from the active request's query
        // string (`?page=N&per_page=M`). This is the no-op path outside
        // any request scope, so CLI / queue / cron callers still see
        // the same defaults as before.
        let callArgs = args
        const propName = String(prop)
        if (propName === 'paginate' || propName === 'simplePaginate') {
          const { perPage, page } = resolvePageArgs(args[0], args[1])
          callArgs = [perPage, page]
        }
        else if (propName === 'cursorPaginate') {
          const { perPage, cursor } = resolveCursorArgs(args[0], args[1])
          callArgs = [perPage, cursor, args[2], args[3]] // pass thru column + direction
        }

        const result = v.apply(target, callArgs)
        const finalize = (r: any) => {
          if (QB_TERMINATORS.has(propName)) {
            if (Array.isArray(r)) return r.map(x => wrapModelInstance(x, casts))
            // Paginators — wrap data items first, then convert the raw
            // bqb `{ data, meta }` shape to the canonical Stacks
            // paginator. Each adapter preserves the data array, so
            // wrapping the model instances before the conversion is
            // safe (and saves a re-walk). Finally, enrich with URL
            // fields from the active request (P2 — no-op when none).
            const adapter = PAGINATE_ADAPTERS[propName]
            if (adapter && r && Array.isArray((r).data)) {
              const wrappedData = (r).data.map((x: any) => wrapModelInstance(x, casts))
              const canonical = adapter({ ...r, data: wrappedData })
              return enrichPaginatorUrls(canonical)
            }
            // Backward-compat: a non-paginator object whose `.data` is
            // an array (custom subquery / search result) — re-wrap items
            // without touching the surrounding shape.
            if (r && Array.isArray((r).data)) {
              return { ...r, data: (r).data.map((x: any) => wrapModelInstance(x, casts)) }
            }
            return wrapModelInstance(r, casts)
          }
          // Chainable — re-wrap if QueryBuilder-shaped
          if (r && typeof r === 'object' && typeof (r).get === 'function') {
            return wrapQueryBuilder(r, casts)
          }
          return r
        }
        if (result && typeof (result).then === 'function') {
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
      if (result && typeof (result).then === 'function') return (result as Promise<any>).then(apply)
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
      if (result && typeof (result).then === 'function') return (result as Promise<any>).then(apply)
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
 * Deny-by-default. Once a model declares `attributes`, only those declared
 * columns may be mass-assigned, so a request body can't smuggle in an
 * undeclared column like `role` / `is_admin`:
 *
 *   • If any attribute carries `fillable: true` → the allowlist is exactly
 *     that explicit `fillable` subset (Laravel `$fillable`).
 *   • Else → the allowlist is every declared attribute (minus `guarded`).
 *   • `guarded: true` always wins — including on foreign-key (`*_id`)
 *     columns. The old code blanket-exempted every `*_id` key, so a
 *     `guarded` `owner_id` / `account_id` was still mass-assignable and an
 *     attacker could re-parent a record or cross tenants. Now guarded FKs
 *     throw like any other guarded column.
 *   • Non-guarded `*_id` columns stay assignable even when not separately
 *     declared in `attributes`, so `belongsTo` writes keep working.
 *   • A model that declares no `attributes` at all has no column vocabulary
 *     to validate against → permissive (the only escape hatch left).
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

  const attrs = (definition).attributes as Record<string, { fillable?: boolean, guarded?: boolean }> | undefined
  if (!attrs) return data

  const declared = new Set<string>()
  const fillable = new Set<string>()
  const guarded = new Set<string>()
  for (const [k, a] of Object.entries(attrs)) {
    const col = snakeCase(k)
    declared.add(col)
    if (a?.fillable === true) fillable.add(col)
    if (a?.guarded === true) guarded.add(col)
  }

  // Explicit `fillable` narrows the allowlist; otherwise every declared,
  // non-guarded attribute is assignable. Deny-by-default either way.
  const allowed = fillable.size > 0 ? fillable : declared

  for (const key of Object.keys(data)) {
    // The allowlist above is keyed by COLUMN name (`snakeCase(k)`), so the
    // payload key has to be normalised the same way before any comparison.
    // Without this the guard rejected every camelCase attribute, including
    // ones explicitly marked `fillable: true`: a model declaring
    // `predictionMarketId` built an allowlist holding
    // `prediction_market_id`, then tested the raw `predictionMarketId`
    // against it and threw 'not in the fillable allowlist' for a field the
    // developer had just allowed.
    //
    // The FK escape hatch had the same blind spot: `predictionMarketId`
    // ends in `Id`, not `_id`, so belongsTo writes in camelCase fell
    // through to the throw as well. Models written in snake_case were
    // unaffected, which is why this survived.
    const col = snakeCase(key)

    if (MASS_ASSIGNMENT_SYSTEM_COLUMNS.has(col)) continue

    // Guarded wins for every column, FK included.
    if (guarded.has(col))
      throw new MassAssignmentException(definition.name, key, 'guarded')

    // Non-guarded foreign keys remain assignable so belongsTo writes work
    // even when the FK column isn't separately declared as an attribute.
    if (col.endsWith('_id'))
      continue

    if (!allowed.has(col))
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
  const setters = (definition).set as Record<string, (attrs: Record<string, unknown>) => unknown> | undefined
  if (!setters || typeof setters !== 'object') return data
  const out: Record<string, unknown> = { ...data }
  for (const [key, fn] of Object.entries(setters)) {
    if (typeof fn !== 'function' || !(key in out)) continue
    try {
      out[key] = await fn(out)
    }
    catch (err) {
      log.error(`[orm] ${definition.name}.set.${key} threw - skipping setter`, err)
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
        log.debug(`[orm] ${definition.name}.update called with empty data - short-circuiting and returning current row`)
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
  //
  // Routed through `make().forceFill().save()` rather than the un-wrapped
  // `create`. Bypassing this layer's rule-enforcing wrapper is not enough on
  // its own: the query builder's `create()` fills via `fill()`, which only
  // accepts `fillable && !guarded` attributes, so a guarded column never
  // reached the INSERT. A guarded NOT NULL column threw a constraint error and
  // a nullable one silently wrote NULL — exactly the columns (API keys,
  // idempotency keys) that are marked guarded precisely so they can only be
  // written deliberately. `forceFill()` is the builder's own bypass and keeps
  // that intent.
  //
  // Falls back to the un-wrapped `create` when the builder predates
  // `forceFill`, so an older query-builder still creates rows.
  if (typeof baseModel.forceCreate !== 'function') {
    baseModel.forceCreate = async function (data: Record<string, unknown>) {
      if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new Error(`[ORM] ${definition.name}.forceCreate requires a data object`)

      const make = baseModel.make
      if (typeof make === 'function') {
        // Awaited because `make()` is not always synchronous: on a model with
        // encrypted attributes the read wrappers hand back a promise, and an
        // un-awaited promise has no forceFill/save, so this silently fell
        // through to the un-forced path.
        const instance = await (make as Function).call(baseModel) as {
          forceFill?: (data: Record<string, unknown>) => unknown
          save?: () => Promise<unknown>
        } | null
        if (instance && typeof instance.forceFill === 'function' && typeof instance.save === 'function') {
          instance.forceFill(data)
          return (await instance.save()) ?? instance
        }
      }

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

  // Scout-style search statics (stacksjs/stacks#1891). Installed
  // only when `traits.useSearch` is set — otherwise these names
  // stay free for caller-defined statics. Each one is a thin
  // wrapper around the search-engine driver scoped to the model's
  // resolved index name.
  const searchConfig = resolveSearchConfig(definition.traits?.useSearch, definition)
  if (searchConfig) {
    const indexName = searchConfig.index ?? definition.table ?? snakeCase(`${definition.name}s`)

    // Model.search(query, params?) — full-text search returning a
    // builder so callers can chain `.get()`, `.paginate(n)`,
    // `.hydrate()` (returns model instances) or pass through to the
    // raw driver response via `.raw()`.
    if (typeof baseModel.search !== 'function') {
      baseModel.search = function (query: string, params?: Record<string, unknown>) {
        /*
         * The fields the model declared searchable, handed to the builder.
         *
         * Without this the driver has nothing to search *by* and falls back to
         * `id`, which Typesense refuses outright - so `Model.search('anything')`
         * was a guaranteed 400 for every model that did not pass `query_by` by
         * hand. The trait already knows the answer: `searchable` is what
         * `useSearch` was given, and it is what the index settings are built
         * from a few lines above. It just was not reaching the query.
         */
        return createSearchQueryBuilder(baseModel, indexName, query, params, searchConfig.searchable)
      }
    }

    // Model.makeAllSearchable() — bulk reindex every row. Uses
    // `chunk(500)` when available; falls back to `.all()` for
    // models that don't expose chunking. Returns the total count
    // indexed.
    if (typeof baseModel.makeAllSearchable !== 'function') {
      baseModel.makeAllSearchable = async function (chunkSize: number = 500): Promise<number> {
        const all = baseModel.all as Function | undefined
        if (typeof all !== 'function')
          throw new Error(`[ORM] ${definition.name}.makeAllSearchable cannot run: the underlying query builder did not expose all()`)

        const { useSearchEngine } = await import('@stacksjs/search-engine')
        const engine = useSearchEngine()
        let total = 0

        // Try the chunking path first — far cheaper for large
        // tables. Falls through to .all() if the builder doesn't
        // expose .query().chunk() (some test mocks).
        const query = baseModel.query as Function | undefined
        if (typeof query === 'function') {
          try {
            const q = query.call(baseModel) as { chunk?: (size: number, cb: (rows: any[]) => Promise<void>) => Promise<void> }
            if (q && typeof q.chunk === 'function') {
              await q.chunk(chunkSize, async (rows: any[]) => {
                const docs = await projectDocumentsFromTrait(rows, searchConfig)
                if (docs.length > 0) await engine.addDocuments(indexName, docs)
                total += docs.length
              })
              return total
            }
          }
          catch {
            // Fall through to .all() — chunking is an optimization, not a requirement.
          }
        }

        const rows = (await all.call(baseModel)) || []
        const docs = await projectDocumentsFromTrait(rows as Record<string, unknown>[], searchConfig)
        if (docs.length > 0) await engine.addDocuments(indexName, docs)
        return docs.length
      }
    }

    // Model.removeAllFromSearch() — drop every document from the
    // model's index. Useful before a driver swap or schema-shape
    // change. Idempotent: calling against an empty index is a no-op.
    if (typeof baseModel.removeAllFromSearch !== 'function') {
      baseModel.removeAllFromSearch = async function (): Promise<void> {
        const { useSearchEngine } = await import('@stacksjs/search-engine')
        const engine = useSearchEngine() as { deleteAllDocuments?: (index: string) => Promise<unknown> }
        if (typeof engine.deleteAllDocuments === 'function') {
          await engine.deleteAllDocuments(indexName)
          return
        }
        // Fallback: iterate + delete-by-id when the driver doesn't
        // expose a bulk-flush primitive. Rare — most engines do.
        const all = baseModel.all as Function | undefined
        const rows = typeof all === 'function' ? ((await all.call(baseModel)) || []) : []
        const e2 = useSearchEngine()
        // A row, or a model instance holding its columns in `_attributes`.
        for (const r of rows as Array<{ id?: unknown, _attributes?: { id?: unknown } }>) {
          const id = r?.id ?? r?._attributes?.id
          if (id != null) await e2.deleteDocument(indexName, Number(id))
        }
      }
    }
  }
}

/**
 * Standalone projection helper (#1891) — used by both the lifecycle
 * sync and the bulk-reindex path so the document shape stays
 * consistent. Mirrors the closure inside `buildSearchHooks` but
 * lives at module scope so the static-helpers code can reach it.
 */
/**
 * Project a whole chunk at once.
 *
 * The entry point for every bulk indexing path. `shapeMany` gets the batch and
 * decides for itself how many queries that costs; without it this falls back to
 * projecting each row, which is what a column-rearranging `shape` wants anyway.
 */
export async function projectDocumentsFromTrait(
  /** Model rows, projected into search documents by the trait's config. */
  models: Record<string, unknown>[],
  config: SearchableTraitConfig,
): Promise<Record<string, unknown>[]> {
  if (models.length === 0)
    return []

  if (typeof config.shapeMany === 'function') {
    const docs = await config.shapeMany(models)

    if (!Array.isArray(docs) || docs.length !== models.length) {
      throw new TypeError(
        `[orm/search] shapeMany returned ${Array.isArray(docs) ? docs.length : typeof docs} documents for ${models.length} rows. `
        + 'It must return one document per row, in order, or documents are indexed under the wrong ids.',
      )
    }

    return docs.filter(Boolean)
  }

  const projected = await Promise.all(models.map(model => projectDocumentFromTrait(model, config)))

  return projected.filter(Boolean) as Record<string, unknown>[]
}

/**
 * The attribute names a model declared `hidden`.
 *
 * `hidden: true` already means "never serialise this" - it is how `password`
 * is kept out of a JSON response - and the search projection ignored it. The
 * default projection is the whole row, so any model with a hidden attribute and
 * `useSearch` enabled wrote that attribute into the search index. For the
 * framework's own `User` that is the password hash, which turns a read of the
 * search node into an offline cracking target needing no further access, and
 * `email`, which makes every address on the instance queryable.
 *
 * `displayable` did not prevent it: that governs what a query returns, not what
 * is written.
 */
function hiddenAttributeNames(definition: BQBModelDefinition): Set<string> {
  const hidden = new Set<string>()
  const attributes = (definition as { attributes?: Record<string, { hidden?: boolean }> }).attributes ?? {}

  for (const [name, attribute] of Object.entries(attributes)) {
    if (attribute?.hidden)
      hidden.add(name)
  }

  return hidden
}

/** Strip hidden attributes from a document the default projection produced. */
function withoutHidden(
  document: Record<string, unknown> | null | undefined,
  hidden: Set<string>,
): Record<string, unknown> | null | undefined {
  if (!document || hidden.size === 0)
    return document

  const safe: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(document)) {
    if (!hidden.has(key))
      safe[key] = value
  }

  return safe
}

async function projectDocumentFromTrait(
  model: any,
  config: SearchableTraitConfig,
): Promise<Record<string, unknown> | null | undefined> {
  if (typeof config.shape === 'function') {
    try { return await config.shape(model) }
    catch { return undefined }
  }
  const fromHook = (model as { toSearchableObject?: () => Record<string, unknown> | null })?.toSearchableObject?.()
  if (fromHook !== undefined) return fromHook

  // The default projection is the whole row, so anything the model marked
  // `hidden` is removed here. See `hiddenAttributeNames` for why that matters.
  return withoutHidden(
    model?._attributes ?? (typeof model?.toJSON === 'function' ? model.toJSON() : null),
    config.hidden ?? new Set<string>(),
  )
}

/**
 * Lightweight search-query builder returned by `Model.search()`
 * (#1891). Thin wrapper around the search-engine driver — defers
 * `.get()` / `.paginate()` / `.raw()` to the driver and lets
 * callers attach filter / facet params via the standard search
 * payload shape.
 */
function createSearchQueryBuilder(
  _baseModel: Record<string, unknown>,
  indexName: string,
  query: string,
  initialParams?: Record<string, unknown>,
  searchableFields?: readonly string[],
): {
  get: () => Promise<unknown[]>
  paginate: (perPage: number, page?: number) => Promise<{ hits: unknown[], total: number, page: number, perPage: number }>
  raw: () => Promise<unknown>
  with: (params: Record<string, unknown>) => ReturnType<typeof createSearchQueryBuilder>
  where: (filter: string | string[]) => ReturnType<typeof createSearchQueryBuilder>
} {
  // `query_by` from the model's `searchable` unless the caller named their own.
  // Explicit params win: a caller narrowing the search to one field is making a
  // deliberate choice, and the default is only there so the common case works.
  const defaultQueryBy = searchableFields && searchableFields.length > 0
    ? { query_by: [...searchableFields].join(',') }
    : {}

  let params: Record<string, unknown> = { q: query, ...defaultQueryBy, ...(initialParams ?? {}) }

  const builder = {
    /** Merge extra search params (filters, facets, attributesToRetrieve, etc.). */
    with(extra: Record<string, unknown>) {
      params = { ...params, ...extra }
      return builder
    },
    /** Set a Meilisearch-style `filter` clause; driver-specific syntax. */
    where(filter: string | string[]) {
      params = { ...params, filter }
      return builder
    },
    /** Execute and return the hit array. */
    async get(): Promise<unknown[]> {
      const { useSearchEngine } = await import('@stacksjs/search-engine')
      const engine = useSearchEngine()
      const result = await engine.search(indexName, params)
      return (result as { hits?: unknown[] })?.hits ?? []
    },
    /** Execute with pagination. */
    async paginate(perPage: number, page: number = 1) {
      const { useSearchEngine } = await import('@stacksjs/search-engine')
      const engine = useSearchEngine()
      const result = await engine.search(indexName, {
        ...params,
        limit: perPage,
        offset: (page - 1) * perPage,
      }) as { hits?: unknown[], estimatedTotalHits?: number, nbHits?: number, total?: number }
      return {
        hits: result.hits ?? [],
        total: Number(result.estimatedTotalHits ?? result.nbHits ?? result.total ?? 0),
        page,
        perPage,
      }
    },
    /** Return the raw driver response (escape hatch for driver-specific fields). */
    async raw(): Promise<unknown> {
      const { useSearchEngine } = await import('@stacksjs/search-engine')
      return await useSearchEngine().search(indexName, params)
    },
  }

  return builder
}

/**
 * Decrypt every `enc:`-prefixed value on a row's attribute bag in place.
 * Ignores values that are missing, null, or already plaintext (so the
 * mutator works against rows written before the trait was on, mid-migration).
 * Used by `wrapReadsWithEncryption()` and the cast-aware read wrappers.
 */
/**
 * The names an encrypted attribute can appear under.
 *
 * `collectEncryptedAttributes()` reports the name the model declared
 * (`encryptedValue`), while a row read back from the database is keyed by
 * column (`encrypted_value`). Checking only the declared name meant every
 * multi-word encrypted attribute silently skipped both encryption and
 * decryption: single-word ones like `ssn` worked because the two spellings
 * coincide, which is why this held up in testing.
 */
function encryptedAliases(key: string): string[] {
  const snake = snakeCase(key)
  return snake === key ? [key] : [key, snake]
}

async function decryptAttrsInPlace(row: any, encryptedKeys: ReadonlyArray<string>): Promise<void> {
  if (!row || typeof row !== 'object') return
  // Stacks model instances carry their values on `_attributes`; plain rows
  // carry them at the top level. Try the proxy bag first.
  const bag: Record<string, unknown> = (row as { _attributes?: Record<string, unknown> })._attributes
    ?? (row as Record<string, unknown>)
  for (const key of encryptedKeys) {
    for (const alias of encryptedAliases(key)) {
      if (!(alias in bag)) continue
      const value = bag[alias]
      if (!isEncrypted(value)) continue // plaintext or null — leave alone
      // eslint-disable-next-line no-await-in-loop
      bag[alias] = await decryptValue(value)
    }
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
  for (const method of ['update', 'forceUpdate']) {
    const original = baseModel[method]
    if (typeof original !== 'function') continue
    baseModel[method] = async function (id: number | string, data: Record<string, unknown>) {
      const result = await (original as Function).call(this, id, data)
      return await decryptResult(result)
    }
  }

  // Query-builder reads. The direct helpers above only cover `Model.first()`
  // and friends; `Model.where(...).first()` resolves on the builder the entry
  // point returns, which nothing was decrypting. A lookup by anything other
  // than the primary key — `where('team_id', t).where('provider', p).first()`,
  // the natural way to fetch a stored credential — therefore handed back raw
  // `enc:` ciphertext, and callers passed it straight to the provider as if it
  // were the secret.
  //
  // Wrap the entry points that return a builder and decorate that builder's
  // terminal methods, so every path out of a query decrypts exactly once.
  const terminals = ['first', 'firstOrFail', 'get', 'all', 'find', 'findOrFail', 'last', 'paginate', 'simplePaginate']
  const decorateBuilder = (builder: unknown): unknown => {
    if (!builder || typeof builder !== 'object') return builder
    const target = builder as Record<string, unknown>
    if (target.__stacksEncryptedReads) return builder
    for (const method of terminals) {
      const original = target[method]
      if (typeof original !== 'function') continue
      target[method] = async function (...args: any[]) {
        return await decryptResult(await (original as Function).apply(this, args))
      }
    }
    // Chainable methods hand back a builder (often `this`, sometimes a new
    // one); decorate whatever comes back so a longer chain stays covered.
    for (const method of ['where', 'whereIn', 'whereNull', 'whereNotNull', 'orWhere', 'orderBy', 'orderByDesc', 'limit', 'offset', 'with']) {
      const original = target[method]
      if (typeof original !== 'function') continue
      target[method] = function (...args: any[]) {
        return decorateBuilder((original as Function).apply(this, args))
      }
    }
    Object.defineProperty(target, '__stacksEncryptedReads', { value: true, enumerable: false })
    return builder
  }

  for (const entry of ['where', 'whereIn', 'whereNull', 'whereNotNull', 'orderBy', 'orderByDesc', 'limit', 'query']) {
    const original = baseModel[entry]
    if (typeof original !== 'function') continue
    baseModel[entry] = function (...args: any[]) {
      return decorateBuilder((original as Function).apply(this, args))
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
      // Callers write either spelling; both must reach the cipher.
      for (const alias of encryptedAliases(key)) {
        if (alias in out) out[alias] = await encryptValue(out[alias])
      }
    }
    return out
  }

  // `forceCreate` is in this list because the mass-assignment escape hatch is
  // not an encryption escape hatch. A guarded, encrypted column (an API key,
  // a provider secret) is written through exactly that path, and leaving it
  // out stored the secret as plaintext. This wrapper installs last, so it
  // sits outside the force helpers and their payload is encrypted before
  // they ever see it.
  const writeMethods = ['create', 'firstOrCreate', 'updateOrCreate', 'forceCreate']
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

  // Same for the (id, data) shaped updates, force included.
  for (const method of ['update', 'forceUpdate']) {
    const original = baseModel[method]
    if (typeof original !== 'function') continue
    baseModel[method] = async function (id: number | string, data: Record<string, unknown>) {
      const enc = (await encryptArg(data)) as Record<string, unknown>
      return await (original as Function).call(this, id, enc)
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

/**
 * Enforce declared `validation.rule`s on every direct write.
 *
 * The rules were only ever run by the generated REST routes
 * (`routes.ts` → `validateWriteBody`). The direct model API — `create`,
 * `update`, `save`, `firstOrCreate`, `updateOrCreate` — went through
 * mass-assignment filtering and casts but never touched the declared rules, so
 * the same model got no width, type or enum enforcement when written from code
 * rather than over HTTP. The database was the first thing to notice, and on
 * Postgres an over-length varchar is a hard 22001 that surfaces as a 500 on
 * whichever endpoint performed the write (stacksjs/stacks#2233).
 *
 * Applied LAST in `defineModel`'s wrapper chain, which makes it the OUTERMOST
 * wrapper and therefore the first to run. That is deliberate: `validateWriteBody`
 * (and its `normalizeValidationValue`) is written against pre-cast input — an
 * ISO date string, not a `Date` — because the REST path validates the raw JSON
 * body. Validating after the cast wrapper would hand the rules values they were
 * never designed to see.
 *
 * `create` validates with the `creating` hook (absent fields are missing
 * values); `update` with `updating`, which skips fields the caller did not
 * send, so a partial update cannot trip a `required` rule on an untouched
 * sibling. `firstOrCreate` / `updateOrCreate` inherit it through the `create`
 * they call internally.
 */
function wrapWritesWithValidation(baseModel: Record<string, unknown>, definition: BQBModelDefinition): void {
  const modelName = String((definition)?.name ?? baseModel.name ?? 'Model')

  const check = (data: unknown, hook: 'creating' | 'updating'): void => {
    if (validationIsSuppressed()) return
    if (!data || typeof data !== 'object' || Array.isArray(data)) return
    const result = validateWriteBody(data as Record<string, any>, definition, hook)
    if (!result.valid)
      throw new ModelValidationError(modelName, result.errors)
  }

  const origCreate = baseModel.create
  if (typeof origCreate === 'function') {
    baseModel.create = async function (this: unknown, data: Record<string, unknown>, ...rest: unknown[]) {
      check(data, 'creating')
      return await (origCreate as Function).call(this, data, ...rest)
    }
  }

  // `update(id, data)` — the id is the first argument here, unlike `create`.
  const origUpdate = baseModel.update
  if (typeof origUpdate === 'function') {
    baseModel.update = async function (this: unknown, id: unknown, data: Record<string, unknown>, ...rest: unknown[]) {
      check(data, 'updating')
      return await (origUpdate as Function).call(this, id, data, ...rest)
    }
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

type BQBModelAttribute = BQBModelDefinition['attributes'][string]

export type StacksModelAttribute = Omit<BQBModelAttribute, 'factory'> & {
  factory?: (faker: Faker) => unknown
}

export interface StacksModelDefinition extends Omit<BQBModelDefinition, 'attributes' | 'indexes' | 'traits' | 'dashboard'> {
  name: string
  table: string
  primaryKey?: string
  autoIncrement?: boolean
  /**
   * How this model appears in the dashboard sidebar.
   *
   * `dashboard` is omitted from the bun-query-builder definition above and
   * restated here because that one carries only `enabled` and `highlight`,
   * while model discovery has always read `icon`, `label`, `section` and
   * `roles` as well. A model that set an icon got it at runtime and a type
   * error at the same time.
   */
  dashboard?: DashboardModelOptions
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
  /**
   * `useApi.middleware` is widened past bun-query-builder's
   * `readonly string[]` to also accept `{ read, write }`.
   *
   * Stacks defaults BOTH sides of the auto-CRUD surface to `auth`
   * (stacksjs/stacks#2224), which leaves a flat list unable to express the
   * commonest real shape — public catalog reads with authenticated writes —
   * since `middleware: []` opens reads and writes together. The split form
   * says it exactly. Only that one trait is overridden; everything else still
   * comes from bqb, so its typing stays authoritative.
   */
  traits?: Omit<NonNullable<BQBModelDefinition['traits']>, 'useApi'> & {
    useApi?: boolean | {
      readonly uri?: string
      readonly prefix?: string
      readonly routes?: readonly string[]
      readonly middleware?: ApiMiddleware
    }
  } & Record<string, unknown>
  indexes?: Array<{ name: string, columns: string[], unique?: boolean, where?: string }>
  casts?: Record<string, CastType | CasterInterface>
  attributes: Record<string, StacksModelAttribute>
}

type ModelDefinition = StacksModelDefinition

type ValidationRuleOf<TAttribute> = TAttribute extends { validation: { rule: infer TRule } } ? TRule : never
type ValidationInferenceRule<TRule> = TRule extends Validator<number> ? 'number' : TRule
type BQBFaker = Parameters<NonNullable<BQBModelAttribute['factory']>>[0]
type FactoryReturnOf<TAttribute> = TAttribute extends { factory: (...args: never[]) => infer TResult } ? TResult : never
type DefaultTypeToken<TAttribute> = TAttribute extends { default: infer TDefault }
  ? TDefault extends string ? 'string'
    : TDefault extends number ? 'number'
      : TDefault extends boolean ? 'boolean'
        : TDefault extends Date ? 'date'
          : TDefault extends Record<string, unknown> ? 'json'
            : never
  : never
type InferenceHint<TAttribute> = TAttribute extends { type: unknown } | { factory: (...args: never[]) => unknown }
  ? object
  : [ValidationRuleOf<TAttribute>] extends [never]
      ? [DefaultTypeToken<TAttribute>] extends [never]
          ? object
          : { type: DefaultTypeToken<TAttribute> }
      : { type: ValidationInferenceRule<ValidationRuleOf<TAttribute>> }
/**
 * `required: false` is what makes the emitted column nullable, so it has to
 * imply `nullable: true` for the inferred value type as well.
 *
 * Without this the two halves of a definition disagree. Value types come from
 * the seed factory's return type, and a factory exists to produce a *useful*
 * sample row, so optional columns are routinely written as
 * `factory: () => new Date().toISOString()`. That inferred a bare `string`,
 * which made `update({ nextPollAt: null })` a type error against a column the
 * migration had already created as nullable. An explicit `nullable` on the
 * attribute still wins, since it is the more specific declaration.
 */
type IsOptionalAttribute<TAttribute> = TAttribute extends { required: false } ? true : false
/** Covers attributes with no factory, where the validation rule drives the type. */
type NullabilityOf<TAttribute> = TAttribute extends { nullable: unknown }
  ? object
  : IsOptionalAttribute<TAttribute> extends true ? { nullable: true } : object
/**
 * Covers attributes that do have a factory, whose return type takes precedence
 * over `nullable` when the value type is inferred.
 */
type FactoryValueOf<TAttribute> = IsOptionalAttribute<TAttribute> extends true
  ? FactoryReturnOf<TAttribute> | null
  : FactoryReturnOf<TAttribute>
type QueryAttribute<TAttribute> = Omit<TAttribute, 'factory'>
  & InferenceHint<TAttribute>
  & NullabilityOf<TAttribute>
  & ([FactoryReturnOf<TAttribute>] extends [never]
    ? object
    : { factory: (faker: BQBFaker) => FactoryValueOf<TAttribute> })
type QueryTraits<TDef extends ModelDefinition> = TDef extends { traits: infer TTraits }
  ? { traits: TTraits & NonNullable<BQBModelDefinition['traits']> }
  : { traits?: BQBModelDefinition['traits'] }
type QueryDefinition<TDef extends ModelDefinition> = TDef
  & {
    attributes: { [TKey in keyof TDef['attributes']]: QueryAttribute<TDef['attributes'][TKey]> }
  }
  & QueryTraits<TDef>
type QueryModel<TDef extends ModelDefinition> = OrmModelStatic<QueryDefinition<TDef>>
type ModelWriteData<TDef extends ModelDefinition> = Parameters<QueryModel<TDef>['create']>[0]
type ModelForceWriteData<TDef extends ModelDefinition> = Parameters<ReturnType<QueryModel<TDef>['make']>['forceFill']>[0]
  & Partial<BelongsToForeignKeys<QueryDefinition<TDef>>>
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
 *     title: { fillable: true, validation: { rule: schema.string() } },
 *     views: { fillable: true, validation: { rule: schema.number() } },
 *   },
 *   belongsTo: ['Author'],
 *   hasMany: ['Tag', 'Category', 'Comment'],
 *   traits: { useTimestamps: true, useUuid: true },
 * })
 *
 * // Result: Post.where('title', 'test') — 'title' narrowed to valid columns
 * // Result: Post.with('author') — 'author' narrowed to valid relations
 * ```
 */
export type StacksModelStatic<TDef extends ModelDefinition> = QueryModel<TDef> & TDef & TraitMethods & {
  readonly [MODEL_DEFINITION]: TDef
  update: (id: number | string, data: ModelWriteData<TDef>) => ReturnType<QueryModel<TDef>['find']>
  forceUpdate: (id: number | string, data: ModelForceWriteData<TDef>) => ReturnType<QueryModel<TDef>['find']>
  forceCreate: (data: ModelForceWriteData<TDef>) => ReturnType<QueryModel<TDef>['create']>
  delete: (id: number | string) => Promise<boolean>
  withoutEvents: <T>(fn: () => T | Promise<T>) => Promise<T>
  /** Run `fn` with declared `validation.rule`s suppressed (bulk imports, backfills). */
  withoutValidation: <T>(fn: () => T | Promise<T>) => Promise<T>
}

/**
 * Statics `defineModel` attaches to a model once its query surface exists.
 *
 * `withoutValidation` is the escape hatch for bulk imports carrying rows that
 * predate a rule; `withoutEvents` suppresses lifecycle events for a call.
 */
interface ModelStaticHelpers {
  withoutValidation: <T>(_fn: () => T | Promise<T>) => Promise<T>
  withoutEvents: <T>(_fn: () => T | Promise<T>) => Promise<T>
}

export function defineModel<const TDef extends ModelDefinition>(definition: TDef): StacksModelStatic<TDef> {
  log.debug(`[orm] Defining model: ${definition.name} (table: ${definition.table})`)

  // Build event hooks from observer configuration and search indexing
  const observeHooks = buildEventHooks(definition as unknown as BQBModelDefinition)
  const searchHooks = buildSearchHooks(definition as unknown as BQBModelDefinition)
  const hooks = mergeModelHooks(observeHooks, searchHooks)

  // Build trait methods based on model config. Computed early (before
  // `defWithHooks`/`createModel`) and stamped onto `definition` itself so
  // every `ModelInstance` built from it — including relation-traversed
  // instances of *this* model reached via a different model's `.with()`,
  // which construct with their own model's definition — can find its own
  // trait bag via `_definition.__traitMethods` in `wrapModelInstance`'s
  // proxy `get` trap. See TRAIT_INSTANCE_METHOD_BINDINGS.
  const traitMethods = buildTraitMethods(definition as unknown as BQBModelDefinition)
  ;(definition as unknown as Record<string, unknown>).__traitMethods = traitMethods

  // Merge hooks into definition
  const defWithHooks = hooks
    ? { ...definition, hooks: { ...(definition as unknown as BQBModelDefinition).hooks, ...hooks } }
    : definition

  // Create the base model from bun-query-builder (provides all typed query methods)
  // Note: createModel's return type is declared as void in .d.ts but actually returns an object at runtime
  const queryDefinition = defWithHooks as unknown as QueryDefinition<TDef>
  const baseModel = createModel(queryDefinition) as QueryModel<TDef> & Record<string, unknown>

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

  // Declared `validation.rule`s, enforced on direct writes (#2233). Applied
  // last of the write wrappers so it is the OUTERMOST one and runs first,
  // against the caller's pre-cast, pre-encryption input — which is what
  // `validateWriteBody` is written for, since the REST path validates a raw
  // JSON body.
  //
  // It has to come BEFORE the `*Quietly` loop below: that loop captures
  // whichever `create`/`update` exists when it runs, so applying validation
  // afterwards would leave `createQuietly` unvalidated. Quiet means "no
  // events", never "no rules".
  wrapWritesWithValidation(baseModel, defWithHooks as BQBModelDefinition)

  // `Model.withoutValidation(fn)` — the escape hatch for bulk imports and
  // backfills carrying rows that predate a rule. Bound to the model for the
  // same discoverability reason as `withoutEvents`.
  /*
   * The statics attached after the query surface is built.
   *
   * Each assignment used to be cast on its own, so a misspelt name or a
   * signature that drifted from what callers expect was written onto the model
   * and checked against nothing. Named once as what is being added, so the two
   * below are checked; the generated `*Quietly` names, whose spellings come
   * from a list at runtime, go through a record view further down.
   */
  const withHelpers = baseModel as typeof baseModel & ModelStaticHelpers

  withHelpers.withoutValidation = function <T>(fn: () => T | Promise<T>): Promise<T> {
    return withoutValidation(fn)
  }

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
  withHelpers.withoutEvents = function <T>(fn: () => T | Promise<T>): Promise<T> {
    return withoutEvents(fn)
  }

  for (const method of ['create', 'update', 'firstOrCreate', 'updateOrCreate', 'forceCreate', 'forceUpdate', 'delete', 'forceDelete', 'softDelete', 'restore'] as const) {
    const orig = (baseModel)[method]
    if (typeof orig !== 'function') continue
    const quietName = `${method}Quietly` as const
    if (typeof (baseModel)[quietName] === 'function') continue
    ;(baseModel as unknown as Record<string, unknown>)[quietName] = function (...args: unknown[]) {
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

  /*
   * The definition it was built from, kept for `extendModel`.
   *
   * A model file exports the *static*, not the object passed in here, so an
   * app that wants to add a column to a framework model has nothing to build
   * on: every field it needs is reachable on the static, but only by reading
   * a Proxy and hoping the shape holds. Stashing the original makes that an
   * agreement rather than a guess. A symbol so it cannot collide with a column.
   */
  Object.defineProperty(finalModel, MODEL_DEFINITION, {
    value: definition,
    enumerable: false,
    configurable: true,
  })

  return finalModel as unknown as StacksModelStatic<TDef>
}

function buildEventHooks(definition: BQBModelDefinition): BQBModelDefinition['hooks'] | undefined {
  const observe = definition.traits?.observe
  if (!observe) return undefined

  const modelName = definition.name.toLowerCase()

  // Model events deliver a PLAIN attribute object, not the raw
  // bun-query-builder ModelInstance the hooks receive. The instance
  // exposes columns only through `.get()` / `.attributes` (plus an `id`
  // getter) — arbitrary column properties are undefined on it — while
  // every listener registered in app/Events.ts reads
  // `payload.monitor_id`-style snake_case keys straight off the payload.
  // Dispatching the raw instance meant every such listener resolved
  // undefined, found nothing, and silently no-oped: incident:created /
  // incident:updated notifications and checkresult:created webhooks were
  // dead code end-to-end (found wiring statusreportupdate:created in
  // stacksjs/status). `.attributes` is the full snake_case column map
  // (including the primary key after insert), which is exactly the shape
  // listeners expect. Broadcast callbacks (broadcastOn/broadcastWith)
  // keep receiving the instance — they are user-supplied functions with
  // their own contract, not property-reading listeners.
  const toEventPayload = (model: any): any => {
    const attributes = model?.attributes
    if (!attributes || typeof attributes !== 'object') return model
    const pk = definition.primaryKey || 'id'
    const payload: Record<string, unknown> = { ...attributes }
    if (payload[pk] === undefined && model[pk] !== undefined) payload[pk] = model[pk]
    return payload
  }

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
      /*
       * Composed at runtime - `${modelName}:created` - so it cannot be a
       * literal member of the event union here, though every name it produces
       * IS one: `types/model-events.d.ts` derives the union from the same
       * models. Asserted once, at the single point of composition.
       */
      await dispatch(event as Parameters<typeof dispatch>[0], data)
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
      // `event` is a runtime-composed name (`model:created` and friends), not one
    // of the declared AppEvents keys.
    const results = (await dispatchAsync(event as Parameters<typeof dispatchAsync>[0], data)) as unknown[]
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

  const hooks: { -readonly [K in keyof NonNullable<BQBModelDefinition['hooks']>]: NonNullable<BQBModelDefinition['hooks']>[K] } = {}

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
      const payload = toEventPayload(model)
      await dispatchEvent(`${modelName}:created`, payload)
      await dispatchEvent(`${modelName}:saved`, payload)
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
      const payload = toEventPayload(model)
      await dispatchEvent(`${modelName}:updated`, payload)
      await dispatchEvent(`${modelName}:saved`, payload)
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
      await dispatchEvent(`${modelName}:deleted`, toEventPayload(model))
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
/**
 * Per-model search-trait config (stacksjs/stacks#1891). Accepts
 * either `true` (legacy boolean — uses the model's
 * `toSearchableObject()` if defined) OR a declarative object that
 * spells out index name, document projection, and whether to
 * dispatch the sync via a queued job.
 */
interface SearchableTraitConfig {
  /** Index name. Defaults to the model's table name. */
  index?: string

  /*
   * The four field lists every model already passes.
   *
   * These were missing from the interface while `useSearch` was documented
   * around them and every model in the framework declares them — so reading
   * `searchConfig.searchable`, which is what supplies Typesense's `query_by`,
   * was a type error even though the value is always there. The runtime
   * contract and the type had simply drifted apart.
   *
   * Attribute names in the model's own casing; the trait maps them to columns.
   */

  /** Fields returned on a hit. Defaults to the whole document. */
  displayable?: string[]
  /** Fields matched against the query. Becomes Typesense's `query_by`. */
  searchable?: string[]
  /** Fields a result set may be ordered by. */
  sortable?: string[]
  /** Fields a result set may be narrowed by. */
  filterable?: string[]
  /**
   * Projection function — what gets indexed. Lets you index a
   * curated subset of fields (or denormalize relations) instead of
   * the full row. Falls back to the model's `toSearchableObject()`
   * if both are absent; if neither exists, the whole row is
   * indexed.
   */
  shape?: (model: any) => Record<string, unknown> | null | undefined | Promise<Record<string, unknown> | null | undefined>
  /**
   * Batch projection, for a document that needs the database.
   *
   * `shape` is called once per row, which is right for a projection that only
   * rearranges columns. It is the wrong shape for the case the comment above
   * promises - "or denormalize relations" - because doing that per row means a
   * query per row, and a rebuild of ten thousand repositories becomes twenty
   * thousand round trips.
   *
   * `shapeMany` receives the whole chunk and returns a document for each, in
   * order, so the owner handles are one query and the topics are one more
   * however large the batch is. It takes precedence over `shape` when both are
   * given, and it is what the indexing paths reach for first.
   *
   * Returning a shorter array than it was given is a programming error and is
   * refused loudly rather than silently indexing the wrong document under the
   * wrong id.
   */
  shapeMany?: (models: any[]) => Record<string, unknown>[] | Promise<Record<string, unknown>[]>
  /**
   * Attribute names the model declared `hidden`, resolved by the trait.
   *
   * Not something a caller sets: it is filled in from the model definition so
   * the default projection cannot write a password hash into a search index.
   */
  hidden?: Set<string>
  /**
   * When `true`, the search-sync runs through a queued job
   * (`SyncSearchIndexJob`) instead of inline. Recommended for
   * production where the search backend is on a separate network
   * and a slow upsert shouldn't block the request.
   *
   * Default `false` so tests see the index update immediately and
   * dev environments don't need a worker running.
   */
  queueable?: boolean
}

function resolveSearchConfig(useSearch: unknown, definition?: BQBModelDefinition): SearchableTraitConfig | null {
  if (!useSearch)
    return null

  const base: SearchableTraitConfig = useSearch === true
    ? {}
    : (typeof useSearch === 'object' ? { ...(useSearch as SearchableTraitConfig) } : null) as SearchableTraitConfig

  if (!base)
    return null

  // Resolved once, here, so both the per-save hook and the bulk path strip the
  // same attributes rather than each deciding for itself.
  if (definition)
    base.hidden = hiddenAttributeNames(definition)

  return base
}

function buildSearchHooks(definition: BQBModelDefinition): BQBModelDefinition['hooks'] | undefined {
  const config = resolveSearchConfig(definition.traits?.useSearch, definition)
  if (!config) return undefined
  const searchConfig = config

  const indexName = searchConfig.index ?? definition.table ?? snakeCase(`${definition.name}s`)

  /**
   * Project a model into a searchable document. Resolution order
   * (stacksjs/stacks#1891):
   *   1. trait config's `shape(model)` — explicit per-model
   *      projection, most callers
   *   2. model's `toSearchableObject()` — legacy hook still
   *      supported for back-compat
   *   3. fall back to the raw model attributes
   */
  async function projectDocument(model: any): Promise<Record<string, unknown> | null | undefined> {
    // A single save goes through the batch projector too, as a batch of one, so
    // a model that defines `shapeMany` indexes the same document on save as it
    // does on a rebuild. Two projections for one model is how the index quietly
    // disagrees with itself depending on which path last wrote a row.
    if (typeof searchConfig.shapeMany === 'function') {
      try {
        const [doc] = await projectDocumentsFromTrait([model], searchConfig)
        return doc
      }
      catch (err) {
        log.warn(`[orm/search] shapeMany() threw for ${definition.name}: ${(err as Error).message}`)
        return undefined
      }
    }

    if (typeof searchConfig.shape === 'function') {
      try { return await searchConfig.shape(model) }
      catch (err) {
        log.warn(`[orm/search] shape() threw for ${definition.name}: ${(err as Error).message}`)
        return undefined
      }
    }
    const wrapped = wrapModelInstance(model)
    const fromHook = (wrapped as { toSearchableObject?: () => Record<string, unknown> | null }).toSearchableObject?.()
    if (fromHook !== undefined) return fromHook
    // Fall back to the model attributes (mirrors `Model.toJSON()`).
    return model?._attributes ?? (typeof model?.toJSON === 'function' ? model.toJSON() : null)
  }

  /**
   * Dispatch through the queue when `queueable` is enabled; runs
   * inline otherwise. The queue path is fire-and-forget — failures
   * don't abort the model save (an unreachable Meilisearch shouldn't
   * roll the user write back). When inline runs throw, log a warn
   * for diagnostic visibility.
   */
  const syncDocument = async (model: any) => {
    if (eventsAreSuppressed()) return
    const doc = await projectDocument(model)
    if (!doc) return

    if (config.queueable) {
      try {
        const { Jobs } = await import('@stacksjs/queue')
        await Jobs.dispatch('SyncSearchIndexJob', { index: indexName, op: 'upsert', doc })
      }
      catch (err) {
        log.warn(`[orm/search] queue dispatch failed for ${definition.name}; falling back to inline: ${(err as Error).message}`)
        await indexInline(indexName, doc, definition.name)
      }
      return
    }
    await indexInline(indexName, doc, definition.name)
  }

  const removeDocument = async (model: any) => {
    if (eventsAreSuppressed()) return
    const id = model?.id ?? model?._attributes?.id
    if (id == null) return

    if (config.queueable) {
      try {
        const { Jobs } = await import('@stacksjs/queue')
        await Jobs.dispatch('SyncSearchIndexJob', { index: indexName, op: 'delete', id: Number(id) })
      }
      catch (err) {
        log.warn(`[orm/search] queue dispatch failed for ${definition.name}#${id}; falling back to inline: ${(err as Error).message}`)
        await removeInline(indexName, Number(id), definition.name)
      }
      return
    }
    await removeInline(indexName, Number(id), definition.name)
  }

  return {
    afterCreate: syncDocument,
    afterUpdate: syncDocument,
    afterDelete: removeDocument,
  }
}

/**
 * Search indexing fails per document, but its causes are per environment: no
 * search server running, no driver configured, a bad key. Seeding a few
 * hundred rows into a `useSearch` model therefore printed the same warning a
 * few hundred times and buried whatever else the command had to say.
 *
 * The first failure for a model is worth reporting; the rest are the same
 * fact repeated, so they are counted and summarised instead.
 */
const searchFailures = new Map<string, number>()

function warnSearchFailure(key: string, message: string): void {
  const seen = searchFailures.get(key) ?? 0
  searchFailures.set(key, seen + 1)

  if (seen === 0)
    log.warn(`[orm/search] ${message}`)
  else if (seen === 9)
    log.warn(`[orm/search] ${key} is still failing; further identical warnings suppressed for this process.`)
}

async function indexInline(indexName: string, doc: Record<string, unknown>, modelName: string): Promise<void> {
  try {
    const { useSearchEngine } = await import('@stacksjs/search-engine')
    await useSearchEngine().addDocument(indexName, doc)
  }
  catch (err) {
    warnSearchFailure(`index:${modelName}`, `Failed to index ${modelName}: ${(err as Error).message}`)
  }
}

async function removeInline(indexName: string, id: number, modelName: string): Promise<void> {
  try {
    const { useSearchEngine } = await import('@stacksjs/search-engine')
    await useSearchEngine().deleteDocument(indexName, id)
  }
  catch (err) {
    warnSearchFailure(`remove:${modelName}`, `Failed to remove ${modelName}#${id}: ${(err as Error).message}`)
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
  // The model is assembled here and gains the query surface `createSoftDeleteMethods`
  // asks for as it goes, so the conversion passes through `unknown`.
  const helpers = createSoftDeleteMethods(baseModel as unknown as Parameters<typeof createSoftDeleteMethods>[0], definition.primaryKey || 'id')
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
      const results = (await dispatchAsync(`${modelName}:restoring` as Parameters<typeof dispatchAsync>[0], { id })) as unknown[]
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
      await dispatch(`${modelName}:restored` as Parameters<typeof dispatch>[0], { id })
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
export function toAttrs<T = unknown>(value: unknown): T {
  if (value == null) return value as T
  if (Array.isArray(value)) return value.map(v => toAttrs(v)) as unknown as T
  if (typeof value !== 'object') return value as T

  // Narrowed once, then read: as `any` these three probes were checked against
  // nothing, so a rename of `_attributes` would have gone unnoticed here and
  // leaked hidden fields - the exact failure this function exists to prevent.
  const candidate = value as { toJSON?: unknown, _attributes?: unknown }

  if (typeof candidate.toJSON === 'function') return candidate.toJSON() as T
  if (candidate._attributes && typeof candidate._attributes === 'object') return candidate._attributes as T
  return value as T
}

// Re-export types from bun-query-builder for convenience
export type { ModelDefinition, InferRelationNames, ModelAttributes, InferModelAttributes, SystemFields, ColumnName, AttributeKeys, FillableKeys, HiddenKeys, ModelInstance, ModelQueryBuilder } from '@stacksjs/query-builder'
