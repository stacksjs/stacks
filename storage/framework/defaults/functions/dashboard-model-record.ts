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
import type { ModelFieldDisplay } from './dashboard-model-format'
import { modelColumnIsDate, modelFormattedValue } from './dashboard-model-format'

export interface ModelWriteCapabilities {
  create: boolean
  update: boolean
  destroy: boolean
  /** New records are added by invitation (users): see {@link inviteUser}. */
  invite: boolean
  /** A delete other records block anonymizes the record instead (users). */
  anonymize: boolean
}

/**
 * Something the model lets an operator do to a record beyond editing it, as
 * a button: "Mark as shipped". From the model's `dashboard.actions`.
 */
export interface ModelCustomAction {
  /** Its place in the URL that runs it. */
  name: string
  /** What the button says. */
  label: string
  /** An iconify class, or empty for the default. */
  icon: string
  /** What the confirmation says before it runs. Empty runs it at once. */
  confirm: string
  /** It removes or revokes something: drawn in red. */
  destructive: boolean
  /** Where it is offered: the record's page, its row in a list, the rows selected in a list. */
  places: Array<'record' | 'row' | 'bulk'>
}

export interface ModelColumn {
  name: string
  /** What the field is called: the model's own word for it, else its name in words. */
  label: string
  type?: 'number' | 'boolean' | 'date' | 'json' | 'text'
  /** How the model says the value reads (`dashboard.fields`): money, a size, a link. */
  format?: ModelFieldDisplay
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
  /** The columns that hold another model's id, and whose. */
  relations: Record<string, ModelRelationTarget>
  /** What the records this one points at are called, by column: `{ team_id: 'PrimeSoft Ltd' }`. */
  relationNames: ModelRelationNames
  writeCapabilities: ModelWriteCapabilities
  /** Erased under the app's data-subject rules: its personal details are placeholders. */
  anonymized: boolean
  /** The model's own actions this record is offered on its page. */
  actions: ModelCustomAction[]
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
  relations?: Record<string, ModelRelationTarget>
  listColumns?: string[]
  relationNames?: Record<string, Record<string, string>>
  writeCapabilities?: ModelWriteCapabilities
  anonymizedIds?: Array<number | string>
  actions?: ModelCustomAction[]
  rowActions?: Record<string, string[]>
  error?: string | null
}

/** A field of the create form, from the model's fillable attributes. */
/** How a field is asked for: see `modelFieldType` on the server. */
export type ModelFieldType = 'boolean' | 'date' | 'datetime' | 'email' | 'enum' | 'json' | 'longtext' | 'number' | 'relation' | 'text' | 'url'

/** The model a field or column points at: `team_id` is a Team. */
export interface ModelRelationTarget {
  model: string
  /** Its place in dashboard URLs: `team`, `board-column`. */
  slug: string
  /** Its name in words: "Board Column". */
  label: string
}

/** One record of a related model, as a picker lists it. */
export interface ModelOption {
  id: number | string
  /** What the record is called: its name, title or address. */
  label: string
  /** A second line that tells two of the same name apart: a user's email. */
  hint: string
}

