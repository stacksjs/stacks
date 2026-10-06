/**
 * Algolia Search Driver
 *
 * Two layers. The named exports (`search`, `saveObjects`, `setSettings`, ...)
 * are thin wrappers over Algolia's REST API in Algolia's own terms - 0-based
 * pages, `objectID`, `attributesForFaceting`. The default export is the
 * `SearchEngineDriver` built on them, which is what `useSearchEngine()` hands
 * out when `config/search-engine.ts` selects Algolia, and which speaks the same
 * contract as every other driver.
 */

import type {
  CreateIndexOptions,
  SearchEngineDriver,
  SearchEngineSearchParams,
  SearchFilter,
} from '@stacksjs/types'
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
import { assertSafeField, DEFAULT_SEARCH_LIMIT, isObjectFilter, resolveSearchParams, sortToList } from '../params'

export interface AlgoliaConfig {
  appId: string
  apiKey: string
  searchOnlyApiKey?: string
}

export interface AlgoliaSearchParams {
  query?: string
  page?: number
  hitsPerPage?: number
  filters?: string
  facets?: string[]
  attributesToRetrieve?: string[]
  attributesToHighlight?: string[]
  attributesToSnippet?: string[]
  sortBy?: string
}

export interface AlgoliaHit {
  objectID: string
  [key: string]: any
}

export interface AlgoliaSearchResponse {
  hits: AlgoliaHit[]
  nbHits: number
  page: number
  nbPages: number
  hitsPerPage: number
  processingTimeMS: number
  query: string
  params: string
  facets?: Record<string, Record<string, number>>
}

export interface AlgoliaIndexSettings {
  searchableAttributes?: string[]
  attributesForFaceting?: string[]
  unretrievableAttributes?: string[]
  attributesToRetrieve?: string[]
  ranking?: string[]
  customRanking?: string[]
  replicas?: string[]
  maxValuesPerFacet?: number
  sortFacetValuesBy?: 'count' | 'alpha'
  attributesToHighlight?: string[]
  attributesToSnippet?: string[]
  highlightPreTag?: string
  highlightPostTag?: string
  snippetEllipsisText?: string
  restrictHighlightAndSnippetArrays?: boolean
  minWordSizefor1Typo?: number
  minWordSizefor2Typos?: number
  typoTolerance?: boolean | 'min' | 'strict'
  allowTyposOnNumericTokens?: boolean
  disableTypoToleranceOnAttributes?: string[]
  disableTypoToleranceOnWords?: string[]
  ignorePlurals?: boolean | string[]
  removeStopWords?: boolean | string[]
  separatorsToIndex?: string
  queryType?: 'prefixLast' | 'prefixAll' | 'prefixNone'
  removeWordsIfNoResults?: 'none' | 'lastWords' | 'firstWords' | 'allOptional'
  advancedSyntax?: boolean
  optionalWords?: string[]
  disablePrefixOnAttributes?: string[]
  disableExactOnAttributes?: string[]
  exactOnSingleWordQuery?: 'attribute' | 'none' | 'word'
  alternativesAsExact?: Array<'ignorePlurals' | 'singleWordSynonym' | 'multiWordsSynonym'>
  numericAttributesForFiltering?: string[]
  allowCompressionOfIntegerArray?: boolean
  attributeForDistinct?: string
  distinct?: boolean | number
  replaceSynonymsInHighlight?: boolean
  minProximity?: number
  responseFields?: string[]
  maxFacetHits?: number
  paginationLimitedTo?: number
}

export interface AlgoliaTask {
  taskID: number
  objectID?: string
  objectIDs?: string[]
  createdAt?: string
  updatedAt?: string
}

let config: AlgoliaConfig | null = null

function getConfig(): AlgoliaConfig {
  if (!config) {
    const appId = searchEngine.algolia?.appId || process.env.ALGOLIA_APP_ID || ''
    const apiKey = searchEngine.algolia?.apiKey || process.env.ALGOLIA_API_KEY || ''

    if (!appId || !apiKey) {
      log.error('Algolia credentials not configured. Set ALGOLIA_APP_ID and ALGOLIA_API_KEY.')
      throw new Error('Algolia credentials not configured. Set ALGOLIA_APP_ID and ALGOLIA_API_KEY.')
    }

    config = { appId, apiKey }
  }

  return config
}

function getBaseUrl(): string {
  const { appId } = getConfig()
  return `https://${appId}.algolia.net`
}

function getHeaders(): Record<string, string> {
  const { appId, apiKey } = getConfig()
  return {
    'X-Algolia-Application-Id': appId,
    'X-Algolia-API-Key': apiKey,
    'Content-Type': 'application/json',
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: any,
): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }))
    throw new AlgoliaRequestError(response.status, error.message || response.statusText)
  }

  return response.json() as Promise<T>
}

export class AlgoliaRequestError extends Error {
  constructor(public status: number, message: string) {
    super(`Algolia API error: ${message}`)
  }
}

