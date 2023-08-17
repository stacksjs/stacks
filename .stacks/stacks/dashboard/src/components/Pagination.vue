<template>
  <div class="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 dark:border-gray-600 rounded-bl-lg rounded-br-lg dark:bg-blue-gray-800 sm:px-6 dark:border-gray-600">
    <div class="flex justify-between flex-1 sm:hidden">
      <a
        href="#"
        class="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md dark:border-gray-600 dark:text-gray-200 hover:bg-gray-50"
      >Previous</a><a
        href="#"
        class="relative inline-flex items-center px-4 py-2 ml-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md dark:border-gray-600 dark:text-gray-200 hover:bg-gray-50"
      >Next</a>
    </div>
    <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
      <div>
        <p class="text-sm text-gray-700 dark:text-gray-300 dark:text-gray-200">
          Showing <span class="font-semibold">1</span> to <span class="font-semibold">20</span> of <span class="font-semibold">875</span> results
        </p>
      </div>
      <div>
        <nav
          class="inline-flex -space-x-px rounded-md shadow-sm isolate"
          aria-label="Pagination"
        >
          <a
            href="#"
            class="relative inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-l-md dark:bg-blue-gray-700 dark:text-gray-300 dark:border-gray-600 dark:text-gray-400 hover:bg-gray-50 focus:z-20"
          >
            <span class="sr-only">First</span>
            <div class="i-heroicons-chevron-double-left-20-solid w-5 h-5" />
          </a>
          <a
            href="#"
            class="relative inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 dark:bg-blue-gray-700 dark:text-gray-300 dark:border-gray-600 dark:text-gray-400 hover:bg-gray-50 focus:z-20"
          >
            <span class="sr-only">Previous</span>
            <div class="i-heroicons-chevron-left-20-solid w-5 h-5" />
          </a>
          <a
            href="#"
            aria-current="page"
            class="border-blue-gray-400 z-20 text-blue-600 dark:bg-blue-gray-600 bg-blue-gray-50 relative inline-flex items-center px-4 py-2 text-sm font-medium border hover:bg-blue-gray-50 dark:border-gray-600 dark:text-teal-50"
          >1</a><a
            href="#"
            aria-current="page"
            class="dark:bg-blue-gray-700 dark-hover:bg-gray-600 relative inline-flex items-center px-4 py-2 text-sm font-medium border hover:bg-blue-gray-50 dark:border-gray-600 dark:text-teal-50"
          >2</a><a
            href="#"
            aria-current="page"
            class="dark:bg-blue-gray-700 dark-hover:bg-gray-600 relative inline-flex items-center px-4 py-2 text-sm font-medium border hover:bg-blue-gray-50 dark:border-gray-600 dark:text-teal-50"
          >3</a><a
            href="#"
            aria-current="page"
            class="dark:bg-blue-gray-700 dark-hover:bg-gray-600 relative inline-flex items-center px-4 py-2 text-sm font-medium border hover:bg-blue-gray-50 dark:border-gray-600 dark:text-teal-50"
          >4</a><a
            href="#"
            aria-current="page"
            class="dark:bg-blue-gray-700 dark-hover:bg-gray-600 relative inline-flex items-center px-4 py-2 text-sm font-medium border hover:bg-blue-gray-50 dark:border-gray-600 dark:text-teal-50"
          >5</a>
          <a
            href="#"
            class="relative inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 dark:bg-blue-gray-700 dark:text-gray-300 dark:border-gray-600 dark:text-gray-400 hover:bg-gray-50 focus:z-20"
          >
            <span class="sr-only">Next</span>
            <div class="i-heroicons-chevron-right-20-solid w-5 h-5" />
          </a>
          <a
            href="#"
            class="relative inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-r-md dark:bg-blue-gray-700 dark:text-gray-300 dark:border-gray-600 dark:text-gray-400 hover:bg-gray-50 focus:z-20"
          >
            <span class="sr-only">Last</span>
            <div class="i-heroicons-chevron-double-right-20-solid w-5 h-5" />
          </a>
        </nav>
      </div>
    </div>
  </div>
</template>
