/**
 * The records that point at a record, for its page: a team's members and
 * invitations, a user's team memberships.
 *
 * A model already says who points at it, in its `hasMany` and `hasOne`. That
 * is all a panel needs: nothing is declared for the dashboard. Each panel is
 * a short table of the newest few with a count, so the page answers "what
 * belongs to this?" without a trip to another list and a filter.
 *
 * Where the related model lets the dashboard write its rows, the panel is
 * also where they are managed: it carries that model's form fields and each
 * listed row's values, so a row is added, edited and deleted from this page.
 * Each of those is a write of its own through the related model's own
 * endpoints. Saving a record and its rows together, all or nothing, is not
 * offered: a write through a model takes no part in a transaction
 * (stacksjs/stacks#3269).
 */
import type { ModelHasRelation } from './model-relations'
import { safeGet } from '../../../../resources/functions/dashboard/data'
import { resolveDashboardModel } from '../../../../resources/functions/dashboard/model-access'
import { hiddenModelColumns } from '../../../../resources/functions/dashboard/model-columns'
import { recordNames } from './model-options'
import { belongsToRelations, hasRelations, modelLabelColumn, pluralizeLabel, relatedForeignKey } from './model-relations'
import type { ModelFieldDisplay } from './model-fields'
import { modelFormFields } from './model-forms'
import { humanizeIdentifier, type ModelCreateField, modelColumnDisplay, modelColumnLabel, modelListColumns, modelSchemaColumns, modelWriteCapabilities } from './model-write'

/** How many of a panel's records the page shows before "View all". */
export const RELATED_PREVIEW = 5

export interface RelatedPanelColumn {
  key: string
  label: string
  /** A name or value, a status-like word, or a moment. */
  type: 'text' | 'badge' | 'datetime'
  /** How the related model says the value is shown (`dashboard.fields`). Wins over `type`. */
  format?: ModelFieldDisplay
}

export interface RelatedPanel {
  /** Many records point here, or at most one does. */
  kind: 'many' | 'one'
  model: string
  slug: string
  /** The panel's heading: "Team Members", or "Subscriber" for a `hasOne`. */
  title: string
  /** One of them, in words: "Team Member". */
  label: string
  /** The column on the related model that holds this record's id. */
  foreignKey: string
  /** That column as the related model's form field, for a new one that starts here. */
  field: string
  total: number
  columns: RelatedPanelColumn[]
  /** The newest few, each with its `id` and a value per column, ready to show. */
  rows: Array<Record<string, unknown>>
  /** A new one can be added from the dashboard, already pointing at this record. */
  canCreate: boolean
  /** The related model lets the dashboard edit its rows. */
  canUpdate: boolean
  /** The related model lets the dashboard delete its rows. */
  canDestroy: boolean
  /**
   * What "Add" and the pencil ask for: the related model's own form fields,
   * without the link back to this record, which is not a choice here. Empty
   * when the panel offers neither.
   */
  fields: ModelCreateField[]
  /** What an edit starts from: each listed row's stored values for those fields, by row id. */
  values: Record<string, Record<string, unknown>>
}

interface SummaryColumn extends RelatedPanelColumn {
  /** For a column that holds another model's id: that model, to name it by. */
  relation?: string
}

