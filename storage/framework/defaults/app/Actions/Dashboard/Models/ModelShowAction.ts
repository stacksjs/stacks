import { Action } from '@stacksjs/actions'
import { env } from '@stacksjs/env'
import { request, response as routerResponse } from '@stacksjs/router'
import { loadModelIfExists, safeGet } from '../../../../resources/functions/dashboard/data'
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
 *   3. Raw SQLite — last resort for a table with no model file at all
 *      (lookup/pivot tables, or a schema added outside the ORM).
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
  source: 'orm' | 'sqlite-fallback'
  /** False for tables reached through the SQLite fallback: no model, no writes. */
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

function queryParams(): URLSearchParams {
  const query = ((request as any).query || {}) as Record<string, string | string[] | undefined>
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue
    params.set(key, Array.isArray(value) ? String(value[0]) : String(value))
  }
  return params
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

/**
 * Signals that a free-text search spans several columns, which the query
 * builder cannot express (`whereLike` is single-column and `orWhere` only
 * takes equality pairs). The SQLite path builds that OR with bound
 * parameters instead. Distinct from a real failure so it never surfaces
 * to the page as an error.
 */
class SearchUnsupported extends Error {}

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
  async handle(req: { getParam?: (name: string) => unknown, route?: { params?: { slug?: string } } }) {
    const slug = String(req?.getParam?.('slug') ?? req?.route?.params?.slug ?? '')
    if (!isValidModelSlug(slug))
      return routerResponse.json({ message: 'Model slug must be lowercase kebab-case.' }, 400)

    const modelName = slugToPascal(slug)
    const tableName = pluralize(pascalToSnake(modelName))

    const params = queryParams()
    const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1)
    const perPage = Math.min(MAX_PER_PAGE, Math.max(1, Number.parseInt(params.get('per_page') || String(DEFAULT_PER_PAGE), 10) || DEFAULT_PER_PAGE))
    const requestedSort = (params.get('sort') || '').trim()
    const dir: 'asc' | 'desc' = params.get('dir') === 'asc' ? 'asc' : 'desc'
    const q = (params.get('q') || '').trim()
    let filters: Record<string, string>
    try {
      filters = parseFilters(params.get('filters'))
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
      source: 'orm',
      writable: false,
      writeCapabilities: { create: false, update: false, destroy: false },
      createFields: [],
      error: null,
    }

    const Model = resolveOrmModel(modelName) ?? await loadModelIfExists(modelName)
    const hasOrm = Boolean(Model) && typeof Model.where === 'function'

    if (hasOrm) {
      try {
        response.tableName = String(Model.table || tableName)
        // The column list has to come from a real row: the ORM does not
        // expose a database schema reflection API. Empty tables fall back
        // to the model definition, which is also the migration source.
        const probe = await Model.orderByDesc('id').take(1).get() as Array<Record<string, unknown>>
        const first = Array.isArray(probe) ? probe[0] : undefined
        const shape = first && typeof first === 'object'
          ? ((first as { attributes?: Record<string, unknown> }).attributes ?? first)
          : {}
        response.columns = Object.keys(shape).filter(k => typeof k === 'string' && !k.startsWith('_'))
        if (response.columns.length === 0)
          response.columns = modelSchemaColumns(Model)

        const allowed = new Set(response.columns.filter(c => !HIDDEN_COLUMNS.has(c)))
        const unknownFilter = Object.keys(filters).find(column => !isSafeColumn(column, allowed))
        if (unknownFilter)
          return routerResponse.json({ message: `Unknown model filter column "${unknownFilter}".` }, 422)
        if (requestedSort && !isSafeColumn(requestedSort, allowed))
          return routerResponse.json({ message: `Unknown model sort column "${requestedSort}".` }, 422)

        const sort = isSafeColumn(requestedSort, allowed)
          ? requestedSort
          : (allowed.has('id') ? 'id' : (response.columns[0] ?? ''))
        response.sort = sort

        // Text columns are decided from the probe row, before any query is
        // built, so the search clause does not depend on response metadata
        // that is only assembled after the rows come back.
        const searchColumns = [...allowed].filter(c => typeof safeGet(first, c, null) === 'string')

        const build = () => {
          let chain = Model as any
          for (const [column, value] of Object.entries(filters)) {
            if (!isSafeColumn(column, allowed)) continue
            chain = chain.where(column, value)
          }
          // Global search is a LIKE across every text column. The builder's
          // `whereLike` covers one column and `orWhere` only takes equality
          // pairs, so a multi-column OR-LIKE has no ORM expression; that
          // case is served by the SQLite path below instead, which builds
          // the OR with bound parameters. Writes stay enabled either way,
          // because the model still exists.
          if (q && searchColumns.length === 1)
            chain = chain.whereLike(searchColumns[0], `%${q}%`)
          return chain
        }

        // A multi-column search has no ORM expression, so hand that one
        // query to the SQLite path — without recording an error, because it
        // is a gap in the builder's vocabulary, not a failure.
        if (q && searchColumns.length > 1)
          throw new SearchUnsupported()

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

        // Flatten to plain JSON-safe objects — proxy models and
        // accessor-rich rows do not serialise cleanly across the wire.
        response.rows = (Array.isArray(rows) ? rows : []).map((row) => {
          const flat: Record<string, unknown> = {}
          for (const col of response.columns)
            flat[col] = safeGet(row, col, null)
          return flat
        })
      }
      catch (e) {
        if (e instanceof SearchUnsupported) {
          response.source = 'sqlite-fallback'
        }
        else {
          return routerResponse.json({
            message: `Could not query model ${modelName}: ${e instanceof Error ? e.message : String(e)}`,
          }, 503)
        }
      }
    }
    else {
      response.source = 'sqlite-fallback'
    }

    if (response.source === 'sqlite-fallback') {
      try {
        const { Database } = await import('bun:sqlite')
        const db = new Database(env.DB_DATABASE_PATH || 'database/stacks.sqlite', { readonly: true })
        try {
          if (!/^[A-Za-z_]\w*$/.test(response.tableName))
            return routerResponse.json({ message: `Model table "${response.tableName}" is not a safe SQL identifier.` }, 500)

          const tableInfo = db.query(`PRAGMA table_info(${response.tableName})`).all() as Array<{ name: string, type: string }>
          if (tableInfo.length === 0)
            return routerResponse.json({ message: `Model table "${response.tableName}" does not exist.` }, 404)

          response.columns = tableInfo.map(c => c.name)

          if (response.columns.length > 0) {
            const allowed = new Set(response.columns.filter(c => !HIDDEN_COLUMNS.has(c)))
            const unknownFilter = Object.keys(filters).find(column => !isSafeColumn(column, allowed))
            if (unknownFilter)
              return routerResponse.json({ message: `Unknown model filter column "${unknownFilter}".` }, 422)
            if (requestedSort && !isSafeColumn(requestedSort, allowed))
              return routerResponse.json({ message: `Unknown model sort column "${requestedSort}".` }, 422)

            const sort = isSafeColumn(requestedSort, allowed)
              ? requestedSort
              : (allowed.has('id') ? 'id' : response.columns[0])
            response.sort = sort

            // Every value is bound; only identifiers are interpolated, and
            // those come from the allowlist built out of PRAGMA above.
            const wheres: string[] = []
            const values: unknown[] = []
            for (const [column, value] of Object.entries(filters)) {
              if (!isSafeColumn(column, allowed)) continue
              wheres.push(`${column} = ?`)
              values.push(value)
            }
            if (q) {
              const textColumns = tableInfo
                .filter(c => allowed.has(c.name) && /char|text|clob/i.test(c.type || ''))
                .map(c => c.name)
              if (textColumns.length > 0) {
                wheres.push(`(${textColumns.map(c => `${c} LIKE ?`).join(' OR ')})`)
                for (const _ of textColumns) values.push(`%${q}%`)
              }
            }
            const whereSql = wheres.length > 0 ? ` WHERE ${wheres.join(' AND ')}` : ''

            const countRow = db.query(`SELECT COUNT(*) as count FROM ${response.tableName}${whereSql}`).get(...values as any[]) as { count?: number } | null
            response.totalCount = countRow?.count ?? 0
            response.rows = db
              .query(`SELECT * FROM ${response.tableName}${whereSql} ORDER BY ${sort} ${dir.toUpperCase()} LIMIT ? OFFSET ?`)
              .all(...values as any[], perPage, (page - 1) * perPage) as Array<Record<string, unknown>>
            response.error = null
          }
        }
        finally {
          db.close()
        }
      }
      catch (e) {
        return routerResponse.json({
          message: `Could not query table ${response.tableName}: ${e instanceof Error ? e.message : String(e)}`,
        }, 503)
      }
    }

    // Writability follows the model's declared useApi routes, not which
    // engine answered this particular query. A multi-column search can be
    // served by SQLite for a model that still creates and updates through
    // the ORM.
    response.writeCapabilities = hasOrm
      ? modelWriteCapabilities(Model)
      : { create: false, update: false, destroy: false }
    response.writable = Object.values(response.writeCapabilities).some(Boolean)
    response.createFields = response.writeCapabilities.create ? modelCreateFields(Model) : []
    response.displayColumns = response.columns.filter(col => !HIDDEN_COLUMNS.has(col) && !col.startsWith('_'))
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
