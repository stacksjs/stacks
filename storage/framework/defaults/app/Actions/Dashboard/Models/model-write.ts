/**
 * Shared plumbing for the dashboard model browser's write endpoints.
 *
 * Only the ORM path is writable. A table reachable solely through the
 * read-side SQLite fallback has no model, so it has no fillable list, no
 * casts and no observers; writing to it from a generic admin screen would
 * bypass every guarantee the ORM makes. Those rows stay read-only.
 */
import { loadModelIfExists } from '../../../../resources/functions/dashboard/data'
import { dashboardOperationalIssue } from '../dashboard-response'
import { modelApiConfiguration } from './model-api'

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

/**
 * Model browser URLs are generated from PascalCase model names as lowercase
 * kebab-case slugs. Validate that public boundary before deriving a model or
 * table name from it.
 */
export function isValidModelSlug(str: string): boolean {
  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(str)
}

export interface ResolvedModel {
  Model: any
  modelName: string
}

export interface ModelResolutionError {
  error: string
  status: 400 | 404 | 405 | 500
}

export type ModelWriteOperation = 'store' | 'update' | 'destroy'

export interface ModelWriteCapabilities {
  create: boolean
  update: boolean
  destroy: boolean
}

export interface ModelCreateField {
  name: string
  label: string
  type: 'boolean' | 'date' | 'datetime' | 'email' | 'enum' | 'number' | 'text'
  required: boolean
  defaultValue: unknown
  options: string[]
}

export interface PreparedModelFields {
  data: Record<string, unknown>
  errors: Record<string, string[]>
}

function snakeCase(name: string): string {
  return name
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase()
}

function humanize(name: string): string {
  return name
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
    .replace(/\bId\b/g, 'ID')
}

/**
 * Derive the physical columns declared by a model when its table has no rows
 * to inspect. This mirrors model-driven migrations closely enough for the
 * generic browser to render and sort an empty model without falling back to
 * raw SQLite.
 */
export function modelSchemaColumns(Model: any): string[] {
  const columns: string[] = []
  const add = (column: string) => {
    if (column && !columns.includes(column))
      columns.push(column)
  }

  add(snakeCase(String(Model?.primaryKey || 'id')))
  for (const name of Object.keys(Model?.attributes ?? {}))
    add(snakeCase(name))

  for (const relation of Model?.belongsTo ?? []) {
    const name = typeof relation === 'string' ? relation : relation?.model
    if (typeof name === 'string' && name.trim())
      add(`${snakeCase(name)}_id`)
  }

  const traits = Model?.traits ?? {}
  if (traits.useUuid)
    add('uuid')
  if ((traits.useTimestamps ?? traits.timestampable) !== false) {
    add('created_at')
    add('updated_at')
  }
  if (traits.useSoftDeletes ?? traits.softDeletable)
    add('deleted_at')

  return columns
}

function isProtectedField(name: string): boolean {
  const column = name
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase()
  return PROTECTED_COLUMNS.has(name) || PROTECTED_COLUMNS.has(column)
}

export function modelWriteCapabilities(Model: any): ModelWriteCapabilities {
  const routes = modelApiConfiguration(Model).routes
  return {
    create: routes.includes('store'),
    update: routes.includes('update'),
    destroy: routes.includes('destroy'),
  }
}

function relationFieldName(relation: string): string {
  const words = relation
    .trim()
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split('_')
    .filter(Boolean)
  return `${words[0]}${words.slice(1).map(word => `${word[0]?.toUpperCase()}${word.slice(1)}`).join('')}Id`
}

export function modelCreateFields(Model: any): ModelCreateField[] {
  const fields: ModelCreateField[] = []
  const attributes = Model?.attributes ?? {}

  for (const [name, definition] of Object.entries(attributes as Record<string, any>)) {
    if (!definition?.fillable || definition.hidden || isProtectedField(name))
      continue
    const rule = definition.validation?.rule
    const ruleName = String(rule?.name || definition.type || 'string')
    const options = Array.isArray(rule?.allowedValues) ? rule.allowedValues.map(String) : []
    let type: ModelCreateField['type'] = 'text'
    if (options.length > 0 || ruleName === 'enum')
      type = 'enum'
    else if (ruleName === 'number' || ruleName === 'integer' || ruleName === 'timestamp')
      type = 'number'
    else if (ruleName === 'boolean')
      type = 'boolean'
    else if (ruleName === 'date')
      type = 'date'
    else if (ruleName === 'datetime' || ruleName === 'timestampTz')
      type = 'datetime'
    else if (name.toLowerCase().includes('email'))
      type = 'email'

    fields.push({
      name,
      label: humanize(name),
      type,
      required: definition.required === true || rule?.isRequired === true,
      defaultValue: definition.default ?? (type === 'boolean' ? false : ''),
      options,
    })
  }

  for (const relation of Model?.belongsTo ?? []) {
    if (typeof relation !== 'string' || !relation.trim())
      continue
    const name = relationFieldName(relation)
    if (fields.some(field => field.name === name) || isProtectedField(name))
      continue
    fields.push({
      name,
      label: humanize(name),
      type: 'number',
      required: false,
      defaultValue: '',
      options: [],
    })
  }

  return fields.sort((left, right) => {
    const leftOrder = attributes[left.name]?.order ?? Number.MAX_SAFE_INTEGER
    const rightOrder = attributes[right.name]?.order ?? Number.MAX_SAFE_INTEGER
    return leftOrder - rightOrder
  })
}

