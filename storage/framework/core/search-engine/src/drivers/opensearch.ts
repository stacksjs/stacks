import type { SearchEngineDriver } from '@stacksjs/types'
import { searchEngine } from '@stacksjs/config'

interface OpenSearchMeta {
  filterableAttributes?: string[]
  searchableAttributes?: string[]
  sortableAttributes?: string[]
  displayedAttributes?: string[]
  pagination?: Record<string, unknown>
  synonyms?: Record<string, unknown>
  rankingRules?: string[]
  distinctAttribute?: string | null
  faceting?: Record<string, unknown>
  typoTolerance?: Record<string, unknown> | null
  dictionary?: string[] | null
}

interface OpenSearchHit {
  _id: string
  _source?: Record<string, unknown>
}

interface OpenSearchResponse {
  took?: number
  hits?: {
    total?: number | { value?: number }
    hits?: OpenSearchHit[]
  }
}

class OpenSearchRequestError extends Error {
  constructor(
    public status: number,
    method: string,
    path: string,
    detail: string,
  ) {
    super(`[search/opensearch] ${method} ${path} failed (${status}): ${detail}`)
  }
}

function configuration(): { baseUrl: string, auth: string } {
  const options = searchEngine.opensearch
  const configuredHost = String(options?.host || 'localhost').replace(/\/+$/, '')
  const hasProtocol = /^https?:\/\//i.test(configuredHost)
  const protocol = String(options?.protocol || 'http').replace(/:$/, '')
  const port = Number(options?.port || 9200)
  let baseUrl = `${protocol}://${configuredHost}${port ? `:${port}` : ''}`
  if (hasProtocol) {
    const url = new URL(configuredHost)
    if (!url.port && options?.port)
      url.port = String(options.port)
    baseUrl = url.toString().replace(/\/+$/, '')
  }

  return { baseUrl, auth: String(options?.auth || '') }
}

function headers(contentType = 'application/json'): Record<string, string> {
  const { auth } = configuration()
  return {
    'Content-Type': contentType,
    ...(auth ? { Authorization: `Basic ${btoa(auth)}` } : {}),
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: Record<string, unknown> | string,
  contentType?: string,
): Promise<T> {
  const { baseUrl } = configuration()
  const result = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headers(contentType),
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })

  if (!result.ok) {
    const detail = await result.text()
    throw new OpenSearchRequestError(result.status, method, path, detail || result.statusText)
  }

  const text = await result.text()
  return (text ? JSON.parse(text) : {}) as T
}

function indexPath(index: string): string {
  return `/${encodeURIComponent(index)}`
}

function task(index: string, type: string): any {
  return {
    taskUid: Date.now(),
    indexUid: index,
    status: 'succeeded',
    type,
    enqueuedAt: new Date().toISOString(),
  }
}

async function getMeta(index: string): Promise<OpenSearchMeta> {
  const result = await request<Record<string, any>>('GET', `${indexPath(index)}/_mapping`)
  return result[index]?.mappings?._meta?.stacks || {}
}

async function updateMeta(index: string, patch: Partial<OpenSearchMeta>): Promise<any> {
  let current: OpenSearchMeta
  try {
    current = await getMeta(index)
  }
  catch (error) {
    if (!(error instanceof OpenSearchRequestError) || error.status !== 404)
      throw error
    await request('PUT', indexPath(index))
    current = {}
  }
  await request('PUT', `${indexPath(index)}/_mapping`, {
    _meta: {
      stacks: { ...current, ...patch },
    },
  })
  return task(index, 'settingsUpdate')
}

async function search(index: string, params: any = {}): Promise<any> {
  if (typeof params === 'string')
    params = { q: params }
  const queryText = String(params.q ?? params.query ?? '')
  const limit = Math.max(1, Number(params.limit ?? params.perPage ?? 20))
  const offset = Math.max(0, Number(params.offset ?? ((Number(params.page || 1) - 1) * limit)))
  const filters = Array.isArray(params.filter) ? params.filter : params.filter ? [params.filter] : []
  const textQuery = queryText
    ? { multi_match: { query: queryText, fields: params.attributesToSearchOn || ['*'] } }
    : { match_all: {} }
  const query = filters.length > 0
    ? {
        bool: {
          must: [textQuery],
          filter: filters.map((filter: unknown) => ({
            query_string: { query: typeof filter === 'string' ? filter : JSON.stringify(filter) },
          })),
        },
      }
    : textQuery

  const result = await request<OpenSearchResponse>('POST', `${indexPath(index)}/_search`, {
    query,
    from: offset,
    size: limit,
    ...(params.sort ? { sort: params.sort } : {}),
    ...(params.attributesToRetrieve ? { _source: params.attributesToRetrieve } : {}),
  })
  const total = typeof result.hits?.total === 'number'
    ? result.hits.total
    : Number(result.hits?.total?.value || 0)
  const hits = (result.hits?.hits || []).map(hit => ({
    id: hit._source?.id ?? hit._id,
    ...hit._source,
  }))

  return {
    hits,
    estimatedTotalHits: total,
    processingTimeMs: Number(result.took || 0),
    query: queryText,
    limit,
    offset,
  }
}

