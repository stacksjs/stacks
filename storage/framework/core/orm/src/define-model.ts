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

function wrapQueryMethodsWithCasts(baseModel: Record<string, unknown>, casts: Record<string, CastType | CasterInterface>) {
  const readMethods = ['find', 'first', 'get', 'all']
  const writeMethods = ['create', 'update']

  for (const method of readMethods) {
    const original = baseModel[method]
    if (typeof original === 'function') {
      baseModel[method] = async function (...args: any[]) {
        log.debug(`[orm] Query ${String(baseModel.name || 'unknown')}: ${method}(${args.length ? JSON.stringify(args) : ''})`)
        const result = await (original as Function).apply(this, args)
        if (Array.isArray(result)) return result.map((r: any) => castAttributes(r, casts, 'get'))
        if (result && typeof result === 'object') return castAttributes(result, casts, 'get')
        return result
      }
    }
  }

  for (const method of writeMethods) {
    const original = baseModel[method]
    if (typeof original === 'function') {
      baseModel[method] = async function (...args: any[]) {
        log.debug(`[orm] ${method.charAt(0).toUpperCase() + method.slice(1)} ${String(baseModel.name || 'unknown')}`, args[0])
        // Cast the input data before writing
        if (args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
          args[0] = castAttributes(args[0], casts, 'set')
        }
        const result = await (original as Function).apply(this, args)
        // Cast the result back for reading
        if (result && typeof result === 'object') return castAttributes(result, casts, 'get')
        return result
      }
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

  // Apply attribute casting if casts are defined
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

// Re-export types from bun-query-builder for convenience
export type { ModelDefinition, InferRelationNames, ModelAttributes, InferModelAttributes, SystemFields, ColumnName, AttributeKeys, FillableKeys, HiddenKeys, ModelInstance, ModelQueryBuilder } from 'bun-query-builder'