function normalizeModelValue(type: ModelCreateField['type'], value: unknown): unknown {
  if (type === 'number') {
    if (value === '' || value === null || value === undefined)
      return null
    const number = Number(value)
    return Number.isFinite(number) ? number : value
  }
  if (type === 'boolean')
    return value === true || value === 1 || value === '1' || value === 'true' || value === 'on'
  return value
}

function normalizeValidationValue(rule: any, value: unknown): unknown {
  if (typeof value !== 'string')
    return value
  if (rule?.name === 'date') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!match)
      return value
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  }
  if (rule?.name === 'datetime') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : parsed
  }
  return value
}

/**
 * Filter, coerce and validate fields through the model definition. Both
 * camelCase attribute names and snake_case database columns are accepted.
 * Partial mode validates only supplied fields for PATCH requests.
 */
export function prepareModelFields(
  Model: any,
  body: Record<string, unknown>,
  partial = false,
): PreparedModelFields {
  const data: Record<string, unknown> = {}
  const errors: Record<string, string[]> = {}
  const attributes = Model?.attributes ?? {}

  for (const field of modelCreateFields(Model)) {
    const column = snakeCase(field.name)
    const hasAttribute = Object.prototype.hasOwnProperty.call(body, field.name)
    const hasColumn = Object.prototype.hasOwnProperty.call(body, column)
    if (!hasAttribute && !hasColumn) {
      if (!partial && field.required)
        errors[field.name] = [`${field.label} is required.`]
      continue
    }

    const rawValue = hasAttribute ? body[field.name] : body[column]
    const value = normalizeModelValue(field.type, rawValue)
    if ((value === '' || value === null || value === undefined) && field.required) {
      errors[field.name] = [`${field.label} is required.`]
      continue
    }
    if ((value === '' || value === null || value === undefined) && !field.required) {
      if (partial)
        data[field.name] = null
      continue
    }

    const definition = attributes[field.name]
    const rule = definition?.validation?.rule
    if (rule && typeof rule.validate === 'function') {
      const result = rule.validate(normalizeValidationValue(rule, value))
      if (!result?.valid && Array.isArray(result?.errors)) {
        errors[field.name] = result.errors.map((error: any) =>
          definition?.validation?.message?.[error?.code] ?? error?.message ?? 'Invalid value.',
        )
        continue
      }
    }

    data[field.name] = value
  }

  return { data, errors }
}

/**
 * Resolve a URL slug to a writable model, preferring the global the ORM
 * injects (the same object the rest of the dashboard queries, so scopes,
 * casts and observers all apply) over the path-map lookup.
 */
export async function resolveWritableModel(slug: string, operation?: ModelWriteOperation): Promise<ResolvedModel | ModelResolutionError> {
  if (!isValidModelSlug(slug))
    return { error: 'Model slug must be lowercase kebab-case.', status: 400 }

  const modelName = slugToPascal(slug)
  const injected = (globalThis as Record<string, any>)[modelName]
  let Model: any
  try {
    Model = (injected && typeof injected.where === 'function') ? injected : await loadModelIfExists(modelName)
  }
  catch (error) {
    return {
      error: dashboardOperationalIssue(error, `${modelName} could not be loaded.`, `resolveWritableModel.${operation || 'read'}`),
      status: 500,
    }
  }
  if (!Model || typeof Model.find !== 'function')
    return { error: `No ORM model named ${modelName}. Rows from tables without a model are read-only.`, status: 404 }
  if (operation) {
    const capability = operation === 'store' ? 'create' : operation
    if (!modelWriteCapabilities(Model)[capability])
      return { error: `${modelName} does not declare the ${operation} route in its useApi trait.`, status: 405 }
  }
  return { Model, modelName }
}

export function parseRowId(raw: unknown): number | null {
  const id = Number.parseInt(String(raw ?? ''), 10)
  return Number.isFinite(id) && id > 0 ? id : null
}