function isNotFound(error: unknown): boolean {
  return error instanceof AlgoliaRequestError && error.status === 404
}

/**
 * Configure Algolia client
 */
export function configure(options: AlgoliaConfig): void {
  config = options
}

/**
 * Search an index
 */
export async function search(
  indexName: string,
  params: AlgoliaSearchParams = {},
): Promise<AlgoliaSearchResponse> {
  return request<AlgoliaSearchResponse>('POST', `/1/indexes/${indexName}/query`, {
    query: params.query || '',
    page: params.page || 0,
    hitsPerPage: params.hitsPerPage || 20,
    filters: params.filters,
    facets: params.facets,
    attributesToRetrieve: params.attributesToRetrieve,
    attributesToHighlight: params.attributesToHighlight,
    attributesToSnippet: params.attributesToSnippet,
  })
}

/**
 * Multi-index search
 */
export async function multiSearch(
  queries: Array<{ indexName: string, params?: AlgoliaSearchParams }>,
): Promise<{ results: AlgoliaSearchResponse[] }> {
  return request('POST', '/1/indexes/*/queries', {
    requests: queries.map(q => ({
      indexName: q.indexName,
      params: new URLSearchParams({
        query: q.params?.query || '',
        page: String(q.params?.page || 0),
        hitsPerPage: String(q.params?.hitsPerPage || 20),
        ...(q.params?.filters && { filters: q.params.filters }),
      }).toString(),
    })),
  })
}

/**
 * Add or update a single object
 */
export async function saveObject(
  indexName: string,
  object: Record<string, any>,
  objectID?: string,
): Promise<AlgoliaTask> {
  if (objectID) {
    return request('PUT', `/1/indexes/${indexName}/${objectID}`, object)
  }
  return request('POST', `/1/indexes/${indexName}`, object)
}

/**
 * Add or update multiple objects
 */
export async function saveObjects(
  indexName: string,
  objects: Array<Record<string, any>>,
): Promise<AlgoliaTask> {
  return request('POST', `/1/indexes/${indexName}/batch`, {
    requests: objects.map(obj => ({
      action: obj.objectID ? 'updateObject' : 'addObject',
      body: obj,
    })),
  })
}

/**
 * Partially update an object
 */
export async function partialUpdateObject(
  indexName: string,
  objectID: string,
  attributes: Record<string, any>,
  createIfNotExists = true,
): Promise<AlgoliaTask> {
  return request(
    'POST',
    `/1/indexes/${indexName}/${objectID}/partial${createIfNotExists ? '' : '?createIfNotExists=false'}`,
    attributes,
  )
}

/**
 * Delete an object
 */
export async function deleteObject(
  indexName: string,
  objectID: string,
): Promise<AlgoliaTask> {
  return request('DELETE', `/1/indexes/${indexName}/${objectID}`)
}

/**
 * Delete multiple objects
 */
export async function deleteObjects(
  indexName: string,
  objectIDs: string[],
): Promise<AlgoliaTask> {
  return request('POST', `/1/indexes/${indexName}/batch`, {
    requests: objectIDs.map(objectID => ({
      action: 'deleteObject',
      body: { objectID },
    })),
  })
}

/**
 * Delete objects matching a filter
 */
export async function deleteBy(
  indexName: string,
  filters: string,
): Promise<AlgoliaTask> {
  return request('POST', `/1/indexes/${indexName}/deleteByQuery`, { filters })
}

/**
 * Get an object by ID
 */
export async function getObject(
  indexName: string,
  objectID: string,
  attributesToRetrieve?: string[],
): Promise<AlgoliaHit> {
  const params = attributesToRetrieve
    ? `?attributesToRetrieve=${attributesToRetrieve.join(',')}`
    : ''
  return request('GET', `/1/indexes/${indexName}/${objectID}${params}`)
}

/**
 * Get multiple objects by IDs
 */
export async function getObjects(
  indexName: string,
  objectIDs: string[],
  attributesToRetrieve?: string[],
): Promise<{ results: AlgoliaHit[] }> {
  return request('POST', '/1/indexes/*/objects', {
    requests: objectIDs.map(objectID => ({
      indexName,
      objectID,
      attributesToRetrieve,
    })),
  })
}

/**
 * Clear all objects from an index
 */
export async function clearObjects(indexName: string): Promise<AlgoliaTask> {
  return request('POST', `/1/indexes/${indexName}/clear`)
}

/**
 * Get index settings
 */
export async function getSettings(indexName: string): Promise<AlgoliaIndexSettings> {
  return request('GET', `/1/indexes/${indexName}/settings`)
}

/**
 * Update index settings
 */
export async function setSettings(
  indexName: string,
  settings: AlgoliaIndexSettings,
  forwardToReplicas = false,
): Promise<AlgoliaTask> {
  return request(
    'PUT',
    `/1/indexes/${indexName}/settings${forwardToReplicas ? '?forwardToReplicas=true' : ''}`,
    settings,
  )
}

