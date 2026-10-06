import type { CreateIndexOptions, SearchEngineDriver, SearchEngineSearchParams, SearchFilter } from '@stacksjs/types'
import type {
  EnqueuedTask,
  Index,
  IndexesResults,
  SearchResponse,
  Settings,
  Synonyms,
} from 'meilisearch'
import { searchEngine } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { assertSafeField, DEFAULT_SEARCH_LIMIT, isObjectFilter, resolveSearchParams, sortToList } from '../params'

type TypesenseConfig = {
  host: string
  port: number
  protocol: string
  apiKey: string
}

let _config: TypesenseConfig | null = null

function config(): TypesenseConfig {
  if (!_config) {
    const host = searchEngine.typesense?.host || process.env.TYPESENSE_HOST || '127.0.0.1'
    const port = searchEngine.typesense?.port || Number(process.env.TYPESENSE_PORT || 8108)
    const protocol = searchEngine.typesense?.protocol || process.env.TYPESENSE_PROTOCOL || 'http'
    const apiKey = searchEngine.typesense?.apiKey || process.env.TYPESENSE_API_KEY || 'xyz'

    _config = { host, port, protocol, apiKey }
  }

  return _config
}

function baseUrl(): string {
  const { protocol, host, port } = config()
  return `${protocol}://${host}:${port}`
}

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-TYPESENSE-API-KEY': config().apiKey,
  }
}

function fakeTask(indexUid: string): EnqueuedTask {
  return {
    taskUid: 0,
    indexUid,
    status: 'succeeded',
    type: 'documentAddition',
    enqueuedAt: new Date(),
  } as unknown as EnqueuedTask
}

class TypesenseRequestError extends Error {
  constructor(
    public status: number,
    method: string,
    path: string,
    detail: string,
  ) {
    super(`[search/typesense] ${method} ${path} failed (${status}): ${detail}`)
  }
}

function isNotFound(error: unknown): boolean {
  return error instanceof TypesenseRequestError && error.status === 404
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: headers(),
    body: body == null ? undefined : JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new TypesenseRequestError(res.status, method, path, text)
  }

  if (res.status === 204) return undefined as T
  return await res.json() as T
}

function collectionPath(name: string): string {
  return `/collections/${encodeURIComponent(name)}`
}

/**
 * The contract's filter as a Typesense `filter_by`.
 *
 * A string is already Typesense syntax and an array is several clauses that
 * must all hold; both pass through. An object is `{ field: value }`, with the
 * field names checked and the values backtick-quoted; an array value means any
 * of them. Empty values are skipped, as they always were here.
 */
function convertToFilterBy(filter: SearchFilter | undefined): string | undefined {
  if (filter == null || filter === '')
    return undefined
  if (typeof filter === 'string')
    return filter
  if (Array.isArray(filter))
    return filter.map(clause => Array.isArray(clause) ? `(${clause.join(' || ')})` : clause).filter(Boolean).join(' && ') || undefined
  if (!isObjectFilter(filter))
    throw new TypeError(`[search/typesense] Unsupported filter: ${JSON.stringify(filter)}`)

  const quote = (value: unknown) => `\`${String(value).replace(/`/g, '\\`')}\``
  const parts: string[] = []

  for (const [key, value] of Object.entries(filter)) {
    assertSafeField('typesense', key)
    if (value == null || value === '') continue
    parts.push(Array.isArray(value) ? `${key}:=[${value.map(quote).join(',')}]` : `${key}:=${quote(value)}`)
  }

  return parts.length ? parts.join(' && ') : undefined
}

/**
 * Map a sample value onto a Typesense field type.
 *
 * This used to answer 'string' for everything, which types a price column as
 * text: `sort_by=price:asc` then orders it lexicographically, so 1000 sorts
 * before 900, and a numeric `filter_by` range matches nothing.
 */
