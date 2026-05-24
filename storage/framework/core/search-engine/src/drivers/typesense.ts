import type { SearchEngineDriver } from '@stacksjs/types'
import type {
  Dictionary,
  DocumentOptions,
  EnqueuedTask,
  Faceting,
  Index,
  IndexesResults,
  IndexOptions,
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
  } as EnqueuedTask
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

function inferFieldType(_value: unknown): string {
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

  for (const f of [...searchable, ...filterable, ...sortable, ...displayed]) fieldNames.add(f)

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

function normalizeDocument(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(doc)) {
    if (value == null) continue
    if (key === 'id' || typeof value === 'number' || typeof value === 'bigint') {
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

  const queryBy = (params.queryBy as string[] | undefined)?.join(',')
    || (params.query_by as string | undefined)
    || 'id'

  const q = params.query == null || params.query === '' ? '*' : String(params.query)

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

async function createIndex(name: string): Promise<EnqueuedTask> {
  await ensureCollection(name)
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
  listAllIndexes: async () => ({ results: [] } as IndexesResults<Index[]>),
  listAllIndices: async () => ({ results: [] } as IndexesResults<Index[]>),

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
