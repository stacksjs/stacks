import type { Ref, SearchResponse, TableStore } from '@stacksjs/types'

// import { client } from '@stacksjs/search-engine'
// import { useStorage } from '@stacksjs/utils'
import type { ComputedRef } from 'vue'
import { computed } from 'vue'

const table = useStorage('table', determineState()).value as TableStore

function isString(val: unknown): val is string {
  return typeof val === 'string'
}

const pages: Ref<number[]> = ref([])
export const totalPages: Ref = ref(0)
export const currentPage: ComputedRef = computed(() => table.currentPage)

const totalHits = table.results?.estimatedTotalHits ?? 1

// // table related
export const filters = computed(() => table.filters)
export const goToNextPage = computed(() => table.goToNextPage)
export const goToPage = computed(() => table.goToPage)
export const goToPrevPage = computed(() => table.goToPrevPage)
export const hits = computed(() => table.hits)
export const index = computed(() => table.index)
export const lastPageNumber = computed(() => table.lastPageNumber)
export const perPage = computed(() => table.perPage)
export const query = computed(() => table.query)
export const results = computed(() => table.results)
export const searchFilters = computed(() => table.searchFilters)
export const searchParams = computed(() => table.searchParams)
export const setTotalHits = computed(() => table.setTotalHits)
export const sort = computed(() => table.sort)
export const sorts = computed(() => table.sorts)

const columns = computed(() => table.columns)
const actions = computed(() => table.actions)
const actionable = computed(() => table.actionable)
const selectedRows = computed(() => table.selectedRows)
const selectedAll = computed(() => table.selectedAll)
const views: Ref<number[]> = ref([])
const indeterminate = computed(() => {
  const selectedRowsLength = table?.selectedRows?.length ?? 0
  const hitsLength = hits.value?.length ?? 0
  return selectedRowsLength > 0 && selectedRowsLength < hitsLength
})

const lastColumn = computed(() => {
  return table.columns[table.columns.length - 1]
})

const readableLastColumn = computed(() => {
  const firstColumn = lastColumn.value?.[0]
  if (!firstColumn) {
    return ''
  }

  const parts = firstColumn.split(':')
  return parts.length > 1 ? parts[1]?.trim() : parts[0]
})

// this watchEffect picks up any reactivity changes from `query` and `searchParams` and it will then trigger a search
// watchEffect(async () => {
//   // console.log('watchEffect', query, searchParams)

//   const results = await search(query.value, searchParams.value)

//   if (results) {
//     table.results = results
//     table.hits = results.hits
//   }

//   setTotalHits(table.results?.nbHits ?? 1)
//   calculatePagination()
// })

export function calculatePagination(): void {
  if (table.perPage)
    totalPages.value = Math.ceil(totalHits / table.perPage)

  const hitPages = Array.from({ length: totalPages.value }, (_, i) => i + 1)
  const offset = 2
  const currentPage = table.currentPage ?? 1
  const lastPage = hitPages[hitPages.length - 1]

  let from = currentPage - offset
  if (from < 1)
    from = 1

  let to = from + offset * 2
  if (to >= (lastPage as number))
    to = lastPage as number

  const allPages = []
  for (let page = from; page <= to; page++) allPages.push(page)

  pages.value = allPages
}

watchDebounced(
  query,
  () => {
    if (table === undefined)
      return

    if (isRef(table.query))
      table.query = query.value
  },
  { debounce: 500 },
)

function determineState(): TableStore {
  let ls
  if (typeof localStorage !== 'undefined') {
    ls = localStorage.getItem('table')
  }

  if (isString(ls))
    return JSON.parse(ls) as TableStore

  // initial default state - overwrite with properties passed down from parent component
  const table: TableStore = {
    source: '',
    password: '',
    index: '',
    columns: [],
    filters: [],
    perPage: 20,
    currentPage: 1,
    query: '',
    goToNextPage: 2,
    goToPage: 1,
    goToPrevPage: 1,
    hits: [],
    lastPageNumber: 1,
    results: {} as SearchResponse<Record<string, any>>,
    searchFilters: {},
    searchParams: {},
    setTotalHits: 0,
  }

  return table
}

function isColumnSortable(col: string): boolean {
  if (!hasTableLoaded(table))
    return false

  if (col === undefined)
    return false

  if (col.includes(':'))
    col = col.split(':')[0] || ''

  if (table.sorts?.includes(col))
    return true

  return false
}

function hasTableLoaded(state?: any): boolean {
  if (state?.index !== '')
    return true

  return isString(table?.index) && table.index !== '' // a lazy way to check if the table is loaded
}

function isColumnUsedAsSort(col: string) {
  const splitCol = (col.split(':')[0]) || ''

  const sortKey = col.includes(':') ? splitCol.trim() : col

  return table.sort?.includes(sortKey)
}

function toggleSort(col: string | Ref<string>) {
  if (isRef(col))
    col = unref(col)

  const splitCol = (col.split(':')[0]) || ''

  const sortKey = (col as string).includes(':') ? splitCol.trim() : col

  if (table.sort?.includes('desc')) {
    table.sort = `${sortKey}:asc`

    // console.log('sort included asc it is now desc for', sortKey)

    return
  }

  if (table.sort?.includes('asc')) {
    table.sort = undefined

    // console.log('sort included desc it is now "" for', sortKey)

    return
  }

  // console.log('there was no sort. Setting it now in asc order for', sortKey)

  table.sort = `${sortKey}:desc`

  // console.log('table.sort', table.sort)
}

function columnName(col: string) {
  const splitCol = (col.split(':')[0]) || ''

  return splitCol.trim()
}

export async function useTable(store?: TableStore) {
  return {
    store,
    table,
    index,
    columns,
    isColumnSortable,
    filters,
    sort,
    sorts,
    query,
    results,
    hits,
    perPage,
    currentPage,
    goToPrevPage,
    goToNextPage,
    goToPage,
    // search,
    searchFilters,
    searchParams,
    toggleSort,
    isColumnUsedAsSort,
    actionable,
    actions,
    columnName,
    indeterminate,
    lastColumn,
    readableLastColumn,
    lastPageNumber,
    selectedRows,
    selectedAll,
    totalPages,
    views,
    filterName,
  }
}
