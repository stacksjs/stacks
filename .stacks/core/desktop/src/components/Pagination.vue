<script setup lang="ts">
interface Props {
  results: any
}

const {
  results,
} = defineProps<Props>()

const emit = defineEmits(['goToPage'])

function goPrevious(page: number) {
  goTo(page - 1)
}

function goNext(page: number) {
  goTo(page + 1)
}

const totalPages = ref(0)

const currentPage = computed(() => {
  if (results.offset === 0)
    return 1

  return (results.offset / 20) + 1
})

const totalCount = computed(() => {
  return results.estimatedTotalHits
})

const currentShowing = computed(() => {
  const count = ((20 * currentPage.value) - 20) + 1

  return count < 0 ? 0 + 1 : count
})

const pages = computed(() => {
  totalPages.value = Math.ceil(results.estimatedTotalHits / 20)

  const hitPages = [...Array(totalPages.value).keys()].map(i => i + 1)
  const offset = 2
  // const currentPage = currentPage ?? 1
  const currPage = currentPage.value ?? 1

  const lastPage = hitPages[hitPages.length - 1]

  let from = currPage - offset
  if (from < 1)
    from = 1

  let to = from + offset * 2
  if (to >= lastPage)
    to = lastPage

  const allPages = []
  for (let page = from; page <= to; page++)
    allPages.push(page)

  return allPages
})

const lastPage = computed(() => {
  const lastPage = pages.value[pages.value.length - 1]

  return lastPage
})

const currentCount = computed(() => {
  if (currentPage.value === lastPage.value)
    return results.estimatedTotalHits

  return results.limit + results.offset
})

function goTo(page: number) {
  if (page > totalPages.value)
    return
  if (page < 1)
    return

  emit('goToPage', page)
}
</script>

<template>
  <div class="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 rounded-bl-lg rounded-br-lg dark:bg-gray-800 sm:px-6 dark:border-gray-600">
    <div class="flex justify-between flex-1 sm:hidden">
      <a
        href="#"
        class="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md dark:border-gray-600 dark:text-gray-200 hover:bg-gray-50"
        @click.prevent="goPrevious(currentPage)"
      >Previous</a>
      <a
        href="#"
        class="relative inline-flex items-center px-4 py-2 ml-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md dark:border-gray-600 dark:text-gray-200 hover:bg-gray-50"
        @click.prevent="goNext(currentPage)"
      >Next</a>
    </div>
    <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
      <div>
        <p class="text-sm text-gray-700 dark:text-gray-300 dark:text-gray-200">
          Showing
          <span class="font-semibold">
            {{ currentShowing }}
          </span>
          to
          <span class="font-semibold">
            {{ currentCount }}
          </span>
          of
          <span class="font-semibold">
            {{ totalCount }}
          </span>
          results
        </p>
      </div>
      <div>
        <nav
          class="inline-flex -space-x-px rounded-md shadow-sm isolate"
          aria-label="Pagination"
        >
          <a
            href="#"
            class="relative inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-l-md dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:text-gray-400 hover:bg-gray-50 focus:z-20"
            @click.prevent="goPrevious(currentPage)"
          >
            <span class="sr-only">Previous</span>
            <!-- Heroicon name: mini/chevron-left -->
            <svg
              class="w-5 h-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                clip-rule="evenodd"
              />
            </svg>
          </a>
          <!-- Current: "z-10 bg-teal-50 border-teal-500 text-teal-600", Default: "bg-white border-gray-300 text-gray-500 dark:text-gray-400 hover:bg-gray-50" -->
          <a
            v-for="(page, index) in pages"
            :key="index"
            href="#"
            aria-current="page"
            :class="{ 'border-teal-500 z-20 text-teal-600 dark:bg-gray-600 bg-teal-50': currentPage === page, 'dark:bg-gray-700 dark-hover:bg-gray-600': currentPage !== page }"
            class="relative inline-flex items-center px-4 py-2 text-sm font-medium border hover:bg-gray-50 dark:border-gray-600 dark:text-teal-50"
            @click.prevent="goTo(page)"
          >{{ page }}</a>

          <a
            href="#"
            class="relative inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-r-md dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:text-gray-400 hover:bg-gray-50 focus:z-20"
            @click.prevent="goNext(currentPage)"
          >
            <span class="sr-only">Next</span>
            <!-- Heroicon name: mini/chevron-right -->
            <svg
              class="w-5 h-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                clip-rule="evenodd"
              />
            </svg>
          </a>
        </nav>
      </div>
    </div>
  </div>
</template>
