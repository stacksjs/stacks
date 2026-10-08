/**
 * Pure helpers for the auto-CRUD route generator (../routes.ts).
 *
 * Extracted so the write-path key mapping and middleware resolution can be
 * unit-tested without booting the router or a database. The canonical
 * storage/framework/orm/routes.ts entrypoint delegates to ../core/orm/routes,
 * so every runtime consumes these same helpers.
 */

// Lives in @stacksjs/error-handling, where the queue and other packages that
// cannot depend on the ORM can use it too. Re-exported for existing callers.
export { isUniqueViolation } from '@stacksjs/error-handling'
import { isUniqueViolation } from '@stacksjs/error-handling'

/**
 * Classify a write-path error into an HTTP status + JSON body for the
 * auto-CRUD store/update handlers. Three branches, in priority order:
 *
 * 1. HttpError-like (an Error carrying an integer `status` in 400-599) —
 *    preserve its status, message and optional `details`. Duck-typed rather
 *    than `instanceof HttpError` so this helper stays inline-copyable into the
 *    canonical generated routes file without importing @stacksjs/error-handling.
 *    Covers the 400/413/422 throws from getRequestBody / validation.
 * 2. Unique-constraint violation — 409 with a clean `${Model} already exists`
 *    message (NO raw driver text, which would leak column names in prod).
 * 3. Anything else — the unchanged 500 contract, including `detail: String(err)`.
 */
export function mapWriteError(
  err: unknown,
  modelName: string,
  op: 'create' | 'update',
): { status: number, body: Record<string, unknown> } {
  const e = err as { status?: unknown, message?: unknown, details?: unknown }
  if (
    err instanceof Error
    && typeof e.status === 'number'
    && Number.isInteger(e.status)
    && e.status >= 400
    && e.status < 600
  ) {
    const body: Record<string, unknown> = { error: err.message }
    if (e.details !== undefined) body.details = e.details
    return { status: e.status, body }
  }

  if (isUniqueViolation(err))
    return { status: 409, body: { error: `${modelName} already exists` } }

  return {
    status: 500,
    body: { error: `Failed to ${op} ${modelName}`, detail: String(err) },
  }
}

/**
 * Attribute names in model definitions may be camelCase; the migration
 * drivers (database/src/drivers/{sqlite,mysql,postgres}.ts) snake_case them
 * into column names. Write payload keys must be mapped the same way, LAST on
 * the write path — fillable filtering, validation, set-hooks and casts are
 * all keyed by attribute name. Output-identical to @stacksjs/strings
 * snakeCase for word-shaped attribute names (locked in by tests).
 */
export function toSnakeCase(s: string): string {
  let hasUppercase = false
  for (let index = 0; index < s.length; index++) {
    const code = s.charCodeAt(index)
    if (code > 127)
      return s.replace(/([a-z\d])([A-Z])/g, '$1_$2').replace(/([A-Z])([A-Z][a-z])/g, '$1_$2').toLowerCase()
    if (code >= 65 && code <= 90) hasUppercase = true
  }
  if (!hasUppercase) return s

  let result = ''
  for (let index = 0; index < s.length; index++) {
    const code = s.charCodeAt(index)
    if (code < 65 || code > 90) {
      result += s[index]
      continue
    }

    const previous = index > 0 ? s.charCodeAt(index - 1) : 0
    const next = index + 1 < s.length ? s.charCodeAt(index + 1) : 0
    const followsWord = (previous >= 97 && previous <= 122) || (previous >= 48 && previous <= 57)
    const endsAcronym = previous >= 65 && previous <= 90 && next >= 97 && next <= 122
    if (index > 0 && (followsWord || endsAcronym)) result += '_'
    result += String.fromCharCode(code + 32)
  }
  return result
}

/** Map every key of a write payload to its snake_case column spelling. */
export function toSnakeCaseKeys(data: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(data)) out[toSnakeCase(k)] = v
  return out
}

/** Build the canonical auto-CRUD path while accepting a version prefix. */
export function apiBasePath(uri: string, prefix?: string): string {
  const cleanPrefix = String(prefix || '').replace(/^\/+|\/+$/g, '')
  const cleanUri = String(uri).replace(/^\/+/, '')
  return `/api/${cleanPrefix ? `${cleanPrefix}/` : ''}${cleanUri}`
}

/**
 * Resolve the database column used for automatic team ownership.
 *
 * A belongsTo relation creates its foreign key during model-driven migration,
 * so Team-owned models do not need to repeat a synthetic teamId attribute just
 * to activate API isolation.
 */
export function teamOwnershipField(model: {
  attributes?: Record<string, unknown>
  belongsTo?: unknown[]
} | null | undefined): string | null {
  if (!model) return null
  const attributes = model.attributes ?? {}
  if (Object.prototype.hasOwnProperty.call(attributes, 'teamId') || Object.prototype.hasOwnProperty.call(attributes, 'team_id'))
    return 'team_id'

  return model.belongsTo?.some(relation => relation === 'Team') ? 'team_id' : null
}

/**
 * Resolve the database column used for automatic per-user ownership.
 *
 * The same principle `teamOwnershipField` applies to tenants, applied to the
 * rows a single caller owns: a model carrying `user_id` (declared, or created
 * by a `belongsTo: ['User']` relation during model-driven migration) has a
 * per-row owner already, so it does not need to repeat that fact as an
 * `ownership` config just to get API isolation.
 *
 * Ten of the framework's own models are in this shape - Card, Comment,
 * Notification, Subscriber and friends - and every one of them published
 * mutating routes that any authenticated caller could point at any row
 * (stacksjs/stacks#2375).
 */
export function userOwnershipField(model: {
  attributes?: Record<string, unknown>
  belongsTo?: unknown[]
} | null | undefined): string | null {
  if (!model) return null
  const attributes = model.attributes ?? {}
  if (Object.prototype.hasOwnProperty.call(attributes, 'userId') || Object.prototype.hasOwnProperty.call(attributes, 'user_id'))
    return 'user_id'

  return model.belongsTo?.some(relation => relation === 'User') ? 'user_id' : null
}

