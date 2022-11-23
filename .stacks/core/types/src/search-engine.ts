import type { EnqueuedTask, Hits, Index, IndexOptions, IndexesResults, MeiliSearch, Document as Record, DocumentOptions as RecordOptions, Documents as Records, DocumentsResults as RecordsResults, Settings as SearchEngineSettings, SearchParams, SearchResponse } from 'meilisearch'
import type { MaybePromise } from '.'

export type { EnqueuedTask, Hits, Index, IndexOptions, IndexesResults, MeiliSearch, Record, RecordOptions, Records, RecordsResults, SearchEngineSettings, SearchParams, SearchResponse }

export interface SearchEngineOptions {
  /**
   * ### Search Engine Driver
   *
   * The search engine to utilize.
   *
   * @default string 'meilisearch'
   * @see https://stacksjs.dev/docs/search-engine
   */
  driver: 'meilisearch' | 'algolia'
}

type Search = any

export interface SearchEngineDriver {
  client: MeiliSearch

  // Indexes
  createIndex: (name: string, options?: IndexOptions) => MaybePromise<EnqueuedTask>
  getIndex: (name: string) => MaybePromise<Index>
  updateIndex?: (name: string, options: IndexOptions) => MaybePromise<EnqueuedTask>
  deleteIndex?: (name: string) => MaybePromise<EnqueuedTask>
  updateIndexSettings: (name: string, settings: SearchEngineSettings) => MaybePromise<EnqueuedTask>
  listAllIndexes: () => MaybePromise<IndexesResults<Index[]>>
  listAllIndices: () => MaybePromise<IndexesResults<Index[]>> // alternatives plural spelling

  // Records (MeiliSearch uses the term "documents")
  getRecord?: (key: string) => MaybePromise<Record>
  getRecords?: (key: string) => MaybePromise<RecordOptions>
  createRecord?: (record: Record, indexName: string, options: RecordOptions) => MaybePromise<EnqueuedTask>
  createRecords?: (records: Records, indexName: string, options: RecordOptions) => MaybePromise<EnqueuedTask>
  createOrReplaceRecord?: (record: Record, indexName: string, options: RecordOptions) => MaybePromise<EnqueuedTask>
  createOrUpdateRecord?: (record: Record, indexName: string, options: RecordOptions) => MaybePromise<EnqueuedTask>
  deleteRecord?: (recordId: string | number, indexName: string) => MaybePromise<EnqueuedTask>
  deleteAllRecords?: (indexName: string) => MaybePromise<EnqueuedTask>
  batchDeleteRecords?: (recordIds: string[] | number[], indexName: string) => MaybePromise<EnqueuedTask>

  // Search
  search?: (query: string, indexName: string, options: SearchParams) => MaybePromise<Search>

  calculatePagination: any
  currentPage: any
  filterName: any
  filters: any
  goToNextPage: any
  goToPage: any
  goToPrevPage: any
  hits: any
  index: any
  lastPageNumber: any
  perPage: any
  query: any
  results: any
  searchFilters: any
  searchParams: any
  setTotalHits: any
  sort: any
  sorts: any
  totalPages: any
}

/**
 * the TableStore interface is primarily used to unify the persisting of data to localStorage
 */
export interface SearchEngineStorage {
  /**
   * The search engine index name.
   * i.e. the type of table, like `users`, `posts`, `products`, etc.
   */
  index?: string
  /**
   * The search engine results object.
   */
  results?: SearchResponse
  /**
   * The search engine hits object.
   */
  hits?: Hits
  /**
   * The number of hits to be returned per page.
   *
   * @default number 20
   */
  perPage: number
  /**
   * The current page number.
   *
   * @default number 1
   */
  currentPage: number
}