function inferFieldType(value: unknown): string {
  if (typeof value === 'boolean')
    return 'bool'

  if (typeof value === 'number')
    return Number.isInteger(value) ? 'int64' : 'float'

  if (Array.isArray(value)) {
    const first = value[0]
    if (typeof first === 'boolean')
      return 'bool[]'
    if (typeof first === 'number')
      return Number.isInteger(first) ? 'int64[]' : 'float[]'
    return 'string[]'
  }

  return 'string'
}

interface TypesenseField {
  name: string
  type: string
  facet?: boolean
  sort?: boolean
  optional?: boolean
  [key: string]: unknown
}

interface TypesenseCollection {
  name: string
  fields?: TypesenseField[]
}

/**
 * The settings each index has been given, merged across calls.
 *
 * A Typesense collection can only be created from a document, because only a
 * document knows each field's type. Settings synced before the first write -
 * which is what `search-engine:update` and the import command both do - used
 * to be applied to a collection that did not exist yet and then forgotten, so
 * the collection the first write created had no facets and filtering on any
 * declared `filterable` field failed. They are kept here until the collection
 * exists, and reconciled against its schema once it does.
 */
const indexSettings = new Map<string, Settings>()

function rememberSettings(index: string, settings?: Settings): Settings {
  const merged: Settings = { ...indexSettings.get(index) }
  for (const [key, value] of Object.entries(settings ?? {})) {
    if (value !== undefined)
      (merged as Record<string, unknown>)[key] = value
  }
  indexSettings.set(index, merged)
  return merged
}

function attributeNames(list: Settings['searchableAttributes'] | Settings['filterableAttributes'] | undefined | null): string[] {
  const names: string[] = []
  for (const entry of list ?? []) {
    if (typeof entry === 'string') names.push(entry)
    else names.push(...entry.attributePatterns)
  }
  return names
}

/**
 * One value per field, taken from the first document that has one.
 *
 * The schema used to be inferred from the first row alone. A column that was
 * null there - an optional rating, an image not uploaded yet - was dropped by
 * `normalizeDocument`, defaulted to '' and typed `string`, and every later row
 * carrying a number for it was refused. An empty array is used only when no
 * document has a non-empty one, since it says nothing about the element type.
 */
function mergeSample(docs: Record<string, unknown>[]): Record<string, unknown> {
  const sample: Record<string, unknown> = {}
  for (const doc of docs) {
    for (const [key, value] of Object.entries(doc)) {
      if (value == null) continue
      const current = sample[key]
      if (current === undefined || (Array.isArray(current) && current.length === 0 && Array.isArray(value) && value.length > 0))
        sample[key] = value
    }
  }
  return sample
}

/**
 * A field declaration.
 *
 * `sort` is set only when the field was declared sortable. It used to be
 * written out as `sort: false` for every other field, and Typesense's default
 * is `true` for numbers - so declaring one sortable field switched sorting off
 * on every other numeric column, including the default sorting field.
 */
function fieldFor(name: string, value: unknown, settings: Settings): TypesenseField {
  const field: TypesenseField = {
    name,
    type: name === 'id' ? 'string' : inferFieldType(value ?? ''),
    facet: attributeNames(settings.filterableAttributes).includes(name),
    optional: name !== 'id',
  }
  if (attributeNames(settings.sortableAttributes).includes(name))
    field.sort = true
  return field
}

async function fetchCollection(indexName: string): Promise<TypesenseCollection | undefined> {
  try {
    return await request<TypesenseCollection>('GET', collectionPath(indexName))
  }
  catch (error) {
    // Only "not there" means create it. Any other failure - a bad key, the
    // node down - used to be read the same way, and the create that followed
    // failed with a message about the collection already existing.
    if (isNotFound(error)) return undefined
    throw error
  }
}

/**
 * The PATCH that brings an existing collection in line with the settings and
 * with the documents about to be written.
 *
 * A field whose facet or sort flag has to change is dropped and re-added in the
 * same request, which is how Typesense alters a field. A document field the
 * schema lacks is added, typed from the documents. A declared attribute no
 * document has carried yet is left out, because nothing yet says its type.
 */
