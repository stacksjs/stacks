import type { Signal } from '@stacksjs/stx'
import { effect, state } from '@stacksjs/stx'

/**
 * Shared pieces of the dashboard's list screens.
 *
 * Seventeen list dashboards each wrote their own `previousPage` and
 * `nextPage` (stacksjs/stacks#2918), in four different styles. Twelve of them
 * mean the same thing - move a page number, keep it between one and the last
 * page - and this is that, once.
 */

/** The shape `state()` returns, narrowed to what paging needs. */
interface PageSignal {
  (): number
  set: (value: number) => void
}

export interface PageControls {
  /** Back one page, never past the first. */
  previousPage: () => void
  /** Forward one page, never past the last. */
  nextPage: () => void
}

/**
 * Previous and next for a page number bounded by a last page.
 *
 * `lastPage` is an accessor rather than a number because every call site
 * derives it, and reading it at click time is what keeps the clamp correct
 * when a filter shrinks the result set under the reader's feet.
 *
 * Clamps rather than guards. The twelve call sites split between
 * `page.set(Math.max(1, page() - 1))` and `if (page() > 1) page.set(page() - 1)`,
 * which do the same thing from a user's point of view; clamping is the one
 * that stays correct if a page number is ever set out of range by something
 * other than these two functions.
 *
 * Not for the dashboards that page server-side. `Jobs/JobHistory` reloads
 * inside its `nextPage`, and a navigation that triggers a fetch is a
 * different thing wearing the same name.
 */
export function pageControls(page: PageSignal, lastPage: () => number): PageControls {
  return {
    previousPage: () => page.set(Math.max(1, page() - 1)),
    nextPage: () => page.set(Math.min(Math.max(1, lastPage()), page() + 1)),
  }
}

/** How a list screen decides what the current search matches. */
export interface RecordsDashboardOptions<T> {
  /**
   * Rows matching `query`, which arrives trimmed and lowercased.
   *
   * The caller's, because the fields worth searching are the only part of a
   * list dashboard that is genuinely about its own records.
   */
  filter: (records: T[], query: string) => T[]
  /** Rows per page. Default 10, which is what all five callers used. */
  perPage?: number
  /**
   * Whether two rows are the same row. Defaults to matching `id`, which is
   * what every current caller means.
   */
  sameRecord?: (a: T, b: T) => boolean
}

export interface RecordsDashboard<T> {
  records: Signal<T[]>
  loading: Signal<boolean>
  loadError: Signal<string>
  search: Signal<string>
  page: Signal<number>
  perPage: Signal<number>
  editorOpen: Signal<boolean>
  editorMode: Signal<'create' | 'edit'>
  editing: Signal<T | null>
  saving: Signal<boolean>
  editorError: Signal<string>
  deleting: Signal<T | null>
  deleteBusy: Signal<boolean>
  deleteError: Signal<string>
  filteredRecords: () => T[]
  paginatedRecords: () => T[]
  pageCount: () => number
  previousPage: () => void
  nextPage: () => void
  /**
   * Jump to a page, clamped into range.
   *
   * The five callers each wrote a bare `page.set(value)` and trusted the
   * pagination component to emit only pages that exist. Clamping costs
   * nothing when that is true and keeps the list rendering when it is not.
   */
  goToPage: (value: number) => void
  /** Set the search and return to the first page, which is the only sane page to land on. */
  handleSearch: (value: string) => void
  openCreate: () => void
  openEdit: (record: T) => void
  /** Refuses while a save is in flight, so a half-written row cannot be abandoned by accident. */
  closeEditor: () => void
  requestDelete: (record: T) => void
  closeDelete: () => void
  /**
   * Put a saved row into the list.
   *
   * `replacing` is the row the editor was opened on, or null for a create.
   * Passed rather than inferred so the behaviour matches what the five
   * callers did: an edit replaces in place and a create appends and jumps to
   * the page the new row landed on.
   */
  upsert: (record: T, replacing: T | null) => void
  /** Drop a row and pull the page back if that emptied the last one. */
  remove: (record: T) => void
  /** Pull `page` back into range after the row count changes under it. */
  clampPage: () => void
}

/**
 * The state and lifecycle every list screen in the dashboard repeats.
 *
 * Five Delivery dashboards carried byte-identical copies of fourteen signals,
 * `handleSearch`, `openCreate`, `openEdit`, `closeEditor`, `requestDelete`,
 * `closeDelete`, and the page arithmetic around saving and deleting
 * (stacksjs/stacks#2918). Five copies of an off-by-one is four chances to be
 * right in four places and wrong in the fifth.
 *
 * Deliberately not here: fetching, toasts, and the search predicate. Those
 * differ per screen, and a composable that owned them would be a framework
 * each caller had to fight. The caller writes its own `load`, `save` and
 * `delete`, and calls `upsert`, `remove` and `clampPage` from inside them.
 */
