/**
 * A record's related rows, changed on its edit page and saved with it, all or
 * nothing (stacksjs/stacks#3315).
 *
 * On the edit page a related panel's rows are not written one at a time. Each
 * add, edit and delete is kept as a draft until "Save changes", which sends
 * the record's fields and every panel's drafts in one request
 * (`PATCH /models/{slug}/{id}/save`). The server writes them all in one
 * transaction, or none of them, and says where a refusal was.
 *
 * Everything here is plain data in and out, so the page holds the drafts in
 * one state and each change makes a new one.
 */
import { DashboardApiError, dashboardApi } from './dashboard-api'
import type { ModelFormValues, ModelRelatedPanel, ModelWriteFailure } from './dashboard-model-record'
import { modelFieldColumn, modelFormPayload, modelFormValues, modelPath, modelWriteFailure } from './dashboard-model-record'

/** A row added on this page and not saved yet. `key` names it until it has an id. */
export interface ModelDraftRow {
  key: string
  values: ModelFormValues
}

/** One panel's unsaved changes. */
export interface ModelPanelDraft {
  added: ModelDraftRow[]
  /** A listed row's values as edited here, by row id. */
  edited: Record<string, ModelFormValues>
  /** The listed rows to delete, by id. */
  removed: string[]
}

/** Every panel's unsaved changes, by panel slug. */
export type ModelDrafts = Record<string, ModelPanelDraft>

/** What one panel asks the save to change, as the endpoint reads it. */
export interface ModelRelatedChanges {
  slug: string
  create: Array<{ key: string, fields: Record<string, unknown> }>
  update: Array<{ id: number | string, fields: Record<string, unknown> }>
  destroy: Array<number | string>
}

/** Where a combined save was refused: the record's fields, or one row of one panel. */
export interface ModelSaveLocation {
  operation: 'update' | 'create' | 'destroy'
  panel?: string
  /** A listed row's id, or the key of one added here. */
  row?: string
}

export type ModelSaveFailure = ModelWriteFailure & { at?: ModelSaveLocation }

/** How a row of a panel stands on this page. */
export type ModelDraftState = 'kept' | 'added' | 'edited' | 'removed'

/** A row as the edit page lists it: its summary values, how it stands, and what names it. */
export interface ModelDraftListRow {
  /** The listed row's id, or the key of one added here. */
  key: string
  state: ModelDraftState
  values: Record<string, unknown>
}

const NEW_ROW = 'new-'

function panelDraft(drafts: ModelDrafts, slug: string): ModelPanelDraft {
  return drafts[slug] ?? { added: [], edited: {}, removed: [] }
}

function withPanel(drafts: ModelDrafts, slug: string, next: ModelPanelDraft): ModelDrafts {
  return { ...drafts, [slug]: next }
}

/** Whether `key` names a row added here rather than one that is stored. */
export function modelDraftIsNew(key: string): boolean {
  return key.startsWith(NEW_ROW)
}

/** A key for the next row added to a panel, unique among the ones there. */
export function modelDraftKey(drafts: ModelDrafts, slug: string): string {
  const taken = new Set(panelDraft(drafts, slug).added.map(row => row.key))
  let index = taken.size + 1
  while (taken.has(`${NEW_ROW}${index}`))
    index++
  return `${NEW_ROW}${index}`
}

/** What a row's form starts from: the values added or edited here, else the row's stored ones. */
export function modelDraftValues(panel: ModelRelatedPanel, drafts: ModelDrafts, key: string): ModelFormValues {
  const draft = panelDraft(drafts, panel.slug)
  if (modelDraftIsNew(key))
    return { ...(draft.added.find(row => row.key === key)?.values ?? modelFormValues(panel.fields ?? [])) }
  return { ...(draft.edited[key] ?? modelDraftStored(panel, key)) }
}

/** A listed row's values as they are stored, in the form's shape. */
export function modelDraftStored(panel: ModelRelatedPanel, key: string): ModelFormValues {
  return modelFormValues(panel.fields ?? [], panel.values?.[key] ?? {})
}

/** Keep a row's form: a new row added, or a row's values changed, whether it was listed or added here. */
export function modelDraftPut(drafts: ModelDrafts, panel: ModelRelatedPanel, key: string, values: ModelFormValues): ModelDrafts {
  const draft = panelDraft(drafts, panel.slug)
  if (modelDraftIsNew(key)) {
    const added = draft.added.some(row => row.key === key)
      ? draft.added.map(row => row.key === key ? { key, values } : row)
      : [...draft.added, { key, values }]
    return withPanel(drafts, panel.slug, { ...draft, added })
  }
  return withPanel(drafts, panel.slug, { ...draft, edited: { ...draft.edited, [key]: values } })
}

/** Mark a row to be deleted. A row added here is simply dropped, and an edit to a deleted row goes with it. */
export function modelDraftRemove(drafts: ModelDrafts, panel: ModelRelatedPanel, key: string): ModelDrafts {
  const draft = panelDraft(drafts, panel.slug)
  if (modelDraftIsNew(key))
    return withPanel(drafts, panel.slug, { ...draft, added: draft.added.filter(row => row.key !== key) })
  const edited = { ...draft.edited }
  delete edited[key]
  return withPanel(drafts, panel.slug, { ...draft, edited, removed: draft.removed.includes(key) ? draft.removed : [...draft.removed, key] })
}