type FieldChange = TypesenseField | { name: string, drop: true }

/**
 * A field re-declared with new flags. Only the properties that shape indexing
 * are carried over; the rest of what `GET /collections` reports is read-only
 * or engine bookkeeping.
 */
function redeclare(field: TypesenseField, facet: boolean, sort: boolean | undefined): TypesenseField {
  const next: TypesenseField = { name: field.name, type: field.type, facet, optional: field.optional ?? true }
  if (sort !== undefined) next.sort = sort
  if (field.index === false) next.index = false
  if (field.infix === true) next.infix = true
  if (typeof field.locale === 'string' && field.locale !== '') next.locale = field.locale
  return next
}

function schemaPatch(existing: TypesenseField[], sample: Record<string, unknown>, settings: Settings): FieldChange[] {
  const patch: FieldChange[] = []
  const known = new Set(existing.map(f => f.name))
  const filterableDeclared = settings.filterableAttributes != null
  const filterable = attributeNames(settings.filterableAttributes)
  const sortable = attributeNames(settings.sortableAttributes)

  for (const field of existing) {
    if (field.name === 'id' || field.name.includes('*')) continue
    const facet = filterableDeclared ? filterable.includes(field.name) : Boolean(field.facet)
    const sort = sortable.includes(field.name) ? true : field.sort
    if (facet !== Boolean(field.facet) || sort !== field.sort)
      patch.push({ name: field.name, drop: true }, redeclare(field, facet, sort))
  }

  for (const [name, value] of Object.entries(sample)) {
    if (name === 'id' || known.has(name)) continue
    patch.push(fieldFor(name, value, settings))
  }

  return patch
}

/**
 * Make sure the collection exists and its schema matches what is declared.
 *
 * With no document there is nothing to type the fields from, so a missing
 * collection is left missing and created by the first write, using the
 * settings remembered for it. An existing one is patched in place.
 */
async function ensureCollection(indexName: string, docs?: Record<string, unknown>[], settings?: Settings): Promise<void> {
  const effective = rememberSettings(indexName, settings)
  const sample = mergeSample(docs ?? [])
  const existing = await fetchCollection(indexName)

  if (existing) {
    const patch = schemaPatch(existing.fields ?? [], sample, effective)
    if (patch.length > 0)
      await request('PATCH', collectionPath(indexName), { fields: patch })
    return
  }

  if (!docs || docs.length === 0)
    return

  const fieldNames = new Set<string>(['id'])
  for (const name of [
    ...attributeNames(effective.searchableAttributes),
    ...attributeNames(effective.filterableAttributes),
    ...attributeNames(effective.sortableAttributes),
    ...attributeNames(effective.displayedAttributes),
    ...Object.keys(sample),
  ]) fieldNames.add(name)

  await request('POST', '/collections', {
    name: indexName,
    fields: [...fieldNames].map(name => fieldFor(name, sample[name], effective)),
  })
}

/**
 * Only `id` is coerced to a string, because Typesense requires that one to be
 * a string. Numbers stay numbers.
 *
 * Stringifying every number meant a document's price arrived as "1200" against
 * a field typed from the same stringified sample, so the collection had no
 * numeric fields at all and neither sorting nor range filters worked on them.
 * bigint still has to be stringified: JSON.stringify throws on it.
 */
function normalizeDocument(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(doc)) {
    if (value == null) continue
    if (key === 'id' || typeof value === 'bigint') {
      out[key] = String(value)
    }
    else {
      out[key] = value
    }
  }
  if (doc.id != null && out.id == null) out.id = String(doc.id)
  return out
}

function queryByFrom(params: SearchEngineSearchParams): string | undefined {
  const raw = params.queryBy ?? params.query_by
  if (raw == null) return undefined
  return (Array.isArray(raw) ? raw.join(',') : String(raw)) || undefined
}

