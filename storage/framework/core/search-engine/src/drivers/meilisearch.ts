import type { Dictionary, DocumentOptions, EnqueuedTask, Faceting, Index, IndexesResults, IndexOptions, Meilisearch, PaginationSettings, SearchParams, SearchResponse, Settings, Synonyms, TypoTolerance } from 'meilisearch'
import type { SearchEngineDriver, SearchEngineSearchParams, SearchFilter } from '@stacksjs/types'
import { searchEngine } from '@stacksjs/config'
import { assertSafeField, DEFAULT_SEARCH_LIMIT, isObjectFilter, resolveSearchParams, sortToList } from '../params'

// `meilisearch` is an opt-in dependency: it is only installed when the
// `meilisearch` search driver is selected in `config/search-engine.ts`.
// The constructor is resolved lazily so merely importing this module (e.g.
// as the default driver) never hard-requires the package.
let MeilisearchCtor: typeof import('meilisearch').Meilisearch | undefined
try {
  ({ Meilisearch: MeilisearchCtor } = await import('meilisearch'))
}
catch {
  // package not installed — client() throws a helpful opt-in error on use
}

let _client: Meilisearch | null = null

function client(): Meilisearch {
  if (!MeilisearchCtor) {
    throw new Error(
      'The `meilisearch` search driver is selected but the `meilisearch` package is not installed. '
      + 'It is an opt-in dependency - run `bun add meilisearch` to enable it, or switch drivers in `config/search-engine.ts`.',
    )
  }

  if (!_client) {
    const host = searchEngine.meilisearch?.host || 'http://127.0.0.1:7700'
    const apiKey = searchEngine.meilisearch?.apiKey || ''

    if (!host) {
      throw new Error('Meilisearch host is not configured. Please specify a search engine host.')
    }

    _client = new MeilisearchCtor({ host, apiKey })
  }

  return _client
}

/**
 * Reset the cached client (useful for reconfiguration or testing)
 */
function resetClient(): void {
  _client = null
}

/**
 * Meilisearch's own search options a caller may pass straight through.
 *
 * Meilisearch rejects a search carrying a key it does not know, and the
 * contract's params also carry other engines' names (Typesense's `query_by`,
 * which the ORM always sends), so only these reach the engine.
 */
const PASSTHROUGH_SEARCH_OPTIONS = [
  'attributesToRetrieve',
  'attributesToHighlight',
  'attributesToCrop',
  'attributesToSearchOn',
  'cropLength',
  'cropMarker',
  'distinct',
  'facets',
  'highlightPreTag',
  'highlightPostTag',
  'matchingStrategy',
  'showMatchesPosition',
  'showRankingScore',
] as const

async function search(index: string, params: SearchEngineSearchParams = {}): Promise<SearchResponse<Record<string, any>>> {
  const { query, limit, offset, filter, sort } = resolveSearchParams(params, searchEngine.perPage ?? DEFAULT_SEARCH_LIMIT)

  const options: SearchParams = { limit, offset }
  const meiliFilter = convertToFilter(filter)
  if (meiliFilter !== undefined)
    options.filter = meiliFilter
  const sortRules = sortToList('meilisearch', sort)
  if (sortRules.length > 0)
    options.sort = sortRules

  for (const key of PASSTHROUGH_SEARCH_OPTIONS) {
    if (params[key] !== undefined)
      (options as Record<string, unknown>)[key] = params[key]
  }

  return await client().index(index).search(query, options)
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

/**
 * Empty the index and keep it, with its settings.
 *
 * `Model.removeAllFromSearch()` looked for this, found no driver with it, and
 * fell back to deleting the ids of rows still in the database - so every
 * document whose row was already gone stayed searchable.
 */
async function deleteAllDocuments(indexName: string): Promise<EnqueuedTask> {
  return await client().index(indexName).deleteAllDocuments()
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
  // Meilisearch answers `FilterableAttributes`, which is a list of names OR of
  // per-attribute rule objects. Only the plain names are usable here.
  const attributes = await client().index(index).getFilterableAttributes()

  return (attributes ?? []).filter((a): a is string => typeof a === 'string')
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

function quote(value: unknown): string {
  // Backslashes first: escaping only the quote let a value ending in a
  // backslash turn the closing quote into a literal and run on into the next clause.
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/**
 * The contract's filter as a Meilisearch `filter`.
 *
 * A string or an array is already Meilisearch syntax and goes through as it
 * is. It used to be fed to the object converter regardless, which walks a
 * string's indices - so `.where("status = 'published'")` threw "Refusing to
 * build filter with unsafe field name: 0".
 *
 * An object is `{ field: value }`: field names are checked against
 * {@link SAFE_FILTER_FIELD} and values are quoted, so it is safe to build from
 * input. An array value means any of them (`IN`), and null means `IS NULL`.
 */
function convertToFilter(filter: SearchFilter | undefined): string | Array<string | string[]> | undefined {
  if (filter == null || filter === '')
    return undefined
  if (typeof filter === 'string' || Array.isArray(filter))
    return filter
  if (!isObjectFilter(filter))
    throw new TypeError(`[search/meilisearch] Unsupported filter: ${JSON.stringify(filter)}`)

  const clauses: string[] = []
  for (const [field, value] of Object.entries(filter)) {
    assertSafeField('meilisearch', field)
    if (value === undefined)
      continue
    if (value === null)
      clauses.push(`${field} IS NULL`)
    else if (Array.isArray(value))
      clauses.push(`${field} IN [${value.map(quote).join(', ')}]`)
    else
      clauses.push(`${field} = ${quote(value)}`)
  }

  return clauses.length > 0 ? clauses : undefined
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
  deleteAllDocuments,
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
