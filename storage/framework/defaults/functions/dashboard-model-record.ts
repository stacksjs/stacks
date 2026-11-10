/**
 * One model record, read and written through the dashboard's generic model
 * API (`/api/dashboard/models/{slug}`), for a page that lists records of its
 * own - the Users, Teams and Subscribers pages - and wants the same eye,
 * pencil and trash the model records page offers.
 *
 * What a page may do comes from the model, not the page: `writeCapabilities`
 * follows the model's `useApi` routes, so a model that does not expose
 * `update` or `destroy` (User, on purpose: its rows are personal data) offers
 * the eye and nothing else.
 */
import { dashboardApi } from './dashboard-api'

export interface ModelWriteCapabilities {
  create: boolean
  update: boolean
  destroy: boolean
}

export interface ModelColumn {
  name: string
  label: string
}

export interface ModelRecord {
  modelName: string
  row: Record<string, unknown>
  columns: ModelColumn[]
  /** The columns an edit may change: fillable attributes and declared keys. */
  updateColumns: string[]
  writeCapabilities: ModelWriteCapabilities
}

export interface ModelRecordField {
  name: string
  label: string
  value: string
  readonly: boolean
}

interface ModelShowResponse {
  modelName?: string
  rows?: Array<Record<string, unknown>>
  columnMeta?: ModelColumn[]
  updateColumns?: string[]
  writeCapabilities?: ModelWriteCapabilities
  error?: string | null
}

const NO_WRITES: ModelWriteCapabilities = { create: false, update: false, destroy: false }

function modelPath(slug: string): string {
  return `/api/dashboard/models/${encodeURIComponent(slug)}`
}

/** What the model lets the dashboard do, without loading any rows of note. */
export async function fetchModelCapabilities(slug: string): Promise<ModelWriteCapabilities> {
  const data = await dashboardApi<ModelShowResponse>(`${modelPath(slug)}?perPage=1`)
  return data.writeCapabilities ?? NO_WRITES
}

/** Every stored column of one record, with what an edit may change. */
export async function fetchModelRecord(slug: string, id: string | number): Promise<ModelRecord> {
  const filters = encodeURIComponent(JSON.stringify({ id: String(id) }))
  const data = await dashboardApi<ModelShowResponse>(`${modelPath(slug)}?perPage=1&filters=${filters}`)
  if (data.error)
    throw new Error(data.error)
  const row = data.rows?.find(candidate => String(candidate.id) === String(id))
  if (!row)
    throw new Error(`${data.modelName || 'Record'} ${id} was not found.`)
  return {
    modelName: data.modelName || 'Record',
    row,
    columns: data.columnMeta ?? [],
    updateColumns: data.updateColumns ?? [],
    writeCapabilities: data.writeCapabilities ?? NO_WRITES,
  }
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

/**
 * The dialog's fields for a record. Viewing shows every column read-only;
 * editing leaves the rest visible as context and lets only the writable ones
 * change.
 */
export function modelRecordFields(record: ModelRecord, viewOnly: boolean): ModelRecordField[] {
  return record.columns.map(column => ({
    name: column.name,
    label: column.label,
    value: text(record.row[column.name]),
    readonly: viewOnly || !record.updateColumns.includes(column.name),
  }))
}

/**
 * The fields an edit actually changed, as the model API takes them: a value
 * the editor merely displayed is never sent, and an emptied field is null.
 */
export function changedModelFields(row: Record<string, unknown>, values: Record<string, string>): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  for (const [column, value] of Object.entries(values)) {
    if (value !== text(row[column]))
      fields[column] = value === '' ? null : value
  }
  return fields
}

export async function updateModelRecord(slug: string, id: string | number, fields: Record<string, unknown>): Promise<void> {
  const result = await dashboardApi<{ ok: boolean, error?: string }>(`${modelPath(slug)}/${encodeURIComponent(String(id))}`, { method: 'PATCH', body: { fields } })
  if (!result?.ok)
    throw new Error(result?.error || 'The update was rejected.')
}

export async function deleteModelRecord(slug: string, id: string | number): Promise<void> {
  const result = await dashboardApi<{ ok: boolean, error?: string }>(`${modelPath(slug)}/${encodeURIComponent(String(id))}`, { method: 'DELETE' })
  if (!result?.ok)
    throw new Error(result?.error || 'The delete was rejected.')
}