function snakeCase(name: string): string {
  return name.replace(/([a-z\d])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase()
}

/** The most a panel shows across: enough to tell rows apart, not the whole record. */
const SUMMARY_LIMIT = 5

/**
 * The few columns that say what each related record is.
 *
 * What it is called, the other records it points at (a member's user), its
 * status-like fields, and when it was created. The link back to this record
 * is left out: every row has the same value there. A model with neither a
 * name nor another record to show leads with the id.
 */
export function relatedSummaryColumns(Related: any, foreignKey: string, reachable: ReadonlySet<string>): SummaryColumn[] {
  const hidden = hiddenModelColumns(Related)
  // Called what the related model calls it, and shown the way it says: its
  // `dashboard.fields`, as its own list does. `label` going in is the name
  // of the record a column points at, when it points at one.
  const named = (column: SummaryColumn): SummaryColumn => {
    const format = modelColumnDisplay(Related, column.key)
    return { ...column, label: modelColumnLabel(Related, column.key, column.label || undefined), ...(format ? { format } : {}) }
  }

  // The model's own choice of list columns, when it made one: the panel is
  // that list, less the column every row here shares.
  const chosen = modelListColumns(Related, modelSchemaColumns(Related).filter(column => !hidden.has(column)))
  if (chosen.declared) {
    const relations = belongsToRelations(Related)
    const attributes = Object.fromEntries(Object.entries((Related?.attributes ?? {}) as Record<string, any>).map(([name, definition]) => [snakeCase(name), definition]))
    return chosen.columns.filter(column => column !== foreignKey).map((column) => {
      const relation = relations.find(candidate => candidate.column === column)
      if (relation)
        return reachable.has(relation.model) ? named({ key: column, label: humanizeIdentifier(relation.model), type: 'text', relation: relation.model }) : named({ key: column, label: '', type: 'text' })
      const allowed = attributes[column]?.validation?.rule?.allowedValues
      if (Array.isArray(allowed) && allowed.length > 0)
        return named({ key: column, label: '', type: 'badge' })
      if (/_(?:at|on)$/.test(column))
        return named({ key: column, label: '', type: 'datetime' })
      return named({ key: column, label: '', type: 'text' })
    })
  }

  const columns: SummaryColumn[] = []
  const label = modelLabelColumn(Related)
  if (label && !hidden.has(label))
    columns.push(named({ key: label, label: '', type: 'text' }))

  for (const relation of belongsToRelations(Related)) {
    if (relation.column === foreignKey || hidden.has(relation.column) || !reachable.has(relation.model))
      continue
    columns.push(named({ key: relation.column, label: humanizeIdentifier(relation.model), type: 'text', relation: relation.model }))
  }

  // Neither a name of its own nor a record it points at: the id is all there
  // is to tell one row from the next.
  if (columns.length === 0)
    columns.push({ key: 'id', label: 'ID', type: 'text' })

  for (const [name, definition] of Object.entries((Related?.attributes ?? {}) as Record<string, any>)) {
    const column = snakeCase(name)
    const allowed = definition?.validation?.rule?.allowedValues
    if (!Array.isArray(allowed) || allowed.length === 0 || hidden.has(column) || columns.some(entry => entry.key === column))
      continue
    columns.push(named({ key: column, label: '', type: 'badge' }))
  }

  const traits = Related?.traits ?? {}
  const kept = columns.slice(0, SUMMARY_LIMIT - 1)
  if ((traits.useTimestamps ?? traits.timestampable) !== false)
    kept.push(named({ key: 'created_at', label: '', type: 'datetime' }))
  return kept
}

/** One panel's worth, or null when the related model cannot be listed for this record. */
export async function relatedPanel(parentName: string, parentId: number, relation: ModelHasRelation): Promise<RelatedPanel | null> {
  const Related = await resolveDashboardModel(relation.model).catch(() => null)
  if (!Related || typeof Related.query !== 'function')
    return null

  const foreignKey = relatedForeignKey(parentName, Related, relation, modelSchemaColumns(Related))
  if (!foreignKey)
    return null

  // Which of the related model's own relations can be named.
  const reachable = new Set<string>()
  for (const other of belongsToRelations(Related)) {
    if (other.column !== foreignKey && await resolveDashboardModel(other.model).catch(() => null))
      reachable.add(other.model)
  }
  const columns = relatedSummaryColumns(Related, foreignKey, reachable)
  const hidden = hiddenModelColumns(Related)

  const total = Number(await Related.query().where(foreignKey, parentId).count()) || 0
  const found = total === 0
    ? []
    : await Related.query().where(foreignKey, parentId).orderBy('id', 'desc').take(relation.kind === 'one' ? 1 : RELATED_PREVIEW).get() as unknown[]
  const list = Array.isArray(found) ? found : []

  // The records these rows point at, named in one lookup per model.
  const names = new Map<string, Map<string, string>>()
  for (const column of columns) {
    if (column.relation)
      names.set(column.key, await recordNames(column.relation, list.map(row => safeGet(row, column.key, null)).filter(id => id !== null) as Array<number | string>))
  }

  const rows = list.map((row) => {
    const shown: Record<string, unknown> = { id: safeGet(row, 'id', 0) }
    for (const column of columns) {
      const stored = safeGet(row, column.key, null)
      if (column.key === 'id')
        shown.id_label = `#${String(stored)}`
      else if (column.relation)
        shown[column.key] = stored === null ? '' : names.get(column.key)?.get(String(stored)) ?? `${column.label} #${String(stored)}`
      else
        shown[column.key] = stored ?? ''
      // An amount is read in its row's own currency, so that travels too.
      const currency = column.format?.currencyColumn
      if (currency && !hidden.has(currency) && !(currency in shown))
        shown[currency] = safeGet(row, currency, null) ?? ''
    }
    return shown
  })

  const label = humanizeIdentifier(relation.model)
  const field = belongsToRelations(Related).find(candidate => candidate.column === foreignKey)?.field ?? null
  const capabilities = modelWriteCapabilities(Related)
  const form = modelFormFields(Related, reachable)
  // Only when the form can be told which record it starts from.
  const canCreate = Boolean(field) && capabilities.create && form.some(entry => entry.name === field)
  // The link back to this record is every row's, and moving a row to another
  // record is not what a panel on this one is for.
  const fields = canCreate || capabilities.update ? form.filter(entry => entry.name !== field && snakeCase(entry.name) !== foreignKey) : []
  const values: Record<string, Record<string, unknown>> = {}
  if (capabilities.update) {
    for (const row of list)
      values[String(safeGet(row, 'id', ''))] = Object.fromEntries(fields.map(entry => [snakeCase(entry.name), safeGet(row, snakeCase(entry.name), null)]))
  }
  return {
    kind: relation.kind,
    model: relation.model,
    slug: relation.slug,
    title: relation.kind === 'one' ? label : pluralizeLabel(label),
    label,
    foreignKey,
    field: field ?? foreignKey,
    total,
    // The id column shows "#12", not a bare number in a text cell.
    columns: columns.map(({ relation: _named, ...column }) => column.key === 'id' ? { ...column, key: 'id_label' } : column),
    rows,
    canCreate,
    canUpdate: capabilities.update && fields.length > 0,
    canDestroy: capabilities.destroy,
    fields,
    values,
  }
}

/** Every panel a record's page shows, in the order the model declares them. */
export async function relatedPanels(Model: any, parentName: string, parentId: number): Promise<RelatedPanel[]> {
  const panels: RelatedPanel[] = []
  for (const relation of hasRelations(Model)) {
    try {
      const panel = await relatedPanel(parentName, parentId, relation)
      if (panel)
        panels.push(panel)
    }
    catch (error) {
      // One panel that cannot be read (a table not migrated yet) does not
      // take the others, or the page, with it.
      console.warn(`[dashboard/api] related ${relation.model} records could not be listed for ${parentName} ${parentId}:`, error)
    }
  }
  return panels
}
