import type {
  Dictionary,
  DocumentOptions,
  EnqueuedTask,
  Faceting,
  Hits,
  Index,
  IndexesResults,
  IndexOptions,
  Meilisearch,
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
   * @default string 'meilisearch'
   * @see https://stacksjs.com/docs/search-engine
   */
  driver: 'meilisearch' | 'algolia' | 'opensearch' | 'typesense'

  opensearch?: {
    host: string
    protocol: 'http' | 'https'
    port: number
    auth: string
  }

  meilisearch?: {
    host: string
    protocol?: number
    port?: number
    auth?: string
    apiKey: string
  }

  algolia?: {
    appId: string
    apiKey: string
    searchOnlyApiKey?: string
  }

  typesense?: {
    host?: string
    port?: number
    protocol?: string
    apiKey?: string
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

/**
 * Options for creating an index.
 *
 * Meilisearch is schemaless and only ever needed `primaryKey`. Typesense and
 * OpenSearch are not: a collection has to declare its fields, their types, and
 * which ones can be faceted or sorted, and it cannot be extended afterwards.
 *
 * Without somewhere to put that, those drivers created a collection holding
 * `id` and nothing else. Documents imported cleanly and then every query
 * failed with "Could not find a field named ... in the schema".
 *
 * Both extra fields are optional and ignored by schemaless engines.
 */
export interface CreateIndexOptions extends IndexOptions {
  /** Which attributes are searchable, filterable, sortable and displayed. */
  settings?: Settings
  /** A representative document, used to infer each field's type. */
  sampleDocument?: Record<string, unknown>
}

export interface SearchEngineDriver {
  client: () => Meilisearch
  resetClient?: () => void

  search: (index: string, params: any) => Promise<SearchResponse<Record<string, any>>>

  // Indexes
  createIndex: (name: string, options?: CreateIndexOptions) => MaybePromise<EnqueuedTask>
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
  /**
   * Cross-table denormalisation for searchable fields that live on a
   * related model (stacksjs/stacks#1918). Maps an indexed-document
   * field name to a dot-path resolved against the model instance's
   * `_relations`. Without this, `toSearchableObject` only reads from
   * `_attributes` and silently emits `undefined` for any field that
   * exists on a `belongsTo` / `hasOne` / `hasMany` relation.
   *
   * Example: a `Judge` belongsTo a `CourtHouse`. To make the court
   * house's `name` searchable on the judge index:
   *
   *   useSearch: {
   *     searchable:  ['name', 'court_name'],
   *     displayable: ['id', 'name', 'court_name'],
   *     denormalize: { court_name: 'court_house.name' },
   *   }
   *
   * The caller is responsible for eager-loading the named relations
   * (e.g. via `Judge.query().with('court_house').get()`) — the live
   * observer hook and the CLI bulk-index path do this automatically
   * for every distinct head segment in the `denormalize` map.
   * `toSearchableObject` stays synchronous; no per-row database lookup.
   */
  denormalize?: Record<string, string>
  /**
   * Projection: what actually gets indexed, rather than the whole row.
   *
   * Both of these are implemented and honoured by the ORM's indexing paths -
   * `shapeMany` takes precedence over `shape` when both are given - and both
   * were missing from this interface, which is the one a model's `useSearch`
   * trait is typed against. So a model that used either was rejected by
   * `tsc` for naming a property that does exist and does run, and the only
   * way past it was a cast that hid the mistake rather than fixing it.
   *
   * `shape` is called once per row, which is right for a projection that only
   * rearranges columns. `shapeMany` receives the whole chunk and returns a
   * document for each, in order, which is what a projection needing the
   * database wants: denormalising a relation per row is a query per row, and a
   * rebuild of ten thousand rows becomes twenty thousand round trips.
   */
  shape?: (model: any) => Record<string, unknown> | null | undefined | Promise<Record<string, unknown> | null | undefined>
  shapeMany?: (models: any[]) => Record<string, unknown>[] | Promise<Record<string, unknown>[]>
}

export type {
  EnqueuedTask,
  Hits,
  Index,
  IndexesResults,
  IndexOptions,
  Meilisearch,
  MeilisearchOptions,
  RecordOptions,
  SearchParams,
  SearchResponse,
}
