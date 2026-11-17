import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { transaction } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { safeGet } from '../../../../resources/functions/dashboard/data'
import { dashboardOperationalError } from '../dashboard-response'
import type { RelatedPanel } from './model-related'
import { relatedPanel } from './model-related'
import { hasRelations } from './model-relations'
import type { RowRefusal } from './model-row-writes'
import { destroyModelRow, formFields, requestAccountId, storeModelRow, updateModelRow } from './model-row-writes'
import type { ResolvedModel } from './model-write'
import { isValidModelSlug, parseRowId, resolveWritableModel } from './model-write'

/** What one related panel is asked to change. */
interface PanelChanges {
  /** The related model's slug: which panel. */
  slug: string
  /** New rows. `key` is the form's own name for each, so a refusal can say which. */
  create: Array<{ key: string, fields: Record<string, unknown> }>
  update: Array<{ id: number, fields: Record<string, unknown> }>
  destroy: number[]
}

/** Where a save was refused: the record's own fields, or one row of one panel. */
interface SaveLocation {
  operation: 'update' | 'create' | 'destroy'
  /** The panel's slug, for a row. */
  panel?: string
  /** The row: its id, or the key a new row was sent with. */
  row?: string
}

interface PanelPlan {
  changes: PanelChanges
  panel: RelatedPanel
  target: ResolvedModel
}

interface SavedPanel {
  slug: string
  created: Array<{ key: string, id: unknown }>
  updated: number[]
  destroyed: number[]
  /** Of the destroyed: kept, with their personal details removed. */
  anonymized: number[]
}

/** Thrown inside the transaction to roll it back at the first refusal, carrying where it was. */
class SaveStopped extends Error {
  constructor(readonly refusal: RowRefusal, readonly at: SaveLocation) {
    super(refusal.message)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * The related changes the form sent, checked for shape before anything is
 * read or written. A string is what is wrong with them.
 */
function readRelatedChanges(raw: unknown): PanelChanges[] | string {
  if (raw === undefined || raw === null)
    return []
  if (!Array.isArray(raw))
    return '`related` must be a list of panels.'
  const panels: PanelChanges[] = []
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.slug !== 'string' || !isValidModelSlug(entry.slug))
      return 'Each related panel needs the related model\'s slug.'
    if (panels.some(panel => panel.slug === entry.slug))
      return `The ${entry.slug} panel was sent twice.`
    const create: PanelChanges['create'] = []
    for (const row of Array.isArray(entry.create) ? entry.create : []) {
      if (!isRecord(row) || typeof row.key !== 'string' || row.key === '' || !isRecord(row.fields))
        return `Each new ${entry.slug} row needs a key and its fields.`
      if (create.some(other => other.key === row.key))
        return `Two new ${entry.slug} rows were sent as ${row.key}.`
      create.push({ key: row.key, fields: row.fields })
    }
    const update: PanelChanges['update'] = []
    for (const row of Array.isArray(entry.update) ? entry.update : []) {
      const id = isRecord(row) ? parseRowId(row.id) : null
      if (id === null || !isRecord(row.fields))
        return `Each edited ${entry.slug} row needs its id and its fields.`
      if (update.some(other => other.id === id))
        return `${entry.slug} ${id} was edited twice.`
      update.push({ id, fields: row.fields })
    }
    const destroy: number[] = []
    for (const raw of Array.isArray(entry.destroy) ? entry.destroy : []) {
      const id = parseRowId(raw)
      if (id === null)
        return `Each deleted ${entry.slug} row needs its id.`
      if (update.some(row => row.id === id))
        return `${entry.slug} ${id} cannot be both edited and deleted.`
      if (!destroy.includes(id))
        destroy.push(id)
    }
    panels.push({ slug: entry.slug, create, update, destroy })
  }
  return panels
}

/**
 * The fields a related row may be given here: the panel's form, which leaves
 * out the link back to this record. A row is not moved to another record
 * from this one's page, and a new row belongs to this one whatever was sent.
 */
function panelFields(panel: RelatedPanel, fields: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(panel.fields.map(field => field.name))
  return Object.fromEntries(Object.entries(fields).filter(([name]) => allowed.has(name)))
}

function refusal(status: RowRefusal['status'], message: string): RowRefusal {
  return { ok: false, status, message }
}

/** A refusal before anything was written, said the way a stopped save says it. */
function refusedBefore(status: RowRefusal['status'], message: string, at: SaveLocation): Response {
  return response.json({ message, at }, status)
}

function stoppedResponse(stopped: SaveStopped): Response {
  const { refusal: refused, at } = stopped
  // A failure of the server is logged as one. Either way nothing was kept.
  if (refused.where)
    return dashboardOperationalError(refused.cause, `${refused.message} Nothing was saved.`, `ModelSaveAction (${refused.where})`, refused.status)
  return response.json({ message: refused.message, ...(refused.errors ? { errors: refused.errors } : {}), at }, refused.status)
}

/**
 * `PATCH /api/dashboard/models/{slug}/{id}/save`.
 *
 * Saves a record and its related rows together, all or nothing
 * (stacksjs/stacks#3315). The body is the record's changed `fields` and, per
 * related panel, the rows to add, edit and delete:
 *
 *     { fields: { status: 'paid' },
 *       related: [{ slug: 'order-line', create: [{ key: 'new-1', fields: { sku: 'A-1' } }],
 *                   update: [{ id: 5, fields: { quantity: 2 } }], destroy: [7] }] }
 *
 * Every write runs inside one `transaction()`, through the same steps the
 * single-row endpoints use (`./model-row-writes`), so each row gets every
 * rule a single save has. The first refusal rolls them all back and the
 * answer says where (`at`): the record, or a row of a panel.
 *
 * It allows no more than the record's page does. A panel must be one of the
 * record's `hasMany`/`hasOne` that allows the write, decided as the page
 * decides it (`relatedPanel`). A row edited or deleted must point at this
 * record, and a new one is pointed at it.
 */
