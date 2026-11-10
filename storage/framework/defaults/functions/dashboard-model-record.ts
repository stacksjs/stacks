/**
 * One model record, read and written through the dashboard's generic model
 * API (`/api/dashboard/models/{slug}`): the record's own page
 * (`/models/{slug}/{id}`, where the eye leads), its edit page
 * (`/models/{slug}/{id}/edit`, where the pencil leads), and the trash on a
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
  /** The model's table, e.g. `product_categories`. Names the list in the breadcrumb. */
  tableName?: string
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
  tableName?: string
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
    tableName: data.tableName,
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
  /** Nothing is stored in this column; `value` then says so ("No email"). */
  empty: boolean
  /**
   * How the value is drawn: plain text, an outlined badge for a status-like
   * word, a check or cross for a boolean, a preformatted block for JSON.
   */
  kind: 'text' | 'badge' | 'boolean' | 'json'
  /** A boolean's answer, for the icon. */
  yes: boolean
  /** Takes the card's full width: long text and JSON. */
  wide: boolean
}

export interface ModelRecordSection {
  id: 'information' | 'details' | 'identifiers' | 'timestamps'
  title: string
  /** One field per row, or two side by side. */
  columns: 1 | 2
  details: ModelRecordDetail[]
}

/** Columns whose value is one word out of a few: drawn as a badge. */
const BADGE_COLUMNS = new Set(['status', 'state', 'type', 'role', 'source', 'plan', 'category', 'kind', 'channel', 'driver', 'priority', 'visibility', 'guard_name', 'provider', 'locale', 'currency'])

function isIdentifier(name: string): boolean {
  return name === 'id' || name === 'uuid' || name.endsWith('_id') || name.endsWith('_uuid')
}

function isDate(column: ModelColumn): boolean {
  return column.type === 'date' || /_(?:at|on)$/.test(column.name)
}

/** "Created At" reads as "Created", and the update time as "Last Updated". */
function detailLabel(column: ModelColumn): string {
  if (column.name === 'updated_at')
    return 'Last Updated'
  if (column.name === 'uuid')
    return 'UUID'
  return isDate(column) ? column.label.replace(/\s+(?:At|On)$/i, '') : column.label
}

/** "No email", "No stripe ID": lower case, except a word that is an acronym. */
function emptyText(column: ModelColumn, label: string): string {
  if (isDate(column))
    return 'Not yet'
  return `No ${label.split(' ').map(word => word === word.toUpperCase() ? word : word.toLowerCase()).join(' ')}`
}

function titleCase(words: string): string {
  return words.replace(/[_-]+/g, ' ').replace(/\b[a-z]/g, letter => letter.toUpperCase())
}

function detail(record: ModelRecord, column: ModelColumn): ModelRecordDetail {
  const stored = record.row[column.name]
  const label = detailLabel(column)
  const base = { name: column.name, label, yes: false, wide: false }
  if (column.type === 'boolean') {
    const yes = stored === true || stored === 1 || stored === '1'
    return { ...base, value: yes ? 'Yes' : 'No', empty: false, kind: 'boolean', yes }
  }
  if (stored === null || stored === undefined || stored === '')
    return { ...base, value: emptyText(column, label), empty: true, kind: 'text' }
  if (isDate(column)) {
    const date = new Date(stored as string | number)
    const value = Number.isNaN(date.getTime()) ? String(stored) : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    return { ...base, value, empty: false, kind: 'text' }
  }
  if (typeof stored === 'object') {
    let value = String(stored)
    try {
      value = JSON.stringify(stored, null, 2)
    }
    catch {}
    return { ...base, value, empty: false, kind: 'json', wide: true }
  }
  const value = String(stored)
  if (BADGE_COLUMNS.has(column.name) && value.length <= 32)
    return { ...base, value: titleCase(value), empty: false, kind: 'badge' }
  return { ...base, value, empty: false, kind: 'text', wide: value.length > 80 }
}

/**
 * A record's fields as the cards of its page: what it is, its settings, the
 * ids that tie it to other records, and when things happened to it. A card
 * with nothing in it is left out.
 */
export function modelRecordSections(record: ModelRecord): ModelRecordSection[] {
  const groups: Record<ModelRecordSection['id'], ModelRecordDetail[]> = { information: [], details: [], identifiers: [], timestamps: [] }
  for (const column of record.columns) {
    const entry = detail(record, column)
    if (isIdentifier(column.name))
      groups.identifiers.push(entry)
    else if (isDate(column))
      groups.timestamps.push(entry)
    else if (column.type === 'boolean' || column.type === 'number' || BADGE_COLUMNS.has(column.name))
      groups.details.push(entry)
    else
      groups.information.push(entry)
  }
  const sections: ModelRecordSection[] = [
    { id: 'information', title: `${record.modelName} Information`, columns: 1, details: groups.information },
    { id: 'details', title: `${record.modelName} Details`, columns: 2, details: groups.details },
    { id: 'identifiers', title: 'Identifiers', columns: 2, details: groups.identifiers },
    { id: 'timestamps', title: 'Timestamps', columns: 2, details: groups.timestamps },
  ]
  return sections.filter(section => section.details.length > 0)
}

/** The list a record belongs to, as the breadcrumb names it: "Users", "Product Categories". */
export function modelRecordListLabel(record: ModelRecord | null, backHref: string): string {
  const last = backHref.split('/').filter(Boolean).pop() || ''
  if (backHref.startsWith('/data/') && last)
    return titleCase(last)
  return record?.tableName ? titleCase(record.tableName) : 'Records'
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
 * The record's edit page, where the pencil leads. `from` is the list the
 * visitor came from. `via: 'view'` means they came from the record's own
 * page, so saving or cancelling returns there instead of to the list.
 */
export function modelRecordEditHref(slug: string, id: string | number, options: { from?: string, via?: 'view' } = {}): string {
  const path = `/models/${encodeURIComponent(slug)}/${encodeURIComponent(String(id))}/edit`
  const query = [
    options.from ? `from=${encodeURIComponent(options.from)}` : '',
    options.via ? `via=${options.via}` : '',
  ].filter(Boolean).join('&')
  return query ? `${path}?${query}` : path
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
