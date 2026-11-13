/**
 * The filters a model's list offers, and how each narrows the query.
 *
 * Nothing declares a filter. A model already says what its fields are, and
 * that is enough to know which of them a list is worth narrowing by and how
 * to ask: a field with a few allowed values is chosen from them, a yes-or-no
 * is yes or no, a field that points at another record is that record, a
 * moment is a range of days. Three things the model already says decide it:
 *
 *  - **what the field is**, from its validation rule;
 *  - **what the author thinks results are narrowed by**:
 *    `traits.useSearch.filterable`, written for the search engine and true
 *    of a list as well;
 *  - **what must stay private**: a hidden column is never offered, since
 *    narrowing by a value is a way to read it.
 *
 * `dashboard.filters` is the override, in the vocabulary `dashboard.columns`
 * uses: the fields to offer, in order.
 *
 * Free text is not a filter. That is what the search box is for, and a box
 * that only finds an exact match (which is what every column had) finds
 * nothing for "act" under Status.
 */
import { db, sqlDateTime } from '@stacksjs/database/runtime'
import { belongsToRelations } from './model-relations'
import { humanizeIdentifier, modelColumnLabel, modelFieldType } from './model-write'

/** How a filter is asked for. `text` is an exact value: only for a field the model named. */
export type ModelFilterKind = 'choice' | 'boolean' | 'relation' | 'date' | 'datetime' | 'number' | 'text'

export interface ModelFilter {
  /** The column it narrows. */
  name: string
  label: string
  kind: ModelFilterKind
  /** For `choice`: the values the field may hold, as stored and as read. */
  options?: Array<{ value: string, label: string }>
  /**
   * For `choice`: the options are the values the table holds now, not ones
   * the model's rule limits the field to. A value that is not among them
   * matches nothing; it is not refused, since the list can be a moment old.
   */
  open?: boolean
  /** For `relation`: the model the column points at, to pick a record of. */
  relation?: { slug: string, label: string }
}

/**
 * A filter's value as it arrives. Plain text is "exactly this" (which is
 * what a link from a record's panel sends: `{ team_id: "3" }`). The rest say
 * how: any of several, between two moments, between two numbers.
 */
export type ModelFilterValue = string | { in: string[] } | { from?: string, to?: string } | { min?: number, max?: number }

/** The most values one "any of" may carry. */
const IN_LIMIT = 50

function snakeCase(name: string): string {
  return name.replace(/([a-z\d])([A-Z])/g, '$1_$2').toLowerCase()
}

/** A model's attributes by the column each is stored in. */
function attributesByColumn(Model: any): Map<string, { name: string, definition: any }> {
  const byColumn = new Map<string, { name: string, definition: any }>()
  for (const [name, definition] of Object.entries((Model?.attributes ?? {}) as Record<string, any>))
    byColumn.set(snakeCase(name), { name, definition })
  return byColumn
}

/** The columns a model's own search trait says results are narrowed by. */
function searchFilterable(Model: any): string[] {
  const names = Model?.traits?.useSearch?.filterable
  return Array.isArray(names) ? names.filter((name): name is string => typeof name === 'string' && name.trim() !== '').map(name => snakeCase(name.trim())) : []
}

/**
 * The filters a model's list offers, of the columns the page may see.
 *
 * `allowed` is those columns: the list endpoint has already left out the
 * hidden ones, so a filter is never built for a column it does not hold.
 */
