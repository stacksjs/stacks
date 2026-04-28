import type { SearchEngineDriver } from '@stacksjs/types'
import type { Dictionary, DocumentOptions, EnqueuedTask, Faceting, Index, IndexesResults, IndexOptions, PaginationSettings, SearchResponse, Settings, Synonyms, TypoTolerance } from 'meilisearch'
import { searchEngine } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { Meilisearch } from 'meilisearch'

let _client: Meilisearch | null = null

function client(): Meilisearch {
  if (!_client) {
    const host = searchEngine.meilisearch?.host || 'http://127.0.0.1:7700'
    const apiKey = searchEngine.meilisearch?.apiKey || ''

    if (!host) {
      throw new Error('Meilisearch host is not configured. Please specify a search engine host.')
    }

    _client = new Meilisearch({ host, apiKey })
  }

  return _client
}

/**
 * Reset the cached client (useful for reconfiguration or testing)
 */
function resetClient(): void {
  _client = null
}

async function search(index: string, params: any): Promise<SearchResponse<Record<string, any>>> {
  const page = Number(params.page) || 1
  const perPage = Number(params.perPage) || 20
  const offsetVal = (page - 1) * perPage
  const filter = convertToFilter(params.filter)
  const sort = convertToMeilisearchSorting(params.sort)

  return await client()
    .index(index)
    .search(params.query, { limit: perPage, filter, sort, offset: offsetVal })
}

async function addDocument(indexName: string, params: any): Promise<EnqueuedTask> {
  return await client().index(indexName).addDocuments([params])
}

/**
 * Meilisearch caps a single addDocuments() call at 100MB by default and
 * gets unhappy with very large batches even when they fit. Splitting at
 * 1000 docs is the official recommendation — each chunk gets enqueued
 * as its own task and progresses independently. Returning the *first*
 * task preserves the existing single-task return shape; callers wanting
 * full progress should switch to `addDocumentsInBatches` when ready.
 */
async function addDocuments(indexName: string, params: any[]): Promise<EnqueuedTask> {
  const MAX_BATCH = 1000
  if (!Array.isArray(params)) {
    throw new TypeError('[search/meilisearch] addDocuments requires an array of documents')
  }
  if (params.length <= MAX_BATCH) {
    return await client().index(indexName).addDocuments(params)
  }

  let firstTask: EnqueuedTask | undefined
  for (let i = 0; i < params.length; i += MAX_BATCH) {
    const chunk = params.slice(i, i + MAX_BATCH)
    const task = await client().index(indexName).addDocuments(chunk)
    if (!firstTask) firstTask = task
  }
  // Non-null assertion safe: input length > 0 implies at least one chunk ran.
  return firstTask!
}

async function getIndex(name: string): Promise<Index<Record<string, any>>> {
  return await client().getIndex(name)
}

async function createIndex(name: string, options?: IndexOptions): Promise<EnqueuedTask> {
  return await client().createIndex(name, options)
}

async function updateIndex(indexName: string, params: IndexOptions): Promise<EnqueuedTask> {
  return await client().updateIndex(indexName, params)
}

async function updateDocument(indexName: string, params: DocumentOptions): Promise<EnqueuedTask> {
  return await client().index(indexName).updateDocuments([params])
}

async function updateDocuments(indexName: string, params: DocumentOptions[]): Promise<EnqueuedTask> {
  return await client().index(indexName).updateDocuments(params)
}

async function deleteDocument(indexName: string, id: number): Promise<EnqueuedTask> {
  return await client().index(indexName).deleteDocument(id)
}

async function deleteDocuments(indexName: string, filters: string | string[]): Promise<EnqueuedTask> {
  return await client().index(indexName).deleteDocuments({ filter: filters })
}

async function getDocument(indexName: string, id: number, fields: any): Promise<EnqueuedTask> {
  return await client().index(indexName).getDocument(id, fields)
}

async function deleteIndex(indexName: string): Promise<EnqueuedTask> {
  return await client().deleteIndex(indexName)
}

