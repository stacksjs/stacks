/**
 * The fields a model's form asks for, as the dashboard can actually draw
 * them.
 *
 * A `belongsTo` is asked for by a picker that lists the related model's
 * records. That only works when the dashboard can reach that model: one
 * whose feature is off, or that is kept out of the dashboard, has no list to
 * pick from, and its field stays the plain id it is. A model's own pages and
 * a panel that edits its rows on another record's page both ask through
 * here, so a field is not a picker on one and a number box on the other.
 */
import type { ModelRelation } from './model-relations'
import { resolveDashboardModel } from '../../../../resources/functions/dashboard/model-access'
import { belongsToRelations } from './model-relations'
import { type ModelCreateField, modelColumnLabel, modelCreateFields } from './model-write'

/** The records a model points at that the dashboard can list, and so name and pick. */
export async function reachableRelations(Model: any): Promise<ModelRelation[]> {
  const reachable: ModelRelation[] = []
  for (const relation of belongsToRelations(Model)) {
    const related = await resolveDashboardModel(relation.model).catch(() => null)
    if (related && typeof related.where === 'function')
      reachable.push(relation)
  }
  return reachable
}

/** The model's form fields, with a relation the dashboard cannot reach asked for as its id. */
export function modelFormFields(Model: any, reachable: ReadonlySet<string>): ModelCreateField[] {
  return modelCreateFields(Model).map((field) => {
    if (field.type !== 'relation' || reachable.has(field.relation?.model ?? ''))
      return field
    const { relation: _unreachable, ...plain } = field
    return { ...plain, type: 'number', label: modelColumnLabel(Model, field.name) }
  })
}