export function useRecordsDashboard<T>(options: RecordsDashboardOptions<T>): RecordsDashboard<T> {
  const sameRecord = options.sameRecord
    ?? ((a: T, b: T) => (a as { id?: unknown }).id === (b as { id?: unknown }).id)

  const records = state<T[]>([])
  const loading = state(true)
  const loadError = state('')
  const search = state('')
  const page = state(1)
  const perPage = state(options.perPage ?? 10)
  const editorOpen = state(false)
  const editorMode = state<'create' | 'edit'>('create')
  const editing = state<T | null>(null)
  const saving = state(false)
  const editorError = state('')
  const deleting = state<T | null>(null)
  const deleteBusy = state(false)
  const deleteError = state('')

  const filteredRecords = (): T[] => {
    const query = search().trim().toLowerCase()
    return query ? options.filter(records(), query) : records()
  }

  const pageCount = (): number => Math.max(1, Math.ceil(filteredRecords().length / perPage()))

  const paginatedRecords = (): T[] => {
    const start = (page() - 1) * perPage()
    return filteredRecords().slice(start, start + perPage())
  }

  const clampPage = (): void => {
    const lastPage = pageCount()
    if (page() > lastPage)
      page.set(lastPage)
  }

  const { previousPage, nextPage } = pageControls(page, pageCount)

  const goToPage = (value: number): void => {
    page.set(Math.min(Math.max(1, Math.trunc(value) || 1), pageCount()))
  }

  return {
    records,
    loading,
    loadError,
    search,
    page,
    perPage,
    editorOpen,
    editorMode,
    editing,
    saving,
    editorError,
    deleting,
    deleteBusy,
    deleteError,
    filteredRecords,
    paginatedRecords,
    pageCount,
    previousPage,
    nextPage,
    goToPage,

    handleSearch(value: string): void {
      search.set(value)
      page.set(1)
    },

    openCreate(): void {
      editing.set(null)
      editorMode.set('create')
      editorError.set('')
      editorOpen.set(true)
    },

    openEdit(record: T): void {
      editing.set(record)
      editorMode.set('edit')
      editorError.set('')
      editorOpen.set(true)
    },

    closeEditor(): void {
      if (saving())
        return
      editorOpen.set(false)
      editing.set(null)
      editorError.set('')
    },

    requestDelete(record: T): void {
      deleting.set(record)
      deleteError.set('')
    },

    closeDelete(): void {
      if (deleteBusy())
        return
      deleting.set(null)
      deleteError.set('')
    },

    upsert(record: T, replacing: T | null): void {
      if (replacing) {
        records.set(records().map(existing => sameRecord(existing, replacing) ? record : existing))
        return
      }
      const next = [...records(), record]
      records.set(next)
      // Land on the page the new row is actually on, not the last page of the
      // filtered view: a create while a search is active would otherwise jump
      // somewhere the row is not.
      page.set(Math.max(1, Math.ceil(next.length / perPage())))
    },

    remove(record: T): void {
      records.set(records().filter(existing => !sameRecord(existing, record)))
      clampPage()
    },

    clampPage,
  }
}

/** One page as a server-paged list endpoint answers it. */
export interface ServerListPage<T> {
  records?: T[]
  total?: number
  page?: number
}

export interface ServerListOptions<T> {
  /**
   * Ask for one page. `params` carries `sort`, `direction`, the search, the filters,
   * `page` and `per_page`, as the commerce list endpoints read them.
   */
  fetch: (params: URLSearchParams) => Promise<ServerListPage<T>>
  /**
   * The order before any column header is clicked. An accessor when the page
   * has a sort select: changing it hands the order back from a header sort
   * and asks for page 1.
   */
  defaultSort: { sort: string, direction: 'asc' | 'desc' } | (() => { sort: string, direction: 'asc' | 'desc' })
  /** The table's sortable column keys, as the server's sort names. A column not listed returns to `defaultSort`. */
  columnSorts?: Record<string, string>
  /** The filter values, read reactively: a change asks for page 1. `''` or `'all'` leaves a filter out. */
  filters?: () => Record<string, string>
  /** Rows per page. Default 25, the list endpoints' own default. */
  perPage?: number
  /** How long typing pauses before the search is sent. Default 250ms. */
  searchDelay?: number
  /**
   * The query parameter the search is sent as. Default `q`, as the commerce
   * lists read it; the content lists read `search`.
   */
  searchParam?: string
  /** Called with whatever a load threw, after `loadError` is set. */
  onError?: (error: unknown) => void
  /** Called with each answer that lands, for anything else it carries (a summary, choices). */
  onLoad?: (result: ServerListPage<T>) => void
}

export interface ServerList<T> {
  records: Signal<T[]>
  /** How many rows match, across every page. */
  total: Signal<number>
  page: Signal<number>
  perPage: Signal<number>
  /** What the search box holds; it is sent once typing pauses. */
  search: Signal<string>
  loading: Signal<boolean>
  loadError: Signal<string>
  /** The search, filters and order as query parameters, without the page: what an export link needs. */
  params: () => URLSearchParams
  /** Ask for the current page again, after a save or a delete. */
  load: () => Promise<void>
  changePage: (value: number | CustomEvent<number>) => void
  changePageSize: (value: number | CustomEvent<number>) => void
  changeSort: (value: { key: string, direction: string } | CustomEvent<{ key: string, direction: string }>) => void
}