/**
 * List all indices
 */
export async function listIndices(): Promise<{
  items: Array<{
    name: string
    createdAt: string
    updatedAt: string
    entries: number
    dataSize: number
    fileSize: number
    lastBuildTimeS: number
    numberOfPendingTasks: number
    pendingTask: boolean
    primary?: string
    replicas?: string[]
  }>
}> {
  return request('GET', '/1/indexes')
}

/**
 * Copy an index
 */
export async function copyIndex(
  srcIndexName: string,
  dstIndexName: string,
  scope?: Array<'settings' | 'synonyms' | 'rules'>,
): Promise<AlgoliaTask> {
  return request('POST', `/1/indexes/${srcIndexName}/operation`, {
    operation: 'copy',
    destination: dstIndexName,
    scope,
  })
}

/**
 * Move an index
 */
export async function moveIndex(
  srcIndexName: string,
  dstIndexName: string,
): Promise<AlgoliaTask> {
  return request('POST', `/1/indexes/${srcIndexName}/operation`, {
    operation: 'move',
    destination: dstIndexName,
  })
}

/**
 * Delete an index
 */
export async function deleteIndex(indexName: string): Promise<AlgoliaTask> {
  return request('DELETE', `/1/indexes/${indexName}`)
}

/**
 * Check if an index exists
 */
export async function indexExists(indexName: string): Promise<boolean> {
  try {
    await request('GET', `/1/indexes/${indexName}/settings`)
    return true
  }
  catch {
    return false
  }
}

/**
 * Wait for a task to complete
 */
export async function waitTask(
  indexName: string,
  taskID: number,
  timeoutMs = 10000,
  intervalMs = 100,
): Promise<{ status: 'published' | 'notPublished' }> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const response = await request<{ status: 'published' | 'notPublished' }>(
      'GET',
      `/1/indexes/${indexName}/task/${taskID}`,
    )

    if (response.status === 'published') {
      return response
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }

  throw new Error(`Task ${taskID} timed out after ${timeoutMs}ms`)
}

/**
 * Add a synonym
 */
export async function saveSynonym(
  indexName: string,
  synonym: {
    objectID: string
    type: 'synonym' | 'oneWaySynonym' | 'altCorrection1' | 'altCorrection2' | 'placeholder'
    synonyms?: string[]
    input?: string
    word?: string
    corrections?: string[]
    placeholder?: string
    replacements?: string[]
  },
  forwardToReplicas = false,
): Promise<AlgoliaTask> {
  return request(
    'PUT',
    `/1/indexes/${indexName}/synonyms/${synonym.objectID}${forwardToReplicas ? '?forwardToReplicas=true' : ''}`,
    synonym,
  )
}

/**
 * Search synonyms
 */
export async function searchSynonyms(
  indexName: string,
  query = '',
  type?: string,
  page = 0,
  hitsPerPage = 20,
): Promise<{ hits: any[], nbHits: number }> {
  return request('POST', `/1/indexes/${indexName}/synonyms/search`, {
    query,
    type,
    page,
    hitsPerPage,
  })
}

/**
 * Clear all synonyms
 */
export async function clearSynonyms(
  indexName: string,
  forwardToReplicas = false,
): Promise<AlgoliaTask> {
  return request(
    'POST',
    `/1/indexes/${indexName}/synonyms/clear${forwardToReplicas ? '?forwardToReplicas=true' : ''}`,
  )
}

/**
 * Add a rule
 */
export async function saveRule(
  indexName: string,
  rule: {
    objectID: string
    conditions?: Array<{
      pattern?: string
      anchoring?: 'is' | 'startsWith' | 'endsWith' | 'contains'
      context?: string
    }>
    consequence: {
      params?: Record<string, any>
      promote?: Array<{ objectID: string, position: number }>
      hide?: Array<{ objectID: string }>
      userData?: Record<string, any>
    }
    description?: string
    enabled?: boolean
    validity?: Array<{ from: number, until: number }>
  },
  forwardToReplicas = false,
): Promise<AlgoliaTask> {
  return request(
    'PUT',
    `/1/indexes/${indexName}/rules/${rule.objectID}${forwardToReplicas ? '?forwardToReplicas=true' : ''}`,
    rule,
  )
}

/**
 * Search rules
 */
export async function searchRules(
  indexName: string,
  query = '',
  anchoring?: string,
  context?: string,
  page = 0,
  hitsPerPage = 20,
): Promise<{ hits: any[], nbHits: number }> {
  return request('POST', `/1/indexes/${indexName}/rules/search`, {
    query,
    anchoring,
    context,
    page,
    hitsPerPage,
  })
}

/**
 * Clear all rules
 */