async function listAllIndexes(): Promise<IndexesResults<Index[]>> {
  return await client().getIndexes()
}

async function getFilterableAttributes(index: string): Promise<string[]> {
  return client().index(index).getFilterableAttributes() as any
}

async function updateFilterableAttributes(index: string, filterableAttributes: string[] | null): Promise<EnqueuedTask> {
  return client().index(index).updateFilterableAttributes(filterableAttributes)
}

async function resetFilterableAttributes(index: string): Promise<EnqueuedTask> {
  return client().index(index).resetFilterableAttributes()
}

async function updateSearchableAttributes(index: string, searchableAttributes: string[] | null): Promise<EnqueuedTask> {
  return client().index(index).updateSearchableAttributes(searchableAttributes)
}

async function resetSearchableAttributes(index: string): Promise<EnqueuedTask> {
  return client().index(index).resetSearchableAttributes()
}

async function getSearchableAttributes(index: string): Promise<string[]> {
  return client().index(index).getSearchableAttributes()
}

async function updateSortableAttributes(index: string, sortableAttributes: string[] | null): Promise<EnqueuedTask> {
  return client().index(index).updateSortableAttributes(sortableAttributes)
}

async function resetSortableAttributes(index: string): Promise<EnqueuedTask> {
  return client().index(index).resetSortableAttributes()
}

async function getSortableAttributes(index: string): Promise<string[]> {
  return client().index(index).getSortableAttributes()
}

async function updateDisplayedAttributes(index: string, displayedAttributes: string[] | null): Promise<EnqueuedTask> {
  return client().index(index).updateDisplayedAttributes(displayedAttributes)
}

async function getDisplayedAttributes(index: string): Promise<string[]> {
  return client().index(index).getDisplayedAttributes()
}

async function resetDisplayedAttributes(index: string): Promise<EnqueuedTask> {
  return client().index(index).resetDisplayedAttributes()
}

async function getSettings(index: string): Promise<Settings> {
  return client().index(index).getSettings()
}

async function updateSettings(index: string, settings: Settings): Promise<EnqueuedTask> {
  return client().index(index).updateSettings(settings)
}

async function resetSettings(index: string): Promise<EnqueuedTask> {
  return client().index(index).resetSettings()
}

async function getPagination(index: string): Promise<PaginationSettings> {
  return client().index(index).getPagination()
}

async function updatePagination(index: string, pagination: PaginationSettings): Promise<EnqueuedTask> {
  return client().index(index).updatePagination(pagination)
}

async function resetPagination(index: string): Promise<EnqueuedTask> {
  return client().index(index).resetPagination()
}

async function getSynonyms(index: string): Promise<object> {
  return client().index(index).getSynonyms()
}

async function updateSynonyms(index: string, synonyms: Synonyms): Promise<EnqueuedTask> {
  return client().index(index).updateSynonyms(synonyms)
}

async function resetSynonyms(index: string): Promise<EnqueuedTask> {
  return client().index(index).resetSynonyms()
}

async function getRankingRules(index: string): Promise<string[]> {
  return client().index(index).getRankingRules()
}

async function updateRankingRules(index: string, rankingRules: string[] | null): Promise<EnqueuedTask> {
  return client().index(index).updateRankingRules(rankingRules)
}

async function resetRankingRules(index: string): Promise<EnqueuedTask> {
  return client().index(index).resetRankingRules()
}

async function getDistinctAttribute(index: string): Promise<string | null> {
  return client().index(index).getDistinctAttribute()
}

async function updateDistinctAttribute(index: string, distinctAttribute: string | null): Promise<EnqueuedTask> {
  return client().index(index).updateDistinctAttribute(distinctAttribute)
}

async function resetDistinctAttribute(index: string): Promise<EnqueuedTask> {
  return client().index(index).resetDistinctAttribute()
}

async function getFaceting(index: string): Promise<Faceting> {
  return client().index(index).getFaceting()
}

