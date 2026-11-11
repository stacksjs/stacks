/**
 * Shared plumbing for the dashboard model browser's write endpoints.
 *
 * Only the ORM path is writable. A table reachable solely through the
 * read-side SQLite fallback has no model, so it has no fillable list, no
 * casts and no observers; writing to it from a generic admin screen would
 * bypass every guarantee the ORM makes. Those rows stay read-only.
 */
import { GDPR_SUBJECT_MODEL } from '@stacksjs/orm'
import { resolveDashboardModel } from '../../../../resources/functions/dashboard/model-access'
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
  /**
   * New rows are added by invitation: the account is created and its holder
   * is mailed a link to choose their password. True for `User` when the
   * dashboard may create one, since no form can supply a password for it.
   */
  invite: boolean
  /**
   * A delete the database refuses, because other records still point at the
   * row, anonymizes it instead: its personal details are removed and the
   * records are kept. True for the model the app's erasure rules are about
   * (`User`), so the confirmation can say so before anything is pressed.
   */
  anonymize: boolean
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

/**
 * The attributes a new row must have that the create form cannot ask for:
 * required, with no default, and withheld from the form because they are
 * hidden or protected.
 *
 * `User.password` is the case that exists. The form leaves hidden fields out
 * on purpose, the column is NOT NULL, and so every "Create user" ended in a
 * 500 from the database after the visitor had filled the form in. A model in
 * that position needs a flow of its own (registration, an invitation), not
 * the generic form.
 */
export function uncollectableRequiredFields(Model: any): string[] {
  const names: string[] = []
  for (const [name, definition] of Object.entries((Model?.attributes ?? {}) as Record<string, any>)) {
    if (!definition?.fillable || definition.default !== undefined)
      continue
    const required = definition.required === true || definition.validation?.rule?.isRequired === true
    if (required && (definition.hidden || isProtectedField(name)))
      names.push(name)
  }
  return names
}

const MODEL_WRITE_OPERATIONS: readonly ModelWriteOperation[] = ['store', 'update', 'destroy']

/**
 * The writes the dashboard offers for a model.
 *
 * `dashboard.writes` when the model names them, and otherwise the write
 * routes its `useApi` trait declares. The two are separate on purpose: the
 * API is what a client may do to its own data, the dashboard is what an
 * operator may do to anyone's. `User` keeps `update` and `destroy` off its
 * API, where they would let a caller change their own email and password
 * outside the flows that verify them, and still has to be editable here.
 *
 * Anything in the list that is not a write is ignored rather than trusted,
 * and a value that is not a list reads as unset.
 */
export function modelDashboardWrites(Model: any): ModelWriteOperation[] {
  const declared = Model?.dashboard?.writes
  const source: unknown[] = Array.isArray(declared) ? declared : modelApiConfiguration(Model).routes
  return MODEL_WRITE_OPERATIONS.filter(operation => source.includes(operation))
}

/** Whether rows of this model are the accounts people sign in with. */
export function isAccountModel(Model: any): boolean {
  const traits = Model?.traits ?? {}
  return Boolean(traits.useAuth ?? traits.authenticatable)
}

export function modelWriteCapabilities(Model: any): ModelWriteCapabilities {
  const writes = modelDashboardWrites(Model)
  return {
    // Being allowed to create is not enough: the form has to be able to
    // supply every field a new row requires.
    create: writes.includes('store') && uncollectableRequiredFields(Model).length === 0,
    update: writes.includes('update'),
    destroy: writes.includes('destroy'),
    // The invitation mails the framework's account-setup link, which is the
    // `users` table's, so this is `User` and not every model with `useAuth`.
    invite: writes.includes('store') && Model?.name === 'User' && isAccountModel(Model),
    anonymize: writes.includes('destroy') && isErasureSubject(Model),
  }
}

/**
 * Whether this is the model the app's erasure rules are about: the person a
 * data-subject request names, whose rows every other model's `gdpr` trait
 * says to delete, anonymize or keep. `User`, by `GDPR_SUBJECT_MODEL`.
 */
export function isErasureSubject(Model: any): boolean {
  return Model?.name === GDPR_SUBJECT_MODEL
}

/**
 * Field errors for a write the database refused as a duplicate.
 *
 * The driver names the constraint, not the field, and not in one spelling
 * across SQLite, MySQL and Postgres. The model does know which of the columns
 * being written it marks `unique`, and that is who the message is for: the
 * one unique field in the request is the duplicate. With several, each is
 * named, because any of them may be. Keyed by attribute name, like every
 * other field error these endpoints return.
 */
export function duplicateFieldErrors(Model: any, columns: string[]): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  for (const [name, definition] of Object.entries((Model?.attributes ?? {}) as Record<string, any>)) {
    if (definition?.unique === true && columns.includes(snakeCase(name)))
      errors[name] = [`${humanize(name)} is already in use.`]
  }
  return errors
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

/** Physical database columns accepted by the model's generic update API. */
export function modelWritableColumns(Model: any): string[] {
  return modelCreateFields(Model).map(field => snakeCase(field.name))
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
  let Model: any
  try {
    Model = await resolveDashboardModel(modelName)
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
    if (!modelDashboardWrites(Model).includes(operation)) {
      const verb = { store: 'created', update: 'edited', destroy: 'deleted' }[operation]
      return { error: `${modelName} records cannot be ${verb} from the dashboard: the model allows it in neither \`dashboard.writes\` nor its \`useApi\` routes.`, status: 405 }
    }
    if (operation === 'store') {
      const missing = uncollectableRequiredFields(Model)
      if (missing.length > 0) {
        return {
          error: `${modelName} records cannot be created from the dashboard: ${missing.map(humanize).join(', ')} ${missing.length === 1 ? 'is' : 'are'} required and the create form does not collect ${missing.length === 1 ? 'it' : 'them'}.${modelWriteCapabilities(Model).invite ? ' Invite the user instead.' : ''}`,
          status: 405,
        }
      }
    }
  }
  return { Model, modelName }
}

export function parseRowId(raw: unknown): number | null {
  const id = Number.parseInt(String(raw ?? ''), 10)
  return Number.isFinite(id) && id > 0 ? id : null
}