async function search(index: string, params: SearchEngineSearchParams = {}): Promise<SearchResponse<Record<string, any>>> {
  const { query, limit, offset, filter, sort } = resolveSearchParams(params, searchEngine.perPage ?? DEFAULT_SEARCH_LIMIT)
  const filterBy = (params.filter_by as string | undefined) || convertToFilterBy(filter)
  const sortBy = (params.sort_by as string | undefined) || sortToList('typesense', sort).join(',')

  /*
   * No `id` fallback. Typesense refuses `id` as a query field outright, so
   * defaulting to it turned "the caller did not say which fields to search"
   * into a 400 from the search node with a message about `id` - which sends
   * whoever reads it looking at the document rather than at the missing
   * parameter. Saying so here costs one line and names the actual problem.
   */
  const queryBy = queryByFrom(params)

  if (!queryBy) {
    throw new Error(
      `[search/typesense] search on "${index}" needs fields to search by. `
      + 'Pass `query_by`, or declare `searchable` on the model\'s `useSearch` trait so it can be supplied for you.',
    )
  }

  // An empty query matches everything, which Typesense spells `*`.
  const q = query === '' ? '*' : query

  const searchParams = new URLSearchParams({ q, query_by: queryBy })

  /*
   * `page` / `per_page` when the offset falls on a page boundary - which is
   * every `paginate()` call, and works on any Typesense version - and the
   * `offset` / `limit` pair otherwise. Only `page` and `per_page` used to be
   * read, so the builder's `limit` / `offset` were ignored and `.paginate(10,
   * 3)` returned the first twenty hits.
   */
  if (limit > 0 && offset % limit === 0) {
    searchParams.set('per_page', String(limit))
    searchParams.set('page', String(offset / limit + 1))
  }
  else {
    searchParams.set('offset', String(offset))
    searchParams.set('limit', String(limit))
  }

  if (filterBy) searchParams.set('filter_by', filterBy)
  if (sortBy) searchParams.set('sort_by', sortBy)

  const result = await request<{
    found: number
    hits: Array<{ document: Record<string, unknown> }>
    search_time_ms: number
  }>('GET', `${collectionPath(index)}/documents/search?${searchParams}`)

  const hits = (result.hits ?? []).map(h => h.document)

  return {
    hits,
    query: q,
    processingTimeMs: result.search_time_ms ?? 0,
    limit,
    offset,
    estimatedTotalHits: result.found ?? hits.length,
  } as SearchResponse<Record<string, any>>
}

async function addDocument(indexName: string, params: Record<string, unknown>): Promise<EnqueuedTask> {
  const doc = normalizeDocument(params)
  await ensureCollection(indexName, [doc])
  await request('POST', `${collectionPath(indexName)}/documents?action=upsert`, doc)
  return fakeTask(indexName)
}

/** A bulk import Typesense accepted with HTTP 200 and then refused, line by line. */
export class TypesenseImportError extends Error {
  constructor(
    public indexName: string,
    public failures: Array<{ id: unknown, error: string }>,
    public total: number,
  ) {
    const shown = failures.slice(0, 5).map(f => `#${String(f.id ?? '?')}: ${f.error}`).join('; ')
    const more = failures.length > 5 ? `; and ${failures.length - 5} more` : ''
    super(`[search/typesense] import into "${indexName}" rejected ${failures.length} of ${total} document(s): ${shown}${more}`)
  }
}

/**
 * Upsert a batch through `/documents/import`.
 *
 * That endpoint answers HTTP 200 whatever happens to the documents, with one
 * JSON line per document saying whether it was written. Only the status used to
 * be checked, so a batch Typesense refused in full - a field typed `string`
 * meeting a number - was reported as indexed. Every line is read now, and any
 * refusal is thrown with the ids and reasons.
 */