/**
 * A model that has declared, in as many words, that its rows have no per-caller
 * owner: `ownership: false`.
 *
 * This is what separates "considered, and there is genuinely nothing to scope
 * by" - a public catalog table - from "nobody thought about it", which is the
 * state `security.api.rowScoping: 'deny'` refuses to generate writes for. The
 * two were indistinguishable before, which is why denying by default needed
 * this to exist first: without it the safe default also punishes every model
 * that is legitimately unscoped.
 */
export function ownershipDeclaredUnscoped(model: { ownership?: unknown } | null | undefined): boolean {
  return model?.ownership === false
}

/**
 * Remove every client spelling of an ownership field, then apply the trusted
 * value resolved from the authenticated request. Array ownership is used for
 * resources owned through a parent relation, so the client must select one of
 * the allowed values in that case.
 */
export function stampOwnership(
  data: Record<string, any>,
  field: string,
  value: unknown,
): { data: Record<string, any>, error?: string } {
  const ownerKey = Object.keys(data).find(key => toSnakeCase(key) === toSnakeCase(field))

  if (Array.isArray(value)) {
    if (ownerKey === undefined)
      return { data, error: 'Ownership value is required' }
    if (!value.some(allowed => String(allowed) === String(data[ownerKey])))
      return { data, error: 'Ownership value is not available to this caller' }
    return { data: { ...data, [field]: data[ownerKey] } }
  }

  if (value === null || value === undefined)
    return { data, error: 'Caller has no ownership identity' }

  const stamped = { ...data }
  for (const key of Object.keys(stamped)) {
    if (toSnakeCase(key) === toSnakeCase(field)) delete stamped[key]
  }
  stamped[field] = value
  return { data: stamped }
}

/**
 * Resolve the model fields accepted by generated store/update routes.
 *
 * Declared fillable attributes remain the primary allowlist. A `belongsTo`
 * declaration also defines a real foreign-key column in model-driven
 * migrations, so its `<relation>Id` attribute is writable through `useApi`
 * without requiring a bespoke action for every relationship. No undeclared
 * body key is admitted, and hasMany/hasOne relations never contribute keys.
 */
export function getWritableFields(model: {
  attributes?: Record<string, { fillable?: boolean }>
  belongsTo?: unknown[]
} | null | undefined): string[] {
  if (!model) return []

  const fields = Object.entries(model.attributes ?? {})
    .filter(([, attribute]) => attribute?.fillable === true)
    .map(([name]) => name)

  for (const relation of model.belongsTo ?? []) {
    if (typeof relation !== 'string' || !relation.trim())
      continue

    const words = toSnakeCase(relation.trim()).split('_').filter(Boolean)
    if (words.length === 0)
      continue

    const relationField = `${words[0]}${words.slice(1).map(word => `${word[0]?.toUpperCase()}${word.slice(1)}`).join('')}Id`
    fields.push(relationField)
  }

  return [...new Set(fields)]
}

/**
 * Filter a request body down to fillable fields. Accepts BOTH the
 * attribute-name spelling and its snake_case column spelling on input, so
 * read-modify-write round-trips work (GET responses expose snake_case
 * columns). The result stays keyed by attribute name — setters, casts and
 * validation rules all look fields up by that spelling.
 */
export function filterFillable(body: Record<string, unknown> | null | undefined, fillableFields: string[]): Record<string, unknown> {
  if (!body || fillableFields.length === 0) return {}
  const result: Record<string, unknown> = {}
  let snakeByField: Map<string, string> | undefined
  for (const field of fillableFields) {
    if (field in body) {
      result[field] = body[field]
      continue
    }
    snakeByField ??= resolveFieldSpellingMap(fillableFields)
    const snake = snakeByField.get(field)!
    if (snake !== field && snake in body) result[field] = body[snake]
  }
  return result
}

/**
 * Normalize JSON-safe values for validators whose in-process type cannot be
 * represented directly in a request body. `schema.date()` validates a Date
 * instance, while browser forms submit an ISO calendar date string. Keep the
 * stored write payload unchanged and normalize only the value passed to the
 * validator.
 */
export function normalizeValidationValue(rule: { name?: unknown } | null | undefined, value: unknown): unknown {
  if (rule?.name !== 'date' || value instanceof Date || typeof value !== 'string')
    return value

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match)
    return value

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    return value
  }

  return parsed
}

interface ResolvedFieldSpelling {
  field: string
  snake: string
}

const fieldSpellingsByList = new WeakMap<string[], ResolvedFieldSpelling[]>()
const fieldSpellingMaps = new WeakMap<ResolvedFieldSpelling[], Map<string, string>>()

function resolveFieldSpellings(fields: string[]): ResolvedFieldSpelling[] {
  const cached = fieldSpellingsByList.get(fields)
  if (cached && cached.length === fields.length) {
    let unchanged = true
    for (let index = 0; index < fields.length; index++) {
      if (cached[index]?.field !== fields[index]) {
        unchanged = false
        break
      }
    }
    if (unchanged) return cached
  }

  const resolved = fields.map(field => ({ field, snake: toSnakeCase(field) }))
  fieldSpellingsByList.set(fields, resolved)
  return resolved
}

function resolveFieldSpellingMap(fields: string[]): Map<string, string> {
  const spellings = resolveFieldSpellings(fields)
  const cached = fieldSpellingMaps.get(spellings)
  if (cached) return cached

  const resolved = new Map(spellings.map(({ field, snake }) => [field, snake]))
  fieldSpellingMaps.set(spellings, resolved)
  return resolved
}

/**
 * Drop attribute keys flagged `hidden: true` from an incoming write body.
 * Must drop BOTH spellings — accepting the snake spelling in filterFillable
 * without this would let `payment_intent_id` sneak past a camelCase hidden
 * marker.
 */
export function dropHiddenInputs(data: Record<string, any>, hiddenFields: string[]): Record<string, any> {
  if (!hiddenFields.length) return data
  const out: Record<string, any> = { ...data }
  for (const { field, snake } of resolveFieldSpellings(hiddenFields)) {
    delete out[field]
    if (snake !== field) delete out[snake]
  }
  return out
}