async function updateFaceting(index: string, faceting: Faceting): Promise<EnqueuedTask> {
  return client().index(index).updateFaceting(faceting)
}

async function resetFaceting(index: string): Promise<EnqueuedTask> {
  return client().index(index).resetFaceting()
}

async function getTypoTolerance(index: string): Promise<TypoTolerance> {
  return client().index(index).getTypoTolerance()
}

async function updateTypoTolerance(index: string, typoTolerance: TypoTolerance | null): Promise<EnqueuedTask> {
  return client().index(index).updateTypoTolerance(typoTolerance)
}

async function resetTypoTolerance(index: string): Promise<EnqueuedTask> {
  return client().index(index).resetTypoTolerance()
}

async function getDictionary(index: string): Promise<Dictionary> {
  return client().index(index).getDictionary()
}

async function updateDictionary(index: string, dictionary: Dictionary | null): Promise<EnqueuedTask> {
  return client().index(index).updateDictionary(dictionary)
}

async function resetDictionary(index: string): Promise<EnqueuedTask> {
  return client().index(index).resetDictionary()
}

/**
 * Convert a `{ field: value }` map into Meilisearch filter expressions.
 *
 * Field names go straight into the filter DSL — Meilisearch parses them
 * as identifiers, so we restrict to safe identifier characters
 * (`[a-z0-9_]` plus dot for nested paths). Without the check, a key
 * like `"category';TRUNCATE INDEX;'"` would close the filter and inject
 * arbitrary DSL fragments. Values are still single-quote-escaped.
 */
const SAFE_FILTER_FIELD = /^[a-z_][\w]*(\.[a-z_][\w]*)*$/i

function convertToFilter(jsonData: any): string[] {
  if (!jsonData) return []

  const filters: string[] = []

  for (const key in jsonData) {
    if (!Object.prototype.hasOwnProperty.call(jsonData, key)) continue
    if (!SAFE_FILTER_FIELD.test(key)) {
      throw new Error(`[search/meilisearch] Refusing to build filter with unsafe field name: ${key}`)
    }
    const value = jsonData[key]
    const escaped = String(value).replace(/'/g, "\\'")
    filters.push(`${key}='${escaped}'`)
  }

  return filters
}

function convertToMeilisearchSorting(jsonData: any): string[] {
  if (!jsonData) return []

  const sortRules: string[] = []

  for (const key in jsonData) {
    if (Object.prototype.hasOwnProperty.call(jsonData, key)) {
      const value = String(jsonData[key]).toLowerCase()
      const direction = value === 'desc' ? 'desc' : 'asc'
      sortRules.push(`${key}:${direction}`)
    }
  }

  return sortRules
}

const meilisearch: SearchEngineDriver = {
  client,
  resetClient,
  search,

  getIndex,
  createIndex,
  deleteIndex,
  updateIndex,
  listAllIndexes,
  listAllIndices: listAllIndexes,

  addDocument,
  addDocuments,
  updateDocument,
  updateDocuments,
  deleteDocument,
  deleteDocuments,
  getDocument,

  getFilterableAttributes,
  updateFilterableAttributes,
  resetFilterableAttributes,

  updateDisplayedAttributes,
  resetDisplayedAttributes,
  getDisplayedAttributes,

  updateSearchableAttributes,
  resetSearchableAttributes,
  getSearchableAttributes,

  updateSortableAttributes,
  resetSortableAttributes,
  getSortableAttributes,

  getSettings,
  updateSettings,
  resetSettings,

  getPagination,
  updatePagination,
  resetPagination,

  getSynonyms,
  updateSynonyms,
  resetSynonyms,

  getRankingRules,
  updateRankingRules,
  resetRankingRules,

  getDistinctAttribute,
  updateDistinctAttribute,
  resetDistinctAttribute,

  getFaceting,
  updateFaceting,
  resetFaceting,

  getTypoTolerance,
  updateTypoTolerance,
  resetTypoTolerance,

  getDictionary,
  updateDictionary,
  resetDictionary,
}

export default meilisearch
