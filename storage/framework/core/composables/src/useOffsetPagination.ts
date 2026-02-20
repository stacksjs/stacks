import type { Ref } from '@stacksjs/stx'
import { computed, ref, watch } from '@stacksjs/stx'

export interface UseOffsetPaginationOptions {
  /** Total number of items */
  total?: Ref<number> | number
  /** Items per page. Default: 10 */
  pageSize?: number
  /** Current page (1-indexed). Default: 1 */
  page?: number
  /** Callback when page changes */
  onPageChange?: (returnValue: { currentPage: number, currentPageSize: number }) => void
  /** Callback when page size changes */
  onPageSizeChange?: (returnValue: { currentPage: number, currentPageSize: number }) => void
}

export interface UseOffsetPaginationReturn {
  currentPage: Ref<number>
  currentPageSize: Ref<number>
  pageCount: Ref<number>
  isFirstPage: Ref<boolean>
  isLastPage: Ref<boolean>
  prev: () => void
  next: () => void
}

/**
 * Reactive offset-based pagination.
 */
export function useOffsetPagination(options: UseOffsetPaginationOptions = {}): UseOffsetPaginationReturn {
  const {
    total: totalOption,
    pageSize = 10,
    page = 1,
    onPageChange,
    onPageSizeChange,
  } = options

  const currentPage = ref(page)
  const currentPageSize = ref(pageSize)

  const totalItems = typeof totalOption === 'object' && totalOption && 'value' in totalOption
    ? totalOption
    : ref(typeof totalOption === 'number' ? totalOption : 0)

  const pageCount = ref(Math.max(1, Math.ceil((totalItems as Ref<number>).value / currentPageSize.value)))
  const isFirstPage = ref(currentPage.value <= 1)
  const isLastPage = ref(currentPage.value >= pageCount.value)

  function updateComputed(): void {
    pageCount.value = Math.max(1, Math.ceil((totalItems as Ref<number>).value / currentPageSize.value))
    isFirstPage.value = currentPage.value <= 1
    isLastPage.value = currentPage.value >= pageCount.value
  }

  watch(currentPage, () => {
    updateComputed()
    onPageChange?.({ currentPage: currentPage.value, currentPageSize: currentPageSize.value })
  })

  watch(currentPageSize, () => {
    // Reset to page 1 when page size changes
    currentPage.value = 1
    updateComputed()
    onPageSizeChange?.({ currentPage: currentPage.value, currentPageSize: currentPageSize.value })
  })

  watch(totalItems as Ref<number>, () => {
    updateComputed()
  })

  function prev(): void {
    if (currentPage.value > 1)
      currentPage.value--
  }

  function next(): void {
    if (currentPage.value < pageCount.value)
      currentPage.value++
  }

  updateComputed()

  return {
    currentPage,
    currentPageSize,
    pageCount,
    isFirstPage,
    isLastPage,
    prev,
    next,
  }
}
