/**
 * One model record, read and written through the dashboard's generic model
 * API (`/api/dashboard/models/{slug}`): the record's own page
 * (`/models/{slug}/{id}`, where the eye leads), its edit page
 * (`/models/{slug}/{id}/edit`, where the pencil leads), the page that creates
 * one (`/models/{slug}/create`), and the trash on a page that lists records
 * of its own - Users, Teams and Subscribers.
 *
 * What a page may do comes from the model, not the page: `writeCapabilities`
 * follows the model's `useApi` routes, so a model that does not expose
 * `update` or `destroy` (User, on purpose: its rows are personal data) offers
 * the eye and nothing else.
 */
import { DashboardApiError, dashboardApi } from './dashboard-api'
import { parseDashboardDate } from './dashboard-dates'

export interface ModelWriteCapabilities {
  create: boolean
  update: boolean
  destroy: boolean
  /** New records are added by invitation (users): see {@link inviteUser}. */
  invite: boolean
  /** A delete other records block anonymizes the record instead (users). */
  anonymize: boolean
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
  /** The fields an edit may change, with how each is asked for. */
  fields: ModelCreateField[]
  writeCapabilities: ModelWriteCapabilities
  /** Erased under the app's data-subject rules: its personal details are placeholders. */
  anonymized: boolean
}

interface ModelShowResponse {
  modelName?: string
  modelLabel?: string
  tableName?: string
  createFields?: ModelCreateField[]
  rows?: Array<Record<string, unknown>>
  columnMeta?: ModelColumn[]
  updateColumns?: string[]
  updateFields?: ModelCreateField[]
  writeCapabilities?: ModelWriteCapabilities
  anonymizedIds?: Array<number | string>
  error?: string | null
}

/** A field of the create form, from the model's fillable attributes. */
/** How a field is asked for: see `modelFieldType` on the server. */
export type ModelFieldType = 'boolean' | 'date' | 'datetime' | 'email' | 'enum' | 'json' | 'longtext' | 'number' | 'text'

export interface ModelCreateField {
  name: string
  label: string
  type: ModelFieldType
  required: boolean
  defaultValue: unknown
  options: string[]
}

/** What a form holds for each field: a checkbox's state, or an input's text. */
export type ModelFormValues = Record<string, string | boolean>

export interface ModelCreateForm {
  modelName: string
  tableName?: string
  fields: ModelCreateField[]
  /** Whether the model's API has a store route at all. */
  canCreate: boolean
  /** New records are added by invitation instead (users). */
  canInvite: boolean
}

/** What a model offers before its capabilities are known, or when it has none. */
export const NO_WRITES: ModelWriteCapabilities = { create: false, update: false, destroy: false, invite: false, anonymize: false }

function modelPath(slug: string): string {
  return `/api/dashboard/models/${encodeURIComponent(slug)}`
}

/** What the model lets the dashboard do, without loading any rows of note. */
export async function fetchModelCapabilities(slug: string): Promise<ModelWriteCapabilities> {
  const data = await dashboardApi<ModelShowResponse>(`${modelPath(slug)}?perPage=1`)
  return { ...NO_WRITES, ...data.writeCapabilities }
}

