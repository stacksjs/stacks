import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { env } from '@stacksjs/env'
import { readdirSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import process from 'node:process'
import { dashboardOperationalError } from '../dashboard-response'

interface SearchableModel {
  name: string
  table: string
  slug: string
  fields: string[]
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

function modelFiles(root: string): string[] {
  const files: string[] = []

  function walk(directory: string): void {
    let entries
    try {
      entries = readdirSync(directory, { withFileTypes: true })
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        return
      throw new Error(`Could not scan searchable models in ${directory}: ${error instanceof Error ? error.message : String(error)}`)
    }

    for (const entry of entries) {
      const file = join(directory, entry.name)
      if (entry.isDirectory()) {
        walk(file)
        continue
      }
      if (!['.ts', '.js'].includes(extname(entry.name))) continue
      if (entry.name.startsWith('.') || entry.name.startsWith('_') || entry.name.startsWith('index')) continue
      files.push(file)
    }
  }

  walk(root)
  return files.sort()
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
  const defaultsRoot = join(process.cwd(), 'storage/framework/defaults/app/Models')
  const userRoot = join(process.cwd(), 'app/Models')
  const merged = new Map<string, string>()

  for (const file of modelFiles(defaultsRoot))
    merged.set(basename(file, extname(file)), file)
  for (const file of modelFiles(userRoot))
    merged.set(basename(file, extname(file)), file)

  const models: SearchableModel[] = []
  for (const [fallbackName, file] of merged) {
    try {
      const module = await import(file)
      const definition = module.default ?? module
      const name = String(definition.name || fallbackName)
      const search = definition.traits?.useSearch
      if (!search || typeof search !== 'object' || !Array.isArray(search.searchable)) continue

      const fields = search.searchable
        .map((field: unknown) => snakeCase(String(field)))
        .filter((field: string) => isSafeIdentifier(field) && !HIDDEN_FIELDS.has(field))
      const table = String(definition.table || pluralize(snakeCase(name)))
      if (fields.length === 0 || !isSafeIdentifier(table)) continue

      models.push({
        name,
        table,
        slug: kebabCase(name),
        fields: [...new Set(fields)],
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

export default new Action({
  name: 'GlobalSearchAction',
  description: 'Searches fields declared by model useSearch traits and groups matching records by model.',
  method: 'GET',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const q = String(request.get('q') || '').trim().slice(0, MAX_QUERY_LENGTH)
    if (!q) return { results: {} }

    try {
      const { Database } = await import('bun:sqlite')
      const db = new Database(env.DB_DATABASE_PATH || 'database/stacks.sqlite', { readonly: true })
      const results: Record<string, SearchResult[]> = {}
      const unavailable: SearchUnavailable[] = []

      try {
        for (const model of await catalog()) {
          if (Object.keys(results).length >= MAX_GROUPS) break

          const columns = db.query(`PRAGMA table_info(${model.table})`).all() as Array<{ name: string }>
          if (columns.length === 0) {
            unavailable.push({
              model: model.name,
              reason: `Table ${model.table} has not been migrated.`,
            })
            continue
          }

          const available = new Set(columns.map(column => column.name))
          const fields = model.fields.filter(field => available.has(field))
          if (fields.length === 0) {
            unavailable.push({
              model: model.name,
              reason: 'Declared useSearch fields are not present in the migrated table.',
            })
            continue
          }

          const selected = [...new Set(['id', ...fields])].filter(field => available.has(field))
          const where = fields.map(field => `${field} LIKE ? COLLATE NOCASE`).join(' OR ')
          const bindings = fields.map(() => `%${q}%`)
          let rows: Array<Record<string, unknown>>
          try {
            rows = db
              .query(`SELECT ${selected.join(', ')} FROM ${model.table} WHERE ${where} LIMIT ?`)
              .all(...bindings, RESULTS_PER_MODEL) as Array<Record<string, unknown>>
          }
          catch (error) {
            throw new Error(`Could not search model ${model.name}: ${error instanceof Error ? error.message : String(error)}`)
          }
          if (rows.length === 0) continue

          results[model.name] = rows.map((row, index) => {
            const title = resultTitle(model, row)
            return {
              id: (row.id as string | number | undefined) ?? index,
              title,
              subtitle: resultSubtitle(model, row, title),
              href: `/models/${model.slug}?q=${encodeURIComponent(q)}`,
              icon: model.icon,
            }
          })
        }
      }
      finally {
        db.close()
      }

      return { results, unavailable }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Search results could not be loaded.', 'GlobalSearchAction')
    }
  },
})
