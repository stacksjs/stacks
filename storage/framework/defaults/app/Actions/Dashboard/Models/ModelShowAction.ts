import { Action } from '@stacksjs/actions'
import { loadModel, safeAll, safeGet } from '../../../../resources/functions/dashboard/data'

/**
 * `GET /api/dashboard/models/{slug}` (stacksjs/stacks#1838).
 *
 * Returns the first 50 rows of any model's table for the dynamic
 * `views/dashboard/models/[model].stx` page. Previously the page did
 * this work inline in a `<script server>` block — converting it for
 * the #1838 sweep moved the ORM lookup + raw-SQLite fallback into an
 * action so the page can stay `<script client>`-only.
 *
 * Resolution order:
 *   1. ORM via `loadModel(name)` — covers every model the dashboard
 *      knows about and respects scopes, casts, accessors, observers.
 *   2. Raw SQLite via `bun:sqlite` — last-resort fallback for slugs
 *      that don't have a matching ORM file (rare; usually a lookup
 *      table or userland-only schema).
 *
 * The response shape mirrors what the original template consumed so
 * the page rewrite is a 1:1 swap (no template restructuring needed).
 */

interface ResponseShape {
  modelName: string
  tableName: string
  rows: Array<Record<string, unknown>>
  columns: string[]
  displayColumns: string[]
  totalCount: number
  source: 'orm' | 'sqlite-fallback'
  error: string | null
}

function slugToPascal(str: string): string {
  return str.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
}

function pascalToSnake(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase()
}

function pluralize(word: string): string {
  if (word.endsWith('y') && !/[aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`
  if (/(?:s|x|ch|sh)$/.test(word)) return `${word}es`
  return `${word}s`
}

// Hide credential / token columns + private fields by default.
const HIDDEN_COLUMNS = new Set(['password', 'remember_token', 'api_token', 'access_token', 'refresh_token', 'secret'])

export default new Action({
  name: 'Dashboard Model Show',
  description: 'Returns the first N rows of a single model by URL slug.',
  method: 'GET',
  apiResponse: true,
  async handle(request: { route?: { params?: { slug?: string } } }) {
    const slug = request?.route?.params?.slug || ''
    const modelName = slugToPascal(slug)
    const tableName = pluralize(pascalToSnake(modelName))

    const response: ResponseShape = {
      modelName,
      tableName,
      rows: [],
      columns: [],
      displayColumns: [],
      totalCount: 0,
      source: 'orm',
      error: null,
    }

    // ORM path.
    try {
      const Model = await loadModel(modelName)
      if (Model && !Model._isStub) {
        const all = await safeAll(Model) as Array<Record<string, unknown>>
        const rows = all.slice(0, 50)
        response.totalCount = all.length

        if (rows.length > 0) {
          const sample = rows[0] as Record<string, unknown>
          const attrs = sample && typeof sample === 'object' && !Array.isArray(sample)
            ? ((sample as { attributes?: Record<string, unknown> }).attributes ?? sample)
            : sample
          response.columns = Object.keys(attrs ?? {}).filter(k => typeof k === 'string' && !k.startsWith('_'))
        }

        // Flatten each row to a plain JSON-safe object — proxy models or
        // accessor-rich rows don't serialise cleanly across the wire.
        response.rows = rows.map((row) => {
          const flat: Record<string, unknown> = {}
          for (const col of response.columns)
            flat[col] = safeGet(row, col, null)
          return flat
        })
      }
      else {
        response.source = 'sqlite-fallback'
      }
    }
    catch (e) {
      response.source = 'sqlite-fallback'
      response.error = e instanceof Error ? e.message : String(e)
    }

    // SQLite fallback path.
    if (response.source === 'sqlite-fallback' && response.rows.length === 0) {
      try {
        const { Database } = await import('bun:sqlite')
        const db = new Database('database/stacks.sqlite')
        const tableInfo = db.query(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
        response.columns = tableInfo.map(c => c.name)
        if (response.columns.length > 0) {
          const countResult = db.query(`SELECT COUNT(*) as count FROM ${tableName}`).get() as { count?: number } | null
          response.totalCount = countResult?.count ?? 0
          response.rows = db.query(`SELECT * FROM ${tableName} ORDER BY id DESC LIMIT 50`).all() as Array<Record<string, unknown>>
          response.error = null
        }
        db.close()
      }
      catch (e) {
        response.error = e instanceof Error ? e.message : String(e)
      }
    }

    response.displayColumns = response.columns.filter(col => !HIDDEN_COLUMNS.has(col) && !col.startsWith('_'))

    return response
  },
})
