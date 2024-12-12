import type { Hits, SearchResponse } from 'meilisearch'

// this interface is primarily used to persist data to localStorage, in a unified way
export interface SearchEngineStore {
  /**
   * The search engine index.
   */
  index: string
  /**
   * The search engine host.
   * @default 'http://127.0.0.1:7700'
   */
  source?: string
  /**
   * The search engine password/API key.
   */
  password?: string
  /**
   * The search query.
   * @default 20
   * @type {string}
   * @default: ''
   */
  query?: string
  /**
   * The number of results to return.
   * @default 20
   * @type {number}
   */
  perPage?: number
  /**
   * The current page number
   * @default 1
   * @type {number}
   */
  currentPage?: number
  /**
   * The results object returned from the search engine.
   */
  results?: SearchResponse<Record<string, any>> // optional: the Meilisearch search response (defaults: {})
  /**
   * The hits object returned from the search engine.
   */
  hits?: Hits<Record<string, any>>

  /**
   * The search Filter Name
   */
  filterName?: string

  /**
   * The search filters
   */
  filters?: object

  /**
   * The next page value
   */
  goToNextPage?: number

  /**
   * Set to go to a specific page
   */
  goToPage?: number

  /**
   * Set to go to the previous page
   */
  goToPrevPage?: number

  /**
   * The last page number value
   */
  lastPageNumber?: number

  /**
   * The searched term to use for the search
   */
  search?: string

  /**
   * The search params filters to use for the search
   */
  searchFilters?: object

  /**
   * The search params to use for the search
   */
  searchParams?: object

  /**
   * Total hits value to use for the search
   */
  setTotalHits?: number

  /**
   * The sort value to use for the search
   */
  sort?: string

  /**
   * The sorts value to use for the search
   */
  sorts?: object

  // table related config
  // actionable?: string | boolean // optional: determines whether the table displays any "action items" (defaults: true)
  // actions?: string | string[] // optional: the specific type of actions to be displayed/utilized in the table (defaults: 'Edit, Delete')
  // columns: string[] // used as table heads/column titles
  // selectable?: string | boolean // optional: determines whether the table displays the checkboxes (defaults: true)
  // selectedRows?: number[] | string[] // optional: holds the selected rows (defaults: [])
  // selectedAll?: boolean // optional: determines whether all the rows are selected (defaults: false)
  // stickyHeader?: string | boolean // optional: determines whether the table displays the sticky header (defaults: false)
  // stickyFooter?: string | boolean // optional: determines whether the table displays the sticky footer (defaults: false)
}