/** What the create page needs: the model's name and the fields a new record takes. */
export async function fetchModelCreateForm(slug: string): Promise<ModelCreateForm> {
  const data = await dashboardApi<ModelShowResponse>(`${modelPath(slug)}?perPage=1`)
  if (data.error)
    throw new Error(data.error)
  return {
    // What the pages call the model: "Social Post", not the class name.
    modelName: data.modelLabel || data.modelName || 'Record',
    tableName: data.tableName,
    fields: data.createFields ?? [],
    canCreate: Boolean(data.writeCapabilities?.create),
    canInvite: Boolean(data.writeCapabilities?.invite),
  }
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
    // What the pages call the model: "Social Post", not the class name.
    modelName: data.modelLabel || data.modelName || 'Record',
    tableName: data.tableName,
    row,
    columns: data.columnMeta ?? [],
    updateColumns: data.updateColumns ?? [],
    fields: data.updateFields ?? [],
    writeCapabilities: { ...NO_WRITES, ...data.writeCapabilities },
    anonymized: (data.anonymizedIds ?? []).some(candidate => String(candidate) === String(id)),
  }
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
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
export function modelRecordListLabel(record: { tableName?: string } | null, backHref: string): string {
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

/** The page that creates a record. `from` is the list to return to. */
export function modelRecordCreateHref(slug: string, from?: string): string {
  const path = `/models/${encodeURIComponent(slug)}/create`
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

/** The column a field is stored in: `firstName` is `first_name`. */
export function modelFieldColumn(name: string): string {
  return name.replace(/([a-z\d])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase()
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** A moment as a `datetime-local` input takes it: the visitor's own clock, to the minute. */
function localMoment(stored: unknown): string {
  // A number is a unix time, in seconds unless it is too large to be.
  const date = typeof stored === 'number'
    ? new Date(stored < 1e12 ? stored * 1000 : stored)
    : parseDashboardDate(stored)
  if (Number.isNaN(date.getTime()))
    return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * A stored value as its input holds it.
 *
 * Each kind of input wants its own spelling: a checkbox a boolean, a date
 * input `2026-10-01`, a date-and-time input the visitor's local time, JSON
 * indented so it can be read. Handing them the stored text instead is how an
 * edit form came to show `true`, `2026-10-01T00:00:00.000Z` and one long line
 * of braces in plain text boxes.
 */
export function modelFieldInputValue(field: ModelCreateField, stored: unknown): string | boolean {
  if (field.type === 'boolean')
    return stored === true || stored === 1 || stored === '1' || stored === 'true'
  if (stored === null || stored === undefined || stored === '')
    return ''
  if (field.type === 'date') {
    // A calendar day, however the driver returned it. Never through `Date`:
    // midnight UTC is the day before for everyone west of it.
    const day = /^\d{4}-\d{2}-\d{2}/.exec(stored instanceof Date ? stored.toISOString() : String(stored))
    return day ? day[0] : ''
  }
  if (field.type === 'datetime')
    return localMoment(stored)
  if (field.type === 'json') {
    try {
      return JSON.stringify(typeof stored === 'string' ? JSON.parse(stored) : stored, null, 2)
    }
    catch {
      return String(stored)
    }
  }
  return typeof stored === 'object' ? JSON.stringify(stored) : String(stored)
}

/** What an input holds, as the model API takes it. An emptied field is null. */
export function modelFieldPayloadValue(field: ModelCreateField, value: string | boolean | undefined): unknown {
  if (field.type === 'boolean')
    return value === true
  if (value === undefined || value === '' || value === false || value === true)
    return null
  if (field.type === 'datetime') {
    // With its offset, so the moment is the one the visitor picked whatever
    // zone the server runs in.
    const moment = new Date(value)
    return Number.isNaN(moment.getTime()) ? value : moment.toISOString()
  }
  return value
}

/**
 * What a form starts with. An edit starts from the record's stored values, a
 * create from each field's default.
 */
export function modelFormValues(fields: ModelCreateField[], row?: Record<string, unknown>): ModelFormValues {
  return Object.fromEntries(fields.map(field => [
    field.name,
    modelFieldInputValue(field, row ? row[modelFieldColumn(field.name)] ?? row[field.name] : field.defaultValue),
  ]))
}

/**
 * What a form sends. Given what it started with, only the fields that were
 * changed: a value the editor merely displayed is never written back.
 */
export function modelFormPayload(fields: ModelCreateField[], values: ModelFormValues, initial?: ModelFormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const field of fields) {
    if (initial && values[field.name] === initial[field.name])
      continue
    payload[field.name] = modelFieldPayloadValue(field, values[field.name])
  }
  return payload
}

export type ModelWriteFailure = { ok: false, error: string, errors: Record<string, string[]> }

export type ModelUpdateResult = { ok: true } | ModelWriteFailure

export type ModelCreateResult = { ok: true, id: string | number | null } | ModelWriteFailure

/**
 * Why a create or an edit was refused, in one shape: the message for the top
 * of the form and the messages under each field. The API answers a refusal
 * two ways, as a body with `ok: false` or as an error status carrying
 * `fields`.
 */
export function modelWriteFailure(reason: unknown): ModelWriteFailure {
  if (reason instanceof DashboardApiError) {
    const errors = Object.fromEntries(Object.entries(reason.fields ?? {}).map(([field, message]) => [field, [message]]))
    // With field messages to show, the top of the form points at them. The
    // server's own summary for these is "Validation failed", which names
    // nothing the visitor can look for.
    const marked = Object.keys(errors).length
    const summary = marked === 1 ? 'Check the field marked below.' : `Check the ${marked} fields marked below.`
    return { ok: false, error: marked > 0 ? summary : reason.message, errors }
  }
  return { ok: false, error: reason instanceof Error ? reason.message : String(reason), errors: {} }
}

/**
 * The message for one input, from the errors a refused write came back with.
 *
 * The API names fields as the model does (`firstName`); an edit form's inputs
 * are the row's columns (`first_name`). Either spelling finds its message.
 */
export function modelFieldError(errors: Record<string, string[]>, field: string): string {
  const column = (name: string) => name.replace(/([a-z\d])([A-Z])/g, '$1_$2').toLowerCase()
  const key = Object.keys(errors).find(name => name === field || column(name) === column(field))
  return key ? errors[key]?.[0] || '' : ''
}

export async function updateModelRecord(slug: string, id: string | number, fields: Record<string, unknown>): Promise<ModelUpdateResult> {
  try {
    const result = await dashboardApi<{ ok: boolean, error?: string, errors?: Record<string, string[]> }>(`${modelPath(slug)}/${encodeURIComponent(String(id))}`, { method: 'PATCH', body: { fields } })
    if (!result?.ok)
      return { ok: false, error: result?.error || 'The update was rejected.', errors: result?.errors ?? {} }
    return { ok: true }
  }
  catch (reason) {
    return modelWriteFailure(reason)
  }
}

export async function createModelRecord(slug: string, fields: Record<string, unknown>): Promise<ModelCreateResult> {
  try {
    const result = await dashboardApi<{ ok: boolean, id?: number | string | null, error?: string, errors?: Record<string, string[]> }>(modelPath(slug), { method: 'POST', body: { fields } })
    if (!result?.ok)
      return { ok: false, error: result?.error || 'The record was rejected.', errors: result?.errors ?? {} }
    return { ok: true, id: result.id ?? null }
  }
  catch (reason) {
    return modelWriteFailure(reason)
  }
}

/**
 * What the confirmation says before a record is deleted.
 *
 * True whichever way the model deletes: a soft-deleted row stays in the
 * database, and the dashboard still has no way to bring it back. Where a
 * blocked delete anonymizes instead (users), it says that too, before the
 * button is pressed and not only afterwards.
 */
export function modelDeleteWarning(name: string, anonymizes = false): string {
  const warning = `${name} will be deleted. This cannot be undone from the dashboard.`
  return anonymizes
    ? `${warning} If other records still refer to this account, it is anonymized instead: the name and email are removed, sign-in is revoked and those records are kept.`
    : warning
}

/** What became of the record: gone, or kept with its personal details removed. */
export type ModelDeleteOutcome = 'deleted' | 'anonymized'

export async function deleteModelRecord(slug: string, id: string | number): Promise<ModelDeleteOutcome> {
  const result = await dashboardApi<{ ok: boolean, anonymized?: boolean, error?: string }>(`${modelPath(slug)}/${encodeURIComponent(String(id))}`, { method: 'DELETE' })
  if (!result?.ok)
    throw new Error(result?.error || 'The delete was rejected.')
  return result.anonymized ? 'anonymized' : 'deleted'
}

/**
 * The toast after a delete. An anonymized account is still in the list, so
 * "deleted" would be contradicted by the page the visitor is looking at.
 */
export function modelDeleteNotice(name: string, outcome: ModelDeleteOutcome): { title: string, detail?: string } {
  if (outcome === 'anonymized')
    return { title: `${name} anonymized`, detail: 'Other records still refer to this account, so it was kept with its name and email removed. It can no longer sign in.' }
  return { title: `${name} deleted` }
}

/** Where the invite page lives, remembering the list to return to. */
export function userInviteHref(from?: string): string {
  return from ? `/data/users/invite?from=${encodeURIComponent(from)}` : '/data/users/invite'
}

export type UserInviteResult = { ok: true, id: string | number, email: string, expiresInDays: number } | ModelWriteFailure

/**
 * Add a user by invitation: the account is created and its holder is mailed
 * a link to choose their password. A refusal comes back in the same shape as
 * a refused create, so the form shows it the same way.
 */
export async function inviteUser(name: string, email: string): Promise<UserInviteResult> {
  try {
    const result = await dashboardApi<{ ok: boolean, id?: number | string, email?: string, expiresInDays?: number, error?: string, errors?: Record<string, string[]> }>('/api/dashboard/users/invitations', { method: 'POST', body: { name, email } })
    if (!result?.ok || result.id === undefined)
      return { ok: false, error: result?.error || 'The invitation was rejected.', errors: result?.errors ?? {} }
    return { ok: true, id: result.id, email: result.email || email, expiresInDays: result.expiresInDays ?? 7 }
  }
  catch (reason) {
    return modelWriteFailure(reason)
  }
}
