import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response as routerResponse } from '@stacksjs/router'
import { loadModelIfExists, safeGet } from '../../../../resources/functions/dashboard/data'
import { dashboardOperationalError } from '../dashboard-response'
import { isValidModelSlug, type ModelCreateField, type ModelWriteCapabilities, modelCreateFields, modelSchemaColumns, modelWriteCapabilities, slugToPascal } from './model-write'

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
}

interface ResponseShape {
  modelName: string
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

function humanize(column: string): string {
  return column
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bId\b/g, 'ID')
    .replace(/\bUrl\b/g, 'URL')
}

// Hide credential / token columns + private fields by default. These are
// dropped from the response body AND from the sort/filter allowlist: a
// column you cannot see is still an enumeration oracle if you can sort or
// filter by it.
const HIDDEN_COLUMNS = new Set(['password', 'remember_token', 'api_token', 'access_token', 'refresh_token', 'secret', 'two_factor_secret'])

function hiddenModelColumns(Model: any): Set<string> {
  const hidden = new Set(HIDDEN_COLUMNS)
  for (const [name, definition] of Object.entries(Model?.attributes ?? {})) {
    if ((definition as { hidden?: boolean })?.hidden)
      hidden.add(pascalToSnake(name))
  }
  return hidden
}

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

function resolveOrmModel(modelName: string): any {
  const injected = (globalThis as Record<string, any>)[modelName]
  // The ORM injects Proxies that answer `undefined` for every property
  // until their deferred load lands, so probe for a real query method
  // rather than trusting the name to be bound.
  if (injected && typeof injected.where === 'function') return injected
  return null
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
      writeCapabilities: { create: false, update: false, destroy: false },
      createFields: [],
      error: null,
    }

    let Model: any
    try {
      Model = resolveOrmModel(modelName) ?? await loadModelIfExists(modelName)
    }
    catch (error) {
      return dashboardOperationalError(error, `${modelName} could not be loaded.`, 'ModelShowAction.resolve')
    }
    if (!Model || typeof Model.where !== 'function')
      return routerResponse.json({ message: `No ORM model named ${modelName}.` }, 404)

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
      const searchColumns = [...allowed].filter(c => typeof safeGet(first, c, null) === 'string')

      const build = () => {
        let chain = Model.query() as any
        for (const [column, value] of Object.entries(filters)) {
          if (!isSafeColumn(column, allowed)) continue
          chain = chain.where(column, value)
        }
        if (q && searchColumns.length > 0) {
          chain = chain.whereGroup((group: any) => {
            for (const [index, column] of searchColumns.entries()) {
              group = index === 0
                ? group.whereLike(column, `%${q}%`)
                : group.orWhereLike(column, `%${q}%`)
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

      response.rows = (Array.isArray(rows) ? rows : []).map((row) => {
        const flat: Record<string, unknown> = {}
        for (const col of response.columns)
          flat[col] = safeGet(row, col, null)
        return flat
      })
    }
    catch (error) {
      return dashboardOperationalError(error, `${modelName} records could not be loaded.`, 'ModelShowAction.query')
    }

    response.writeCapabilities = modelWriteCapabilities(Model)
    response.writable = Object.values(response.writeCapabilities).some(Boolean)
    response.createFields = response.writeCapabilities.create ? modelCreateFields(Model) : []
    response.displayColumns = response.columns.filter(col => !col.startsWith('_'))
    response.columnMeta = response.displayColumns.map(name => ({
      name,
      label: humanize(name),
      type: typeForColumn(name, response.rows.map(r => r[name])),
    }))
    response.searchable = response.columnMeta.filter(c => c.type === 'text').map(c => c.name)
    response.lastPage = Math.max(1, Math.ceil(response.totalCount / perPage))

    return response
  },
})