/**
 * Strip attribute keys flagged `hidden: true` from an outgoing response
 * record. Must drop BOTH spellings — DB rows come back keyed by snake_case
 * column names, so deleting only the attribute-name spelling lets a
 * camelCase hidden attribute (Transaction's `paymentDetails`) leak as
 * `payment_details` on public reads. Response-side mirror of
 * `dropHiddenInputs`.
 */
export function stripHidden<T extends Record<string, unknown>>(record: T | null | undefined, hiddenFields: string[]): T | null | undefined {
  if (!record || hiddenFields.length === 0) return record
  const result = { ...record }
  for (const { field, snake } of resolveFieldSpellings(hiddenFields)) {
    delete result[field]
    if (snake !== field) delete result[snake]
  }
  return result
}

/**
 * Columns every auto-CRUD table carries regardless of declared attributes.
 * Members of the read allowlist (sort/filter) alongside the model's own
 * attribute names.
 */
export const SYSTEM_COLUMNS = ['id', 'uuid', 'created_at', 'updated_at', 'deleted_at']

/**
 * Build the read-path column allowlist for a model: a map from BOTH the
 * attribute-name spelling and its snake_case column spelling to the real
 * snake_case column. One map serves `?sort=` and `?<column>=` filters.
 *
 * Why a map and not a set: attribute names may be camelCase
 * (`discountType`) while DB columns are always snake_case (the migration
 * drivers snake_case them — same contract as `toSnakeCaseKeys` on the
 * write path). A set keyed by attribute spelling let `?sort=discountType`
 * through to `orderBy('discountType')` (ghost column → 500) while
 * REJECTING the real column spelling `discount_type`. The map accepts
 * either spelling and always emits the column spelling.
 *
 * Hidden attributes are removed under BOTH spellings — sorting or
 * equality-filtering on a hidden column (`?two_factor_secret=x`) is a
 * blind-enumeration oracle even though the value never appears in the
 * response body.
 */
export function buildReadColumnMap(
  attributes: Record<string, unknown> | null | undefined,
  hiddenFields: string[],
): Map<string, string> {
  const map = new Map<string, string>()
  for (const name of [...Object.keys(attributes ?? {}), ...SYSTEM_COLUMNS]) {
    const column = toSnakeCase(name)
    // bun-query-builder interpolates ORDER BY / WHERE columns raw and
    // unquoted — only word-shaped columns may enter the map.
    if (!/^\w+$/.test(column)) continue
    map.set(name, column)
    map.set(column, column)
  }
  for (const f of hiddenFields) {
    map.delete(f)
    map.delete(toSnakeCase(f))
  }
  return map
}

/**
 * Apply a `?sort=` parameter to a query builder chain. Comma-separated
 * tokens, each optionally `-` prefixed for descending. Tokens are resolved
 * through the `columns` allowlist map (see `buildReadColumnMap`) so either
 * spelling of a declared, non-hidden attribute works and everything else —
 * unknown names, hidden attributes, non-word tokens — is silently skipped
 * (the existing contract, matching the filter loop).
 *
 * Examples:
 *   ?sort=name              → ORDER BY name ASC
 *   ?sort=-rating           → ORDER BY rating DESC
 *   ?sort=discountType,name → ORDER BY discount_type ASC, name ASC
 */
export function applySorting<Q extends { orderBy: (_column: string, _direction: 'asc' | 'desc') => Q }>(
  query: Q,
  sortParam: string | null,
  columns: ReadonlyMap<string, string>,
): Q {
  if (!sortParam) return query
  let q = query
  for (const rawToken of String(sortParam).split(',')) {
    const tok = rawToken.trim()
    if (!tok) continue
    const desc = tok.startsWith('-')
    const requested = desc ? tok.slice(1) : tok
    if (!/^\w+$/.test(requested)) continue
    const column = columns.get(requested)
    if (!column) continue
    q = q.orderBy(column, desc ? 'desc' : 'asc')
  }
  return q
}

/**
 * Built-in cast resolvers — kept in sync with @stacksjs/orm/define-model.
 * A duplicate here is the simplest way to keep auto-CRUD parity with the
 * model-driven path without introducing a circular import.
 */
export const AUTO_CRUD_CASTERS: Record<string, { get: (v: unknown) => unknown, set: (v: unknown) => unknown }> = {
  string:   { get: v => v != null ? String(v) : null,                                set: v => v != null ? String(v) : null },
  number:   { get: v => v != null ? Number(v) : null,                                set: v => v != null ? Number(v) : null },
  integer:  { get: v => v != null ? Math.trunc(Number(v)) : null,                    set: v => v != null ? Math.trunc(Number(v)) : null },
  float:    { get: v => v != null ? Number.parseFloat(String(v)) : null,             set: v => v != null ? Number.parseFloat(String(v)) : null },
  boolean:  { get: v => v === 1 || v === '1' || v === true || v === 'true',         set: v => (v === true || v === 1 || v === '1' || v === 'true') ? 1 : 0 },
  json:     { get: v => v == null ? null : (typeof v === 'string' ? safeJSON(v) : v), set: v => v == null ? null : typeof v === 'string' ? v : JSON.stringify(v) },
  datetime: { get: v => v ? new Date(v as string) : null,                            set: v => v instanceof Date ? v.toISOString() : v },
  date:     { get: v => v ? new Date(v as string) : null,                            set: v => v instanceof Date ? (v.toISOString().split('T')[0] as string) : v },
  array:    { get: v => v == null ? [] : Array.isArray(v) ? v : (typeof v === 'string' ? safeJSONOrEmpty(v) : []), set: v => v == null ? null : Array.isArray(v) ? JSON.stringify(v) : v },
}

interface ResolvedAutoCrudCast {
  attr: string
  snake: string
  definition: string | { get: (v: unknown) => unknown, set: (v: unknown) => unknown }
  caster?: { get?: (v: unknown) => unknown, set?: (v: unknown) => unknown }
}

const autoCrudCastsByDefinition = new WeakMap<object, ResolvedAutoCrudCast[]>()