function eventValue<V>(value: V | CustomEvent<V>): V {
  return typeof CustomEvent !== 'undefined' && value instanceof CustomEvent ? value.detail : value as V
}

/**
 * A list the server searches, filters, sorts and pages (stacksjs/stacks#3218).
 *
 * The Orders, Payments, Products, Gift Cards, Reviews and waitlist pages each
 * wrote the same request counter, page, page size, header sort and search
 * debounce. This is that, once: only the newest answer lands, a filter or
 * search change asks for page 1, and a column header the server cannot sort
 * by returns to the default order.
 *
 * The caller still owns when to load first (call `load()` in `onMount`), its
 * toasts, and what its endpoint returns beyond the page (`onLoad`).
 */
export function useServerList<T>(options: ServerListOptions<T>): ServerList<T> {
  const records = state<T[]>([])
  const total = state(0)
  const page = state(1)
  const perPage = state(options.perPage ?? 25)
  const search = state('')
  const loading = state(true)
  const loadError = state('')
  const appliedSearch = state('')
  const headerSort = state<{ sort: string, direction: string } | null>(null)
  let request = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  const defaultOrder = () => typeof options.defaultSort === 'function' ? options.defaultSort() : options.defaultSort

  const params = (): URLSearchParams => {
    const query = new URLSearchParams()
    const order = headerSort() ?? defaultOrder()
    query.set('sort', order.sort)
    query.set('direction', order.direction)
    if (appliedSearch())
      query.set(options.searchParam ?? 'q', appliedSearch())
    for (const [name, value] of Object.entries(options.filters?.() ?? {})) {
      if (value !== '' && value !== 'all')
        query.set(name, value)
    }
    return query
  }

  const load = async (): Promise<void> => {
    const current = ++request
    loading.set(true)
    loadError.set('')
    try {
      const query = params()
      query.set('page', String(page()))
      query.set('per_page', String(perPage()))
      const result = await options.fetch(query)
      if (current !== request)
        return
      records.set(Array.isArray(result.records) ? result.records : [])
      total.set(Number(result.total) || 0)
      page.set(Number(result.page) || 1)
      options.onLoad?.(result)
    }
    catch (error) {
      if (current !== request)
        return
      loadError.set(error instanceof Error ? error.message : String(error))
      options.onError?.(error)
    }
    finally {
      if (current === request)
        loading.set(false)
    }
  }

  if (options.filters) {
    let shown = JSON.stringify(options.filters())
    effect(() => {
      const filters = JSON.stringify(options.filters!())
      if (filters === shown)
        return
      shown = filters
      page.set(1)
      void load()
    })
  }

  if (typeof options.defaultSort === 'function') {
    let shownOrder = JSON.stringify(defaultOrder())
    effect(() => {
      const order = JSON.stringify(defaultOrder())
      if (order === shownOrder)
        return
      shownOrder = order
      headerSort.set(null)
      page.set(1)
      void load()
    })
  }

  let shownSearch = search().trim()
  effect(() => {
    const term = search().trim()
    if (term === shownSearch)
      return
    shownSearch = term
    if (timer)
      clearTimeout(timer)
    timer = setTimeout(() => {
      appliedSearch.set(term)
      page.set(1)
      void load()
    }, options.searchDelay ?? 250)
  })

  return {
    records,
    total,
    page,
    perPage,
    search,
    loading,
    loadError,
    params,
    load,
    changePage(value) {
      page.set(Number(eventValue(value)) || 1)
      void load()
    },
    changePageSize(value) {
      perPage.set(Number(eventValue(value)) || (options.perPage ?? 25))
      page.set(1)
      void load()
    },
    changeSort(value) {
      const column = eventValue(value)
      const sort = options.columnSorts?.[column.key]
      headerSort.set(sort ? { sort, direction: column.direction === 'asc' ? 'asc' : 'desc' } : null)
      page.set(1)
      void load()
    },
  }
}

/** The largest page the list endpoints serve. */
export const LARGEST_PAGE = 100

/**
 * Every record a paged list endpoint holds, a page at a time: for a caller
 * that does want all of them, such as a resource's `fetchAll`. Stops at the
 * first short page, so a count that moved while it read cannot loop it.
 */
export async function readEveryPage<T>(
  get: (page: number, perPage: number) => Promise<{ records?: T[], total?: number }>,
): Promise<T[]> {
  const all: T[] = []
  for (let page = 1; ; page++) {
    const data = await get(page, LARGEST_PAGE)
    if (!Array.isArray(data?.records))
      throw new TypeError('Server returned a page without records')
    all.push(...data.records)
    if (data.records.length < LARGEST_PAGE || all.length >= Number(data.total))
      return all
  }
}
