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

/**
 * A search filter, in one of three shapes.
 *
 * - A **string** is already written in the engine's own filter syntax
 *   (Meilisearch `status = 'published'`, Typesense `status:=published`,
 *   Algolia `status:published`, OpenSearch query-string) and is passed through
 *   untouched.
 * - An **array of strings** is several such clauses, all of which must match.
 *   Meilisearch additionally reads a nested array as an OR group, as its own
 *   API does.
 * - An **object** maps field names to the value each must equal (an array
 *   value means "any of these"). This is the only portable form: every driver
 *   translates it into its own syntax, validating the field names and escaping
 *   the values, so it is the one to build from user input.
 */
export type SearchFilter = string | Array<string | string[]> | Record<string, unknown>

/**
 * A sort order: engine syntax (`'price:asc'`), a list of those, or a
 * `{ field: 'asc' | 'desc' }` map.
 */
export type SearchSort = string | string[] | Record<string, string>

/**
 * The parameters every driver's `search()` reads.
 *
 * The ORM's `Model.search()` builder sends `{ q, limit, offset, filter }`, and
 * the drivers used to each read their own subset of names - Meilisearch only
 * `query` / `page` / `perPage` and an object filter - so a model search
 * returned the first page of the whole index whatever was asked. These are the
 * names all of them honour.
 *
 * Paging is `limit` + `offset`, or `perPage` + `page` (1-based). When both are
 * given, `limit` / `offset` win. Unlisted keys are driver-specific extras
 * (Typesense's `query_by`, Meilisearch's `attributesToRetrieve`, ...).
 */
export interface SearchEngineSearchParams {
  /** The search text. An empty or missing query matches everything. */
  q?: string
  /** Alias of `q`. */
  query?: string
  /** How many hits to return. Defaults to the config's `perPage`, else 20. */
  limit?: number
  /** How many hits to skip. */
  offset?: number
  /** 1-based page number, used when `offset` is not given. */
  page?: number
  /** Alias of `limit`, used when `limit` is not given. */
  perPage?: number
  filter?: SearchFilter
  sort?: SearchSort
  /** Typesense: the fields to search (required by Typesense). */
  query_by?: string | string[]
  /** Alias of `query_by`. */
  queryBy?: string | string[]
  [key: string]: unknown
}

export interface SearchEngineDriver {
  client: () => Meilisearch
  resetClient?: () => void

  search: (index: string, params?: SearchEngineSearchParams) => Promise<SearchResponse<Record<string, any>>>

  // Indexes
  createIndex: (name: string, options?: CreateIndexOptions) => MaybePromise<EnqueuedTask>
  getIndex: (name: string) => Promise<Index<Record<string, any>>>
  addDocument: (indexName: string, params: any) => Promise<EnqueuedTask>
  updateDocuments: (indexName: string, params: DocumentOptions[]) => Promise<EnqueuedTask>
  updateDocument: (indexName: string, params: DocumentOptions) => Promise<EnqueuedTask>
  addDocuments: (indexName: string, params: any[]) => Promise<EnqueuedTask>
  /** The stored document, by id. (Typed as a task until now, which no driver returns.) */
  getDocument: (indexName: string, id: number | string, fields?: any) => Promise<Record<string, any>>
  deleteDocument: (indexName: string, id: number) => Promise<EnqueuedTask>
  /** Delete the documents matching a filter, written in the engine's own syntax. */
  deleteDocuments: (indexName: string, filters: string | string[]) => Promise<EnqueuedTask>
  /**
   * Delete every document in the index and keep the index itself, with its
   * settings. A missing index is already empty, so that is not an error.
   */
  deleteAllDocuments: (indexName: string) => Promise<EnqueuedTask>
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