export async function clearRules(
  indexName: string,
  forwardToReplicas = false,
): Promise<AlgoliaTask> {
  return request(
    'POST',
    `/1/indexes/${indexName}/rules/clear${forwardToReplicas ? '?forwardToReplicas=true' : ''}`,
  )
}

/**
 * Browse all records in an index
 */
export async function* browse(
  indexName: string,
  params: AlgoliaSearchParams = {},
): AsyncGenerator<AlgoliaHit> {
  let cursor: string | undefined

  do {
    const response = await request<AlgoliaSearchResponse & { cursor?: string }>(
      'POST',
      `/1/indexes/${indexName}/browse`,
      {
        ...params,
        cursor,
      },
    )

    for (const hit of response.hits) {
      yield hit
    }

    cursor = response.cursor
  } while (cursor)
}

/**
 * The raw REST wrappers, in Algolia's own terms. The driver is the default
 * export.
 */
export const algolia = {
  configure,
  search,
  multiSearch,
  saveObject,
  saveObjects,
  partialUpdateObject,
  deleteObject,
  deleteObjects,
  deleteBy,
  getObject,
  getObjects,
  clearObjects,
  getSettings,
  setSettings,
  listIndices,
  copyIndex,
  moveIndex,
  deleteIndex,
  indexExists,
  waitTask,
  saveSynonym,
  searchSynonyms,
  clearSynonyms,
  saveRule,
  searchRules,
  clearRules,
  browse,
}

/* -------------------------------------------------------------------------- */
/*  SearchEngineDriver                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The default export used to be the object above, cast to `SearchEngineDriver`
 * where the driver is bound. It had none of `addDocument`, `addDocuments`,
 * `updateSettings`, `deleteDocument`, `getIndex` and most of the rest, so with
 * Algolia selected every model save failed with "has no method" and nothing was
 * ever indexed - and the cast kept `tsc` from saying so. What follows is that
 * contract, typed against the interface so a missing member is a compile error.
 */

function unsupported(feature: string, hint: string): never {
  throw new Error(`[search/algolia] ${feature} is not supported by Algolia. ${hint}`)
}

function toTask(indexUid: string, type: string, task?: Partial<AlgoliaTask>): EnqueuedTask {
  return {
    taskUid: Number(task?.taskID ?? 0),
    indexUid,
    status: 'enqueued',
    type,
    enqueuedAt: task?.createdAt ?? task?.updatedAt ?? new Date().toISOString(),
  } as unknown as EnqueuedTask
}

const BATCH_SIZE = 1000

/** Documents carry `id`; Algolia keys them by `objectID`. */
function withObjectId(doc: Record<string, unknown>): Record<string, unknown> {
  const id = doc.objectID ?? doc.id
  return id == null ? { ...doc } : { ...doc, objectID: String(id) }
}

async function batch(
  indexName: string,
  requests: Array<{ action: string, body: Record<string, unknown> }>,
): Promise<AlgoliaTask | undefined> {
  let last: AlgoliaTask | undefined
  for (let i = 0; i < requests.length; i += BATCH_SIZE)
    last = await request<AlgoliaTask>('POST', `/1/indexes/${indexName}/batch`, { requests: requests.slice(i, i + BATCH_SIZE) })
  return last
}