export default new Action({
  name: 'Dashboard Model Save',
  description: 'Saves a record and its related rows together, all or nothing, from the dashboard.',
  method: 'PATCH',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const id = parseRowId(request.getParam('id'))
    if (id === null)
      return response.json({ message: 'A numeric row id is required.' }, 400)

    const input = request.all()
    const fields = formFields(input.fields)
    const related = readRelatedChanges(input.related)
    if (typeof related === 'string')
      return response.json({ message: related }, 422)
    const editsRecord = Object.keys(fields).length > 0
    if (!editsRecord && related.every(panel => panel.create.length + panel.update.length + panel.destroy.length === 0))
      return response.json({ message: 'Nothing to save.' }, 422)

    // Editing the record's own fields needs its model to allow edits. Saving
    // only its rows asks that of the rows' models instead.
    const resolved = await resolveWritableModel(request.getParam('slug'), editsRecord ? 'update' : undefined)
    if ('error' in resolved)
      return response.json({ message: resolved.error }, resolved.status)

    try {
      if (!(await resolved.Model.find(id)))
        return response.json({ message: `${resolved.modelName} ${id} not found.` }, 404)

      // Each panel is planned before anything is written.
      const plans: PanelPlan[] = []
      for (const changes of related) {
        const relation = hasRelations(resolved.Model).find(candidate => candidate.slug === changes.slug)
        const panel = relation ? await relatedPanel(resolved.modelName, id, relation) : null
        if (!panel)
          return refusedBefore(422, `A ${resolved.modelName.toLowerCase()} has no ${changes.slug} rows to save from here.`, { operation: 'update', panel: changes.slug })
        if (changes.create.length > 0 && !panel.canCreate)
          return refusedBefore(405, `${panel.title} cannot be added from here.`, { operation: 'create', panel: changes.slug })
        if (changes.update.length > 0 && !panel.canUpdate)
          return refusedBefore(405, `${panel.title} cannot be edited from here.`, { operation: 'update', panel: changes.slug })
        if (changes.destroy.length > 0 && !panel.canDestroy)
          return refusedBefore(405, `${panel.title} cannot be deleted from here.`, { operation: 'destroy', panel: changes.slug })
        const target = await resolveWritableModel(changes.slug)
        if ('error' in target)
          return response.json({ message: target.error, at: { operation: 'update', panel: changes.slug } }, target.status)
        plans.push({ changes, panel, target })
      }

      const viewer = await requestAccountId(request)
      const own = async (plan: PanelPlan, rowId: number, operation: SaveLocation['operation']): Promise<void> => {
        const row = await plan.target.Model.find(rowId)
        if (!row || String(safeGet(row, plan.panel.foreignKey, '')) !== String(id))
          throw new SaveStopped(refusal(404, `${plan.panel.label} ${rowId} is not one of this ${resolved.modelName.toLowerCase()}'s.`), { operation, panel: plan.changes.slug, row: String(rowId) })
      }

      return await transaction(async () => {
        let changed: string[] = []
        if (editsRecord) {
          const saved = await updateModelRow(resolved, id, fields)
          if (!saved.ok)
            throw new SaveStopped(saved, { operation: 'update' })
          changed = saved.changed
        }

        const panels: SavedPanel[] = []
        for (const plan of plans) {
          const at = (operation: SaveLocation['operation'], row: string): SaveLocation => ({ operation, panel: plan.changes.slug, row })
          const saved: SavedPanel = { slug: plan.changes.slug, created: [], updated: [], destroyed: [], anonymized: [] }
          // Deleted first, so a new row may take a value one being removed held.
          for (const rowId of plan.changes.destroy) {
            await own(plan, rowId, 'destroy')
            const done = await destroyModelRow(plan.target, rowId, viewer)
            if (!done.ok)
              throw new SaveStopped(done, at('destroy', String(rowId)))
            saved.destroyed.push(rowId)
            if (done.anonymized)
              saved.anonymized.push(rowId)
          }
          for (const row of plan.changes.update) {
            await own(plan, row.id, 'update')
            const done = await updateModelRow(plan.target, row.id, panelFields(plan.panel, row.fields))
            if (!done.ok)
              throw new SaveStopped(done, at('update', String(row.id)))
            saved.updated.push(row.id)
          }
          for (const row of plan.changes.create) {
            // The link to this record is the server's to set, and it is
            // validated with the row: a model that declares it required (a
            // team member's userId) refused every row added here as missing
            // it when it was only set after validation.
            const fields = { ...panelFields(plan.panel, row.fields), [plan.panel.field]: id }
            const done = await storeModelRow(plan.target, fields, { [plan.panel.foreignKey]: id })
            if (!done.ok)
              throw new SaveStopped(done, at('create', row.key))
            saved.created.push({ key: row.key, id: done.id })
          }
          panels.push(saved)
        }
        return { ok: true, id, changed, related: panels }
      })
    }
    catch (error) {
      if (error instanceof SaveStopped)
        return stoppedResponse(error)
      return dashboardOperationalError(error, 'The record and its rows could not be saved. Nothing was saved.', 'ModelSaveAction', 500)
    }
  },
})