export function modelFilters(Model: any, allowed: readonly string[]): { filters: ModelFilter[], problems: string[] } {
  const attributes = attributesByColumn(Model)
  const relations = belongsToRelations(Model)
  const has = (column: string) => allowed.includes(column)
  const problems: string[] = []

  /** The filter for one column, or null when its kind is not one a list narrows by. */
  const filterFor = (column: string, named: boolean): ModelFilter | null => {
    if (!has(column))
      return null
    const relation = relations.find(candidate => candidate.column === column)
    const label = modelColumnLabel(Model, column, relation ? humanizeIdentifier(relation.model) : undefined)
    if (relation)
      return { name: column, label, kind: 'relation', relation: { slug: relation.slug, label: humanizeIdentifier(relation.model) } }
    // The columns a trait adds, which the model's attributes do not list.
    if (column === 'created_at' || column === 'updated_at' || column === 'deleted_at')
      return { name: column, label, kind: 'datetime' }

    const attribute = attributes.get(column)
    if (!attribute)
      return null
    const kind = modelFieldType(attribute.name, attribute.definition)
    if (kind === 'enum') {
      const values: unknown[] = attribute.definition?.validation?.rule?.allowedValues ?? []
      return { name: column, label, kind: 'choice', options: values.map(value => ({ value: String(value), label: humanizeIdentifier(String(value)) })) }
    }
    if (kind === 'boolean')
      return { name: column, label, kind: 'boolean' }
    if (kind === 'date' || kind === 'datetime')
      return { name: column, label, kind }
    // A number or a line of text is only a filter when the model names it:
    // every count and every name would otherwise be one.
    if (kind === 'number')
      return named ? { name: column, label, kind: 'number' } : null
    if (kind === 'text' || kind === 'email' || kind === 'url')
      return named ? { name: column, label, kind: 'text' } : null
    // Prose and structures are searched, not filtered.
    return null
  }

  /** A declared name, as `dashboard.columns` reads one: an attribute, a column, or a `belongsTo`. */
  const resolve = (name: string): string | null => {
    const column = snakeCase(name.trim())
    const relation = relations.find(candidate => candidate.column === `${column}_id` || snakeCase(candidate.model) === column)
    return has(column) ? column : relation && has(relation.column) ? relation.column : null
  }

  const declared = Model?.dashboard?.filters
  if (Array.isArray(declared)) {
    const filters: ModelFilter[] = []
    for (const name of declared) {
      if (typeof name !== 'string' || !name.trim()) {
        problems.push('an entry is not a field name')
        continue
      }
      const column = resolve(name)
      const filter = column ? filterFor(column, true) : null
      if (!column)
        problems.push(`'${name}' is not a field the list has`)
      else if (!filter)
        problems.push(`'${name}' is prose or a structure, which a list is searched for and not filtered by`)
      else if (!filters.some(existing => existing.name === filter.name))
        filters.push(filter)
    }
    return { filters, problems }
  }

  // Derived. The ones the model's search trait names come first, then the
  // rest in the order that reads best in a menu: what a record is, what it
  // points at, when it happened.
  const filters: ModelFilter[] = []
  const add = (filter: ModelFilter | null) => {
    if (filter && !filters.some(existing => existing.name === filter.name))
      filters.push(filter)
  }
  for (const name of searchFilterable(Model)) {
    const column = resolve(name)
    if (column)
      add(filterFor(column, true))
  }
  const derived = allowed.map(column => filterFor(column, false)).filter((filter): filter is ModelFilter => filter !== null)
  for (const kind of ['choice', 'boolean', 'relation', 'date', 'datetime'] as const) {
    for (const filter of derived.filter(candidate => candidate.kind === kind))
      add(filter)
  }
  return { filters, problems }
}

/**
 * The columns a list may be ordered by, of the ones the page may see.
 *
 * Any stored value that has an order a person would recognise. Not prose or
 * a structure, and not a column that points at another record: the cell
 * shows that record's name, and ordering by its id would look random.
 */
export function modelSortableColumns(Model: any, allowed: readonly string[]): string[] {
  const attributes = attributesByColumn(Model)
  const relations = new Set(belongsToRelations(Model).map(relation => relation.column))
  return allowed.filter((column) => {
    if (relations.has(column))
      return false
    const attribute = attributes.get(column)
    if (!attribute)
      return true
    const kind = modelFieldType(attribute.name, attribute.definition)
    return kind !== 'json' && kind !== 'longtext' && kind !== 'markdown'
  })
}

/** The most distinct values a field of text may hold and still be chosen from. */
const CHOICE_LIMIT = 20
/** How long a table's distinct values are remembered. */
const CHOICES_TTL = 30_000
const storedChoices = new Map<string, { at: number, values: string[] | null }>()

/** The distinct values a column holds, up to `limit`. */
async function distinctValues(table: string, column: string, limit: number): Promise<unknown[]> {
  const rows = await db.selectFrom(table as never).select([column] as never).groupBy(column as never).limit(limit).execute() as Array<Record<string, unknown>>
  return rows.map(row => row[column])
}