/** Keep a row marked for deletion after all. */
export function modelDraftRestore(drafts: ModelDrafts, panel: ModelRelatedPanel, key: string): ModelDrafts {
  const draft = panelDraft(drafts, panel.slug)
  return withPanel(drafts, panel.slug, { ...draft, removed: draft.removed.filter(id => id !== key) })
}

/** The fields an edit to a listed row changed, against what is stored. */
function editedFields(panel: ModelRelatedPanel, key: string, values: ModelFormValues): Record<string, unknown> {
  return modelFormPayload(panel.fields ?? [], values, modelDraftStored(panel, key))
}

/**
 * What the save sends for the related rows: per panel, the new rows, the
 * edits that changed something, and the rows to delete. A panel with none of
 * them is left out, so a page whose rows were only looked at sends nothing.
 */
export function modelRelatedSaveChanges(panels: ModelRelatedPanel[], drafts: ModelDrafts): ModelRelatedChanges[] {
  const changes: ModelRelatedChanges[] = []
  for (const panel of panels) {
    const draft = drafts[panel.slug]
    if (!draft)
      continue
    const create = draft.added.map(row => ({ key: row.key, fields: modelFormPayload(panel.fields ?? [], row.values) }))
    const update = Object.entries(draft.edited)
      .filter(([key]) => !draft.removed.includes(key))
      .map(([key, values]) => ({ id: rowId(key), fields: editedFields(panel, key, values) }))
      .filter(row => Object.keys(row.fields).length > 0)
    const destroy = draft.removed.map(rowId)
    if (create.length + update.length + destroy.length > 0)
      changes.push({ slug: panel.slug, create, update, destroy })
  }
  return changes
}

/** How many related rows a save would add, change or delete. */
export function modelDraftChangeCount(panels: ModelRelatedPanel[], drafts: ModelDrafts): number {
  return modelRelatedSaveChanges(panels, drafts).reduce((count, panel) => count + panel.create.length + panel.update.length + panel.destroy.length, 0)
}

function rowId(key: string): number | string {
  const id = Number(key)
  return Number.isSafeInteger(id) && id > 0 ? id : key
}

/**
 * A panel's rows as the edit page lists them: the stored ones, marked edited
 * or to be deleted, then the ones added here. An added or edited row shows
 * the values it will be saved with.
 */
export function modelDraftListRows(panel: ModelRelatedPanel, drafts: ModelDrafts): ModelDraftListRow[] {
  const draft = panelDraft(drafts, panel.slug)
  const shown = (values: ModelFormValues, base: Record<string, unknown>): Record<string, unknown> => {
    const out = { ...base }
    for (const [name, value] of Object.entries(values))
      out[modelFieldColumn(name)] = value
    return out
  }
  const listed = panel.rows.map((row): ModelDraftListRow => {
    const key = String(row.id)
    if (draft.removed.includes(key))
      return { key, state: 'removed', values: row }
    const edited = draft.edited[key]
    if (edited && Object.keys(editedFields(panel, key, edited)).length > 0)
      return { key, state: 'edited', values: shown(edited, row) }
    return { key, state: 'kept', values: row }
  })
  const added = draft.added.map((row): ModelDraftListRow => ({ key: row.key, state: 'added', values: shown(row.values, {}) }))
  return [...listed, ...added]
}

/** The words for a row on the list: its first few summary values, else its id. */
export function modelDraftRowLabel(panel: ModelRelatedPanel, row: ModelDraftListRow): string {
  const words = panel.columns
    .map(column => row.values[column.key])
    .filter(value => value !== null && value !== undefined && String(value).trim() !== '')
    .slice(0, 3)
    .map(String)
  if (words.length > 0)
    return words.join(' · ')
  return modelDraftIsNew(row.key) ? `New ${panel.label.toLowerCase()}` : `${panel.label} #${row.key}`
}

/**
 * Save the record's changed fields and its panels' changes in one request,
 * all or nothing. A refusal comes back with where it was (`at`), so the page
 * can point at the record's field or at the row.
 */
export async function saveModelRecordWithRelated(
  slug: string,
  id: string | number,
  fields: Record<string, unknown>,
  related: ModelRelatedChanges[],
): Promise<{ ok: true } | ModelSaveFailure> {
  try {
    await dashboardApi(`${modelPath(slug)}/${encodeURIComponent(String(id))}/save`, { method: 'PATCH', body: { fields, related } })
    return { ok: true }
  }
  catch (reason) {
    const failure: ModelSaveFailure = modelWriteFailure(reason)
    const at = reason instanceof DashboardApiError ? (reason.body as { at?: unknown } | null)?.at : undefined
    if (at && typeof at === 'object' && typeof (at as ModelSaveLocation).operation === 'string')
      failure.at = at as ModelSaveLocation
    return failure
  }
}
