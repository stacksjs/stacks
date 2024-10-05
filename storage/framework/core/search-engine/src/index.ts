import type { UiEngine } from '@stacksjs/ui'
import { useStorage } from '@stacksjs/utils'
import { type ComputedRef, type Ref, computed, ref } from 'vue'

// import { client as meilisearch } from './drivers/meilisearch'
import { determineState } from './helpers'

// import type { Ref } from '@stacksjs/types'

const table = useStorage('table', determineState()).value
const totalHits = table.results?.estimatedTotalHits ?? 1

// state
const pages: UiEngine.Ref<number[]> = ref([])
export const totalPages: Ref = ref(0)
export const currentPage: ComputedRef = computed(() => table.currentPage)
export const filterName: ComputedRef = computed(() => table.filterName)

export const filters: ComputedRef = computed(() => table.filters)
export const goToNextPage: ComputedRef = computed(() => table.goToNextPage)
export const goToPage: ComputedRef = computed(() => table.goToPage)
export const goToPrevPage: ComputedRef = computed(() => table.goToPrevPage)
export const hits: ComputedRef = computed(() => table.hits)
export const index: ComputedRef<string> = computed(() => table.index)
export const lastPageNumber: ComputedRef<number> = computed(() => table.lastPageNumber || 1)
export const perPage: ComputedRef<number> = computed(() => table.perPage || 10)
export const query: ComputedRef<string | undefined> = computed(() => table.query)
export const results: ComputedRef = computed(() => table.results)
export const searchFilters: ComputedRef = computed(() => table.searchFilters)
export const searchParams: ComputedRef = computed(() => table.searchParams)
export const setTotalHits: ComputedRef = computed(() => table.setTotalHits)
export const sort: ComputedRef = computed(() => table.sort)
export const sorts: ComputedRef = computed(() => table.sorts)

export function client(): string {
  // if (searchEngine.driver === 'meilisearch')
  //   return meilisearch
  return 'wip-search-me'
}

export function useSearchEngine(): string {
  return client()
}

export function calculatePagination(): void {
  if (table.perPage) totalPages.value = Math.ceil(totalHits / table.perPage)

  const hitPages = [...Array(totalPages.value).keys()].map((i) => i + 1)
  const offset = 2
  const currentPage = table.currentPage ?? 1
  const lastPage = hitPages[hitPages.length - 1]

  let from = currentPage - offset
  if (from < 1) from = 1

  let to = from + offset * 2
  if (to >= (lastPage as number)) to = lastPage as number

  const allPages = []
  for (let page = from; page <= to; page++) allPages.push(page)

  pages.value = allPages
}

// it needs these exports
// currentPage, filterName, filters, goToNextPage, goToPage, goToPrevPage, hits, index, lastPageNumber, perPage, query, results, search, searchFilters, searchParams, setTotalHits, sort, sorts, totalPages