async function createIndex(index: string, options: any = {}): Promise<any> {
  await request('PUT', indexPath(index), options)
  return task(index, 'indexCreation')
}

async function getIndex(index: string): Promise<any> {
  return await request('GET', indexPath(index))
}

async function updateIndex(index: string, options: any): Promise<any> {
  await request('PUT', `${indexPath(index)}/_settings`, options)
  return task(index, 'indexUpdate')
}

async function deleteIndex(index: string): Promise<any> {
  try {
    await request('DELETE', indexPath(index))
  }
  catch (error) {
    if (!(error instanceof OpenSearchRequestError) || error.status !== 404)
      throw error
  }
  return task(index, 'indexDeletion')
}

async function listAllIndexes(): Promise<any> {
  const indexes = await request<any[]>('GET', '/_cat/indices?format=json')
  const results = indexes.map(item => ({
    uid: item.index,
    primaryKey: null,
    createdAt: null,
    updatedAt: null,
  }))
  return { results, total: results.length, limit: results.length, offset: 0 }
}

async function addDocument(index: string, document: any): Promise<any> {
  const id = document?.id ?? document?.objectID
  const path = id === undefined || id === null
    ? `${indexPath(index)}/_doc?refresh=wait_for`
    : `${indexPath(index)}/_doc/${encodeURIComponent(String(id))}?refresh=wait_for`
  await request(id === undefined || id === null ? 'POST' : 'PUT', path, document)
  return task(index, 'documentAdditionOrUpdate')
}

async function addDocuments(index: string, documents: any[]): Promise<any> {
  if (!Array.isArray(documents))
    throw new TypeError('[search/opensearch] addDocuments requires an array of documents')
  if (documents.length === 0)
    return task(index, 'documentAdditionOrUpdate')

  const lines = documents.flatMap((document) => {
    const id = document?.id ?? document?.objectID
    return [
      JSON.stringify({ index: { _index: index, ...(id === undefined || id === null ? {} : { _id: id }) } }),
      JSON.stringify(document),
    ]
  })
  const result = await request<{ errors?: boolean, items?: any[] }>(
    'POST',
    '/_bulk?refresh=wait_for',
    `${lines.join('\n')}\n`,
    'application/x-ndjson',
  )
  if (result.errors) {
    const failed = result.items?.filter(item => Number(item.index?.status || 0) >= 400) || []
    throw new Error(`[search/opensearch] Bulk indexing failed for ${failed.length} document(s)`)
  }
  return task(index, 'documentAdditionOrUpdate')
}

async function getDocument(index: string, id: number, fields?: any): Promise<any> {
  const source = fields ? `?_source=${encodeURIComponent(Array.isArray(fields) ? fields.join(',') : String(fields))}` : ''
  const result = await request<any>('GET', `${indexPath(index)}/_doc/${encodeURIComponent(String(id))}${source}`)
  return { id: result._source?.id ?? result._id, ...result._source }
}

async function deleteDocument(index: string, id: number): Promise<any> {
  await request('DELETE', `${indexPath(index)}/_doc/${encodeURIComponent(String(id))}?refresh=wait_for`)
  return task(index, 'documentDeletion')
}

async function deleteDocuments(index: string, filters: string | string[]): Promise<any> {
  const clauses = (Array.isArray(filters) ? filters : [filters]).filter(Boolean)
  await request('POST', `${indexPath(index)}/_delete_by_query?refresh=true`, {
    query: clauses.length > 0
      ? { bool: { filter: clauses.map(query => ({ query_string: { query } })) } }
      : { match_all: {} },
  })
  return task(index, 'documentDeletion')
}

