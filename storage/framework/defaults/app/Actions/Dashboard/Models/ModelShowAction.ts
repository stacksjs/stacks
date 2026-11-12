import { hiddenModelColumns } from '../../../../resources/functions/dashboard/model-columns'
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { anonymizedRows } from '@stacksjs/orm'
import { response as routerResponse } from '@stacksjs/router'
import { safeGet } from '../../../../resources/functions/dashboard/data'
import { resolveDashboardModel } from '../../../../resources/functions/dashboard/model-access'
import { dashboardOperationalError } from '../dashboard-response'
import { type ModelCustomAction, modelActionApplies, modelActions, publicModelAction } from './model-actions'
import { modelFormFields, reachableRelations } from './model-forms'
import { isUnmigratedTable } from './model-migration'
import { recordNames } from './model-options'
import type { ModelFieldDisplay } from './model-fields'
import { humanizeIdentifier, isErasureSubject, isValidModelSlug, type ModelCreateField, type ModelWriteCapabilities, modelColumnDisplay, modelColumnLabel, modelFieldProblems, modelListColumns, modelSchemaColumns, modelWritableColumns, modelWriteCapabilities, slugToPascal } from './model-write'

/** Models already told, this process, that `dashboard.columns` names a column they lack. */
const warnedColumns = new Set<string>()
/** Models already told, this process, what is wrong with their `dashboard.fields`. */
const warnedFields = new Set<string>()

/**
 * `GET /api/dashboard/models/{slug}` (stacksjs/stacks#1838).
 *
 * The query engine behind the dashboard's generic model browser
 * (`views/dashboard/models/[model].stx`) — the page every model gets for
 * free, whether or not someone hand-built a dedicated view for it.
 *
 * Everything is resolved server-side: paging, sorting, a global search
 * across text columns, and per-column equality filters. The page used to
 * receive the first 50 rows and nothing else, so its pagination controls
 * were inert and a table with real volume was unusable.
 *
 * Model resolution order:
 *   1. `globalThis[Name]` — @stacksjs/orm injects every registered model
 *      as a global, and that is the same object the rest of the dashboard
 *      queries, so scopes, casts and accessors all apply.
 *   2. `loadModelIfExists(Name)` — path-map lookup, covers models the ORM has not
 *      registered as a global.
 * A missing model is a 404. The generic browser never bypasses model scopes,
 * casts, observers, connection drivers, or the app override contract.
 */

interface ColumnMeta {
  name: string
  label: string
  /** Coarse kind used by the table to pick an alignment and a filter control. */
  type: 'number' | 'boolean' | 'date' | 'json' | 'text'
  /** How the model says the value is shown (`dashboard.fields`): money, a size, a link. */
  format?: ModelFieldDisplay
}

interface ResponseShape {
  modelName: string
  /** The model's name as a person reads it: "Social Post" for `SocialPost`. */
  modelLabel: string
  tableName: string
  rows: Array<Record<string, unknown>>
  columns: string[]
  displayColumns: string[]
  columnMeta: ColumnMeta[]
  searchable: string[]
  totalCount: number
  page: number
  perPage: number
  lastPage: number
  sort: string
  dir: 'asc' | 'desc'
  q: string
  filters: Record<string, string>
  writable: boolean
  writeCapabilities: ModelWriteCapabilities
  createFields: ModelCreateField[]
  /** The fields an edit may change, described the way the create form's are. */
  updateFields: ModelCreateField[]
  /** The columns that hold another model's id, and whose: `team_id` is a Team. */
  relations: Record<string, { model: string, slug: string, label: string }>
  /** The columns the list draws, in order: the model's `dashboard.columns`, or all of them. */
  listColumns: string[]
  /** What the records these rows point at are called, by column and then id. */
  relationNames: Record<string, Record<string, string>>
  updateColumns: string[]
  /** Rows whose personal details erasure has replaced with placeholders (the subject model only). */
  anonymizedIds?: Array<number | string>
  /** What the model lets an operator do to a record beyond editing it: its `dashboard.actions`. */
  actions: ModelCustomAction[]
  /** Which of those each row on this page is offered, by row id. A row with none is left out. */
  rowActions: Record<string, string[]>
  /** False when the model's table does not exist yet: `./buddy migrate` creates it. */
  migrated: boolean
  error: string | null
}

const DEFAULT_PER_PAGE = 25
const MAX_PER_PAGE = 200

