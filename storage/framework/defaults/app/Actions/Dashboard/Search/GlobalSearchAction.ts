import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { getDatabaseDialect, sqlHelpers } from '@stacksjs/database/runtime'
import { overridesReady } from '@stacksjs/config'
import { hiddenModelColumns } from '../../../../resources/functions/dashboard/model-columns'
import { dashboardModelSources, resolveDashboardModel } from '../../../../resources/functions/dashboard/model-access'
import { dashboardOperationalError, dashboardOperationalIssue } from '../dashboard-response'

interface SearchableModel {
  name: string
  table: string
  slug: string
  fields: string[]
  primaryKey: string
  model: any
  icon: string
}

interface SearchResult {
  id: string | number
  title: string
  subtitle?: string
  href: string
  icon: string
}

interface SearchUnavailable {
  model: string
  reason: string
}

const HIDDEN_FIELDS = new Set([
  'password',
  'remember_token',
  'api_token',
  'access_token',
  'refresh_token',
  'secret',
  'two_factor_secret',
])
const MAX_QUERY_LENGTH = 120
const MAX_GROUPS = 8
const RESULTS_PER_MODEL = 5

const modelCatalog: { promise: Promise<SearchableModel[]> | null } = { promise: null }

function snakeCase(value: string): string {
  return value
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase()
}

function kebabCase(value: string): string {
  return value
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase()
}

function pluralize(word: string): string {
  if (word.endsWith('y') && !/[aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`
  if (/(?:s|x|ch|sh)$/.test(word)) return `${word}es`
  return `${word}s`
}

function isSafeIdentifier(value: string): boolean {
  return /^[A-Z_][A-Z0-9_]*$/i.test(value) && value.length <= 64
}

function iconForModel(name: string): string {
  const icons: Record<string, string> = {
    User: 'i-hugeicons-user-group',
    Team: 'i-hugeicons-user-multiple',
    Product: 'i-hugeicons-shopping-bag-02',
    Customer: 'i-hugeicons-user-02',
    Order: 'i-hugeicons-shopping-cart-01',
    Post: 'i-hugeicons-note-edit',
    Page: 'i-hugeicons-file-02',
    Release: 'i-hugeicons-package-delivered',
    Deployment: 'i-hugeicons-cloud-upload',
    Log: 'i-hugeicons-document-validation',
  }
  return icons[name] || 'i-hugeicons-database-02'
}

async function loadSearchableModels(): Promise<SearchableModel[]> {
  await overridesReady
  const sources = dashboardModelSources()

  const models: SearchableModel[] = []
  for (const { name: fallbackName, file } of sources) {
    try {
      const module = await import(file)
      const definition = await resolveDashboardModel(fallbackName, module.default ?? module, sources)
      if (!definition) continue
      const name = String(definition.name || fallbackName)
      const search = definition.traits?.useSearch
      if (!search || typeof search !== 'object' || !Array.isArray(search.searchable)) continue

      const hidden = hiddenModelColumns(definition)
      const stored = new Set(Object.keys(definition.attributes ?? {}).map(snakeCase))
      const fields: string[] = (search.searchable as unknown[])
        .map((field: unknown) => snakeCase(String(field)))
        .filter((field: string) => isSafeIdentifier(field) && !HIDDEN_FIELDS.has(field) && !hidden.has(field) && stored.has(field))
      const table = String(definition.table || pluralize(snakeCase(name)))
      if (fields.length === 0 || !isSafeIdentifier(table)) continue

      models.push({
        name,
        table,
        slug: kebabCase(name),
        fields: [...new Set(fields)],
        primaryKey: String(definition.primaryKey || 'id'),
        model: definition,
        icon: iconForModel(name),
      })
    }
    catch (error) {
      throw new Error(`Could not load searchable model ${fallbackName}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return models.sort((a, b) => a.name.localeCompare(b.name))
}

function catalog(): Promise<SearchableModel[]> {
  if (modelCatalog.promise)
    return modelCatalog.promise

  const loading = loadSearchableModels().catch((error) => {
    modelCatalog.promise = null
    throw error
  })
  modelCatalog.promise = loading
  return loading
}

function rowValue(row: Record<string, unknown>, field: string): string {
  const value = row[field]
  if (value === null || value === undefined) return ''
  return typeof value === 'string' ? value : String(value)
}

function resultTitle(model: SearchableModel, row: Record<string, unknown>): string {
  for (const field of ['name', 'title', 'subject', 'version', 'code', 'email', ...model.fields]) {
    const value = rowValue(row, field).trim()
    if (value) return value
  }
  return `${model.name} #${rowValue(row, 'id') || 'record'}`
}

function resultSubtitle(model: SearchableModel, row: Record<string, unknown>, title: string): string | undefined {
  for (const field of model.fields) {
    const value = rowValue(row, field).trim()
    if (value && value !== title) return value
  }
  return undefined
}

/** Use the configured ORM connection, including PostgreSQL, and select only approved fields. */
export async function searchModelRows(Model: any, fields: string[], primaryKey: string, term: string, limit = RESULTS_PER_MODEL): Promise<Array<Record<string, unknown>>> {
  if (!isSafeIdentifier(primaryKey) || fields.some(field => !isSafeIdentifier(field)))
    throw new TypeError('Search columns must be model identifiers.')
  if (fields.length === 0) return []
  const dialect = sqlHelpers(getDatabaseDialect())
  const quote = (column: string) => dialect.isMysql ? `\`${column}\`` : `"${column}"`
  const rows = await Model.query()
    .select(...new Set([primaryKey, ...fields]))
    .whereGroup((group: any) => {
      for (const [index, column] of fields.entries()) {
        const match = `LOWER(CAST(${quote(column)} AS ${dialect.isMysql ? 'CHAR' : 'TEXT'})) LIKE LOWER(?)`
        group = index === 0 ? group.whereRaw(match, `%${term}%`) : group.orWhereRaw(match, `%${term}%`)
      }
      return group
    })
    .orderBy(primaryKey, 'asc')
    .limit(limit)
    .get()
  return rows.map((row: any) => typeof row.toJSON === 'function' ? row.toJSON() : row.attributes ?? row)
}

export default new Action({
  name: 'GlobalSearchAction',
  description: 'Searches fields declared by model useSearch traits and groups matching records by model.',
  method: 'GET',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const q = String(request.get('q') || '').trim().slice(0, MAX_QUERY_LENGTH)
    if (!q) return { results: {} }

    try {
      const models = await catalog()
      if (models.length === 0) return { results: {}, unavailable: [] }
      const results: Record<string, SearchResult[]> = {}
      const unavailable: SearchUnavailable[] = []

      for (const model of models) {
        if (Object.keys(results).length >= MAX_GROUPS) break
        try {
          const rows = await searchModelRows(model.model, model.fields, model.primaryKey, q, RESULTS_PER_MODEL)
          if (rows.length === 0) continue
          results[model.name] = rows.map((row) => {
            const title = resultTitle(model, row)
            return {
              id: row[model.primaryKey] as string | number,
              title,
              subtitle: resultSubtitle(model, row, title),
              href: `/models/${model.slug}?q=${encodeURIComponent(q)}`,
              icon: model.icon,
            }
          })
        }
        catch (error) {
          unavailable.push({ model: model.name, reason: 'Could not search model. Check its migrated schema and declared useSearch fields.' })
          dashboardOperationalIssue(error, 'Could not search model.', `GlobalSearchAction.${model.name}`)
        }
      }

      return { results, unavailable }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Search results could not be loaded.', 'GlobalSearchAction')
    }
  },
})
