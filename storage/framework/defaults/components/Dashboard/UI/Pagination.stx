<script setup lang="ts">
/**
 * Pagination Component
 * Modern pagination with page numbers, prev/next, and items per page.
 */
import { computed } from 'vue'

interface Props {
  currentPage: number
  totalPages: number
  totalItems?: number
  itemsPerPage?: number
  showItemsPerPage?: boolean
  showTotalItems?: boolean
  maxVisiblePages?: number
  itemsPerPageOptions?: number[]
}

const props = withDefaults(defineProps<Props>(), {
  showItemsPerPage: false,
  showTotalItems: true,
  maxVisiblePages: 5,
  itemsPerPageOptions: () => [10, 25, 50, 100],
})

const emit = defineEmits<{
  (e: 'update:currentPage', page: number): void
  (e: 'update:itemsPerPage', count: number): void
}>()

// Calculate visible page numbers
const visiblePages = computed(() => {
  const pages: (number | 'ellipsis')[] = []
  const total = props.totalPages
  const current = props.currentPage
  const max = props.maxVisiblePages

  if (total <= max) {
    // Show all pages
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  } else {
    // Always show first page
    pages.push(1)

    // Calculate range around current page
    let start = Math.max(2, current - Math.floor((max - 3) / 2))
    let end = Math.min(total - 1, start + max - 4)

    // Adjust start if we're near the end
    if (end === total - 1) {
      start = Math.max(2, end - (max - 4))
    }

    // Add ellipsis before middle pages if needed
    if (start > 2) {
      pages.push('ellipsis')
    }

    // Add middle pages
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    // Add ellipsis after middle pages if needed
    if (end < total - 1) {
      pages.push('ellipsis')
    }

    // Always show last page
    pages.push(total)
  }

  return pages
})

// Calculate item range
const itemRange = computed(() => {
  if (!props.totalItems || !props.itemsPerPage) return null

  const start = (props.currentPage - 1) * props.itemsPerPage + 1
  const end = Math.min(props.currentPage * props.itemsPerPage, props.totalItems)

  return { start, end }
})

function goToPage(page: number) {
  if (page >= 1 && page <= props.totalPages && page !== props.currentPage) {
    emit('update:currentPage', page)
  }
}

function updateItemsPerPage(event: Event) {
  const value = parseInt((event.target as HTMLSelectElement).value)
  emit('update:itemsPerPage', value)
}
</script>

<template>
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <!-- Left: Items info & per page selector -->
    <div class="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
      <!-- Items per page -->
      <div v-if="showItemsPerPage && itemsPerPage" class="flex items-center gap-2">
        <span>Show</span>
        <select
          :value="itemsPerPage"
          class="rounded-md border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-sm focus:ring-blue-500 focus:border-blue-500"
          @change="updateItemsPerPage"
        >
          <option v-for="option in itemsPerPageOptions" :key="option" :value="option">
            {{ option }}
          </option>
        </select>
        <span>per page</span>
      </div>

      <!-- Total items info -->
      <div v-if="showTotalItems && itemRange">
        <span class="text-neutral-700 dark:text-neutral-200 font-medium">
          {{ itemRange.start }}-{{ itemRange.end }}
        </span>
        of
        <span class="text-neutral-700 dark:text-neutral-200 font-medium">
          {{ totalItems }}
        </span>
        items
      </div>
    </div>

    <!-- Right: Page navigation -->
    <nav class="flex items-center gap-1" aria-label="Pagination">
      <!-- Previous button -->
      <button
        type="button"
        :disabled="currentPage === 1"
        :class="[
          'p-2 rounded-lg text-sm font-medium transition-colors',
          currentPage === 1
            ? 'text-neutral-300 dark:text-neutral-600 cursor-not-allowed'
            : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-800',
        ]"
        @click="goToPage(currentPage - 1)"
      >
        <div class="i-hugeicons-arrow-left-01 w-5 h-5" />
      </button>

      <!-- Page numbers -->
      <template v-for="(page, index) in visiblePages" :key="index">
        <span
          v-if="page === 'ellipsis'"
          class="px-2 text-neutral-400 dark:text-neutral-500"
        >
          ...
        </span>
        <button
          v-else
          type="button"
          :class="[
            'min-w-[2.25rem] h-9 px-3 rounded-lg text-sm font-medium transition-colors',
            page === currentPage
              ? 'bg-blue-600 text-white'
              : 'text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-800',
          ]"
          @click="goToPage(page as number)"
        >
          {{ page }}
        </button>
      </template>

      <!-- Next button -->
      <button
        type="button"
        :disabled="currentPage === totalPages"
        :class="[
          'p-2 rounded-lg text-sm font-medium transition-colors',
          currentPage === totalPages
            ? 'text-neutral-300 dark:text-neutral-600 cursor-not-allowed'
            : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-800',
        ]"
        @click="goToPage(currentPage + 1)"
      >
        <div class="i-hugeicons-arrow-right-01 w-5 h-5" />
      </button>
    </nav>
  </div>
</template>