function quoteValue(value: unknown): string {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function filterClause(field: string, value: unknown): string {
  if (typeof value === 'number')
    return `${field} = ${value}`
  if (typeof value === 'boolean')
    return `${field}:${value}`
  return `${field}:${quoteValue(value)}`
}

/**
 * The contract's filter as an Algolia `filters` string.
 *
 * A string is Algolia syntax and goes through. An array is clauses that must
 * all hold, a nested array an OR group. An object is `{ field: value }`, with
 * field names checked and string values quoted; an array value means any of
 * them. Algolia has no way to filter on a missing value, so null is refused.
 */
function toAlgoliaFilters(filter: SearchFilter | undefined): string | undefined {
  if (filter == null || filter === '')
    return undefined
  if (typeof filter === 'string')
    return filter
  if (Array.isArray(filter)) {
    const clauses = filter.filter(Boolean).map(clause => Array.isArray(clause) ? `(${clause.join(' OR ')})` : `(${clause})`)
    return clauses.length > 0 ? clauses.join(' AND ') : undefined
  }
  if (!isObjectFilter(filter))
    throw new TypeError(`[search/algolia] Unsupported filter: ${JSON.stringify(filter)}`)

  const clauses: string[] = []
  for (const [field, value] of Object.entries(filter)) {
    assertSafeField('algolia', field)
    if (value === undefined)
      continue
    if (value === null)
      throw new TypeError(`[search/algolia] Algolia cannot filter on a missing value (${field}: null)`)
    clauses.push(Array.isArray(value) ? `(${value.map(v => filterClause(field, v)).join(' OR ')})` : filterClause(field, value))
  }
  return clauses.length > 0 ? clauses.join(' AND ') : undefined
}

const SEARCH_PASSTHROUGH = ['facets', 'attributesToRetrieve', 'attributesToHighlight', 'attributesToSnippet', 'restrictSearchableAttributes'] as const

/**
 * Search, in the contract's terms.
 *
 * The raw `search` above takes Algolia's 0-based `page` and `hitsPerPage`; the
 * other drivers take `limit` / `offset` or a 1-based `page`. A page-aligned
 * offset becomes Algolia's page, anything else its `offset` / `length` pair.
 */
async function driverSearch(index: string, params: SearchEngineSearchParams = {}): Promise<SearchResponse<Record<string, any>>> {
  const { query, limit, offset, filter, sort } = resolveSearchParams(params, searchEngine.perPage ?? DEFAULT_SEARCH_LIMIT)

  if (sortToList('algolia', sort).length > 0)
    unsupported('Sorting at query time', 'Algolia sorts through replica indices: create a replica ranked by the attribute (e.g. `products_price_asc`) and search that index instead.')

  const body: Record<string, unknown> = { query }
  if (limit > 0 && offset % limit === 0) {
    body.page = offset / limit
    body.hitsPerPage = limit
  }
  else {
    body.offset = offset
    body.length = limit
  }

  const filters = (params.filters as string | undefined) || toAlgoliaFilters(filter)
  if (filters)
    body.filters = filters

  for (const key of SEARCH_PASSTHROUGH) {
    if (params[key] !== undefined)
      body[key] = params[key]
  }

  const result = await request<AlgoliaSearchResponse>('POST', `/1/indexes/${index}/query`, body)

  return {
    hits: result.hits ?? [],
    query: result.query ?? query,
    processingTimeMs: result.processingTimeMS ?? 0,
    limit,
    offset,
    estimatedTotalHits: result.nbHits ?? result.hits?.length ?? 0,
    ...(result.facets ? { facetDistribution: result.facets } : {}),
  } as SearchResponse<Record<string, any>>
}

/* Settings: Meilisearch-shaped in, Algolia-shaped out, and back. */

/** `filterOnly(brand)`, `searchable(brand)`, `unordered(name)` -> the attribute name. */
function stripModifier(attribute: string): string {
  const match = /^\w+\((.+)\)$/.exec(attribute)
  return match ? match[1]! : attribute
}

function attributeList(list: Settings['filterableAttributes'] | Settings['searchableAttributes']): string[] | null {
  if (list == null)
    return null
  return list.flatMap(entry => typeof entry === 'string' ? [entry] : entry.attributePatterns)
}

/** Meilisearch's `['*']` is "every attribute", which Algolia spells as unset. */
function allOrList(list: string[] | null | undefined): string[] | null {
  if (list == null || list.length === 0 || (list.length === 1 && list[0] === '*'))
    return null
  return list
}

function toAlgoliaRanking(rules: string[]): string[] {
  return rules.flatMap((rule) => {
    const custom = /^([\w.]+):(asc|desc)$/.exec(rule)
    if (custom)
      return [`${custom[2]}(${custom[1]})`]
    if (rule === 'exactness')
      return ['exact']
    // Meilisearch's `sort` rule is where query-time sorting ranks; Algolia has
    // no query-time sort to place.
    if (rule === 'sort')
      return []
    return [rule]
  })
}

function fromAlgoliaRanking(ranking: string[]): string[] {
  return ranking.map((rule) => {
    const custom = /^(asc|desc)\(([\w.]+)\)$/.exec(rule)
    if (custom)
      return `${custom[2]}:${custom[1]}`
    return rule === 'exact' ? 'exactness' : rule
  })
}

function toAlgoliaTypoTolerance(typo: TypoTolerance): AlgoliaIndexSettings {
  if (typo == null)
    return { typoTolerance: null, minWordSizefor1Typo: null, minWordSizefor2Typos: null, disableTypoToleranceOnAttributes: null, disableTypoToleranceOnWords: null } as unknown as AlgoliaIndexSettings
  const out: Record<string, unknown> = {}
  if (typo.enabled != null) out.typoTolerance = typo.enabled
  if (typo.minWordSizeForTypos?.oneTypo != null) out.minWordSizefor1Typo = typo.minWordSizeForTypos.oneTypo
  if (typo.minWordSizeForTypos?.twoTypos != null) out.minWordSizefor2Typos = typo.minWordSizeForTypos.twoTypos
  if (typo.disableOnAttributes !== undefined) out.disableTypoToleranceOnAttributes = typo.disableOnAttributes
  if (typo.disableOnWords !== undefined) out.disableTypoToleranceOnWords = typo.disableOnWords
  if (typo.disableOnNumbers != null) out.allowTyposOnNumericTokens = !typo.disableOnNumbers
  return out as AlgoliaIndexSettings
}

/**
 * Map contract settings onto Algolia's. `null` resets an Algolia setting to its
 * default, which is what a Meilisearch `null` means too.
 *
 * `sortableAttributes` has no Algolia equivalent - sorting is a replica index -
 * and `dictionary` none either. They are skipped with a warning rather than
 * failing the whole call, because the model settings sync sends
 * `sortableAttributes` for every model that declares `sortable`, and refusing
 * those would stop the searchable and filterable lists from applying.
 */
function toAlgoliaSettings(settings: Settings): AlgoliaIndexSettings {
  const out: Record<string, unknown> = {}
  const skipped: string[] = []

  for (const [key, value] of Object.entries(settings)) {
    if (value === undefined)
      continue
    switch (key) {
      case 'searchableAttributes':
        out.searchableAttributes = allOrList(value as string[] | null)
        break
      case 'filterableAttributes':
        out.attributesForFaceting = attributeList(value as Settings['filterableAttributes'])
        break
      case 'displayedAttributes':
        out.attributesToRetrieve = allOrList(value as string[] | null)
        break
      case 'rankingRules':
        out.ranking = value == null ? null : toAlgoliaRanking(value as string[])
        break
      case 'distinctAttribute':
        out.attributeForDistinct = value
        out.distinct = value == null ? null : true
        break
      case 'pagination':
        out.paginationLimitedTo = (value as PaginationSettings | null)?.maxTotalHits ?? null
        break
      case 'faceting': {
        const faceting = value as Faceting | null
        out.maxValuesPerFacet = faceting?.maxValuesPerFacet ?? null
        const order = faceting?.sortFacetValuesBy?.['*']
        if (order !== undefined || faceting == null)
          out.sortFacetValuesBy = order ?? null
        break
      }
      case 'typoTolerance':
        Object.assign(out, toAlgoliaTypoTolerance(value as TypoTolerance))
        break
      case 'synonyms':
        // Synonyms are their own objects in Algolia, written by updateSynonyms.
        break
      default:
        skipped.push(key)
    }
  }

  if (skipped.length > 0)
    log.warn(`[search/algolia] Skipped settings with no Algolia equivalent: ${skipped.join(', ')}. Algolia sorts through replica indices.`)

  return out as AlgoliaIndexSettings
}

function fromAlgoliaSettings(settings: AlgoliaIndexSettings): Settings {
  return {
    searchableAttributes: (settings.searchableAttributes ?? ['*']).map(stripModifier),
    filterableAttributes: (settings.attributesForFaceting ?? []).map(stripModifier),
    sortableAttributes: [],
    displayedAttributes: settings.attributesToRetrieve ?? ['*'],
    rankingRules: fromAlgoliaRanking(settings.ranking ?? []),
    distinctAttribute: settings.distinct ? (settings.attributeForDistinct ?? null) : null,
    pagination: { maxTotalHits: settings.paginationLimitedTo ?? null },
    faceting: {
      maxValuesPerFacet: settings.maxValuesPerFacet ?? null,
      ...(settings.sortFacetValuesBy ? { sortFacetValuesBy: { '*': settings.sortFacetValuesBy } } : {}),
    },
    typoTolerance: {
      enabled: settings.typoTolerance === undefined ? true : settings.typoTolerance !== false,
      minWordSizeForTypos: { oneTypo: settings.minWordSizefor1Typo ?? null, twoTypos: settings.minWordSizefor2Typos ?? null },
      disableOnAttributes: settings.disableTypoToleranceOnAttributes ?? [],
      disableOnWords: settings.disableTypoToleranceOnWords ?? [],
    },
  }
}

async function readSettings(index: string): Promise<Settings> {
  return fromAlgoliaSettings(await getSettings(index))
}

async function writeSettings(index: string, settings: Settings, type = 'settingsUpdate'): Promise<EnqueuedTask> {
  const algoliaSettings = toAlgoliaSettings(settings)
  const task = await setSettings(index, algoliaSettings)
  return toTask(index, type, task)
}

function settingAccessors<K extends keyof Settings>(key: K, reset: Settings[K]) {
  return {
    get: async (index: string): Promise<NonNullable<Settings[K]>> => (await readSettings(index))[key] as NonNullable<Settings[K]>,
    update: (index: string, value: Settings[K]): Promise<EnqueuedTask> => writeSettings(index, { [key]: value } as Settings),
    reset: (index: string): Promise<EnqueuedTask> => writeSettings(index, { [key]: reset } as Settings),
  }
}

const filterableSetting = settingAccessors('filterableAttributes', null)
const searchableSetting = settingAccessors('searchableAttributes', null)
const displayedSetting = settingAccessors('displayedAttributes', null)
const rankingSetting = settingAccessors('rankingRules', null)
const paginationSetting = settingAccessors('pagination', null as unknown as PaginationSettings)
const facetingSetting = settingAccessors('faceting', null as unknown as Faceting)
const typoSetting = settingAccessors('typoTolerance', null)

const SORTABLE_HINT = 'Algolia sorts through replica indices: create a replica ranked by the attribute and search that index instead.'
const DICTIONARY_HINT = 'Use Algolia\'s dictionaries API (stop words, plurals, compounds) from the Algolia dashboard instead.'

/**
 * Synonyms, as Meilisearch spells them: `{ word: [synonyms] }`, each a one-way
 * mapping. Algolia stores them as objects of their own; these are written as
 * one-way synonyms keyed `stacks-<word>`, replacing what was there.
 */
async function updateSynonyms(index: string, synonyms: Synonyms): Promise<EnqueuedTask> {
  if (synonyms == null)
    return resetSynonyms(index)
  const objects = Object.entries(synonyms).map(([input, list]) => ({
    objectID: `stacks-${input}`,
    type: 'oneWaySynonym',
    input,
    synonyms: list,
  }))
  const task = await request<AlgoliaTask>('POST', `/1/indexes/${index}/synonyms/batch?replaceExistingSynonyms=true`, objects)
  return toTask(index, 'settingsUpdate', task)
}

async function resetSynonyms(index: string): Promise<EnqueuedTask> {
  return toTask(index, 'settingsUpdate', await clearSynonyms(index))
}

async function getSynonyms(index: string): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {}
  let page = 0
  while (true) {
    const { hits, nbHits } = await searchSynonyms(index, '', undefined, page, 100)
    for (const hit of hits as Array<{ type: string, input?: string, synonyms?: string[] }>) {
      if (hit.type === 'oneWaySynonym' && hit.input) {
        out[hit.input] = [...(out[hit.input] ?? []), ...(hit.synonyms ?? [])]
      }
      else if (hit.type === 'synonym') {
        for (const word of hit.synonyms ?? [])
          out[word] = [...(out[word] ?? []), ...(hit.synonyms ?? []).filter(other => other !== word)]
      }
    }
    page++
    if (hits.length === 0 || page * 100 >= nbHits)
      break
  }
  return out
}

