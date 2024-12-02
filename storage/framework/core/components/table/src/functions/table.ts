import type { Ref, TableStore } from '@stacksjs/types'

// import { calculatePagination, currentPage, filterName, totalPages } from '@stacksjs/search-engine'
// import { useStorage } from '@stacksjs/utils'
// import { isObject, isString } from '@stacksjs/validation'
// import { computed } from 'vue'

const table = useStorage('table', determineState()).value as TableStore

// // table related
// export const filters = computed(() => table.filters)
// export const goToNextPage = computed(() => table.goToNextPage)
// export const goToPage = computed(() => table.goToPage)
// export const goToPrevPage = computed(() => table.goToPrevPage)
// export const hits = computed(() => table.hits)
// export const index = computed(() => table.index)
// export const lastPageNumber = computed(() => table.lastPageNumber)
// export const perPage = computed(() => table.perPage)
// export const query = computed(() => table.query)
// export const results = computed(() => table.results)
// export const searchFilters = computed(() => table.searchFilters)
// export const searchParams = computed(() => table.searchParams)
// export const setTotalHits = computed(() => table.setTotalHits)
// export const sort = computed(() => table.sort)
// export const sorts = computed(() => table.sorts)

// const columns = computed(() => table.columns)
// const actions = computed(() => table.actions)
// const actionable = computed(() => table.actionable)
// const selectedRows = computed(() => table.selectedRows)
// const selectedAll = computed(() => table.selectedAll)
// const views: Ref<number[]> = ref([])
// const indeterminate = computed(() => {
//   const selectedRowsLength = table?.selectedRows?.length ?? 0
//   const hitsLength = hits.value?.length ?? 0
//   return selectedRowsLength > 0 && selectedRowsLength < hitsLength
// })

// const lastColumn = computed(() => {
//   return table.columns[table.columns.length - 1]
// })

// const readableLastColumn = computed(() => {
//   const firstColumn = lastColumn.value?.[0]
//   if (!firstColumn) {
//     return ''
//   }

//   const parts = firstColumn.split(':')
//   return parts.length > 1 ? parts[1]?.trim() : parts[0]
// })

// // this watchEffect picks up any reactivity changes from `query` and `searchParams` and it will then trigger a search
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

// watchDebounced(
//   query,
//   () => {
//     console.log('watchDebounced')

//     if (table === undefined)
//       return

//     if (isRef(table.query))
//       table.query = query.value
//   },
//   { debounce: 500 },
// )

function determineState(): TableStore {
  const ls = localStorage.getItem('table')

  if (isString(ls))
    return JSON.parse(ls) as TableStore

  // initial default state - overwrite with properties passed down from parent component
  // const table: TableStore = {
  //   source: '',
  //   password: '',
  //   index: '',
  //   columns: [],
  //   filters: [],
  //   perPage: 20,
  //   currentPage: 1,
  //   query: '',
  //   goToNextPage: 2,
  //   goToPage: 1,
  //   goToPrevPage: 1,
  //   hits: [],
  //   lastPageNumber: 1,
  //   results: {},
  //   search: () => {},
  //   searchFilters: {},
  //   searchParams: {},
  //   setTotalHits: () => {},
  // }

  return table
}

// function isColumnSortable(col: string): boolean {
//   if (!hasTableLoaded(table))
//     return false

//   if (col === undefined)
//     return false

//   if (col.includes(':'))
//     col = col.split(':')[0]

//   if (table.sorts?.includes(col))
//     return true

//   return false
// }

// function hasTableLoaded(state?: any): boolean {
//   if (state?.index !== '')
//     return true

//   return isString(table?.index) && table.index !== '' // a lazy way to check if the table is loaded
// }

// function isColumnUsedAsSort(col: string | object) {
//   let sortKey

//   if (isObject(col))
//     sortKey = col[0].includes(':') ? col[0].split(':')[0].trim() : col[0]

//   else
//     sortKey = col.includes(':') ? col.split(':')[0].trim() : col

//   return table.sort?.includes(sortKey)
// }

// function toggleSort(col: string | Ref<string>) {
//   if (isRef(col))
//     col = unref(col)

//   const sortKey = (col as string).includes(':') ? (col as string).split(':')[0].trim() : col

//   if (table.sort?.includes('desc')) {
//     table.sort = `${sortKey}:asc`

//     console.log('sort included asc it is now desc for', sortKey)

//     return
//   }

//   if (table.sort?.includes('asc')) {
//     table.sort = undefined

//     console.log('sort included desc it is now "" for', sortKey)

//     return
//   }

//   console.log('there was no sort. Setting it now in asc order for', sortKey)

//   table.sort = `${sortKey}:desc`

//   console.log('table.sort', table.sort)
// }

// function columnName(col: string) {
//   return col.split(':')[0].trim()
// }

export async function useTable(store?: TableStore) {
  return {
    // store,
    table,
    // index,
    // columns,
    // isColumnSortable,
    // filters,
    // sort,
    // sorts,
    // query,
    // results,
    // hits,
    // perPage,
    // currentPage,
    // goToPrevPage,
    // goToNextPage,
    // goToPage,
    // search,
    // searchFilters,
    // searchParams,
    // toggleSort,
    // isColumnUsedAsSort,
    // actionable,
    // actions,
    // columnName,
    // indeterminate,
    // lastColumn,
    // readableLastColumn,
    // lastPageNumber,
    // selectedRows,
    // selectedAll,
    // totalPages,
    // views,
    // filterName,
  }
}