function resolveAutoCrudCasts(
  casts: Record<string, string | { get: (v: unknown) => unknown, set: (v: unknown) => unknown }>,
  attrs: string[],
): ResolvedAutoCrudCast[] {
  const cached = autoCrudCastsByDefinition.get(casts)
  if (cached && cached.length === attrs.length) {
    let unchanged = true
    for (let index = 0; index < attrs.length; index++) {
      const attr = attrs[index]!
      if (cached[index]?.attr !== attr || cached[index]?.definition !== casts[attr]) {
        unchanged = false
        break
      }
    }
    if (unchanged) return cached
  }

  const resolved: ResolvedAutoCrudCast[] = []
  for (const attr of attrs) {
    const castDef = casts[attr]!
    const caster = typeof castDef === 'string' ? AUTO_CRUD_CASTERS[castDef] : castDef
    resolved.push({ attr, snake: toSnakeCase(attr), definition: castDef, caster })
  }
  autoCrudCastsByDefinition.set(casts, resolved)
  return resolved
}

function safeJSON(s: string): unknown { try { return JSON.parse(s) } catch { return s } }
function safeJSONOrEmpty(_s: string): unknown { try { return JSON.parse(_s) } catch { return [] } }

/**
 * Apply a model's `casts` to a record, in either direction:
 *   - `'get'`  — DB shape → JS-typed values (read responses)
 *   - `'set'`  — input → DB shape (write payloads)
 *
 * Casts are declared keyed by attribute name (possibly camelCase:
 * `instantBook: 'boolean'`) but DB rows come back keyed by snake_case
 * column names (`instant_book`) — so each cast is applied under BOTH
 * spellings, whichever is present. A record keyed by attribute names
 * (the write path) behaves exactly as before; a snake-keyed DB row (the
 * read path) now gets its casts instead of leaking raw SQLite `"1"`s.
 */
export function applyCasts(
  record: Record<string, any> | null | undefined,
  casts: Record<string, string | { get: (v: unknown) => unknown, set: (v: unknown) => unknown }> | null | undefined,
  direction: 'get' | 'set',
): any {
  if (!record || typeof record !== 'object' || !casts) return record
  const attrs = Object.keys(casts)
  if (attrs.length === 0) return record
  const resolvedCasts = resolveAutoCrudCasts(casts, attrs)
  if (resolvedCasts.length === 0) return record
  const out: Record<string, any> = { ...record }
  for (const { attr, caster, snake } of resolvedCasts) {
    if (!caster) continue
    const cast = caster[direction]
    if (typeof cast !== 'function') continue
    if (Object.prototype.hasOwnProperty.call(out, attr)) out[attr] = cast.call(caster, out[attr])
    if (snake !== attr && Object.prototype.hasOwnProperty.call(out, snake)) out[snake] = cast.call(caster, out[snake])
  }
  return out
}

/**
 * Run each declared `validation.rule` against a write payload.
 *
 * Returns `{ valid: true }` or `{ valid: false, errors }`. Per-attribute custom
 * messages from `validation.message` override the rule's default text.
 *
 * Fields the caller never sent are skipped on the `updating` hook, so a partial
 * update does not trip a `required` rule on a sibling field it never touched.
 *
 * Lives here rather than in `../routes.ts` so BOTH write paths can reach it.
 * It used to be a local function in that module, which meant the declared rules
 * ran on the generated REST routes and nowhere else: `Model.create()`,
 * `.update()` and `.save()` went straight to the driver, and an over-length
 * value first got noticed by Postgres as a 22001, surfacing as a 500 on
 * whichever endpoint performed the write (stacksjs/stacks#2233). Importing it
 * from `routes.ts` was not an option — that module registers routes on import.
 */
export type WriteValidationResult =
  | { valid: true }
  | { valid: false, errors: Record<string, string[]> }

interface WriteValidatorDefinition {
  definition: Record<string, any>
  field: string
  hasDefault: boolean
  rule: { name?: unknown, validate: (value: unknown) => any }
}

const writeValidatorsByAttributes = new WeakMap<object, WriteValidatorDefinition[]>()

function resolveWriteValidators(attributes: Record<string, any>): WriteValidatorDefinition[] {
  const cached = writeValidatorsByAttributes.get(attributes)
  if (cached) return cached

  const validators: WriteValidatorDefinition[] = []
  for (const [field, definition] of Object.entries(attributes)) {
    const rule = definition?.validation?.rule
    if (!rule || typeof rule.validate !== 'function') continue
    validators.push({
      definition,
      field,
      hasDefault: definition !== null
        && typeof definition === 'object'
        && Object.prototype.hasOwnProperty.call(definition, 'default'),
      rule,
    })
  }

  writeValidatorsByAttributes.set(attributes, validators)
  return validators
}

export function hasWriteValidators(model: any): boolean {
  const attributes = model?.attributes
  if (!attributes || typeof attributes !== 'object') return false

  for (const definition of Object.values(attributes)) {
    const rule = (definition as Record<string, any>)?.validation?.rule
    if (rule && typeof rule.validate === 'function') return true
  }

  return false
}

export function validateWriteBody(
  data: Record<string, any>,
  model: any,
  hook: 'creating' | 'updating',
): WriteValidationResult {
  const attributes = model?.attributes
  if (!attributes || typeof attributes !== 'object') return { valid: true }

  const validators = resolveWriteValidators(attributes)
  if (validators.length === 0) return { valid: true }

  const errors: Record<string, string[]> = {}
  let hasErrors = false
  for (const validator of validators) {
    const { definition, field, hasDefault, rule } = validator
    const present = Object.prototype.hasOwnProperty.call(data, field)
    if (!present && hook === 'updating') continue

    // An absent field on create is worth `default`, not `undefined`.
    //
    // Enforcement is the outermost write wrapper — deliberately, since the
    // rules are written against pre-cast input — which puts it ahead of every
    // step that fills defaults in. Reading `undefined` here therefore failed
    // `required()` for fields the model had already said it knew a value for,
    // making `required().default(x)` a mandatory field with a dead default.
    // The framework's own `Product.preparationTime` is declared that way, so
    // writing a product from code failed on a field the caller had no opinion
    // about.
    //
    // `hasOwnProperty`, not a truthiness test: `default: 0` and `default: ''`
    // are values, and are exactly the defaults most likely to be declared.
    const raw = present
      ? data[field]
      : hasDefault ? definition.default : undefined

    // The default is validated rather than waved through, so a default that
    // breaks its own rule is caught at the first write instead of silently
    // storing an invalid row.
    const value = normalizeValidationValue(rule, raw)
    const result = rule.validate(value)
    if (!result?.valid && Array.isArray(result?.errors) && result.errors.length > 0) {
      hasErrors = true
      errors[field] = result.errors.map((e: any) =>
        definition.validation?.message?.[e?.code] ?? e?.message ?? 'invalid',
      )
    }
  }
  return hasErrors ? { valid: false, errors } : { valid: true }
}

