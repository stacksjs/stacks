/**
 * The records a model's rows point at, for the dashboard's forms and pages.
 *
 * A `belongsTo` is stored as a number: `team_id: 3`. Asking a person for that
 * number means they leave the form, find the team, read its id off the page
 * and come back to type it. The forms ask for the team instead, by name, and
 * a record's page says which team it is.
 *
 * Only a declared `belongsTo` is a relation here. A model has other fields
 * that end in `Id` (`externalId`, `providerMessageId`, a polymorphic
 * `subjectId`) which are ids of things that live elsewhere or of no one model,
 * and guessing a model from such a name would offer a picker that finds
 * nothing.
 */
import { isForeignKeyViolation } from '@stacksjs/error-handling'

export interface ModelRelation {
  /** The related model, as declared: `Team`. */
  model: string
  /** Its place in dashboard URLs: `team`, `board-column`. */
  slug: string
  /** The attribute that holds its id on this model: `teamId`. */
  field: string
  /** The column behind that attribute: `team_id`. */
  column: string
}

/** One record of a related model, as a picker lists it. */
export interface ModelOption {
  id: number | string
  /** What the record is called: its name, title or address. */
  label: string
  /** A second line that tells two of the same name apart: a user's email. */
  hint: string
}

function snakeCase(name: string): string {
  return name.replace(/([a-z\d])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase()
}

function camelCase(name: string): string {
  const words = snakeCase(name).split('_').filter(Boolean)
  return `${words[0] ?? ''}${words.slice(1).map(word => `${word[0]?.toUpperCase()}${word.slice(1)}`).join('')}`
}

/** A model's name as its dashboard URLs spell it: `BoardColumn` is `board-column`. */
export function modelSlug(name: string): string {
  return snakeCase(name).replace(/_/g, '-')
}

/**
 * The models this one belongs to, with where each one's id is kept.
 *
 * A relation is declared as a name (`'Team'`) or as an object naming the
 * model, and optionally the foreign key when it is not the conventional one.
 */
export function belongsToRelations(Model: any): ModelRelation[] {
  const relations: ModelRelation[] = []
  for (const declared of Model?.belongsTo ?? []) {
    const model = typeof declared === 'string' ? declared.trim() : String(declared?.model ?? '').trim()
    if (!model)
      continue
    const foreignKey = typeof declared === 'object' && typeof declared?.foreignKey === 'string' ? declared.foreignKey.trim() : ''
    const field = foreignKey ? camelCase(foreignKey) : `${camelCase(model)}Id`
    if (relations.some(relation => relation.field === field))
      continue
    relations.push({ model, slug: modelSlug(model), field, column: snakeCase(field) })
  }
  return relations
}

export interface ModelHasRelation {
  /** Many records point at this one, or at most one does. */
  kind: 'many' | 'one'
  /** The model whose records point here, as declared: `TeamMember`. */
  model: string
  slug: string
  /** The column the declaration names for the link, when it names one. */
  foreignKey: string | null
}

/**
 * The models whose records point at this one: its `hasMany` and `hasOne`.
 * Declared as a name or as an object naming the model and, optionally, the
 * foreign key on the other side.
 */
export function hasRelations(Model: any): ModelHasRelation[] {
  const relations: ModelHasRelation[] = []
  for (const [property, kind] of [['hasMany', 'many'], ['hasOne', 'one']] as const) {
    for (const declared of Model?.[property] ?? []) {
      const model = typeof declared === 'string' ? declared.trim() : String(declared?.model ?? '').trim()
      if (!model || relations.some(relation => relation.model === model))
        continue
      const foreignKey = typeof declared === 'object' && typeof declared?.foreignKey === 'string' && declared.foreignKey.trim()
        ? snakeCase(declared.foreignKey.trim())
        : null
      relations.push({ kind, model, slug: modelSlug(model), foreignKey })
    }
  }
  return relations
}

/**
 * The column on the related model that holds this model's id.
 *
 * What the declaration names, else what the related model says of its own
 * `belongsTo`, else the conventional `<model>_id` when the related model has
 * that column. With none of the three there is no knowing which rows are
 * this record's, and the caller shows no panel instead of a wrong one.
 */
export function relatedForeignKey(parentName: string, Related: any, relation: ModelHasRelation, relatedColumns: string[]): string | null {
  if (relation.foreignKey)
    return relation.foreignKey
  const declared = belongsToRelations(Related).find(candidate => candidate.model === parentName)
  if (declared)
    return declared.column
  const conventional = `${snakeCase(parentName)}_id`
  return relatedColumns.includes(conventional) ? conventional : null
}

/** "Team Members" for `Team Member`: the last word made plural. */
export function pluralizeLabel(label: string): string {
  const words = label.split(' ')
  const last = words.pop() ?? ''
  const lower = last.toLowerCase()
  const plural = lower.endsWith('y') && !/[aeiou]y$/.test(lower)
    ? `${last.slice(0, -1)}ies`
    : /(?:s|x|ch|sh)$/.test(lower) ? `${last}es` : `${last}s`
  return [...words, plural].join(' ')
}

/** The columns a record is called by, most telling first. */
const LABEL_COLUMNS = ['name', 'title', 'label', 'subject', 'email', 'domain', 'code', 'slug'] as const

function visibleColumns(Model: any): string[] {
  return Object.entries((Model?.attributes ?? {}) as Record<string, any>)
    .filter(([, definition]) => !definition?.hidden)
    .map(([name]) => snakeCase(name))
}

/** The column whose value names a record of this model, when it has one. */
export function modelLabelColumn(Model: any): string | null {
  const columns = visibleColumns(Model)
  return LABEL_COLUMNS.find(candidate => columns.includes(candidate)) ?? null
}

/**
 * A second column that tells two records of the same name apart. Only a
 * person's email does that usefully, and only when the name is not it.
 */
export function modelHintColumn(Model: any): string | null {
  return modelLabelColumn(Model) !== 'email' && visibleColumns(Model).includes('email') ? 'email' : null
}

/**
 * Field errors for a write the database refused because a record it points
 * at is not there: the team was deleted while the form was open.
 *
 * The driver names the constraint, not the field. The model knows which of
 * the fields being written are relations, and the one in the request is the
 * one that is gone. With several, each is named, because any of them may be.
 */
export function missingRelationErrors(Model: any, error: unknown, columns: string[], label: (name: string) => string): Record<string, string[]> {
  if (!isForeignKeyViolation(error))
    return {}
  const errors: Record<string, string[]> = {}
  for (const relation of belongsToRelations(Model)) {
    if (columns.includes(relation.column) || columns.includes(relation.field))
      errors[relation.field] = [`That ${label(relation.model).toLowerCase()} no longer exists. Choose another.`]
  }
  return errors
}
