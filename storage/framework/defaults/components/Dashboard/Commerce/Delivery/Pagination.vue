<template>
  <div class="mt-5 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6">
    <div class="flex flex-1 justify-between sm:hidden">
      <a
        href="#"
        class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-gray-200 dark:hover:bg-blue-gray-700"
        @click.prevent="$emit('prev')"
        :class="{ 'opacity-50 cursor-not-allowed': currentPage === 1 }"
      >
        Previous
      </a>
      <a
        href="#"
        class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-gray-200 dark:hover:bg-blue-gray-700"
        @click.prevent="$emit('next')"
        :class="{ 'opacity-50 cursor-not-allowed': currentPage === totalPages }"
      >
        Next
      </a>
    </div>
    <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
      <div>
        <p class="text-sm text-gray-700 dark:text-gray-300">
          Showing
          <span class="font-medium">{{ startItem }}</span>
          to
          <span class="font-medium">{{ endItem }}</span>
          of
          <span class="font-medium">{{ totalItems }}</span>
          results
        </p>
      </div>
      <div>
        <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
          <a
            href="#"
            class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-gray-700 dark:hover:bg-blue-gray-700"
            @click.prevent="$emit('prev')"
            :class="{ 'opacity-50 cursor-not-allowed': currentPage === 1 }"
          >
            <span class="sr-only">Previous</span>
            <div class="i-hugeicons-arrow-left-01 h-5 w-5" />
          </a>

          <template v-for="page in displayedPages" :key="page">
            <a
              v-if="page !== '...'"
              href="#"
              :class="[
                page === currentPage
                  ? 'relative z-10 inline-flex items-center bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-blue-700'
                  : 'relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:text-gray-200 dark:ring-gray-700 dark:hover:bg-blue-gray-700',
                'cursor-pointer'
              ]"
              @click.prevent="$emit('page', page)"
            >
              {{ page }}
            </a>
            <span
              v-else
              class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0 dark:text-gray-400 dark:ring-gray-700"
            >
              ...
            </span>
          </template>

          <a
            href="#"
            class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-gray-700 dark:hover:bg-blue-gray-700"
            @click.prevent="$emit('next')"
            :class="{ 'opacity-50 cursor-not-allowed': currentPage === totalPages }"
          >
            <span class="sr-only">Next</span>
            <div class="i-hugeicons-arrow-right-01 h-5 w-5" />
          </a>
        </nav>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps({
  currentPage: {
    type: Number,
    required: true
  },
  totalItems: {
    type: Number,
    required: true
  },
  itemsPerPage: {
    type: Number,
    default: 10
  },
  maxDisplayedPages: {
    type: Number,
    default: 5
  }
})

defineEmits(['prev', 'next', 'page'])

const totalPages = computed(() => Math.ceil(props.totalItems / props.itemsPerPage))
const startItem = computed(() => ((props.currentPage - 1) * props.itemsPerPage) + 1)
const endItem = computed(() => Math.min(props.currentPage * props.itemsPerPage, props.totalItems))

const displayedPages = computed(() => {
  if (totalPages.value <= props.maxDisplayedPages) {
    return Array.from({ length: totalPages.value }, (_, i) => i + 1)
  }

  const pages = []
  const halfMax = Math.floor(props.maxDisplayedPages / 2)

  // Always show first page
  pages.push(1)

  // Add ellipsis if needed
  if (props.currentPage - halfMax > 2) {
    pages.push('...')
  }

  // Add pages around current page
  const start = Math.max(2, props.currentPage - halfMax)
  const end = Math.min(totalPages.value - 1, props.currentPage + halfMax)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  // Add ellipsis if needed
  if (props.currentPage + halfMax < totalPages.value - 1) {
    pages.push('...')
  }

  // Always show last page
  if (totalPages.value > 1) {
    pages.push(totalPages.value)
  }

  return pages
})
</script>
