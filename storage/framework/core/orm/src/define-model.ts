import { createModel, type ModelDefinition as BQBModelDefinition } from 'bun-query-builder'
import type { InferRelationNames } from 'bun-query-builder'
import { log } from '@stacksjs/logging'

// Extended model definition that provides proper contextual typing for factory callbacks.
// BrowserModelDefinition from bun-query-builder uses BrowserTypedAttribute<unknown> which
// prevents TypeScript from providing contextual types for callback parameters.
/**
 * Built-in cast types for model attributes.
 */
export type CastType = 'string' | 'number' | 'boolean' | 'json' | 'datetime' | 'date' | 'array' | 'integer' | 'float'

/**
 * Custom caster interface for user-defined attribute transformations.
 */
export interface CasterInterface {
  get(value: unknown): unknown
  set(value: unknown): unknown
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
      if (typeof v === 'string') { try { return JSON.parse(v) } catch { return v } }
      return v
    },
    set: (v) => {
      if (v == null) return null
      return typeof v === 'string' ? v : JSON.stringify(v)
    },
  },
  datetime: {
    get: (v) => v ? new Date(v as string) : null,
    set: (v) => v instanceof Date ? v.toISOString() : v,
  },
  date: {
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

function wrapQueryBuilder(qb: any, casts?: Record<string, CastType | CasterInterface>): any {
  if (!qb || typeof qb !== 'object') return qb
  return new Proxy(qb, {
    get(target, prop, recv) {
      const v = Reflect.get(target, prop, recv)
      if (typeof v !== 'function') return v
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

      const finalData = await applyDefinedSetters(definition, data)

      await getWhere('update').call(baseModel, pk, id).update(finalData)
      const f = baseModel.find as Function | undefined
      return typeof f === 'function' ? await f.call(baseModel, id) : null
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

      return await getCreate('firstOrCreate').call(baseModel, { ...attrs, ...defaults })
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
        const id = (existing as Record<string, unknown>)[pk]
        await getWhere('updateOrCreate').call(baseModel, pk, id).update(values)
        const f = baseModel.find as Function | undefined
        return typeof f === 'function' ? await f.call(baseModel, id) : { ...existing, ...values }
      }

      return await getCreate('updateOrCreate').call(baseModel, { ...attrs, ...values })
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

/**
 * Stacks-enhanced model definition.
 *
 * Wraps bun-query-builder's `createModel()` with:
 * - Event dispatching via `traits.observe`
 * - Trait methods (billable, taggable, categorizable, commentable, likeable, 2FA)
 * - Full backward compatibility with generators (migration, routes, dashboard)
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

  // Build event hooks from observer configuration
  const hooks = buildEventHooks(definition as unknown as BQBModelDefinition)

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

  // Write-side casts (e.g. JSON serialization on save) still need the
  // legacy wrapper; reads are handled inside the proxy above.
  if (definition.casts && Object.keys(definition.casts).length > 0) {
    wrapQueryMethodsWithCasts(baseModel, definition.casts)
  }

  // Build trait methods based on model config
  const traitMethods = buildTraitMethods(definition as unknown as BQBModelDefinition)

  // Merge: base model + trait methods + raw definition properties (for generators)
  // Spreading `definition` ensures `.name`, `.table`, `.attributes`, `.traits` etc.
  // remain accessible for migration/route/dashboard generators
  return Object.assign(baseModel, traitMethods, {
    // Raw definition access
    ...definition,
    getDefinition: () => definition,
    _isStacksModel: true as const,
  })
}

function buildEventHooks(definition: BQBModelDefinition): BQBModelDefinition['hooks'] | undefined {
  const observe = definition.traits?.observe
  if (!observe) return undefined

  const modelName = definition.name.toLowerCase()

  // Lazy import to avoid circular dependency
  const dispatchEvent = (event: string, data: any) => {
    return import('@stacksjs/events')
      .then(({ dispatch }) => dispatch(event, data))
      .catch((err) => {
        // Only silence module resolution errors (events package may not exist in browser/tests)
        if (err && typeof err === 'object' && 'code' in err && err.code === 'MODULE_NOT_FOUND') {
          return
        }
        // Log actual event handler errors instead of swallowing them
        console.error(`[ORM] Event '${event}' handler error:`, err)
      })
  }

  // Dispatches a before-event and returns false if the handler cancels the operation
  const dispatchBeforeEvent = async (event: string, data: any): Promise<boolean> => {
    try {
      const { dispatch } = await import('@stacksjs/events')
      const result = await dispatch(event, data)
      // If any listener explicitly returns false, cancel the operation
      if (result === false) return false
    }
    catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'MODULE_NOT_FOUND') {
        return true
      }
      console.error(`[ORM] Before-event '${event}' handler error:`, err)
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
      const shouldProceed = await dispatchBeforeEvent(`${modelName}:creating`, model)
      if (!shouldProceed) throw new Error(`[ORM] ${modelName}:creating event cancelled the operation`)
    }
    hooks.afterCreate = (model: any) => dispatchEvent(`${modelName}:created`, model)
  }
  if (events.includes('update')) {
    hooks.beforeUpdate = async (model: any) => {
      log.debug(`[orm] Update ${modelName}#${model?.id ?? 'unknown'}`, model)
      const shouldProceed = await dispatchBeforeEvent(`${modelName}:updating`, model)
      if (!shouldProceed) throw new Error(`[ORM] ${modelName}:updating event cancelled the operation`)
    }
    hooks.afterUpdate = (model: any) => dispatchEvent(`${modelName}:updated`, model)
  }
  if (events.includes('delete')) {
    hooks.beforeDelete = async (model: any) => {
      log.debug(`[orm] Delete ${modelName}#${model?.id ?? 'unknown'}`)
      const shouldProceed = await dispatchBeforeEvent(`${modelName}:deleting`, model)
      if (!shouldProceed) throw new Error(`[ORM] ${modelName}:deleting event cancelled the operation`)
    }
    hooks.afterDelete = (model: any) => dispatchEvent(`${modelName}:deleted`, model)
  }

  return hooks
}

export interface TraitMethods {
  _taggable?: ReturnType<typeof createTaggableMethods>
  _categorizable?: ReturnType<typeof createCategorizableMethods>
  _commentable?: ReturnType<typeof createCommentableMethods>
  _billable?: ReturnType<typeof createBillableMethods>
  _likeable?: ReturnType<typeof createLikeableMethods>
  _twoFactor?: ReturnType<typeof createTwoFactorMethods>
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
export type { ModelDefinition, InferRelationNames, ModelAttributes, InferModelAttributes, SystemFields, ColumnName, AttributeKeys, FillableKeys, HiddenKeys, ModelInstance, ModelQueryBuilder } from 'bun-query-builder'