async function addDocuments(indexName: string, params: Record<string, unknown>[]): Promise<EnqueuedTask> {
  if (!Array.isArray(params)) throw new TypeError('[search/typesense] addDocuments requires an array of documents')
  if (params.length === 0) return fakeTask(indexName)

  const docs = params.map(normalizeDocument)
  await ensureCollection(indexName, docs)
  const importBody = docs.map(d => JSON.stringify(d)).join('\n')
  const res = await fetch(`${baseUrl()}${collectionPath(indexName)}/documents/import?action=upsert`, {
    method: 'POST',
    headers: {
      ...headers(),
      'Content-Type': 'text/plain',
    },
    body: importBody,
  })
  const text = await res.text().catch(() => '')
  if (!res.ok)
    throw new Error(`[search/typesense] bulk import failed (${res.status}): ${text}`)

  const failures: Array<{ id: unknown, error: string }> = []
  text.split('\n').filter(line => line.trim() !== '').forEach((line, i) => {
    let result: { success?: boolean, error?: string }
    try {
      result = JSON.parse(line)
    }
    catch {
      result = { success: false, error: line }
    }
    if (result.success !== true)
      failures.push({ id: docs[i]?.id, error: result.error ?? 'not written' })
  })

  if (failures.length > 0)
    throw new TypesenseImportError(indexName, failures, docs.length)

  return fakeTask(indexName)
}

async function deleteDocument(indexName: string, id: number): Promise<EnqueuedTask> {
  await request('DELETE', `${collectionPath(indexName)}/documents/${encodeURIComponent(String(id))}`)
  return fakeTask(indexName)
}

/**
 * Delete the documents matching a filter.
 *
 * This used to call `deleteIndex`, so asking to delete the drafts dropped the
 * whole collection - every document and the schema with it.
 */
async function deleteDocuments(indexName: string, filters: string | string[]): Promise<EnqueuedTask> {
  const filterBy = convertToFilterBy(filters)
  if (!filterBy)
    throw new Error(`[search/typesense] deleteDocuments on "${indexName}" needs a filter. Use deleteAllDocuments to empty the collection.`)

  await request('DELETE', `${collectionPath(indexName)}/documents?${new URLSearchParams({ filter_by: filterBy })}`)
  return fakeTask(indexName)
}

/** Empty the collection and keep its schema. `truncate` needs Typesense 28 or later. */
async function deleteAllDocuments(indexName: string): Promise<EnqueuedTask> {
  try {
    await request('DELETE', `${collectionPath(indexName)}/documents?truncate=true`)
  }
  catch (error) {
    if (!isNotFound(error)) throw error
  }
  return fakeTask(indexName)
}

/**
 * Drop the collection. One that is already gone is fine; anything else - an
 * auth failure, the node down - used to be logged at debug level and reported
 * as success.
 */
async function deleteIndex(indexName: string): Promise<EnqueuedTask> {
  try {
    await request('DELETE', collectionPath(indexName))
  }
  catch (error) {
    if (!isNotFound(error)) throw error
    log.debug(`[search/typesense] deleteIndex ${indexName}: already absent`)
  }
  indexSettings.delete(indexName)
  return fakeTask(indexName)
}

/**
 * Create the collection, using the caller's settings and sample document to
 * type and mark the fields.
 *
 * These two arguments used to be dropped on the floor, and that made calling
 * createIndex actively harmful: it created a collection carrying nothing but
 * `id`, and because ensureCollection returns early when the collection already
 * exists, the addDocuments call that followed could no longer add the fields.
 * Documents imported fine and every query came back
 * "Could not find a field named `name` in the schema".
 */
async function createIndex(name: string, options?: CreateIndexOptions): Promise<EnqueuedTask> {
  const sample = options?.sampleDocument
  await ensureCollection(name, sample ? [normalizeDocument(sample)] : undefined, options?.settings)
  return fakeTask(name)
}

async function getIndex(name: string): Promise<Index<Record<string, any>>> {
  const collection = await request<Record<string, unknown>>('GET', collectionPath(name))
  return collection as unknown as Index<Record<string, any>>
}

/**
 * Remember the settings, and apply them to the collection if it exists. If it
 * does not, the first write creates it with them.
 */