export interface ModelCreateField {
  name: string
  label: string
  type: ModelFieldType
  required: boolean
  defaultValue: unknown
  options: string[]
  /** For a `relation`: the model whose records the picker lists. */
  relation?: ModelRelationTarget
  /** A sentence under the input, from the model's `dashboard.fields`. */
  help?: string
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
    relations: data.relations ?? {},
    relationNames: Object.fromEntries(Object.entries(data.relationNames ?? {})
      .map(([column, names]) => [column, names[String(row[column])]] as const)
      .filter((entry): entry is readonly [string, string] => typeof entry[1] === 'string')),
    writeCapabilities: { ...NO_WRITES, ...data.writeCapabilities },
    anonymized: (data.anonymizedIds ?? []).some(candidate => String(candidate) === String(id)),
    actions: modelActionsFor(data.actions, data.rowActions, id, 'record'),
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
   * word, a check or cross for a boolean, a preformatted block for JSON, a
   * link to the record another model's id points at, and where the model
   * says so a link out to a web address, a picture or a code font.
   */
  kind: 'text' | 'badge' | 'boolean' | 'json' | 'link' | 'external' | 'image' | 'code'
  /** For a link: the page of the record this one points at, or the address it opens. For an image: what it draws. */
  href?: string
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
  return modelColumnIsDate(column)
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

/** The names of the records a record points at, by column: `{ team_id: 'PrimeSoft Ltd' }`. */
export type ModelRelationNames = Record<string, string>

function detail(record: ModelRecord, column: ModelColumn, names: ModelRelationNames = {}): ModelRecordDetail {
  const stored = record.row[column.name]
  const relation = record.relations?.[column.name]
  // What the list calls it: the model's own word, "Team" and not "Team ID"
  // for a record it points at, "Created" and not "Created At".
  const label = column.label
  const base = { name: column.name, label, yes: false, wide: false }
  if (relation && stored !== null && stored !== undefined && stored !== '') {
    return {
      ...base,
      // Until the name arrives, and for a record that is gone, the id says which.
      value: names[column.name] || `${relation.label} #${String(stored)}`,
      empty: false,
      kind: 'link',
      href: modelRecordHref(relation.slug, stored as number | string),
    }
  }
  // The model's own say on how the value reads comes before any guess.
  if (column.format) {
    const shown = modelFormattedValue(stored, column.format, record.row)
    if (!shown)
      return { ...base, value: emptyText(column, label), empty: true, kind: 'text' }
    const kind = shown.kind === 'link' ? 'external' : shown.kind
    return { ...base, value: shown.text, empty: false, kind, href: shown.href, wide: shown.kind === 'text' && shown.text.length > 80 }
  }
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
export function modelRecordSections(record: ModelRecord, names: ModelRelationNames = record.relationNames ?? {}): ModelRecordSection[] {
  const groups: Record<ModelRecordSection['id'], ModelRecordDetail[]> = { information: [], details: [], identifiers: [], timestamps: [] }
  for (const column of record.columns) {
    const entry = detail(record, column, names)
    if (isIdentifier(column.name))
      groups.identifiers.push(entry)
    else if (isDate(column))
      groups.timestamps.push(entry)
    else if (column.type === 'boolean' || column.type === 'number' || BADGE_COLUMNS.has(column.name) || entry.kind === 'badge')
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
  // Opened from a record's page (a panel's "Add"): the way back is that
  // record, and calling it by this model's list would name the wrong place.
  const opener = /^\/models\/([\w-]+)\/(\d+)$/.exec(backHref)
  if (opener)
    return `${titleCase(opener[1]!)} ${opener[2]}`
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
  if (field.type === 'relation') {
    // The picker holds the id as text; the API takes the number.
    const id = Number(value)
    return Number.isSafeInteger(id) && id > 0 ? id : value
  }
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

/**
 * The model's own actions one record is offered in one place.
 *
 * Which records an action is for is the server's to say: it sends, per row,
 * the names of the actions that apply, and a row it does not list is offered
 * none. The page only narrows that to where each button belongs.
 */
export function modelActionsFor(
  actions: ModelCustomAction[] | undefined,
  rowActions: Record<string, string[]> | undefined,
  id: string | number,
  place: 'record' | 'row',
): ModelCustomAction[] {
  const offered = rowActions?.[String(id)] ?? []
  return (actions ?? []).filter(action => offered.includes(action.name) && action.places.includes(place))
}

/** The classes of an action's icon: its own, or a bolt for one that names none. */
export function modelActionIconClass(action: ModelCustomAction): string {
  const tone = action.destructive ? 'text-red-500' : 'text-neutral-500 dark:text-neutral-400'
  return `h-4 w-4 ${tone} ${action.icon || 'i-hugeicons-flash'}`
}

export type ModelActionResult
  = | { ok: true, message: string, redirect: string }
    /** `status` is the refusal's HTTP status, or 0 when no answer came back at all. */
    | { ok: false, error: string, status?: number }

/**
 * Run one of a model's own actions on a record. A refusal comes back as its
 * reason, in the action's words: "Already shipped."
 */
export async function runModelAction(slug: string, id: string | number, name: string): Promise<ModelActionResult> {
  try {
    const result = await dashboardApi<{ ok?: boolean, message?: string, redirect?: string }>(
      `${modelPath(slug)}/${encodeURIComponent(String(id))}/actions/${encodeURIComponent(name)}`,
      { method: 'POST', body: {} },
    )
    const redirect = typeof result?.redirect === 'string' && /^\/(?!\/)/.test(result.redirect) ? result.redirect : ''
    return { ok: true, message: typeof result?.message === 'string' ? result.message : '', redirect }
  }
  catch (reason) {
    return { ok: false, error: reason instanceof Error ? reason.message : String(reason), status: reason instanceof DashboardApiError ? reason.status : 0 }
  }
}

/**
 * The toast after an action: its name, and what it said came of it. An
 * action that says nothing is still confirmed, so a press is never met with
 * silence.
 */
export function modelActionNotice(action: ModelCustomAction, result: ModelActionResult): { tone: 'success' | 'error', title: string, detail: string } {
  if (result.ok)
    return { tone: 'success', title: action.label, detail: result.message || 'Done.' }
  return { tone: 'error', title: `${action.label} did not run`, detail: result.error }
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

/**
 * A model's records by name, for choosing one in a form. `q` searches by
 * what a record is called; `ids` asks what exactly those are called, which is
 * how a form and a record's page name the record a field already points at.
 */
export async function fetchModelOptions(slug: string, search: { q?: string, ids?: Array<number | string> } = {}): Promise<ModelOption[]> {
  const params = new URLSearchParams()
  if (search.ids && search.ids.length > 0)
    params.set('ids', search.ids.map(String).join(','))
  else if (search.q)
    params.set('q', search.q)
  const query = params.toString()
  const data = await dashboardApi<{ options?: ModelOption[] }>(`${modelPath(slug)}/options${query ? `?${query}` : ''}`)
  return data.options ?? []
}

/**
 * The columns a model's list draws, in order.
 *
 * The ones the model named in `dashboard.columns`, or every column when it
 * named none. A column the list is being filtered on is drawn as well, even
 * when the model left it out: a list opened from a record's panel arrives
 * narrowed by that record, and what narrowed it has to be in view to clear.
 */
export function modelListColumnNames(all: string[], chosen: string[] | undefined, filters: Record<string, string> = {}): string[] {
  const list = chosen && chosen.length > 0 ? chosen.filter(column => all.includes(column)) : all
  const filtered = Object.entries(filters).filter(([column, value]) => value !== '' && all.includes(column) && !list.includes(column)).map(([column]) => column)
  return [...list, ...filtered]
}

/**
 * A cell that holds another model's id, as the list shows it: that record's
 * name and the page it links to. Null for any other cell, and for an empty
 * one. Named by its id when the name is not known, which is still true.
 */
export function modelRelationCell(
  column: string,
  value: unknown,
  relations: Record<string, ModelRelationTarget>,
  names: Record<string, Record<string, string>>,
): { text: string, href: string } | null {
  const relation = relations[column]
  if (!relation || value === null || value === undefined || value === '')
    return null
  return {
    text: names[column]?.[String(value)] || `${relation.label} #${String(value)}`,
    href: modelRecordHref(relation.slug, value as number | string),
  }
}

/** A column of a related-records panel. */
export interface ModelRelatedColumn {
  key: string
  label: string
  type: 'text' | 'badge' | 'datetime'
  /** How the related model says the value reads. Wins over `type`. */
  format?: ModelFieldDisplay
}

/**
 * The records of one model that point at a record: a team's members. From the
 * model's own `hasMany` or `hasOne`.
 */
export interface ModelRelatedPanel {
  kind: 'many' | 'one'
  model: string
  slug: string
  /** The panel's heading: "Team Members", or "Subscriber" for a `hasOne`. */
  title: string
  /** One of them, in words: "Team Member". */
  label: string
  /** The column on the related model that holds this record's id. */
  foreignKey: string
  /** That column as the related model's form field. */
  field: string
  total: number
  columns: ModelRelatedColumn[]
  /** The newest few, each with its `id` and a value per column. */
  rows: Array<Record<string, unknown>>
  canCreate: boolean
  /** The related model lets the dashboard edit its rows. */
  canUpdate?: boolean
  /** The related model lets the dashboard delete its rows. */
  canDestroy?: boolean
  /** What "Add" and the pencil ask for: the related model's fields, less the link back here. */
  fields?: ModelCreateField[]
  /** What an edit starts from: each listed row's stored values, by row id. */
  values?: Record<string, Record<string, unknown>>
}

/** A panel's form: a new row for this record, or one of its rows being edited. */
export interface ModelRelatedEditor {
  panel: ModelRelatedPanel
  /** The row being edited. Null for a new one. */
  id: string | number | null
}

/** The panel's row actions: the eye always, the pencil and the trash where the related model allows. */
export function modelRelatedRowActions(panel: ModelRelatedPanel): Array<{ action: 'view' | 'edit' | 'delete', label: string }> {
  const one = panel.label.toLowerCase()
  return [
    { action: 'view', label: `View ${one}` },
    ...(panel.canUpdate && (panel.fields?.length ?? 0) > 0 ? [{ action: 'edit' as const, label: `Edit ${one}` }] : []),
    ...(panel.canDestroy ? [{ action: 'delete' as const, label: `Delete ${one}` }] : []),
  ]
}

/** Whether "Add" opens its form on this page. Without fields to ask for, it leaves for the create page. */
export function modelRelatedAddsHere(panel: ModelRelatedPanel): boolean {
  return panel.canCreate && (panel.fields?.length ?? 0) > 0
}

/**
 * Save a panel's form: a new row pointing at this record, or the changes to
 * one of its rows. One write, through the related model's own endpoint.
 * `changed` is false when an edit changed nothing and so sent nothing.
 */
export async function saveModelRelated(
  editor: ModelRelatedEditor,
  parentId: string | number,
  values: ModelFormValues,
  initial: ModelFormValues,
): Promise<{ ok: true, changed: boolean } | ModelWriteFailure> {
  const fields = editor.panel.fields ?? []
  if (editor.id === null) {
    const parent = Number(parentId)
    const result = await createModelRecord(editor.panel.slug, {
      ...modelFormPayload(fields, values),
      // Which record the new row belongs to is this page's to say, not the form's.
      [editor.panel.field]: Number.isSafeInteger(parent) && parent > 0 ? parent : parentId,
    })
    return result.ok ? { ok: true, changed: true } : result
  }
  const changes = modelFormPayload(fields, values, initial)
  if (Object.keys(changes).length === 0)
    return { ok: true, changed: false }
  const result = await updateModelRecord(editor.panel.slug, editor.id, changes)
  return result.ok ? { ok: true, changed: true } : result
}

/** The panels of a record's page: who points at it. None when it cannot be asked. */
export async function fetchModelRelated(slug: string, id: string | number): Promise<ModelRelatedPanel[]> {
  const data = await dashboardApi<{ panels?: ModelRelatedPanel[] }>(`${modelPath(slug)}/${encodeURIComponent(String(id))}/related`)
  return data.panels ?? []
}

/** The related model's own list, narrowed to the records that point at this one. */
export function modelRelatedListHref(panel: ModelRelatedPanel, parentId: string | number): string {
  return `/models/${encodeURIComponent(panel.slug)}?filters=${encodeURIComponent(JSON.stringify({ [panel.foreignKey]: String(parentId) }))}`
}

/** The related model's create page, with this record already chosen, coming back here. */
export function modelRelatedCreateHref(panel: ModelRelatedPanel, parentId: string | number, from: string): string {
  return `${modelRecordCreateHref(panel.slug, from)}&${encodeURIComponent(panel.field)}=${encodeURIComponent(String(parentId))}`
}

/**
 * The filters a list starts with, from its address: `?filters={"team_id":"3"}`.
 * Anything that is not a flat object of text is ignored, never trusted.
 */
export function modelListFilters(raw: string | null): Record<string, string> {
  if (!raw)
    return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {}
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>)
      .filter(([column, value]) => /^[a-z_][a-z0-9_]*$/i.test(column) && (typeof value === 'string' || typeof value === 'number') && String(value) !== '')
      .map(([column, value]) => [column, String(value)]))
  }
  catch {
    return {}
  }
}

/**
 * What a create form is given to start with, from its address: the record it
 * was opened from (`?teamId=3`). Only fields the form has, and never a
 * checkbox, so an address cannot set what the form does not show.
 */
export function modelFormPrefill(fields: ModelCreateField[], query: (name: string) => string | null): ModelFormValues {
  const values: ModelFormValues = {}
  for (const field of fields) {
    if (field.type === 'boolean')
      continue
    const given = query(field.name)
    if (given !== null && given !== '')
      values[field.name] = given
  }
  return values
}
