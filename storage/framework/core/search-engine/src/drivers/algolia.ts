/**
 * Algolia Search Driver
 *
 * Full-featured Algolia integration for search functionality.
 */

import { searchEngine } from '@stacksjs/config'
import { log } from '@stacksjs/logging'

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
    const error = await response.json().catch(() => ({ message: response.statusText })) as any
    throw new Error(`Algolia API error: ${error.message || response.statusText}`)
  }

  return response.json() as Promise<T>
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

export default algolia