function metaAccessors(key: keyof OpenSearchMeta, fallback: any) {
  return {
    get: async (index: string): Promise<any> => (await getMeta(index))[key] ?? fallback,
    update: async (index: string, value: any): Promise<any> => updateMeta(index, { [key]: value }),
    reset: async (index: string): Promise<any> => updateMeta(index, { [key]: fallback }),
  }
}

const filterable = metaAccessors('filterableAttributes', [])
const searchable = metaAccessors('searchableAttributes', [])
const sortable = metaAccessors('sortableAttributes', [])
const displayed = metaAccessors('displayedAttributes', [])
const pagination = metaAccessors('pagination', {})
const synonyms = metaAccessors('synonyms', {})
const rankingRules = metaAccessors('rankingRules', [])
const distinctAttribute = metaAccessors('distinctAttribute', null)
const faceting = metaAccessors('faceting', {})
const typoTolerance = metaAccessors('typoTolerance', {})
const dictionary = metaAccessors('dictionary', [])

async function getSettings(index: string): Promise<any> {
  const meta = await getMeta(index)
  return {
    filterableAttributes: meta.filterableAttributes || [],
    searchableAttributes: meta.searchableAttributes || [],
    sortableAttributes: meta.sortableAttributes || [],
    displayedAttributes: meta.displayedAttributes || [],
    pagination: meta.pagination || {},
    synonyms: meta.synonyms || {},
    rankingRules: meta.rankingRules || [],
    distinctAttribute: meta.distinctAttribute ?? null,
    faceting: meta.faceting || {},
    typoTolerance: meta.typoTolerance || {},
    dictionary: meta.dictionary || [],
  }
}

async function updateSettings(index: string, settings: any): Promise<any> {
  const supported = [
    'filterableAttributes',
    'searchableAttributes',
    'sortableAttributes',
    'displayedAttributes',
    'pagination',
    'synonyms',
    'rankingRules',
    'distinctAttribute',
    'faceting',
    'typoTolerance',
    'dictionary',
  ]
  const patch = Object.fromEntries(supported.filter(key => key in settings).map(key => [key, settings[key]]))
  return await updateMeta(index, patch)
}

async function resetSettings(index: string): Promise<any> {
  return await updateMeta(index, {
    filterableAttributes: [],
    searchableAttributes: [],
    sortableAttributes: [],
    displayedAttributes: [],
    pagination: {},
    synonyms: {},
    rankingRules: [],
    distinctAttribute: null,
    faceting: {},
    typoTolerance: {},
    dictionary: [],
  })
}

const opensearch: SearchEngineDriver = {
  client: () => ({ request, configuration }) as unknown as ReturnType<SearchEngineDriver['client']>,
  search,
  createIndex,
  getIndex,
  updateIndex,
  deleteIndex,
  listAllIndexes,
  listAllIndices: listAllIndexes,
  addDocument,
  addDocuments,
  updateDocument: addDocument,
  updateDocuments: addDocuments,
  getDocument,
  deleteDocument,
  deleteDocuments,
  getFilterableAttributes: filterable.get,
  updateFilterableAttributes: filterable.update,
  resetFilterableAttributes: filterable.reset,
  getSearchableAttributes: searchable.get,
  updateSearchableAttributes: searchable.update,
  resetSearchableAttributes: searchable.reset,
  getSortableAttributes: sortable.get,
  updateSortableAttributes: sortable.update,
  resetSortableAttributes: sortable.reset,
  getDisplayedAttributes: displayed.get,
  updateDisplayedAttributes: displayed.update,
  resetDisplayedAttributes: displayed.reset,
  getSettings,
  updateSettings,
  resetSettings,
  getPagination: pagination.get,
  updatePagination: pagination.update,
  resetPagination: pagination.reset,
  getSynonyms: synonyms.get,
  updateSynonyms: synonyms.update,
  resetSynonyms: synonyms.reset,
  getRankingRules: rankingRules.get,
  updateRankingRules: rankingRules.update,
  resetRankingRules: rankingRules.reset,
  getDistinctAttribute: distinctAttribute.get,
  updateDistinctAttribute: distinctAttribute.update,
  resetDistinctAttribute: distinctAttribute.reset,
  getFaceting: faceting.get,
  updateFaceting: faceting.update,
  resetFaceting: faceting.reset,
  getTypoTolerance: typoTolerance.get,
  updateTypoTolerance: typoTolerance.update,
  resetTypoTolerance: typoTolerance.reset,
  getDictionary: dictionary.get,
  updateDictionary: dictionary.update,
  resetDictionary: dictionary.reset,
}

export default opensearch