/**
 * A route path with every parameter name flattened to `{}`.
 *
 * The "user routes win" guard compared paths literally, so an app's own
 * `/api/sites/{siteId}` did not suppress the ORM's `/api/sites/{id}` — the two
 * strings differ, so BOTH were registered and the ORM copy carried none of the
 * app's authorization. The app had declared the endpoint and still got a second,
 * unguarded one it never wrote (stacksjs/stacks#2224).
 *
 * The parameter's NAME is the app's business. The shape is what decides whether
 * this URL is already claimed.
 */
/** The subset of a registered route this matching needs. */
export interface RegisteredRouteLike {
  method?: string
  path?: unknown
}

/** A stable lookup key for the verb and parameter-independent route shape. */
export function routeShapeKey(method: string, path: string): string {
  return `${method}\0${routeShape(path)}`
}

/**
 * Index registered routes by verb and path shape while preserving the first
 * route for collision diagnostics. The router also serves the first
 * registration, so later duplicates must not replace it here.
 */
export function indexRouteShapes<T extends RegisteredRouteLike>(routes: readonly T[]): Map<string, T> {
  const index = new Map<string, T>()
  for (const route of routes) {
    const key = routeShapeKey(String(route.method ?? ''), String(route.path ?? ''))
    if (!index.has(key)) index.set(key, route)
  }
  return index
}

/**
 * The already-registered route that would shadow a generated `method` + `path`,
 * or undefined when the generated route is free to register.
 *
 * Pure, and separate from the logging wrapper in `../routes.ts`, so the rule can
 * be tested without booting a router. The rule itself is the whole of
 * stacksjs/stacks#2364: match on SHAPE, because a hand-written
 * `/api/sites/{siteId}` and a generated `/api/sites/{id}` address the same URLs
 * and a literal comparison sees two different strings, registers both, and lets
 * the generated handler answer without the hand-written one's authorization.
 */
export function findShadowingRoute<T extends RegisteredRouteLike>(
  routes: readonly T[],
  method: string,
  path: string,
): T | undefined {
  const shape = routeShape(path)
  return routes.find(r => r.method === method && routeShape(String(r.path ?? '')) === shape)
}

export function routeShape(path: string): string {
  // Both spellings the router accepts, so `/sites/:siteId` matches too.
  return path.replace(/\{[^}]*\}/g, '{}').replace(/:[^/]+/g, '{}')
}

/** Drop non-string and empty entries, accepting a bare string as a one-item list. */
function middlewareList(raw: unknown): string[] {
  if (Array.isArray(raw))
    return raw.filter((m: unknown): m is string => typeof m === 'string' && m.length > 0)
  return typeof raw === 'string' && raw ? [raw] : []
}

/**
 * Resolve middleware lists for a model's `useApi` trait value (which may be
 * `true` or `{ uri, routes, middleware }`).
 *
 * Secure-by-default on BOTH sides: with no declared `useApi.middleware`, read
 * and mutating routes alike get `auth`.
 *
 * #1949 gave the mutating routes that default and deliberately left reads
 * public, reasoning that catalog tables (products, posts) want anonymous
 * browsing. The cost of that default landed on models that are not catalogs: a
 * model opting into the trait without declaring middleware published
 * `GET /api/{uri}` and `GET /api/{uri}/{id}` to anyone. In one real app that
 * was `GET /api/users` returning the full customer list — only `password` was
 * `hidden`, so names and emails came back — and the app's own security tests
 * could not see it, because the route was never declared in its route files
 * (stacksjs/stacks#2224).
 *
 * A wrong "public" default is a data breach; a wrong "private" default is a 401
 * on the first request in development. Only one of those is recoverable, so the
 * default is now `auth` and a public read is something an app asks for.
 *
 * Three declaration shapes, so asking is always possible:
 *
 *   `middleware: ['auth']`              both sides get the list (unchanged)
 *   `middleware: []`                    both sides public — deliberate opt-out,
 *                                       warned about at the call site
 *   `middleware: { read, write }`       per-side lists
 *
 * The split form exists because the secure default would otherwise make the
 * most common real shape — public catalog reads, authenticated writes —
 * inexpressible: a flat `middleware: []` is the only way to open reads, and it
 * opens writes at the same time. That is a worse trade than the bug being fixed,
 * so `{ read: [], write: ['auth'] }` says it exactly.
 */
export function resolveApiMiddleware(useApi: unknown, dashboard?: unknown): { read: string[], write: string[], declared: boolean } {
  const declared = typeof useApi === 'object' && useApi !== null && 'middleware' in (useApi as Record<string, unknown>)
  const raw = (useApi as { middleware?: unknown } | null | undefined)?.middleware
  const role = dashboardRoleMiddleware(dashboard)

  if (!declared)
    return { read: withDashboardRole(['auth'], role), write: withDashboardRole(['auth'], role), declared: false }

  // Split form. `read`/`write` are independent: an omitted side falls back to
  // the secure default rather than to "public", so `{ write: ['auth'] }` does
  // not quietly reopen reads.
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const split = raw as Record<string, unknown>
    return {
      read: withDashboardRole('read' in split ? middlewareList(split.read) : ['auth'], role),
      write: withDashboardRole('write' in split ? middlewareList(split.write) : ['auth'], role),
      declared: true,
    }
  }

  const list = middlewareList(raw)
  return { read: withDashboardRole(list, role), write: withDashboardRole(list, role), declared: true }
}

