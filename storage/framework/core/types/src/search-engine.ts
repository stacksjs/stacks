import type {
  EnqueuedTask,
  Hits,
  Index,
  IndexOptions,
  IndexesResults,
  MeiliSearch,
  Settings as MeilisearchOptions,
  DocumentOptions as RecordOptions,
  SearchParams,
  SearchResponse,
} from 'meilisearch'
import type { MaybePromise } from '.'

type Search = any
type Page = any
type Pages = Page[]
type Filter = any
type Filters = Filter[]
type Result = any
type Results = Result[]
type SearchFilter = any
type SearchFilters = SearchFilter[]
type Sorts = any
type Sort = any

export interface SearchEngineOptions {
  /**
   * **Search Engine Driver**
   *
   * The search engine to utilize.
   *
   * @default string 'opensearch'
   * @see https://stacksjs.org/docs/search-engine
   */
  driver: 'opensearch'
  // driver: 'meilisearch' | 'algolia' | 'typesense' | 'opensearch' wip

  // meilisearch?: {
  //   host: string
  //   apiKey: string
  // }

  opensearch?: {
    host: string
    protocol: number
    port: number
    auth: string
  }

  filters?: {
    [key: string]: string
  }

  /**
   * The number of hits to be returned per page.
   *
   * @default number 20
   */
  perPage?: number
}

export type SearchEngineConfig = Partial<SearchEngineOptions>

export interface SearchEngineDriver {
  client: MeiliSearch

  // Indexes
  createIndex: (
    name: string,
    options?: IndexOptions,
  ) => MaybePromise<EnqueuedTask>
  getIndex: (name: string) => MaybePromise<Index>
  updateIndex: (
    name: string,
    options: IndexOptions,
  ) => MaybePromise<EnqueuedTask>
  deleteIndex: (name: string) => MaybePromise<EnqueuedTask>
  updateIndexSettings: (
    name: string,
    settings: SearchEngineOptions,
  ) => MaybePromise<EnqueuedTask>
  listAllIndexes: () => MaybePromise<IndexesResults<Index[]>>
  listAllIndices: () => MaybePromise<IndexesResults<Index[]>> // alternatives plural spelling

  // Records (MeiliSearch uses the term "documents")
  getRecord: (key: string) => MaybePromise<any>
  getRecords: (key: string) => MaybePromise<RecordOptions>
  createRecord: (
    record: any,
    indexName: string,
    options: RecordOptions,
  ) => MaybePromise<EnqueuedTask>
  createRecords: (
    records: any,
    indexName: string,
    options: RecordOptions,
  ) => MaybePromise<EnqueuedTask>
  createOrReplaceRecord: (
    record: any,
    indexName: string,
    options: RecordOptions,
  ) => MaybePromise<EnqueuedTask>
  createOrUpdateRecord: (
    record: any,
    indexName: string,
    options: RecordOptions,
  ) => MaybePromise<EnqueuedTask>
  deleteRecord: (
    recordId: string | number,
    indexName: string,
  ) => MaybePromise<EnqueuedTask>
  deleteAllRecords: (indexName: string) => MaybePromise<EnqueuedTask>
  batchDeleteRecords: (
    recordIds: string[] | number[],
    indexName: string,
  ) => MaybePromise<EnqueuedTask>

  // Search
  search: (
    query: string,
    indexName: string,
    options: SearchParams,
  ) => MaybePromise<Search>

  calculatePagination: Pages
  currentPage: Page
  filterName: string
  filters: Filters
  goToNextPage: () => Page
  goToPage: (pageNumber: number) => Page
  goToPrevPage: () => Page
  hits: Hits
  index: Index
  lastPage: Page
  perPage: number
  query: string
  results: Results // SearchResponse
  searchFilters: SearchFilters
  searchParams: SearchParams
  setTotalHits: number
  sort: Sort
  sorts: Sorts
  totalPages: number
}

/**
 * This interface is used to unify the persisting of data to localStorage
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

export interface SearchOptions {
  searchable: string[]
  sortable: string[]
  filterable: string[]
  options?: SearchEngineOptions
}

export type {
  EnqueuedTask,
  Hits,
  Index,
  IndexOptions,
  IndexesResults,
  MeiliSearch,
  RecordOptions,
  MeilisearchOptions,
  SearchParams,
  SearchResponse,
}
