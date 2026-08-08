import type { CreateIndexOptions, SearchEngineDriver } from '@stacksjs/types'
import type {
  Dictionary,
  DocumentOptions,
  EnqueuedTask,
  Faceting,
  Index,
  IndexesResults,
  PaginationSettings,
  SearchResponse,
  Settings,
  Synonyms,
  TypoTolerance,
} from 'meilisearch'
import { searchEngine } from '@stacksjs/config'
import { log } from '@stacksjs/logging'

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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: headers(),
    body: body == null ? undefined : JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`[search/typesense] ${method} ${path} failed (${res.status}): ${text}`)
  }

  if (res.status === 204) return undefined as T
  return await res.json() as T
}

const SAFE_FILTER_FIELD = /^[a-z_][\w]*(?:\.[a-z_][\w]*)*$/i

function convertToFilterBy(jsonData: Record<string, unknown> | undefined): string | undefined {
  if (!jsonData) return undefined

  const parts: string[] = []

  for (const key in jsonData) {
    if (!Object.prototype.hasOwnProperty.call(jsonData, key)) continue
    if (!SAFE_FILTER_FIELD.test(key)) {
      throw new Error(`[search/typesense] Refusing to build filter with unsafe field name: ${key}`)
    }
    const value = jsonData[key]
    if (value == null || value === '') continue
    const escaped = String(value).replace(/`/g, '\\`')
    parts.push(`${key}:=\`${escaped}\``)
  }

  return parts.length ? parts.join(' && ') : undefined
}

function convertToSortBy(jsonData: Record<string, string> | undefined): string | undefined {
  if (!jsonData) return undefined

  const parts: string[] = []
  for (const key in jsonData) {
    if (!Object.prototype.hasOwnProperty.call(jsonData, key)) continue
    if (!SAFE_FILTER_FIELD.test(key)) continue
    const dir = String(jsonData[key]).toLowerCase() === 'desc' ? 'desc' : 'asc'
    parts.push(`${key}:${dir}`)
  }

  return parts.length ? parts.join(',') : undefined
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

async function ensureCollection(indexName: string, sampleDoc?: Record<string, unknown>, settings?: Settings): Promise<void> {
  try {
    await request('GET', `/collections/${indexName}`)
    return
  }
  catch {
    // collection missing — create below
  }

  const fieldNames = new Set<string>(['id'])
  const searchable = settings?.searchableAttributes ?? []
  const filterable = settings?.filterableAttributes ?? []
  const sortable = settings?.sortableAttributes ?? []
  const displayed = settings?.displayedAttributes ?? []

  for (const f of [...searchable, ...filterable, ...sortable, ...displayed]) {
    if (typeof f === 'string') fieldNames.add(f)
    else for (const pattern of f.attributePatterns) fieldNames.add(pattern)
  }

  if (sampleDoc) {
    for (const key of Object.keys(sampleDoc)) fieldNames.add(key)
    for (const key of fieldNames) {
      if (sampleDoc[key] === undefined) sampleDoc[key] = ''
    }
  }

  const fields = [...fieldNames].map(name => ({
    name,
    type: name === 'id' ? 'string' : inferFieldType(sampleDoc?.[name]),
    facet: filterable.includes(name),
    sort: sortable.includes(name),
    optional: name !== 'id',
  }))

  await request('POST', '/collections', {
    name: indexName,
    fields,
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

async function search(index: string, params: any): Promise<SearchResponse<Record<string, any>>> {
  const page = Number(params.page) || 1
  const perPage = Number(params.perPage) || 20
  const offsetVal = (page - 1) * perPage
  const filterBy = params.filter_by || convertToFilterBy(params.filter)
  const sortBy = convertToSortBy(params.sort)

  /*
   * No `id` fallback. Typesense refuses `id` as a query field outright, so
   * defaulting to it turned "the caller did not say which fields to search"
   * into a 400 from the search node with a message about `id` - which sends
   * whoever reads it looking at the document rather than at the missing
   * parameter. Saying so here costs one line and names the actual problem.
   */
  const queryBy = (params.queryBy as string[] | undefined)?.join(',')
    || (params.query_by as string | undefined)

  if (!queryBy) {
    throw new Error(
      `[search/typesense] search on "${index}" needs fields to search by. `
      + 'Pass `query_by`, or declare `searchable` on the model\'s `useSearch` trait so it can be supplied for you.',
    )
  }

  /*
   * `query` or `q`, because both spellings arrive here.
   *
   * The ORM's search builder sets `q` (it is the name Typesense itself uses on
   * the wire); this read only `params.query`, found nothing, and fell back to
   * `*`. So every `Model.search('anything')` matched every document in the
   * collection and returned a full page of results - which looks like working
   * search right up until somebody notices the same twenty rows come back for
   * a term that appears nowhere. Silent, and worse than an error: a 400 gets
   * fixed, a wrong answer gets shipped.
   */
  const rawQuery = params.query ?? params.q
  const q = rawQuery == null || rawQuery === '' ? '*' : String(rawQuery)

  const searchParams = new URLSearchParams({
    q,
    query_by: queryBy,
    per_page: String(perPage),
    page: String(page),
  })

  if (filterBy) searchParams.set('filter_by', filterBy)
  if (sortBy) searchParams.set('sort_by', sortBy)

  const result = await request<{
    found: number
    hits: Array<{ document: Record<string, unknown> }>
    search_time_ms: number
  }>('GET', `/collections/${index}/documents/search?${searchParams}`)

  const hits = (result.hits ?? []).map(h => h.document)

  return {
    hits,
    query: q,
    processingTimeMs: result.search_time_ms ?? 0,
    limit: perPage,
    offset: offsetVal,
    estimatedTotalHits: result.found ?? hits.length,
  } as SearchResponse<Record<string, any>>
}

async function addDocument(indexName: string, params: any): Promise<EnqueuedTask> {
  const doc = normalizeDocument(params)
  await ensureCollection(indexName, doc)
  await request('POST', `/collections/${indexName}/documents?action=upsert`, doc)
  return fakeTask(indexName)
}

async function addDocuments(indexName: string, params: any[]): Promise<EnqueuedTask> {
  if (!Array.isArray(params) || params.length === 0) return fakeTask(indexName)

  const docs = params.map(normalizeDocument)
  await ensureCollection(indexName, docs[0])
  const importBody = docs.map(d => JSON.stringify(d)).join('\n')
  const res = await fetch(`${baseUrl()}/collections/${indexName}/documents/import?action=upsert`, {
    method: 'POST',
    headers: {
      ...headers(),
      'Content-Type': 'text/plain',
    },
    body: importBody,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`[search/typesense] bulk import failed (${res.status}): ${text}`)
  }
  return fakeTask(indexName)
}

async function deleteDocument(indexName: string, id: number): Promise<EnqueuedTask> {
  await request('DELETE', `/collections/${indexName}/documents/${String(id)}`)
  return fakeTask(indexName)
}

async function deleteIndex(indexName: string): Promise<EnqueuedTask> {
  try {
    await request('DELETE', `/collections/${indexName}`)
  }
  catch (err) {
    log.debug(`[search/typesense] deleteIndex ${indexName}: ${(err as Error).message}`)
  }
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
  await ensureCollection(name, sample ? normalizeDocument(sample) : undefined, options?.settings)
  return fakeTask(name)
}

async function getIndex(name: string): Promise<Index<Record<string, any>>> {
  const collection = await request<Record<string, unknown>>('GET', `/collections/${name}`)
  return collection as unknown as Index<Record<string, any>>
}

async function updateSettings(index: string, settings: Settings): Promise<EnqueuedTask> {
  await ensureCollection(index, undefined, settings)
  return fakeTask(index)
}

async function getSearchableAttributes(index: string): Promise<string[]> {
  const col = await request<{ fields?: Array<{ name: string }> }>('GET', `/collections/${index}`)
  return (col.fields ?? []).map(f => f.name).filter(n => n !== 'id')
}

async function getFilterableAttributes(index: string): Promise<string[]> {
  const col = await request<{ fields?: Array<{ name: string, facet?: boolean }> }>('GET', `/collections/${index}`)
  return (col.fields ?? []).filter(f => f.facet).map(f => f.name)
}

async function getSortableAttributes(index: string): Promise<string[]> {
  const col = await request<{ fields?: Array<{ name: string, sort?: boolean }> }>('GET', `/collections/${index}`)
  return (col.fields ?? []).map(f => f.name)
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

function notImplemented(_index: string, _arg?: unknown): Promise<EnqueuedTask> {
  return Promise.resolve(fakeTask('typesense'))
}

const typesense: SearchEngineDriver = {
  client: () => ({}) as any,
  resetClient: () => { _config = null },
  search,

  getIndex,
  createIndex,
  deleteIndex,
  updateIndex: notImplemented,
  listAllIndexes: async () => ({ results: [] } as unknown as IndexesResults<Index[]>),
  listAllIndices: async () => ({ results: [] } as unknown as IndexesResults<Index[]>),

  addDocument,
  addDocuments,
  updateDocument: (indexName, doc) => addDocument(indexName, doc),
  updateDocuments: (indexName, docs) => addDocuments(indexName, docs as DocumentOptions[]),
  deleteDocument,
  deleteDocuments: async (indexName) => deleteIndex(indexName),
  getDocument: async () => fakeTask('typesense') as any,

  getFilterableAttributes,
  updateFilterableAttributes: notImplemented,
  resetFilterableAttributes: notImplemented,

  updateDisplayedAttributes: notImplemented,
  resetDisplayedAttributes: notImplemented,
  getDisplayedAttributes,

  updateSearchableAttributes: notImplemented,
  resetSearchableAttributes: notImplemented,
  getSearchableAttributes,

  updateSortableAttributes: notImplemented,
  resetSortableAttributes: notImplemented,
  getSortableAttributes,

  getSettings,
  updateSettings,
  resetSettings: notImplemented,

  getPagination: async () => ({} as PaginationSettings),
  updatePagination: notImplemented,
  resetPagination: notImplemented,

  getSynonyms: async () => ({} as Synonyms),
  updateSynonyms: notImplemented,
  resetSynonyms: notImplemented,

  getRankingRules: async () => [],
  updateRankingRules: notImplemented,
  resetRankingRules: notImplemented,

  getDistinctAttribute: async () => null,
  updateDistinctAttribute: notImplemented,
  resetDistinctAttribute: notImplemented,

  getFaceting: async () => ({} as Faceting),
  updateFaceting: notImplemented,
  resetFaceting: notImplemented,

  getTypoTolerance: async () => ({} as TypoTolerance),
  updateTypoTolerance: notImplemented,
  resetTypoTolerance: notImplemented,

  getDictionary: async () => ({} as Dictionary),
  updateDictionary: notImplemented,
  resetDictionary: notImplemented,
}

export default typesense
