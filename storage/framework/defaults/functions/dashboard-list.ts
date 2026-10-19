import type { Signal } from '@stacksjs/stx'
import { state } from '@stacksjs/stx'

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
