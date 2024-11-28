import { ExitCode, type MeilisearchOptions, type SearchEngineDriver } from '@stacksjs/types'
import { searchEngine } from '@stacksjs/config'

import { EnqueuedTask, Index, MeiliSearch, type DocumentOptions, type IndexesResults, type IndexOptions } from 'meilisearch'
import { log } from '@stacksjs/logging'

function client(): MeiliSearch {
  const host = searchEngine.meilisearch?.host || 'http://127.0.0.1:7700'
  let apiKey = searchEngine.meilisearch?.apiKey || ''

  if (!host) {
    log.error('Please specify a search engine host.')
    process.exit(ExitCode.FatalError)
  }

  return new MeiliSearch({ host, apiKey })
}

// async function search(index: string, params: any): Promise<SearchResponse<Record<string, any>>> {
//   const offsetVal = ((params.page * params.perPage) - 20) || 0
//   const filter = convertToFilter(params.filter)
//   const sort = convertToMeilisearchSorting(params.sort)

//   return await client()
//     .index(index)
//     .search(params.query, { limit: params.perPage, filter, sort, offset: offsetVal })
// }

async function addDocument(indexName: string, params: any): Promise<EnqueuedTask> {
  return await client().index(indexName).addDocuments([params])
}

async function addDocuments(indexName: string, params: any[]): Promise<EnqueuedTask> {
  return await client().index(indexName).addDocuments(params)
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

// function convertToFilter(jsonData: any): string[] {
//   const filters: string[] = []

//   for (const key in jsonData) {
//     if (Object.prototype.hasOwnProperty.call(jsonData, key)) {
//       const value = jsonData[key]
//       const filter = `${key}='${value}'`
//       filters.push(filter)
//     }
//   }

//   return filters
// }

// function convertToMeilisearchSorting(jsonData: any): string[] {
//   const filters: string[] = []

//   for (const key in jsonData) {
//     if (Object.prototype.hasOwnProperty.call(jsonData, key)) {
//       const value = jsonData[key]
//       const filter = `${key}='${value}'`
//       filters.push(filter)
//     }
//   }

//   return filters
// }
const meilisearch: SearchEngineDriver = {
  client,
//   search,
  createIndex,
  deleteIndex,
  updateIndex,
  listAllIndexes,
  addDocument,
  addDocuments,
//   updateDocument,
  listAllIndices: listAllIndexes,
  updateDocuments,
  deleteDocument,
  deleteDocuments,
  getDocument,
}


export default meilisearch