/**
 * Turn a field of text the model named into a choice, when the table holds
 * few enough values to choose from.
 *
 * A model can name `status` as something results are narrowed by without
 * limiting what it holds (`schema.string()`). Asked for as text, it would be
 * a box that finds only an exact match. What the table holds says what there
 * is to choose: "active" and "inactive". A field with many values (a
 * `source` of a thousand referrers) stays a box.
 *
 * Remembered for half a minute per column: the list is read on every page,
 * sort and keystroke, and a distinct read of a column with no index reads
 * the whole table.
 */
export async function withStoredChoices(
  table: string,
  filters: ModelFilter[],
  read: (table: string, column: string, limit: number) => Promise<unknown[]> = distinctValues,
  now: number = Date.now(),
): Promise<ModelFilter[]> {
  const out: ModelFilter[] = []
  for (const filter of filters) {
    if (filter.kind !== 'text') {
      out.push(filter)
      continue
    }
    const key = `${table}.${filter.name}`
    let known = storedChoices.get(key)
    if (!known || now - known.at > CHOICES_TTL) {
      let values: string[] | null = null
      try {
        const found = (await read(table, filter.name, CHOICE_LIMIT + 1))
          .filter(value => value !== null && value !== undefined && String(value) !== '')
          .map(String)
        values = found.length > 0 && found.length <= CHOICE_LIMIT ? [...new Set(found)].sort((a, b) => a.localeCompare(b)) : null
      }
      catch {
        // The field is still a filter; it is just asked for as text.
        values = null
      }
      known = { at: now, values }
      storedChoices.set(key, known)
    }
    out.push(known.values
      ? { ...filter, kind: 'choice', open: true, options: known.values.map(value => ({ value, label: humanizeIdentifier(value) })) }
      : filter)
  }
  return out
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** `filters` arrives as a JSON object so column names stay unambiguous. */
export function parseFilters(raw: string | null): Record<string, ModelFilterValue> {
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

  if (!isPlainObject(parsed))
    throw new TypeError('Model filters must be a JSON object')

  const entries = Object.entries(parsed)
  if (entries.length > 50)
    throw new TypeError('Model filters may contain at most 50 columns')

  const out: Record<string, ModelFilterValue> = {}
  for (const [key, value] of entries) {
    if (!/^\w+$/.test(key))
      throw new TypeError(`Invalid model filter column "${key}"`)
    if (value === null || value === undefined || value === '')
      continue
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = String(value)
      continue
    }
    if (!isPlainObject(value))
      throw new TypeError(`Model filter "${key}" must be a value, or an object saying how to compare`)

    const keys = Object.keys(value)
    if (keys.length === 1 && keys[0] === 'in') {
      const list = value.in
      if (!Array.isArray(list) || list.some(item => typeof item !== 'string' && typeof item !== 'number'))
        throw new TypeError(`Model filter "${key}" must list the values to match`)
      if (list.length > IN_LIMIT)
        throw new TypeError(`Model filter "${key}" may list at most ${IN_LIMIT} values`)
      const values = [...new Set(list.map(String).filter(item => item !== ''))]
      if (values.length > 0)
        out[key] = { in: values }
      continue
    }
    if (keys.length > 0 && keys.every(name => name === 'from' || name === 'to')) {
      const range: { from?: string, to?: string } = {}
      for (const edge of ['from', 'to'] as const) {
        const moment = value[edge]
        if (moment === undefined || moment === null || moment === '')
          continue
        if (typeof moment !== 'string' || moment.length > 40)
          throw new TypeError(`Model filter "${key}" ${edge} must be a date`)
        range[edge] = moment
      }
      if (range.from !== undefined || range.to !== undefined)
        out[key] = range
      continue
    }
    if (keys.length > 0 && keys.every(name => name === 'min' || name === 'max')) {
      const range: { min?: number, max?: number } = {}
      for (const edge of ['min', 'max'] as const) {
        const amount = value[edge]
        if (amount === undefined || amount === null || amount === '')
          continue
        const number = typeof amount === 'number' ? amount : typeof amount === 'string' && amount.trim() !== '' ? Number(amount) : Number.NaN
        if (!Number.isFinite(number))
          throw new TypeError(`Model filter "${key}" ${edge} must be a number`)
        range[edge] = number
      }
      if (range.min !== undefined || range.max !== undefined)
        out[key] = range
      continue
    }
    throw new TypeError(`Model filter "${key}" is not a comparison the list has: use a value, { in }, { from, to } or { min, max }`)
  }
  return out
}

