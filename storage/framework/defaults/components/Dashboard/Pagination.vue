<template>
  <div class="flex items-center justify-between border-t border-gray-200 rounded-bl-lg rounded-br-lg bg-white px-4 py-3 dark:border-gray-600 dark:border-gray-600 dark:bg-blue-gray-800 sm:px-6">
    <div class="flex flex-1 justify-between sm:hidden">
      <a
        href="#"
        class="relative inline-flex items-center border border-gray-300 rounded-md bg-white px-4 py-2 text-sm text-gray-700 font-medium dark:border-gray-600 hover:bg-gray-50 dark:text-gray-200"
      >Previous</a><a
        href="#"
        class="relative ml-3 inline-flex items-center border border-gray-300 rounded-md bg-white px-4 py-2 text-sm text-gray-700 font-medium dark:border-gray-600 hover:bg-gray-50 dark:text-gray-200"
      >Next</a>
    </div>
    <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
      <div>
        <p class="text-sm text-gray-700 dark:text-gray-200 dark:text-gray-300">
          Showing <span class="font-semibold">1</span> to <span class="font-semibold">20</span> of <span class="font-semibold">875</span> results
        </p>
      </div>
      <div>
        <nav
          class="isolate inline-flex rounded-md shadow-sm -space-x-px"
          aria-label="Pagination"
        >
          <a
            href="#"
            class="relative inline-flex items-center border border-gray-300 rounded-l-md bg-white px-2 py-2 text-sm text-gray-500 font-medium focus:z-20 dark:border-gray-600 dark:bg-blue-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:text-gray-400"
          >
            <span class="sr-only">First</span>
            <div class="i-hugeicons-chevron-double-left-20-solid h-5 w-5" />
          </a>
          <a
            href="#"
            class="relative inline-flex items-center border border-gray-300 bg-white px-2 py-2 text-sm text-gray-500 font-medium focus:z-20 dark:border-gray-600 dark:bg-blue-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:text-gray-400"
          >
            <span class="sr-only">Previous</span>
            <div class="i-hugeicons-chevron-left-20-solid h-5 w-5" />
          </a>
          <a
            href="#"
            aria-current="page"
            class="relative z-20 inline-flex items-center border border-blue-gray-400 bg-blue-gray-50 px-4 py-2 text-sm text-blue-600 font-medium dark:border-gray-600 dark:bg-blue-gray-600 hover:bg-blue-gray-50 dark:text-teal-50"
          >1</a><a
            href="#"
            aria-current="page"
            class="relative inline-flex items-center border px-4 py-2 text-sm font-medium dark:border-gray-600 dark:bg-blue-gray-700 hover:bg-blue-gray-50 dark:text-teal-50 dark-hover:bg-gray-600"
          >2</a><a
            href="#"
            aria-current="page"
            class="relative inline-flex items-center border px-4 py-2 text-sm font-medium dark:border-gray-600 dark:bg-blue-gray-700 hover:bg-blue-gray-50 dark:text-teal-50 dark-hover:bg-gray-600"
          >3</a><a
            href="#"
            aria-current="page"
            class="relative inline-flex items-center border px-4 py-2 text-sm font-medium dark:border-gray-600 dark:bg-blue-gray-700 hover:bg-blue-gray-50 dark:text-teal-50 dark-hover:bg-gray-600"
          >4</a><a
            href="#"
            aria-current="page"
            class="relative inline-flex items-center border px-4 py-2 text-sm font-medium dark:border-gray-600 dark:bg-blue-gray-700 hover:bg-blue-gray-50 dark:text-teal-50 dark-hover:bg-gray-600"
          >5</a>
          <a
            href="#"
            class="relative inline-flex items-center border border-gray-300 bg-white px-2 py-2 text-sm text-gray-500 font-medium focus:z-20 dark:border-gray-600 dark:bg-blue-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:text-gray-400"
          >
            <span class="sr-only">Next</span>
            <div class="i-hugeicons-chevron-right-20-solid h-5 w-5" />
          </a>
          <a
            href="#"
            class="relative inline-flex items-center border border-gray-300 rounded-r-md bg-white px-2 py-2 text-sm text-gray-500 font-medium focus:z-20 dark:border-gray-600 dark:bg-blue-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:text-gray-400"
          >
            <span class="sr-only">Last</span>
            <div class="i-hugeicons-chevron-double-right-20-solid h-5 w-5" />
          </a>
        </nav>
      </div>
    </div>
  </div>
</template>