async function updateSettings(index: string, settings: Settings): Promise<EnqueuedTask> {
  await ensureCollection(index, undefined, settings)
  return fakeTask(index)
}

function settingUpdater(key: 'filterableAttributes' | 'searchableAttributes' | 'sortableAttributes' | 'displayedAttributes') {
  return (index: string, attributes: string[] | null): Promise<EnqueuedTask> =>
    updateSettings(index, { [key]: attributes ?? [] })
}

async function getSearchableAttributes(index: string): Promise<string[]> {
  const col = await request<TypesenseCollection>('GET', collectionPath(index))
  return (col.fields ?? []).map(f => f.name).filter(n => n !== 'id')
}

async function getFilterableAttributes(index: string): Promise<string[]> {
  const col = await request<TypesenseCollection>('GET', collectionPath(index))
  return (col.fields ?? []).filter(f => f.facet).map(f => f.name)
}

async function getSortableAttributes(index: string): Promise<string[]> {
  const col = await request<TypesenseCollection>('GET', collectionPath(index))
  return (col.fields ?? []).filter(f => f.sort).map(f => f.name)
}

async function getDisplayedAttributes(index: string): Promise<string[]> {
  return getSearchableAttributes(index)
}

async function getSettings(index: string): Promise<Settings> {
  return {
    searchableAttributes: await getSearchableAttributes(index),
    filterableAttributes: await getFilterableAttributes(index),
    sortableAttributes: await getSortableAttributes(index),
    displayedAttributes: await getDisplayedAttributes(index),
  }
}

/**
 * A setting Typesense has no index-level equivalent for. These answered a
 * successful task and did nothing, so `updateRankingRules()` or
 * `resetSettings()` reported success with nothing changed; a getter returned
 * an empty object, as if the index had no such setting.
 */
function unsupported(feature: string, hint: string): never {
  throw new Error(`[search/typesense] ${feature} is not supported by Typesense. ${hint}`)
}

const perQuery = 'Typesense takes it per search request, not as an index setting.'
const viaSchema = 'Typesense derives it from the collection schema: declare it in the model\'s useSearch trait.'

/** Every collection, in the shape `listAllIndexes()` returns for the other drivers. */
async function listAllIndexes(): Promise<IndexesResults<Index[]>> {
  const collections = await request<Array<Record<string, unknown>>>('GET', '/collections')
  const results = collections.map(collection => ({ ...collection, uid: collection.name, primaryKey: 'id' }))
  return { results, offset: 0, limit: results.length, total: results.length } as unknown as IndexesResults<Index[]>
}

/** One document by id. It returned a fake "succeeded" task, never the document. */
async function getDocument(indexName: string, id: number | string): Promise<Record<string, unknown>> {
  return await request<Record<string, unknown>>('GET', `${collectionPath(indexName)}/documents/${encodeURIComponent(String(id))}`)
}

interface TypesenseSynonym { id: string, synonyms: string[], root?: string }

/**
 * Synonyms in the contract's shape - `{ word: [words it also finds] }` - from
 * Typesense's synonym sets: a one-way set (`root`) is its root's entry; a
 * multi-way set gives each word the others.
 */
async function getSynonyms(indexName: string): Promise<Synonyms> {
  const result = await request<{ synonyms?: TypesenseSynonym[] }>('GET', `${collectionPath(indexName)}/synonyms`)
  const synonyms: Record<string, string[]> = {}
  for (const set of result.synonyms ?? []) {
    if (set.root) {
      synonyms[set.root] = [...(synonyms[set.root] ?? []), ...set.synonyms]
      continue
    }
    for (const word of set.synonyms)
      synonyms[word] = [...(synonyms[word] ?? []), ...set.synonyms.filter(other => other !== word)]
  }
  return synonyms as Synonyms
}

