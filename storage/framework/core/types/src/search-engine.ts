import type {
  Dictionary,
  DocumentOptions,
  EnqueuedTask,
  Faceting,
  Hits,
  Index,
  IndexesResults,
  IndexOptions,
  MeiliSearch,
  Settings as MeilisearchOptions,
  PaginationSettings,
  DocumentOptions as RecordOptions,
  SearchParams,
  SearchResponse,
  Settings,
  Synonyms,
  TypoTolerance,
} from 'meilisearch'
import type { MaybePromise } from '.'

// type Search = any
// type Page = any
// type Pages = Page[]
// type Filter = any
// type Filters = Filter[]
// type Result = any
// type Results = Result[]
// type SearchFilter = any
// type SearchFilters = SearchFilter[]
// type Sorts = any
// type Sort = any

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

  meilisearch?: {
    host: string
    protocol: number
    port: number
    auth: string
    apiKey: string
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
  client: () => MeiliSearch

  search: (index: string, params: any) => Promise<SearchResponse<Record<string, any>>>

  // Indexes
  createIndex: (name: string, options?: IndexOptions) => MaybePromise<EnqueuedTask>
  getIndex: (name: string) => Promise<Index<Record<string, any>>>
  addDocument: (indexName: string, params: any) => Promise<EnqueuedTask>
  updateDocuments: (indexName: string, params: DocumentOptions[]) => Promise<EnqueuedTask>
  updateDocument: (indexName: string, params: DocumentOptions) => Promise<EnqueuedTask>
  addDocuments: (indexName: string, params: any[]) => Promise<EnqueuedTask>
  getDocument: (indexName: string, id: number, fields: any) => Promise<EnqueuedTask>
  deleteDocument: (indexName: string, id: number) => Promise<EnqueuedTask>
  deleteDocuments: (indexName: string, filters: string | string[]) => Promise<EnqueuedTask>
  updateIndex: (name: string, options: IndexOptions) => MaybePromise<EnqueuedTask>
  deleteIndex: (name: string) => MaybePromise<EnqueuedTask>
  listAllIndexes: () => MaybePromise<IndexesResults<Index[]>>
  listAllIndices: () => MaybePromise<IndexesResults<Index[]>> // alternatives plural spelling

  getFilterableAttributes: (index: string) => Promise<string[]>
  updateFilterableAttributes: (index: string, filterableAttributes: string[] | null) => Promise<EnqueuedTask>
  resetFilterableAttributes: (index: string) => Promise<EnqueuedTask>

  updateSearchableAttributes: (index: string, searchableAttributes: string[] | null) => Promise<EnqueuedTask>
  resetSearchableAttributes: (index: string) => Promise<EnqueuedTask>
  getSearchableAttributes: (index: string) => Promise<string[]>

  updateSortableAttributes: (index: string, sortableAttributes: string[] | null) => Promise<EnqueuedTask>
  resetSortableAttributes: (index: string) => Promise<EnqueuedTask>
  getSortableAttributes: (index: string) => Promise<string[]>

  updateDisplayedAttributes: (index: string, displayedAttributes: string[] | null) => Promise<EnqueuedTask>
  getDisplayedAttributes: (index: string) => Promise<string[]>
  resetDisplayedAttributes: (index: string) => Promise<EnqueuedTask>

  getSettings: (index: string) => Promise<Settings>
  updateSettings: (index: string, settings: Settings) => Promise<EnqueuedTask>
  resetSettings: (index: string) => Promise<EnqueuedTask>
  getPagination: (index: string) => Promise<PaginationSettings>
  updatePagination: (index: string, pagination: PaginationSettings) => Promise<EnqueuedTask>
  resetPagination: (index: string) => Promise<EnqueuedTask>

  getSynonyms: (index: string) => Promise<any>
  updateSynonyms: (index: string, synonyms: Synonyms) => Promise<EnqueuedTask>
  resetSynonyms: (index: string) => Promise<EnqueuedTask>

  getRankingRules: (index: string) => Promise<string[]>
  updateRankingRules: (index: string, rankingRules: string[] | null) => Promise<EnqueuedTask>
  resetRankingRules: (index: string) => Promise<EnqueuedTask>

  getDistinctAttribute: (index: string) => Promise<string | null>
  updateDistinctAttribute: (index: string, distinctAttribute: string | null) => Promise<EnqueuedTask>
  resetDistinctAttribute: (index: string) => Promise<EnqueuedTask>

  getFaceting: (index: string) => Promise<Faceting>
  updateFaceting: (index: string, faceting: Faceting) => Promise<EnqueuedTask>
  resetFaceting: (index: string) => Promise<EnqueuedTask>

  getTypoTolerance: (index: string) => Promise<TypoTolerance>
  updateTypoTolerance: (index: string, typoTolerance: TypoTolerance | null) => Promise<EnqueuedTask>
  resetTypoTolerance: (index: string) => Promise<EnqueuedTask>

  getDictionary: (index: string) => Promise<Dictionary>
  updateDictionary: (index: string, dictionary: Dictionary | null) => Promise<EnqueuedTask>
  resetDictionary: (index: string) => Promise<EnqueuedTask>

  // Search
  // calculatePagination: Pages
  // currentPage: Page
  // filterName: string
  // filters: Filters
  // goToNextPage: () => Page
  // goToPage: (pageNumber: number) => Page
  // goToPrevPage: () => Page
  // hits: Hits
  // index: Index
  // lastPage: Page
  // perPage: number
  // query: string
  // results: Results // SearchResponse
  // searchFilters: SearchFilters
  // searchParams: SearchParams
  // setTotalHits: number
  // sort: Sort
  // sorts: Sorts
  // totalPages: number
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
  displayable: string[]
  searchable: string[]
  sortable: string[]
  filterable: string[]
  options?: SearchEngineOptions
}

export type {
  EnqueuedTask,
  Hits,
  Index,
  IndexesResults,
  IndexOptions,
  MeiliSearch,
  MeilisearchOptions,
  RecordOptions,
  SearchParams,
  SearchResponse,
}
