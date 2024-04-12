import type { UiEngine } from '@stacksjs/ui'
import { useStorage } from '@stacksjs/utils'
import { computed, ref } from 'vue'

// import { client as meilisearch } from './drivers/meilisearch'
import { determineState } from './helpers'

// import type { Ref } from '@stacksjs/types'

const table = (useStorage('table', determineState()).value)
const totalHits = table.results?.estimatedTotalHits ?? 1

// state
const pages: UiEngine.Ref<number[]> = ref([])
export const totalPages = ref(0)
export const currentPage = computed(() => table.currentPage)
export const filterName = computed(() => table.filterName)

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

export function client() {
  // if (searchEngine.driver === 'meilisearch')
  //   return meilisearch
  return 'wip-search-me'
}

export function useSearchEngine() {
  return client()
}

export function calculatePagination() {
  if (table.perPage)
    totalPages.value = Math.ceil(totalHits / table.perPage)

  const hitPages = [...Array(totalPages.value).keys()].map(i => i + 1)
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
  for (let page = from; page <= to; page++)
    allPages.push(page)

  pages.value = allPages
}

// it needs these exports
// currentPage, filterName, filters, goToNextPage, goToPage, goToPrevPage, hits, index, lastPageNumber, perPage, query, results, search, searchFilters, searchParams, setTotalHits, sort, sorts, totalPages