/** Replace the collection's synonyms: one one-way set per word, as the contract means it. */
async function updateSynonyms(indexName: string, synonyms: Synonyms): Promise<EnqueuedTask> {
  await resetSynonyms(indexName)
  for (const [word, others] of Object.entries((synonyms ?? {}) as Record<string, string[]>)) {
    if (!others?.length)
      continue
    await request('PUT', `${collectionPath(indexName)}/synonyms/${encodeURIComponent(`stacks-${word}`)}`, { root: word, synonyms: others })
  }
  return fakeTask(indexName)
}

async function resetSynonyms(indexName: string): Promise<EnqueuedTask> {
  const result = await request<{ synonyms?: TypesenseSynonym[] }>('GET', `${collectionPath(indexName)}/synonyms`)
  for (const set of result.synonyms ?? [])
    await request('DELETE', `${collectionPath(indexName)}/synonyms/${encodeURIComponent(set.id)}`)
  return fakeTask(indexName)
}

const typesense: SearchEngineDriver = {
  client: () => ({}) as ReturnType<SearchEngineDriver['client']>,
  resetClient: () => {
    _config = null
    indexSettings.clear()
  },
  search,

  getIndex,
  createIndex,
  deleteIndex,
  updateIndex: () => unsupported('updateIndex (changing the primary key)', 'A Typesense collection\'s key is always `id`.'),
  listAllIndexes,
  listAllIndices: listAllIndexes,

  addDocument,
  addDocuments,
  updateDocument: (indexName, doc) => addDocument(indexName, doc as Record<string, unknown>),
  updateDocuments: (indexName, docs) => addDocuments(indexName, docs as Record<string, unknown>[]),
  deleteDocument,
  deleteDocuments,
  deleteAllDocuments,
  getDocument,

  getFilterableAttributes,
  updateFilterableAttributes: settingUpdater('filterableAttributes'),
  resetFilterableAttributes: index => updateSettings(index, { filterableAttributes: [] }),

  updateDisplayedAttributes: settingUpdater('displayedAttributes'),
  resetDisplayedAttributes: () => unsupported('resetDisplayedAttributes', viaSchema),
  getDisplayedAttributes,

  updateSearchableAttributes: settingUpdater('searchableAttributes'),
  resetSearchableAttributes: () => unsupported('resetSearchableAttributes', viaSchema),
  getSearchableAttributes,

  updateSortableAttributes: settingUpdater('sortableAttributes'),
  resetSortableAttributes: () => unsupported('resetSortableAttributes', viaSchema),
  getSortableAttributes,

  getSettings,
  updateSettings,
  resetSettings: () => unsupported('resetSettings', viaSchema),

  getPagination: () => unsupported('Index pagination settings', perQuery),
  updatePagination: () => unsupported('Index pagination settings', perQuery),
  resetPagination: () => unsupported('Index pagination settings', perQuery),

  getSynonyms,
  updateSynonyms,
  resetSynonyms,

  getRankingRules: () => unsupported('Ranking rules', perQuery),
  updateRankingRules: () => unsupported('Ranking rules', perQuery),
  resetRankingRules: () => unsupported('Ranking rules', perQuery),

  getDistinctAttribute: () => unsupported('A distinct attribute', perQuery),
  updateDistinctAttribute: () => unsupported('A distinct attribute', perQuery),
  resetDistinctAttribute: () => unsupported('A distinct attribute', perQuery),

  getFaceting: () => unsupported('Faceting settings', perQuery),
  updateFaceting: () => unsupported('Faceting settings', perQuery),
  resetFaceting: () => unsupported('Faceting settings', perQuery),

  getTypoTolerance: () => unsupported('Typo tolerance settings', perQuery),
  updateTypoTolerance: () => unsupported('Typo tolerance settings', perQuery),
  resetTypoTolerance: () => unsupported('Typo tolerance settings', perQuery),

  getDictionary: () => unsupported('Custom dictionaries', 'Typesense has no equivalent.'),
  updateDictionary: () => unsupported('Custom dictionaries', 'Typesense has no equivalent.'),
  resetDictionary: () => unsupported('Custom dictionaries', 'Typesense has no equivalent.'),
}

export default typesense
