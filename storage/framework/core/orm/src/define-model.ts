import { createModel, type ModelDefinition, type InferRelationNames } from 'bun-query-builder'
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
  // Build event hooks from observer configuration
  const hooks = buildEventHooks(definition)

  // Merge hooks into definition
  const defWithHooks = hooks
    ? { ...definition, hooks: { ...definition.hooks, ...hooks } }
    : definition

  // Create the base model from bun-query-builder (provides all typed query methods)
  const baseModel = createModel(defWithHooks as TDef)

  // Build trait methods based on model config
  const traitMethods = buildTraitMethods(definition)

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

function buildEventHooks(definition: ModelDefinition): ModelDefinition['hooks'] | undefined {
  const observe = definition.traits?.observe
  if (!observe) return undefined

  const modelName = definition.name.toLowerCase()

  // Lazy import to avoid circular dependency
  const dispatchEvent = async (event: string, data: any) => {
    try {
      const { dispatch } = await import('@stacksjs/events')
      dispatch(event, data)
    }
    catch {
      // Events module may not be available in all contexts (e.g., browser, tests)
    }
  }

  const events = observe === true
    ? ['create', 'update', 'delete']
    : Array.isArray(observe) ? observe : []

  const hooks: NonNullable<ModelDefinition['hooks']> = {}

  if (events.includes('create')) {
    hooks.afterCreate = (model: any) => dispatchEvent(`${modelName}:created`, model)
  }
  if (events.includes('update')) {
    hooks.afterUpdate = (model: any) => dispatchEvent(`${modelName}:updated`, model)
  }
  if (events.includes('delete')) {
    hooks.afterDelete = (model: any) => dispatchEvent(`${modelName}:deleted`, model)
  }

  return hooks
}

interface TraitMethods {
  _taggable?: ReturnType<typeof createTaggableMethods>
  _categorizable?: ReturnType<typeof createCategorizableMethods>
  _commentable?: ReturnType<typeof createCommentableMethods>
  _billable?: ReturnType<typeof createBillableMethods>
  _likeable?: ReturnType<typeof createLikeableMethods>
  _twoFactor?: ReturnType<typeof createTwoFactorMethods>
}

function buildTraitMethods(definition: ModelDefinition): TraitMethods {
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

  if (traits.commentables) {
    methods._commentable = createCommentableMethods(tableName)
  }

  if (traits.billable) {
    methods._billable = createBillableMethods(tableName)
  }

  if (traits.likeable) {
    const likeableOpts = typeof traits.likeable === 'object' ? traits.likeable as any : undefined
    methods._likeable = createLikeableMethods(tableName, likeableOpts)
  }

  const useAuth = traits.useAuth || traits.authenticatable
  if (typeof useAuth === 'object' && useAuth && 'useTwoFactor' in useAuth && useAuth.useTwoFactor) {
    methods._twoFactor = createTwoFactorMethods()
  }

  return methods
}

// Re-export types from bun-query-builder for convenience
export type { ModelDefinition, InferRelationNames } from 'bun-query-builder'
export type {
  ModelInstance,
  ModelQueryBuilder,
  ModelAttributes,
  InferModelAttributes,
  SystemFields,
  ColumnName,
  AttributeKeys,
  FillableKeys,
  HiddenKeys,
} from 'bun-query-builder'
