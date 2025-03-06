<script setup lang="ts">
// const emit = defineEmits(['paginateToNextPage', 'paginateToPreviousPage', 'paginateToPage'])

// const { goToNextPage, goToPrevPage, goToPage, table, lastPageNumber, views } = await useTable()

// watch(totalPages, (newValue, oldValue) => {
//   console.log('totalPages', totalPages.value)
//   console.log('oldValue', oldValue)
//   console.log('newValue', newValue)
// })

// const isFirstPage = computed(() => {
//   if (table.currentPage === 1)
//     return true

//   return false
// })

// const isLastPage = computed(() => {
//   if (table.currentPage === totalPages.value)
//     return true

//   return false
// })

// console.log('views', views.value)

// function next() {
//   goToNextPage()
//   emit('paginateToNextPage')
// }

// function back() {
//   goToPrevPage()
//   emit('paginateToPreviousPage')
// }

// function paginateTo(page: number) {
//   goToPage(page)
//   emit('paginateToPage', page)
// }

// const currentCount = computed(() => {
//   const count = table.perPage * table.currentPage
//   const nbHits = table.results?.nbHits || 1

//   return count > nbHits ? table.results?.nbHits : count
// })
</script>

<template>
  <div class="flex items-center justify-end border-gray-200 bg-white py-3">
    <!-- <div class="flex flex-1 justify-between sm:hidden">
      <a href="#"
        class="bg-white border rounded-md font-medium border-gray-300 text-sm py-2 px-4 text-gray-700 relative inline-flex items-center hover:bg-gray-50"
        @click.prevent="goToPrevPage()">
        Previous
      </a>
      <a href="#"
        class="bg-white border rounded-md font-medium border-gray-300 text-sm ml-3 py-2 px-4 text-gray-700 relative inline-flex items-center hover:bg-gray-50"
        @click.prevent="goToNextPage()">
        Next
      </a>
    </div> -->
    <div
      class="inline-block hidden min-w-full py-2 align-middle sm:flex sm:flex-1 sm:items-center sm:justify-between lg:px-8 md:px-6"
    >
      <div>
        <!-- <p class="text-sm text-gray-700">
          Showing {{ ((table.perPage * table.currentPage) - table.perPage) + 1 }}
          <span class="font-medium" />
          to
          <span class="font-medium"> {{ currentCount }} </span>
          of
          <span class="font-medium"> {{ table.results?.nbHits ?? 0 }} </span>
          results
        </p> -->
      </div>

      <div>
        <nav
          class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
          aria-label="Pagination"
        >
          <!-- <a href="#"
            class="bg-white border rounded-l-md font-medium border-gray-300 text-sm py-2 px-2 text-gray-500 relative inline-flex items-center hover:bg-gray-50"
            @click.prevent="paginateTo(1)">
            <span class="sr-only">First</span>
            <div class="h-4 w-5 i-hugeicons-solid-chevron-double-left" />
          </a>
          <a href="#"
            class="bg-white border font-medium border-gray-300 text-sm py-2 px-2 text-gray-500 relative inline-flex items-center hover:bg-gray-50"
            @click.prevent="back()">
            <span class="sr-only">Previous</span>
            <div class="h-5 w-5 i-hugeicons-solid-chevron-left" />
          </a> -->

          <!-- Current: "z-10 bg-blue-50 border-blue-500 text-blue-600", Default: "bg-white border-gray-300 text-gray-500 hover:bg-gray-50" -->
          <!-- <a v-for="page in views" :key="page" href="#" aria-current="page"
            :class="[table.currentPage === page && 'border bg-yellow-500 border-yellow-500 text-gray-900 z-10']"
            class="border border-gray-300 text-gray-500 font-medium text-sm py-2 px-4 relative inline-flex items-center underline-transparent"
            @click.prevent="paginateTo(page)">
            {{ page }}
          </a> -->
          <!-- <a href="#" class="bg-white border font-medium border-gray-300 text-sm py-2 px-4 text-gray-500 relative inline-flex items-center underline-transparent hover:bg-gray-50"> 2 </a>
          <a href="#" class="bg-white border font-medium border-gray-300 text-sm py-2 px-4 text-gray-500 hidden relative items-center underline-transparent md:inline-flex hover:bg-gray-50"> 3 </a>
          <a href="#" class="bg-white border font-medium border-gray-300 text-sm py-2 px-4 text-gray-500 hidden relative items-center underline-transparent md:inline-flex hover:bg-gray-50"> 4 </a>
          <a href="#" class="bg-white border font-medium border-gray-300 text-sm py-2 px-4 text-gray-500 hidden relative items-center underline-transparent md:inline-flex hover:bg-gray-50"> 5 </a> -->

          <!-- <a href="#"
            class="bg-white border font-medium border-gray-300 text-sm py-2 px-2 text-gray-500 relative inline-flex items-center underline-transparent hover:bg-gray-50"
            @click.prevent="next()">
            <span class="sr-only">Next</span>
            <div class="h-5 w-5 i-hugeicons-solid-chevron-right" />
          </a>
          <a href="#"
            class="bg-white border rounded-r-md font-medium border-gray-300 text-sm py-2 px-2 text-gray-500 relative inline-flex items-center underline-transparent hover:bg-gray-50"
            @click.prevent="paginateTo(lastPageNumber)">
            <span class="sr-only">Last</span>
            <div class="h-4 w-5 i-hugeicons-solid-chevron-double-right" />
          </a> -->
        </nav>
      </div>
    </div>
  </div>
</template>
