/**
 * Shared plumbing for the dashboard model browser's write endpoints.
 *
 * Only the ORM path is writable. A table reachable solely through the
 * read-side SQLite fallback has no model, so it has no fillable list, no
 * casts and no observers; writing to it from a generic admin screen would
 * bypass every guarantee the ORM makes. Those rows stay read-only.
 */
import { loadModel } from '../../../../resources/functions/dashboard/data'

/** Never writable from a generic admin table, whatever the model declares. */
export const PROTECTED_COLUMNS: ReadonlySet<string> = new Set([
  'id',
  'uuid',
  'created_at',
  'updated_at',
  'password',
  'remember_token',
  'api_token',
  'access_token',
  'refresh_token',
  'secret',
  'two_factor_secret',
])

export function slugToPascal(str: string): string {
  return str.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
}

export interface ResolvedModel {
  Model: any
  modelName: string
}

/**
 * Resolve a URL slug to a writable model, preferring the global the ORM
 * injects (the same object the rest of the dashboard queries, so scopes,
 * casts and observers all apply) over the path-map lookup.
 */
export async function resolveWritableModel(slug: string): Promise<ResolvedModel | { error: string }> {
  const modelName = slugToPascal(slug)
  const injected = (globalThis as Record<string, any>)[modelName]
  const Model = (injected && typeof injected.where === 'function') ? injected : await loadModel(modelName)
  if (!Model || Model._isStub || typeof Model.find !== 'function')
    return { error: `No ORM model named ${modelName}. Rows from tables without a model are read-only.` }
  return { Model, modelName }
}

export function parseRowId(raw: unknown): number | null {
  const id = Number.parseInt(String(raw ?? ''), 10)
  return Number.isFinite(id) && id > 0 ? id : null
}