/**
 * The `role:` middleware entry a model's `dashboard.roles` implies, or null.
 *
 * #1843 gave models a `dashboard.roles` list and taught the sidebar to hide
 * rows whose roles a viewer does not hold. Nothing carried that list to the
 * routes behind those rows, so a model declaring `roles: ['admin']` registered
 * `['auth']`: the row vanished and `GET /api/<uri>` still returned every row of
 * it to anyone signed in, `DELETE` and `bulk-delete` included. A hidden row is
 * presentation, and the field is called `roles` - an app writing one is saying
 * who may reach the model (stacksjs/stacks#2883).
 *
 * One entry rather than one per role, because `role:a,b` is Role.ts's any-of
 * form and matches what the list means in the sidebar.
 *
 * `enforce: false` opts out, for a row hidden only to reduce clutter. It has to
 * be the boolean: a truthy-looking typo must not reopen what the roles closed,
 * so anything else reads as unset.
 */
export function dashboardRoleMiddleware(dashboard: unknown): string | null {
  if (!dashboard || typeof dashboard !== 'object')
    return null

  const options = dashboard as { roles?: unknown, enforce?: unknown }
  if (options.enforce === false)
    return null

  if (!Array.isArray(options.roles))
    return null

  const roles = options.roles
    .filter((role: unknown): role is string => typeof role === 'string')
    .map((role: string) => role.trim())
    .filter((role: string) => role.length > 0)

  return roles.length > 0 ? `role:${roles.join(',')}` : null
}

/**
 * The abilities the `useApi` trait generates, in the order its `routes` list
 * names them. The same five strings, so a model declaring
 * `routes: ['index', 'show']` and `middleware: { show: [...] }` is using one
 * vocabulary rather than two.
 */
export const API_ABILITIES = ['index', 'show', 'store', 'update', 'destroy'] as const

export type ApiAbility = (typeof API_ABILITIES)[number]

/** Which coarse side an ability falls back to when it declares nothing. */
const ABILITY_SIDE: Record<ApiAbility, 'read' | 'write'> = {
  index: 'read',
  show: 'read',
  store: 'write',
  update: 'write',
  destroy: 'write',
}

/**
 * Per-ability middleware for a model's generated routes.
 *
 * `resolveApiMiddleware` answers "may look" and "may change", which is as fine
 * as the read/write split goes. It cannot say "may create, may not delete",
 * because store and destroy share the write bucket - and that distinction is
 * most of what giving a role fewer ACTIONS means (stacksjs/stacks#2883). An
 * ability key overrides the side it belongs to:
 *
 *   `middleware: { read: ['auth'], write: ['auth'], destroy: ['auth', 'role:admin'] }`
 *
 * reads as everyone signed in may read and write, and only an admin may delete.
 * Declaring an ability and no side leaves the other four on the secure default,
 * so narrowing one route never widens another.
 *
 * The coarse sides come back too: the boot warnings are phrased in terms of
 * reads and writes, and they stay the right granularity for "this model
 * publishes mutating routes to everyone".
 */
export function resolveAbilityMiddleware(
  useApi: unknown,
  dashboard?: unknown,
): { abilities: Record<ApiAbility, string[]>, read: string[], write: string[], declared: boolean } {
  const { read, write, declared } = resolveApiMiddleware(useApi, dashboard)
  const role = dashboardRoleMiddleware(dashboard)
  const raw = (useApi as { middleware?: unknown } | null | undefined)?.middleware
  const declaredPerAbility = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : undefined

  const abilities = {} as Record<ApiAbility, string[]>
  for (const ability of API_ABILITIES) {
    abilities[ability] = declaredPerAbility && ability in declaredPerAbility
      // The same append rules as a side: an emptied ability stays public, and
      // its own `role:` beats the one derived from `dashboard.roles`.
      ? withDashboardRole(middlewareList(declaredPerAbility[ability]), role)
      : (ABILITY_SIDE[ability] === 'read' ? read : write)
  }

  return { abilities, read, write, declared }
}

/**
 * Append a derived role entry to one side's middleware list.
 *
 * Two lists are left alone. An EMPTY one is a public surface the model asked
 * for in as many words (`middleware: []`, or `{ read: [] }` for a catalog), and
 * closing it from a sidebar field would undo a stated decision rather than
 * complete one; `describeContradictoryRoleGates` reports that pairing at boot
 * instead. A list that already names a `role:` is one the app wrote itself, and
 * explicit beats derived - which also keeps the same role from being appended
 * twice.
 */
function withDashboardRole(list: string[], role: string | null): string[] {
  if (!role || list.length === 0)
    return list

  if (list.some(entry => entry === 'role' || entry.startsWith('role:')))
    return list

  return [...list, role]
}

/**
 * The one-line-per-boot report about models whose `dashboard.roles` gates the
 * sidebar row while their own `useApi.middleware` leaves an ability public.
 *
 * `dashboard: { roles: ['admin'] }` beside `middleware: { read: [] }` says two
 * opposite things: admins only, and anyone at all. Neither half can be assumed
 * to be the mistake, so the generator honours the explicit middleware and names
 * the pairing here. Aggregated into one line for the reason the sibling
 * row-scoping report is (see `describeUnscopedMutatingModels`).
 *
 * Named per ability rather than per side, because that is the granularity the
 * middleware resolves at: `middleware: { destroy: [] }` opens one route, and
 * saying "write" would overstate it by two.
 *
 * Returns null when there is nothing to report, so the caller logs nothing.
 */
export function describeContradictoryRoleGates(
  entries: ReadonlyArray<{ model: string, abilities: readonly string[] }>,
): string | null {
  if (entries.length === 0)
    return null

  const named = [...entries]
    .sort((a, b) => a.model.localeCompare(b.model))
    .map(entry => `${entry.model} (${[...entry.abilities].join(', ')})`)
    .join(', ')

  return `[orm] ${entries.length} model(s) role-gate their sidebar row and publish part of the matching API to everyone, `
    + `because \`useApi.middleware\` declares those abilities empty - ${named}. `
    + `Drop the empty list to let \`dashboard.roles\` gate them, or set \`dashboard.enforce: false\` to keep the row hidden and the API public.`
}