async function driverCreateIndex(name: string, options?: CreateIndexOptions): Promise<EnqueuedTask> {
  if (options?.primaryKey && options.primaryKey !== 'id' && options.primaryKey !== 'objectID')
    unsupported(`A primary key other than \`id\` (${options.primaryKey})`, 'Algolia keys every record by `objectID`, which the driver takes from `id`.')
  // Algolia creates an index on its first write; writing its settings is that write.
  return await writeSettings(name, options?.settings ?? {}, 'indexCreation')
}

async function driverGetIndex(name: string): Promise<Index<Record<string, any>>> {
  const { items } = await listIndices()
  const item = items.find(candidate => candidate.name === name)
  if (!item)
    throw new AlgoliaRequestError(404, `Index ${name} does not exist`)
  return { uid: item.name, primaryKey: 'objectID', createdAt: item.createdAt, updatedAt: item.updatedAt } as unknown as Index<Record<string, any>>
}

async function driverListIndexes(): Promise<IndexesResults<Index[]>> {
  const { items } = await listIndices()
  const results = items.map(item => ({ uid: item.name, primaryKey: 'objectID', createdAt: item.createdAt, updatedAt: item.updatedAt }))
  return { results, offset: 0, limit: results.length, total: results.length } as unknown as IndexesResults<Index[]>
}

