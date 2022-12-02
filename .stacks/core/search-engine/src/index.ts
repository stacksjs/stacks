import { searchEngine } from '@stacksjs/config'
import type { Ref } from 'vue'
import { client as meilisearch, search } from './drivers/meilisearch'
import { determineState } from './helpers'

const table = (useStorage('table', determineState()).value)
const totalHits = table.results?.estimatedTotalHits ?? 1

// state
const pages: Ref<number[]> = ref([])
const totalPages = ref(0)
const currentPage = computed(() => table.currentPage)

export function client() {
  if (searchEngine.driver === 'meilisearch')
    return meilisearch
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
  if (to >= lastPage)
    to = lastPage

  const allPages = []
  for (let page = from; page <= to; page++)
    allPages.push(page)

  pages.value = allPages
}

// it needs these exports
// currentPage, filterName, filters, goToNextPage, goToPage, goToPrevPage, hits, index, lastPageNumber, perPage, query, results, search, searchFilters, searchParams, setTotalHits, sort, sorts, totalPages

export default {
  useSearchEngine,
  client,
  search,
  calculatePagination,
  currentPage,
}