/**
 * The policy ability each generated route asks about.
 *
 * Matches the `Policy` interface in `@stacksjs/auth` rather than this file's
 * own {@link API_ABILITIES}: a policy speaks Nova's vocabulary, where reading a
 * collection is `viewAny` and reading one row is `view`.
 */
export const POLICY_ABILITY: Record<ApiAbility, 'viewAny' | 'view' | 'create' | 'update' | 'delete'> = {
  index: 'viewAny',
  show: 'view',
  store: 'create',
  update: 'update',
  destroy: 'delete',
}

/** What a policy answered, flattened to what a route handler needs. */
export interface PolicyVerdict {
  status: 403
  message: string
}

/**
 * As much of `@stacksjs/auth`'s Gate as a policy check needs.
 *
 * `user` is `any` rather than `unknown` on purpose. This is a structural
 * description of a module this package must not import - the auth package
 * imports the ORM's types - and the real `inspectFor` takes `UserModel | null`,
 * which an `unknown` parameter is not assignable to. `authedUserFromRequest`
 * already hands the user across the same boundary the same way.
 */
export interface PolicyGate {
  hasPolicy: (model: string) => boolean
  inspectFor: (model: string, ability: string, user: any, ...args: any[]) => Promise<{ isAllowed: boolean, message?: string } | null>
}

/** The two things a policy check needs from the outside world. */
export interface PolicyGateDeps {
  /**
   * The Gate, or null when `@stacksjs/auth` cannot be loaded at all.
   *
   * Null is not a denial. The policy registry lives in that module, so if it
   * cannot be loaded then no policy can have been registered either, and there
   * is nothing to enforce. `authedUserFromRequest` treats the same failure the
   * same way.
   */
  gate: () => Promise<PolicyGate | null>
  /** The caller. Resolved only once a policy is known to exist, since it costs a token lookup and a query. */
  user: () => Promise<any>
}

/**
 * Consult a model's policy for one ability (stacksjs/stacks#2883).
 *
 * `policy.ts` declared Nova's vocabulary and nothing consulted it, because
 * nothing could: resolution keyed on `args[0].constructor.name` and the
 * generated handlers hold rows the query builder returned, whose constructor is
 * `Object`. `Gate.inspectFor` resolves by model name, and this turns its
 * three-state answer into the one thing a handler needs.
 *
 * Returns null to mean "nothing about this request changes", for both of the
 * cases where that is right: no policy registered (the state all 107 framework
 * models and every existing app are in, which is what keeps this from being a
 * breaking change) and a policy that allowed it.
 *
 * Dependency-injected rather than importing the Gate itself, so the three
 * decisions here - skip when unpoliced, fail open when the module is missing,
 * fail closed when a policy throws - are testable without an auth module, a
 * database or an HTTP request. The handlers are not.
 */
export async function policyDecision(
  modelName: string,
  ability: 'viewAny' | 'view' | 'create' | 'update' | 'delete',
  deps: PolicyGateDeps,
  subject?: unknown,
): Promise<PolicyVerdict | null> {
  let gate: PolicyGate | null
  try {
    gate = await deps.gate()
  }
  catch {
    return null
  }

  if (!gate || !gate.hasPolicy(modelName))
    return null

  try {
    const user = await deps.user()
    const verdict = subject === undefined
      ? await gate.inspectFor(modelName, ability, user)
      : await gate.inspectFor(modelName, ability, user, subject)

    if (verdict && !verdict.isAllowed)
      return { status: 403, message: verdict.message || 'This action is unauthorized.' }

    return null
  }
  catch {
    // A model that HAS a policy, whose answer we failed to get. The opposite
    // case to a missing module: there is something to enforce and we could not,
    // so this one fails closed.
    return { status: 403, message: 'This action is unauthorized.' }
  }
}

// Default page size for the auto-CRUD index route. Matches the
// request-aware Model.paginate() / resolvePageArgs default (15) so the
// REST list endpoint and the in-process paginator agree out of the box.
export const INDEX_DEFAULT_PER_PAGE = 15
// Upper bound on ?per_page= so a single request can't ask for an
// unbounded page and exhaust memory.
export const INDEX_MAX_PER_PAGE = 100

/**
 * Resolve `?page=` / `?per_page=` for the index route into a clamped,
 * NaN-safe `{ page, perPage, offset }`.
 *
 * - `page` is clamped to `>= 1` (a `?page=0` / negative would otherwise
 *   produce a negative OFFSET), defaulting to 1 on missing/NaN.
 * - `perPage` defaults to {@link INDEX_DEFAULT_PER_PAGE}, is clamped to
 *   `>= 1`, and capped at {@link INDEX_MAX_PER_PAGE}.
 */
export function resolveIndexPageArgs(params: URLSearchParams): { page: number, perPage: number, offset: number } {
  const pageRaw = Number.parseInt(params.get('page') || String(1), 10)
  const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1
  const perPageRaw = Number.parseInt(params.get('per_page') || String(INDEX_DEFAULT_PER_PAGE), 10)
  const perPage = Math.min(Number.isFinite(perPageRaw) ? Math.max(1, perPageRaw) : INDEX_DEFAULT_PER_PAGE, INDEX_MAX_PER_PAGE)
  return { page, perPage, offset: (page - 1) * perPage }
}

/**
 * Pagination `meta` for the auto-CRUD index envelope (`{ data, meta }`).
 *
 * Always carries `page` / `per_page` / `from` / `to` / `has_more_pages`
 * plus `prev_page_url` / `next_page_url`. `total` / `last_page` and the
 * `first_page_url` / `last_page_url` are added only when a total is known
 * (`?with_count=true`).
 */