async function driverDeleteIndex(name: string): Promise<EnqueuedTask> {
  try {
    return toTask(name, 'indexDeletion', await deleteIndex(name))
  }
  catch (error) {
    if (!isNotFound(error)) throw error
    return toTask(name, 'indexDeletion')
  }
}

async function addDocument(indexName: string, document: Record<string, unknown>): Promise<EnqueuedTask> {
  const object = withObjectId(document)
  const task = object.objectID == null
    ? await saveObject(indexName, object)
    : await saveObject(indexName, object, encodeURIComponent(String(object.objectID)))
  return toTask(indexName, 'documentAdditionOrUpdate', task)
}

async function addDocuments(indexName: string, documents: Record<string, unknown>[]): Promise<EnqueuedTask> {
  if (!Array.isArray(documents))
    throw new TypeError('[search/algolia] addDocuments requires an array of documents')
  const requests = documents.map((document) => {
    const body = withObjectId(document)
    return { action: body.objectID == null ? 'addObject' : 'updateObject', body }
  })
  return toTask(indexName, 'documentAdditionOrUpdate', await batch(indexName, requests))
}

/** A partial update, as Meilisearch's `updateDocuments` is: unnamed fields are kept. */
async function updateDocuments(indexName: string, documents: DocumentOptions[]): Promise<EnqueuedTask> {
  const requests = (documents as unknown as Record<string, unknown>[]).map((document) => {
    const body = withObjectId(document)
    if (body.objectID == null)
      throw new Error('[search/algolia] updateDocuments needs an `id` (or `objectID`) on every document')
    return { action: 'partialUpdateObject', body }
  })
  return toTask(indexName, 'documentAdditionOrUpdate', await batch(indexName, requests))
}