function pascalToSnake(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
}

function pluralize(word: string): string {
  if (word.endsWith('y') && !/[aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`
  if (/(?:s|x|ch|sh)$/.test(word)) return `${word}es`
  return `${word}s`
}

// Hide credential / token columns + private fields by default. These are
// dropped from the response body AND from the sort/filter allowlist: a
// column you cannot see is still an enumeration oracle if you can sort or
// filter by it.
/**
 * Column identifiers reach the query builder as raw, unquoted SQL, so only
 * valid identifiers from the table's own column list may ever be used.
 */
function isSafeColumn(name: string, allowed: Set<string>): boolean {
  return /^[A-Za-z_]\w*$/.test(name) && allowed.has(name)
}

function inferType(values: unknown[]): ColumnMeta['type'] {
  const sample = values.find(v => v !== null && v !== undefined)
  if (sample === undefined) return 'text'
  if (typeof sample === 'boolean') return 'boolean'
  if (typeof sample === 'number') return 'number'
  if (typeof sample === 'object') return 'json'
  return 'text'
}

function typeForColumn(column: string, values: unknown[]): ColumnMeta['type'] {
  if (column === 'id' || column.endsWith('_id')) return 'number'
  if (column.endsWith('_at') || column.endsWith('_date')) return 'date'
  if (column.startsWith('is_') || column.startsWith('has_')) return 'boolean'
  return inferType(values)
}

/**
 * The columns a global search matches with LIKE: the ones the page is told
 * are text, by the same rule.
 *
 * It used to take every column whose sampled value was a string. PostgreSQL
 * answers BIGINT as a string, so `id` and every `*_id` qualified, and the
 * search failed with `operator does not exist: bigint ~~ unknown` on any
 * table with a row in it: `/models/team?q=PrimeSoft` answered 503.
 */
export function searchColumnsFor(columns: Iterable<string>, sample: unknown): string[] {
  return [...columns].filter((column) => {
    const value = safeGet(sample, column, null)
    return typeof value === 'string' && typeForColumn(column, [value]) === 'text'
  })
}

function queryValue(request: RequestInstance, key: string, fallback = ''): string {
  const value = request.get<unknown>(key, fallback)
  if (Array.isArray(value))
    return value.length > 0 ? String(value[0]) : fallback
  return value == null ? fallback : String(value)
}

/** `filters` arrives as a JSON object so column names stay unambiguous. */
export function parseFilters(raw: string | null): Record<string, string> {
  if (!raw) return {}

  if (raw.length > 8192)
    throw new TypeError('Model filters must be 8 KB or smaller')

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  }
  catch (error) {
    throw new Error(`Could not parse model filters: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new TypeError('Model filters must be a JSON object')

  const entries = Object.entries(parsed)
  if (entries.length > 50)
    throw new TypeError('Model filters may contain at most 50 columns')

  const out: Record<string, string> = {}
  for (const [key, value] of entries) {
    if (!/^\w+$/.test(key))
      throw new TypeError(`Invalid model filter column "${key}"`)
    if (value === null || value === undefined || value === '')
      continue
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')
      throw new TypeError(`Model filter "${key}" must be a scalar value`)
    out[key] = String(value)
  }
  return out
}

export default new Action({
  name: 'Dashboard Model Show',
  description: 'Queries a single model by URL slug with paging, sorting, search and column filters.',
  method: 'GET',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const slug = request.getParam('slug')
    if (!isValidModelSlug(slug))
      return routerResponse.json({ message: 'Model slug must be lowercase kebab-case.' }, 400)

    const modelName = slugToPascal(slug)
    const tableName = pluralize(pascalToSnake(modelName))

    const page = Math.max(1, Number.parseInt(queryValue(request, 'page', '1'), 10) || 1)
    const perPage = Math.min(MAX_PER_PAGE, Math.max(1, Number.parseInt(queryValue(request, 'per_page', String(DEFAULT_PER_PAGE)), 10) || DEFAULT_PER_PAGE))
    const requestedSort = queryValue(request, 'sort').trim()
    const dir: 'asc' | 'desc' = queryValue(request, 'dir') === 'asc' ? 'asc' : 'desc'
    const q = queryValue(request, 'q').trim()
    let filters: Record<string, string>
    try {
      filters = parseFilters(queryValue(request, 'filters') || null)
    }
    catch (error) {
      return routerResponse.json({
        message: error instanceof Error ? error.message : 'Model filters are invalid.',
      }, 422)
    }

    const response: ResponseShape = {
      modelName,
      modelLabel: humanizeIdentifier(modelName),
      tableName,
      rows: [],
      columns: [],
      displayColumns: [],
      columnMeta: [],
      searchable: [],
      totalCount: 0,
      page,
      perPage,
      lastPage: 1,
      sort: '',
      dir,
      q,
      filters,
      writable: false,
      writeCapabilities: { create: false, update: false, destroy: false, invite: false, anonymize: false },
      createFields: [],
      updateFields: [],
      relations: {},
      listColumns: [],
      relationNames: {},
      updateColumns: [],
      actions: [],
      rowActions: {},
      migrated: true,
      error: null,
    }

    let Model: any
    try {
      Model = await resolveDashboardModel(modelName)
    }
    catch (error) {
      return dashboardOperationalError(error, `${modelName} could not be loaded.`, 'ModelShowAction.resolve')
    }
    if (!Model || typeof Model.where !== 'function')
      return routerResponse.json({ message: `No ORM model named ${modelName}.` }, 404)

    // The rows as the model returned them, hidden columns included: an
    // action's `when` may be about a column the page is never sent.
    let stored: unknown[] = []

    try {
      response.tableName = String(Model.table || tableName)
      const probe = await Model.orderByDesc('id').take(1).get() as Array<Record<string, unknown>>
      const first = Array.isArray(probe) ? probe[0] : undefined
      const shape = first && typeof first === 'object'
        ? ((first as { attributes?: Record<string, unknown> }).attributes ?? first)
        : {}
      const hiddenColumns = hiddenModelColumns(Model)
      response.columns = Object.keys(shape).filter(k => typeof k === 'string' && !k.startsWith('_') && !hiddenColumns.has(k))
      if (response.columns.length === 0)
        response.columns = modelSchemaColumns(Model).filter(column => !hiddenColumns.has(column))

      const allowed = new Set(response.columns)
      const unknownFilter = Object.keys(filters).find(column => !isSafeColumn(column, allowed))
      if (unknownFilter)
        return routerResponse.json({ message: `Unknown model filter column "${unknownFilter}".` }, 422)
      if (requestedSort && !isSafeColumn(requestedSort, allowed))
        return routerResponse.json({ message: `Unknown model sort column "${requestedSort}".` }, 422)

      const sort = isSafeColumn(requestedSort, allowed)
        ? requestedSort
        : (allowed.has('id') ? 'id' : (response.columns[0] ?? ''))
      response.sort = sort
      const searchColumns = searchColumnsFor(allowed, first)

      const build = () => {
        let chain = Model.query() as any
        for (const [column, value] of Object.entries(filters)) {
          if (!isSafeColumn(column, allowed)) continue
          chain = chain.where(column, value)
        }
        if (q && searchColumns.length > 0) {
          // Lowercased on both sides, so the search ignores case on every
          // dialect. A model query's whereLike is a plain LIKE, which is
          // case-sensitive on PostgreSQL: "donald" did not find "Donald"
          // there (stacksjs/stacks#3202). The column is one of the model's
          // own (isSafeColumn), and the term is bound.
          chain = chain.whereGroup((group: any) => {
            for (const [index, column] of searchColumns.entries()) {
              const match = `LOWER(${column}) LIKE LOWER(?)`
              group = index === 0
                ? group.whereRaw(match, `%${q}%`)
                : group.orWhereRaw(match, `%${q}%`)
            }
            return group
          })
        }
        return chain
      }

      response.totalCount = q && searchColumns.length === 0
        ? 0
        : await build().count()
      const rows = response.totalCount === 0
        ? []
        : await build()
            .orderBy(sort, dir)
            .skip((page - 1) * perPage)
            .take(perPage)
            .get() as Array<Record<string, unknown>>

      stored = Array.isArray(rows) ? rows : []
      response.rows = (Array.isArray(rows) ? rows : []).map((row) => {
        const flat: Record<string, unknown> = {}
        for (const col of response.columns)
          flat[col] = safeGet(row, col, null)
        return flat
      })

      // An account erased under the app's data-subject rules is stored as
      // placeholders ("[erased]", "erased-13"). The page says which rows those
      // are, so it can explain them and not show what looks like corrupt data.
      if (isErasureSubject(Model) && response.rows.length > 0) {
        const erased = await anonymizedRows(modelName, response.rows).catch((error) => {
          console.warn(`[dashboard/api] ModelShowAction: could not tell which ${modelName} rows are anonymized:`, error)
          return [] as boolean[]
        })
        response.anonymizedIds = response.rows.filter((_row, index) => erased[index] === true).map(row => row.id as number | string)
      }
    }
    catch (error) {
      // Not an error to report: the table simply has not been created yet, and
      // the page says so and names the command that creates it.
      if (await isUnmigratedTable(response.tableName))
        return { ...response, columns: [], rows: [], migrated: false }
      return dashboardOperationalError(error, `${modelName} records could not be loaded.`, 'ModelShowAction.query')
    }

    response.writeCapabilities = modelWriteCapabilities(Model)
    response.writable = Object.values(response.writeCapabilities).some(Boolean)
    // A relation is only worth a picker when the dashboard can list the model
    // it points at. One whose feature is off, or that is kept out of the
    // dashboard, stays the plain id it was.
    const reachable = new Set<string>()
    for (const relation of await reachableRelations(Model)) {
      reachable.add(relation.model)
      response.relations[relation.column] = { model: relation.model, slug: relation.slug, label: humanizeIdentifier(relation.model) }
    }
    const formFields = (): ModelCreateField[] => modelFormFields(Model, reachable)
    response.createFields = response.writeCapabilities.create ? formFields() : []
    response.updateColumns = response.writeCapabilities.update ? modelWritableColumns(Model) : []
    response.updateFields = response.writeCapabilities.update ? formFields() : []
    response.displayColumns = response.columns.filter(col => !col.startsWith('_'))
    response.columnMeta = response.displayColumns.map((name) => {
      const format = modelColumnDisplay(Model, name)
      return {
        name,
        // The model's own word for it, else "Team" and not "Team ID" (the
        // column shows which team), else the name in words.
        label: modelColumnLabel(Model, name, response.relations[name]?.label),
        type: typeForColumn(name, response.rows.map(r => r[name])),
        ...(format ? { format } : {}),
      }
    })
    if (!warnedFields.has(modelName)) {
      warnedFields.add(modelName)
      for (const problem of modelFieldProblems(Model, response.columns))
        console.warn(`[dashboard] ${modelName} dashboard.fields: ${problem}. It is ignored.`)
    }

    const list = modelListColumns(Model, response.displayColumns)
    response.listColumns = list.columns
    // Only with a real row to judge by: an empty table's columns come from the
    // model alone, which does not know the ones its traits add.
    if (list.unknown.length > 0 && response.rows.length > 0 && !warnedColumns.has(modelName)) {
      warnedColumns.add(modelName)
      console.warn(`[dashboard] ${modelName} names ${list.unknown.map(name => `'${name}'`).join(', ')} in dashboard.columns, which its table does not have (or hides). ${list.unknown.length === 1 ? 'It is' : 'They are'} left out of the list.`)
    }

    // The records these rows point at, named: one lookup per related model,
    // for the rows on this page. A list then reads "PrimeSoft Ltd" where it
    // read "3", and a record's page has its names without asking again.
    for (const [column, relation] of Object.entries(response.relations)) {
      const ids = response.rows.map(row => row[column]).filter(id => id !== null && id !== undefined && id !== '') as Array<number | string>
      if (ids.length > 0)
        response.relationNames[column] = Object.fromEntries(await recordNames(relation.model, ids))
    }

    // The model's own actions, and the rows each is for. Decided here, where
    // the whole row is, so the page never has to be sent the rule. An erased
    // account is offered none: there is nobody left to act on.
    const actions = await modelActions(Model, modelName)
    response.actions = actions.map(publicModelAction)
    const erased = new Set((response.anonymizedIds ?? []).map(String))
    for (const [index, row] of stored.entries()) {
      const id = String(response.rows[index]?.id ?? '')
      const offered = id && !erased.has(id) ? actions.filter(action => modelActionApplies(action, row)).map(action => action.name) : []
      if (offered.length > 0)
        response.rowActions[id] = offered
    }
    response.searchable = response.columnMeta.filter(c => c.type === 'text').map(c => c.name)
    response.lastPage = Math.max(1, Math.ceil(response.totalCount / perPage))

    return response
  },
})