export interface IndexPageMeta {
  page: number
  per_page: number
  from: number | null
  to: number | null
  has_more_pages: boolean
  prev_page_url: string | null
  next_page_url: string | null
  total?: number
  last_page?: number
  first_page_url?: string
  last_page_url?: string
}

// Build a URL string preserving every existing query param on `url`,
// overriding only `page`. Returns `pathname + search` (relative) so the
// caller doesn't leak the host. Standalone (not the request-context-coupled
// buildUrl in paginator-request.ts) because the index route already holds
// `new URL(req.url)` and the canonical routes.ts copy can't import ./src/*.
function pageUrl(url: URL, page: number): string {
  const out = new URL(url.toString())
  out.searchParams.set('page', String(page))
  return `${out.pathname}${out.search}`
}

/**
 * Build the index pagination `meta`. `hasMore` is the source of truth for
 * "is there a next page" (derived by the route from a `LIMIT perPage + 1`
 * probe fetch), so `next_page_url` stays consistent whether or not a total
 * was counted. When `total` is known, `last_page` uses the
 * `Math.max(1, ceil(total / perPage))` floor from the Paginator interface.
 */
export function buildIndexMeta(
  url: URL,
  page: number,
  perPage: number,
  rowCount: number,
  hasMore: boolean,
  total?: number,
): IndexPageMeta {
  const offset = (page - 1) * perPage
  const empty = rowCount === 0
  const meta: IndexPageMeta = {
    page,
    per_page: perPage,
    from: empty ? null : offset + 1,
    to: empty ? null : offset + rowCount,
    has_more_pages: hasMore,
    prev_page_url: page > 1 ? pageUrl(url, page - 1) : null,
    next_page_url: hasMore ? pageUrl(url, page + 1) : null,
  }
  if (total !== undefined && !Number.isNaN(total)) {
    const lastPage = Math.max(1, Math.ceil(total / perPage))
    meta.total = total
    meta.last_page = lastPage
    meta.first_page_url = pageUrl(url, 1)
    meta.last_page_url = pageUrl(url, lastPage)
  }
  return meta
}

/**
 * Flat Laravel paginator shape lifted to the index response top level.
 * Mirrors {@link IndexPageMeta} minus `data`/`path` (the route spreads this
 * alongside its own `data`), but keys the current page as `current_page`
 * instead of `page` so a generated-endpoint list response deep-equals a
 * `Model.paginate()` envelope. `total` / `last_page` / `first_page_url` /
 * `last_page_url` stay gated on `total` (`?with_count=true`), matching
 * {@link SimplePaginator} when absent.
 */
export interface IndexPaginator {
  current_page: number
  per_page: number
  from: number | null
  to: number | null
  has_more_pages: boolean
  prev_page_url: string | null
  next_page_url: string | null
  total?: number
  last_page?: number
  first_page_url?: string
  last_page_url?: string
}

/**
 * Flat Laravel paginator shape for the index response top level. Same values
 * as {@link buildIndexMeta} but keyed `current_page` (not `page`) so a
 * generated-endpoint list response deep-equals a `Model.paginate()` envelope.
 * The `page` -> `current_page` rename is the only delta; the value math lives
 * solely in `buildIndexMeta`.
 */
export function buildIndexPaginator(
  url: URL,
  page: number,
  perPage: number,
  rowCount: number,
  hasMore: boolean,
  total?: number,
): IndexPaginator {
  const { page: currentPage, ...rest } = buildIndexMeta(url, page, perPage, rowCount, hasMore, total)
  return { current_page: currentPage, ...rest }
}

/**
 * What to do about a model whose generated mutating routes have no row-level
 * scoping. See `ApiSecurityOptions` in @stacksjs/types for the full reasoning.
 */
export type ApiRowScopingPolicy = 'warn' | 'deny'

/**
 * Resolve the row-scoping policy from config, with an env override.
 *
 * `'warn'` is the default because anything else is a breaking change to
 * published behaviour: `'deny'` stops registering `store` / `update` /
 * `destroy` for every model that declares no ownership, which in this
 * framework's own model set is 62 of the 82 models that use the trait -
 * `User` and `Team` among them.
 *
 * The env override exists so CI can run the strict posture without editing
 * config, which is how an app finds out what it would lose before committing
 * to it. An unrecognised value falls back to the default rather than throwing:
 * a typo in a security setting should not take the API down, and the boot
 * warning still names every unscoped model either way.
 */
export function resolveRowScopingPolicy(configured: unknown, envOverride?: string | null): ApiRowScopingPolicy {
  const candidate = (envOverride ?? configured ?? '').toString().trim().toLowerCase()
  // Defaults to 'deny' (stacksjs/stacks#2375). Anything unrecognised - an empty
  // config, a typo - lands on the safe side rather than the permissive one,
  // which is the whole point of flipping it.
  return candidate === 'warn' ? 'warn' : 'deny'
}

/**
 * The one-line-per-boot report about models publishing unscoped mutating routes.
 *
 * Aggregated deliberately. The sibling warning about public reads was demoted
 * to `debug` because 15 lines on every boot about intended behaviour is how a
 * warning stops being read; 62 lines would be worse. One line that names the
 * count, the models and the two ways to fix it stays readable and stays
 * actionable.
 *
 * Returns null when there is nothing to report, so the caller logs nothing.
 */
export function describeUnscopedMutatingModels(
  modelNames: readonly string[],
  policy: ApiRowScopingPolicy,
): string | null {
  if (modelNames.length === 0)
    return null

  const names = [...modelNames].sort().join(', ')

  if (policy === 'deny') {
    return `[orm] security.api.rowScoping is 'deny': NOT registering store/update/destroy for ${modelNames.length} model(s) `
      + `with no row-level scoping — ${names}. Give a model an \`ownership\` config or a \`team_id\` column to restore its writes.`
  }

  return `[orm] ${modelNames.length} model(s) publish mutating routes with no row-level scoping, so an authenticated caller can write any row — `
    + `${names}. Scope one with an \`ownership\` config or a \`team_id\` column; intended for public catalog tables. `
    + `Set \`security.api.rowScoping: 'deny'\` (config/security.ts) to stop generating these routes instead.`
}