async function getDocument(indexName: string, id: number | string, fields?: any): Promise<any> {
  const list: string[] | undefined = Array.isArray(fields) ? fields : Array.isArray(fields?.fields) ? fields.fields : undefined
  return await getObject(indexName, encodeURIComponent(String(id)), list)
}

async function driverDeleteDocument(indexName: string, id: number): Promise<EnqueuedTask> {
  return toTask(indexName, 'documentDeletion', await deleteObject(indexName, encodeURIComponent(String(id))))
}

async function deleteDocuments(indexName: string, filters: string | string[]): Promise<EnqueuedTask> {
  const algoliaFilters = toAlgoliaFilters(filters)
  if (!algoliaFilters)
    throw new Error(`[search/algolia] deleteDocuments on "${indexName}" needs a filter. Use deleteAllDocuments to empty the index.`)
  return toTask(indexName, 'documentDeletion', await deleteBy(indexName, algoliaFilters))
}

/** Empty the index, keeping its settings, synonyms and rules. */
async function deleteAllDocuments(indexName: string): Promise<EnqueuedTask> {
  try {
    return toTask(indexName, 'documentDeletion', await clearObjects(indexName))
  }
  catch (error) {
    if (!isNotFound(error)) throw error
    return toTask(indexName, 'documentDeletion')
  }
}

/** Every setting this driver maps, set back to Algolia's default. */
async function resetSettings(index: string): Promise<EnqueuedTask> {
  return await writeSettings(index, {
    searchableAttributes: null,
    filterableAttributes: null,
    displayedAttributes: null,
    rankingRules: null,
    distinctAttribute: null,
    pagination: null as unknown as PaginationSettings,
    faceting: null as unknown as Faceting,
    typoTolerance: null,
  })
}

const algoliaDriver: SearchEngineDriver = {
  client: () => ({ request, configure }) as unknown as ReturnType<SearchEngineDriver['client']>,
  resetClient: () => { config = null },
  search: driverSearch,

  createIndex: driverCreateIndex,
  getIndex: driverGetIndex,
  updateIndex: (_name: string, _options: IndexOptions) =>
    unsupported('Changing an index\'s primary key', 'Algolia keys every record by `objectID`, which the driver takes from `id`.'),
  deleteIndex: driverDeleteIndex,
  listAllIndexes: driverListIndexes,
  listAllIndices: driverListIndexes,

  addDocument,
  addDocuments,
  updateDocument: (indexName, document) => updateDocuments(indexName, [document]),
  updateDocuments,
  getDocument,
  deleteDocument: driverDeleteDocument,
  deleteDocuments,
  deleteAllDocuments,

  getFilterableAttributes: async index => (await filterableSetting.get(index)).filter((a): a is string => typeof a === 'string'),
  updateFilterableAttributes: filterableSetting.update,
  resetFilterableAttributes: filterableSetting.reset,

  getSearchableAttributes: searchableSetting.get,
  updateSearchableAttributes: searchableSetting.update,
  resetSearchableAttributes: searchableSetting.reset,

  getSortableAttributes: async () => unsupported('Sortable attributes', SORTABLE_HINT),
  updateSortableAttributes: async () => unsupported('Sortable attributes', SORTABLE_HINT),
  resetSortableAttributes: async () => unsupported('Sortable attributes', SORTABLE_HINT),

  getDisplayedAttributes: displayedSetting.get,
  updateDisplayedAttributes: displayedSetting.update,
  resetDisplayedAttributes: displayedSetting.reset,

  getSettings: readSettings,
  updateSettings: (index, settings) => writeSettings(index, settings),
  resetSettings,

  getPagination: paginationSetting.get,
  updatePagination: paginationSetting.update,
  resetPagination: paginationSetting.reset,

  getSynonyms,
  updateSynonyms,
  resetSynonyms,

  getRankingRules: rankingSetting.get,
  updateRankingRules: rankingSetting.update,
  resetRankingRules: rankingSetting.reset,

  getDistinctAttribute: async index => (await readSettings(index)).distinctAttribute ?? null,
  updateDistinctAttribute: (index, distinctAttribute) => writeSettings(index, { distinctAttribute }),
  resetDistinctAttribute: index => writeSettings(index, { distinctAttribute: null }),

  getFaceting: facetingSetting.get,
  updateFaceting: facetingSetting.update,
  resetFaceting: facetingSetting.reset,

  getTypoTolerance: typoSetting.get,
  updateTypoTolerance: typoSetting.update,
  resetTypoTolerance: typoSetting.reset,

  getDictionary: async (): Promise<Dictionary> => unsupported('A custom dictionary', DICTIONARY_HINT),
  updateDictionary: async () => unsupported('A custom dictionary', DICTIONARY_HINT),
  resetDictionary: async () => unsupported('A custom dictionary', DICTIONARY_HINT),
}

export default algoliaDriver