/** A day as a date column stores it. */
const DAY = /^\d{4}-\d{2}-\d{2}$/

/** A model's query, as far as a filter needs it. */
interface FilterQuery {
  where: (...args: any[]) => FilterQuery
  whereIn: (column: string, values: unknown[]) => FilterQuery
}

/**
 * Narrow a query by the filters that arrived, or say why one cannot be
 * applied. Every column has already been checked against the ones the page
 * may see; what is checked here is that the comparison suits the field.
 */
export function applyModelFilters<Query extends FilterQuery>(
  query: Query,
  values: Record<string, ModelFilterValue>,
  filters: readonly ModelFilter[],
  label: (column: string) => string = column => column,
): { query: Query, error: string | null } {
  let chain: FilterQuery = query
  for (const [column, value] of Object.entries(values)) {
    const filter = filters.find(candidate => candidate.name === column)
    const called = filter?.label ?? label(column)
    // Any column the page may see can be matched exactly, as a link from a
    // record's panel does. Comparing another way is for the list's filters.
    if (!filter && typeof value !== 'string')
      return { query, error: `${called} is not one of this list's filters, so it can only be matched exactly.` }

    if (typeof value === 'string') {
      if (filter?.kind === 'boolean') {
        const yes = ['true', '1', 'yes'].includes(value.toLowerCase())
        if (!yes && !['false', '0', 'no'].includes(value.toLowerCase()))
          return { query, error: `${called} is yes or no.` }
        chain = chain.where(column, yes)
      }
      else if (filter?.kind === 'choice' && !filter.open && !filter.options!.some(option => option.value === value)) {
        return { query, error: `${called} cannot be "${value}".` }
      }
      else {
        chain = chain.where(column, value)
      }
      continue
    }

    if ('in' in value) {
      if (filter!.kind !== 'choice' && filter!.kind !== 'relation' && filter!.kind !== 'text')
        return { query, error: `${called} cannot be matched against a list of values.` }
      if (filter!.kind === 'choice' && !filter!.open) {
        const unknown = value.in.find(item => !filter!.options!.some(option => option.value === item))
        if (unknown !== undefined)
          return { query, error: `${called} cannot be "${unknown}".` }
      }
      chain = chain.whereIn(column, value.in)
      continue
    }

    if ('from' in value || 'to' in value) {
      if (filter!.kind !== 'date' && filter!.kind !== 'datetime')
        return { query, error: `${called} is not a date, so it has no range of days.` }
      for (const edge of ['from', 'to'] as const) {
        const given = value[edge]
        if (given === undefined)
          continue
        if (filter!.kind === 'date') {
          // A day, compared as the column stores days: both ends included.
          if (!DAY.test(given) || Number.isNaN(Date.parse(given)))
            return { query, error: `${called} ${edge} must be a day, as 2026-01-31.` }
          chain = chain.where(column, edge === 'from' ? '>=' : '<=', given)
        }
        else {
          // A moment. The page sends where the viewer's day starts and where
          // the day after their last one does, so "to" is not included.
          const moment = new Date(given)
          if (Number.isNaN(moment.getTime()))
            return { query, error: `${called} ${edge} must be a date and time.` }
          chain = chain.where(column, edge === 'from' ? '>=' : '<', sqlDateTime(moment))
        }
      }
      continue
    }

    if (filter!.kind !== 'number')
      return { query, error: `${called} is not a number, so it has no minimum or maximum.` }
    const range = value as { min?: number, max?: number }
    if (range.min !== undefined)
      chain = chain.where(column, '>=', range.min)
    if (range.max !== undefined)
      chain = chain.where(column, '<=', range.max)
  }
  return { query: chain as Query, error: null }
}
