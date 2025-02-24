import type { SearchEngineDriver } from '@stacksjs/types'
import type { Dictionary, DocumentOptions, EnqueuedTask, Faceting, Index, IndexesResults, IndexOptions, PaginationSettings, SearchResponse, Settings, Synonyms, TypoTolerance } from 'meilisearch'
import process from 'node:process'

import { searchEngine } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { ExitCode } from '@stacksjs/types'
import { Meilisearch } from 'meilisearch'

function client(): Meilisearch {
  const host = searchEngine.meilisearch?.host || 'http://127.0.0.1:7700'
  const apiKey = searchEngine.meilisearch?.apiKey || ''

  if (!host) {
    log.error('Please specify a search engine host.')
    process.exit(ExitCode.FatalError)
  }

  return new Meilisearch({ host, apiKey })
}

async function search(index: string, params: any): Promise<SearchResponse<Record<string, any>>> {
  const offsetVal = ((params.page * params.perPage) - 20) || 0
  const filter = convertToFilter(params.filter)
  const sort = convertToMeilisearchSorting(params.sort)

  return await client()
    .index(index)
    .search(params.query, { limit: params.perPage, filter, sort, offset: offsetVal })
}

async function addDocument(indexName: string, params: any): Promise<EnqueuedTask> {
  return await client().index(indexName).addDocuments([params])
}

async function addDocuments(indexName: string, params: any[]): Promise<EnqueuedTask> {
  return await client().index(indexName).addDocuments(params)
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
  return client().index(index).getFilterableAttributes()
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

function convertToFilter(jsonData: any): string[] {
  const filters: string[] = []

  for (const key in jsonData) {
    if (Object.prototype.hasOwnProperty.call(jsonData, key)) {
      const value = jsonData[key]
      const filter = `${key}='${value}'`
      filters.push(filter)
    }
  }

  return filters
}

function convertToMeilisearchSorting(jsonData: any): string[] {
  const filters: string[] = []

  for (const key in jsonData) {
    if (Object.prototype.hasOwnProperty.call(jsonData, key)) {
      const value = jsonData[key]
      const filter = `${key}='${value}'`
      filters.push(filter)
    }
  }

  return filters
}

const meilisearch: SearchEngineDriver = {
  client,
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
