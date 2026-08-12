/**
 * Add to a framework model without forking it.
 *
 * An app model at `app/Models/Order.ts` replaces the framework's copy outright
 * — `findUserModel` wins over `findCoreModel`, wholesale. So an app that needs
 * one extra column on a commerce model has had exactly one option: copy the
 * vendored file, edit it, and own a two-hundred-line divergence that silently
 * stops tracking upstream at the next release. The column that prompted this
 * was the location fulfilling an order, on a business with two shops.
 *
 * `extendModel` makes the override additive. The app imports the framework
 * model, states what it adds, and inherits everything else — including
 * whatever the framework adds later.
 *
 * @example
 * ```ts
 * // app/Models/Order.ts
 * import { extendModel } from '@stacksjs/orm'
 * import Order from '../../storage/framework/defaults/app/Models/commerce/Order'
 *
 * export default extendModel(Order, {
 *   belongsTo: ['Store'],
 *   attributes: {
 *     mmicNumber: { fillable: true, validation: { rule: schema.string().max(32) } },
 *   },
 * })
 * ```
 */

import type { StacksModelDefinition, StacksModelStatic } from './define-model'
import { defineModel, MODEL_DEFINITION } from './define-model'

/** Relation keys, which merge as a set rather than being replaced. */
const RELATION_KEYS = ['belongsTo', 'hasOne', 'hasMany', 'belongsToMany', 'morphMany', 'morphOne'] as const

/** Keys whose objects merge one level deep rather than being replaced. */
const SHALLOW_MERGE_KEYS = ['traits', 'dashboard'] as const

/** What an extension may say. Everything is optional; anything absent is inherited. */
export type ModelExtension = Partial<StacksModelDefinition>

function baseDefinitionOf(model: unknown): StacksModelDefinition {
  const stashed = (model as Record<symbol, unknown>)?.[MODEL_DEFINITION]

  if (stashed && typeof stashed === 'object')
    return stashed as StacksModelDefinition

  // A plain definition object is also accepted, which is what a framework
  // model looks like before `defineModel` has run over it — and what a test
  // will usually hand in.
  if (model && typeof model === 'object' && 'name' in (model as object) && 'attributes' in (model as object))
    return model as StacksModelDefinition

  throw new TypeError(
    'extendModel() expects a model created by defineModel(), or a model definition. '
    + 'Import the framework model itself rather than its table name.',
  )
}

/** Union, keeping the base's order and dropping repeats. */
function mergeRelations(base: unknown, patch: unknown): string[] | undefined {
  const first = Array.isArray(base) ? base as string[] : []
  const second = Array.isArray(patch) ? patch as string[] : []

  if (!first.length && !second.length)
    return undefined

  return [...new Set([...first, ...second])]
}

/**
 * The highest `order` any base attribute claims.
 *
 * Attributes carry an explicit `order` that decides column and form position.
 * An extension that omits one would otherwise land on 0 and tie with the
 * model's first column, so added attributes are appended instead — which is
 * also where someone reading the table expects a later addition to be.
 */
function highestOrder(attributes: Record<string, unknown> | undefined): number {
  if (!attributes)
    return 0

  return Object.values(attributes).reduce<number>((highest, attribute) => {
    const order = Number((attribute as { order?: unknown })?.order)
    return Number.isFinite(order) && order > highest ? order : highest
  }, 0)
}

/**
 * A model definition with `extension` folded into it.
 *
 * Exported separately from {@link extendModel} so the merge can be asserted
 * without booting a model.
 */
export function mergeModelDefinition(base: StacksModelDefinition, extension: ModelExtension): StacksModelDefinition {
  const merged: Record<string, unknown> = { ...base, ...extension }

  // Attributes merge per key: an extension may add new ones, and may replace
  // one it names outright — which is how an app tightens a framework rule
  // (a stricter max, a required field) without restating the other fourteen.
  const baseAttributes = (base.attributes ?? {}) as Record<string, unknown>
  const patchAttributes = (extension.attributes ?? {}) as Record<string, unknown>

  if (extension.attributes) {
    let nextOrder = highestOrder(baseAttributes)

    const added = Object.fromEntries(Object.entries(patchAttributes).map(([name, attribute]) => {
      const isNew = !(name in baseAttributes)
      const hasOrder = Number.isFinite(Number((attribute as { order?: unknown })?.order))

      if (isNew && !hasOrder)
        return [name, { ...(attribute as object), order: ++nextOrder }]

      return [name, attribute]
    }))

    merged.attributes = { ...baseAttributes, ...added }
  }

  for (const key of RELATION_KEYS) {
    const relations = mergeRelations((base as unknown as Record<string, unknown>)[key], (extension as unknown as Record<string, unknown>)[key])

    if (relations)
      merged[key] = relations
  }

  for (const key of SHALLOW_MERGE_KEYS) {
    const first = (base as unknown as Record<string, unknown>)[key]
    const second = (extension as unknown as Record<string, unknown>)[key]

    if (first && second && typeof first === 'object' && typeof second === 'object')
      merged[key] = { ...first as object, ...second as object }
  }

  return merged as unknown as StacksModelDefinition
}

/**
 * Define a model that is the framework's, plus what this app adds.
 *
 * `base` is the framework model itself — import it, do not name it — so the
 * app keeps inheriting fields, traits and relations added upstream.
 */
export function extendModel(base: unknown, extension: ModelExtension): StacksModelStatic<StacksModelDefinition> {
  return defineModel(mergeModelDefinition(baseDefinitionOf(base), extension))
}
