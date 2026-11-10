/**
 * One model record, read and written through the dashboard's generic model
 * API (`/api/dashboard/models/{slug}`): the record's own page
 * (`/models/{slug}/{id}`, where the eye leads), and the pencil and trash on a
 * page that lists records of its own - Users, Teams and Subscribers.
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
  type?: 'number' | 'boolean' | 'date' | 'json' | 'text'
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
 * The edit dialog's fields for a record: the writable columns can change, and
 * the rest stay visible, read-only, as context.
 */
export function modelRecordFields(record: ModelRecord): ModelRecordField[] {
  return record.columns.map(column => ({
    name: column.name,
    label: column.label,
    value: text(record.row[column.name]),
    readonly: !record.updateColumns.includes(column.name),
  }))
}

export interface ModelRecordDetail {
  name: string
  label: string
  /** As a person reads it: a date in their locale, Yes or No, formatted JSON. */
  value: string
  /** Nothing is stored in this column. */
  empty: boolean
  /** Preformatted, for JSON. */
  block: boolean
}

function readable(value: unknown, type: ModelColumn['type']): { value: string, block: boolean } {
  if (type === 'boolean')
    return { value: value === true || value === 1 || value === '1' ? 'Yes' : 'No', block: false }
  if (type === 'date') {
    const date = new Date(value as string | number)
    if (!Number.isNaN(date.getTime()))
      return { value: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date), block: false }
  }
  if (typeof value === 'object') {
    try {
      return { value: JSON.stringify(value, null, 2), block: true }
    }
    catch {
      return { value: String(value), block: false }
    }
  }
  return { value: String(value), block: false }
}

/** Every stored column of a record, as its own page shows it. */
export function modelRecordDetails(record: ModelRecord): ModelRecordDetail[] {
  return record.columns.map((column) => {
    const stored = record.row[column.name]
    const empty = stored === null || stored === undefined || stored === ''
    return { name: column.name, label: column.label, empty, ...(empty ? { value: '', block: false } : readable(stored, column.type)) }
  })
}

/** What to call a record in a heading: its name, title or email, else its id. */
export function modelRecordTitle(record: ModelRecord): string {
  for (const key of ['name', 'title', 'email', 'subject']) {
    const value = record.row[key]
    if (typeof value === 'string' && value.trim())
      return value
  }
  return `${record.modelName} ${text(record.row.id)}`
}

/** The record's own page. `from` is the list to go back to, when it is not the model's own. */
export function modelRecordHref(slug: string, id: string | number, from?: string): string {
  const path = `/models/${encodeURIComponent(slug)}/${encodeURIComponent(String(id))}`
  return from ? `${path}?from=${encodeURIComponent(from)}` : path
}

/**
 * Where "back" goes: the list the visitor came from when it is a path inside
 * the dashboard, else the model's records. Never an outside address.
 */
export function modelRecordBackHref(slug: string, from: string | null | undefined): string {
  return from && /^\/(?!\/)[\w\-/]*$/.test(from) ? from : `/models/${encodeURIComponent(slug)}`
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
