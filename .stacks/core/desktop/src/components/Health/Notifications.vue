<script lang="ts" setup>
const alertModal = ref(false)

const type = ref('')
const operator = ref('')
const threshold = ref('')
const duration = ref('')
const notify_to = ref('')

function openAlertModal() {
  alertModal.value = true
}

function closeAlertModal() {
  alertModal.value = false
}
</script>

<template>
  <div class="bg-white dark:bg-gray-700">
    <div class="p-4 border-b dark:border-gray-600">
      <div class="flex justify-between items-center">
        <h3 class="font-semibold">
          Alerts
        </h3>

        <button
          type="button"
          class="inline-flex items-center px-2 py-2 mb-4 text-sm font-semibold leading-4 text-white transition duration-150 ease-in-out bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          @click="openAlertModal"
        >
          <svg
            class="w-5 h-5 text-gray-100 dark:text-gray-300"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          ><path
            fill-rule="evenodd"
            d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
            clip-rule="evenodd"
          /></svg>
          <span>New Alert</span>
        </button>
      </div>
    </div>

    <div class="p-4">
      <div class="flex flex-col">
        <div class="overflow-x-auto">
          <div class="inline-block min-w-full py-2 align-middle">
            <table class="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th
                    scope="col"
                    class="py-3.5 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Type
                  </th>
                  <th
                    scope="col"
                    class="py-3.5 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Operator
                  </th>
                  <th
                    scope="col"
                    class="py-3.5 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Threshold
                  </th>
                  <th
                    scope="col"
                    class="py-3.5 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Duration
                  </th>
                  <th
                    scope="col"
                    class="py-3.5 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Notify
                  </th>
                  <th
                    scope="col"
                    class="py-3.5 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Latest
                  </th>

                  <th />
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    CPU Usage
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    gte
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    50%
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    10 minutes
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    chris.breuer@eliinova.com
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    <span class="inline-flex items-center rounded-md bg-green-100 px-2.5 py-0.5 text-sm font-medium text-green-800"><svg
                      fill="currentColor"
                      viewBox="0 0 8 8"
                      class="-ml-0.5 mr-1.5 h-2 w-2 text-green-400 mr-1.5"
                    ><circle
                      cx="4"
                      cy="4"
                      r="3"
                    /></svg>
                      OK
                    </span>
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 text-right whitespace-nowrap dark:text-gray-200">
                    <span
                      class="inline-flex rounded-md shadow-sm isolate"
                    ><button
                       type="button"
                       href="#"
                       title="Edit"
                       class="relative items-center p-2 text-xs font-semibold dark-hover:bg-gray-500 text-white transition duration-150 ease-in-out border border-gray-300 rounded-l-md hover:bg-gray-100 focus:z-10 focus:outline-none    focus:ring-2 group"
                     >

                       <svg
                         fill="none"
                         stroke="currentColor"
                         stroke-width="2"
                         viewBox="0 0 24 24"
                         xmlns="http://www.w3.org/2000/svg"
                         aria-hidden="true"
                         class="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700"
                       >
                         <path
                           stroke-linecap="round"
                           stroke-linejoin="round"
                           d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0M3.124 7.5A8.969 8.969 0 015.292 3m13.416 0a8.969 8.969 0 012.168 4.5"
                         />
                       </svg>
                     </button>
                      <button
                        type="button"
                        title="Delete"
                        class="relative items-center p-2 text-xs font-semibold dark-hover:bg-gray-500 text-white transition duration-150 ease-in-out border border-gray-300 rounded-r-md hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-red-500  focus:ring-2 group"
                      ><svg
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                        class="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      /></svg>
                      </button>
                    </span>
                  </td>
                </tr><tr>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    Used Disk Space
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    gte
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    75%
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    N/A
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    chris.breuer@eliinova.com
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    <span class="inline-flex items-center rounded-md bg-green-100 px-2.5 py-0.5 text-sm font-medium text-green-800"><svg
                      fill="currentColor"
                      viewBox="0 0 8 8"
                      class="-ml-0.5 mr-1.5 h-2 w-2 text-green-400 mr-1.5"
                    ><circle
                      cx="4"
                      cy="4"
                      r="3"
                    /></svg>
                      OK
                    </span>
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 text-right whitespace-nowrap dark:text-gray-200">
                    <span
                      class="inline-flex rounded-md shadow-sm isolate"
                    ><button
                       type="button"
                       href="#"
                       title="Edit"
                       class="relative items-center p-2 text-xs font-semibold dark-hover:bg-gray-500 text-white transition duration-150 ease-in-out border border-gray-300 rounded-l-md hover:bg-gray-100 focus:z-10 focus:outline-none    focus:ring-2 group"
                     >
                       <svg
                         fill="none"
                         stroke="currentColor"
                         stroke-width="2"
                         viewBox="0 0 24 24"
                         xmlns="http://www.w3.org/2000/svg"
                         aria-hidden="true"
                         class="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700"
                       >
                         <path
                           stroke-linecap="round"
                           stroke-linejoin="round"
                           d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0M3.124 7.5A8.969 8.969 0 015.292 3m13.416 0a8.969 8.969 0 012.168 4.5"
                         />
                       </svg>
                     </button>
                      <button
                        type="button"
                        title="Delete"
                        class="relative items-center p-2 text-xs font-semibold dark-hover:bg-gray-500 text-white transition duration-150 ease-in-out border border-gray-300 rounded-r-md hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-red-500  focus:ring-2 group"
                      ><svg
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                        class="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      /></svg>
                      </button>
                    </span>
                  </td>
                </tr><tr>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    CPU Usage
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    gte
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    50%
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    5 minutes
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    chris.breuer@eliinova.com
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    <span class="inline-flex items-center rounded-md bg-green-100 px-2.5 py-0.5 text-sm font-medium text-green-800"><svg
                      fill="currentColor"
                      viewBox="0 0 8 8"
                      class="-ml-0.5 mr-1.5 h-2 w-2 text-green-400 mr-1.5"
                    ><circle
                      cx="4"
                      cy="4"
                      r="3"
                    /></svg>
                      OK
                    </span>
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 text-right whitespace-nowrap dark:text-gray-200">
                    <span
                      class="inline-flex rounded-md shadow-sm isolate"
                    ><button
                       type="button"
                       href="#"
                       title="Edit"
                       class="relative items-center p-2 text-xs font-semibold dark-hover:bg-gray-500 text-white transition duration-150 ease-in-out border border-gray-300 rounded-l-md hover:bg-gray-100 focus:z-10 focus:outline-none    focus:ring-2 group"
                     >

                       <svg
                         fill="none"
                         stroke="currentColor"
                         stroke-width="2"
                         viewBox="0 0 24 24"
                         xmlns="http://www.w3.org/2000/svg"
                         aria-hidden="true"
                         class="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700"
                       >
                         <path
                           stroke-linecap="round"
                           stroke-linejoin="round"
                           d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0M3.124 7.5A8.969 8.969 0 015.292 3m13.416 0a8.969 8.969 0 012.168 4.5"
                         />
                       </svg>
                     </button>
                      <button
                        type="button"
                        title="Delete"
                        class="relative items-center p-2 text-xs font-semibold dark-hover:bg-gray-500 text-white transition duration-150 ease-in-out border border-gray-300 rounded-r-md hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-red-500  focus:ring-2 group"
                      ><svg
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                        class="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      /></svg>
                      </button>
                    </span>
                  </td>
                </tr><tr>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    Used Memory
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    gte
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    50%
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    5 minutes
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    chris.breuer@eliinova.com
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    <span class="inline-flex items-center rounded-md bg-green-100 px-2.5 py-0.5 text-sm font-medium text-green-800"><svg
                      fill="currentColor"
                      viewBox="0 0 8 8"
                      class="-ml-0.5 mr-1.5 h-2 w-2 text-green-400 mr-1.5"
                    ><circle
                      cx="4"
                      cy="4"
                      r="3"
                    /></svg>
                      OK
                    </span>
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 text-right whitespace-nowrap dark:text-gray-200">
                    <span
                      class="inline-flex rounded-md shadow-sm isolate"
                    ><button
                       type="button"
                       href="#"
                       title="Edit"
                       class="relative items-center p-2 text-xs font-semibold dark-hover:bg-gray-500 text-white transition duration-150 ease-in-out border border-gray-300 rounded-l-md hover:bg-gray-100 focus:z-10 focus:outline-none    focus:ring-2 group"
                     >

                       <svg
                         fill="none"
                         stroke="currentColor"
                         stroke-width="2"
                         viewBox="0 0 24 24"
                         xmlns="http://www.w3.org/2000/svg"
                         aria-hidden="true"
                         class="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700"
                       >
                         <path
                           stroke-linecap="round"
                           stroke-linejoin="round"
                           d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0M3.124 7.5A8.969 8.969 0 015.292 3m13.416 0a8.969 8.969 0 012.168 4.5"
                         />
                       </svg>
                     </button>
                      <button
                        type="button"
                        title="Delete"
                        class="relative items-center p-2 text-xs font-semibold dark-hover:bg-gray-500 text-white transition duration-150 ease-in-out border border-gray-300 rounded-r-md hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-red-500  focus:ring-2 group"
                      ><svg
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                        class="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      /></svg>
                      </button>
                    </span>
                  </td>
                </tr><tr>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    Used Disk Space
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    gte
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    75%
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    N/A
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    pujen@eliinova.com
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 whitespace-nowrap dark:text-gray-200">
                    <span class="inline-flex items-center rounded-md bg-green-100 px-2.5 py-0.5 text-sm font-medium text-green-800"><svg
                      fill="currentColor"
                      viewBox="0 0 8 8"
                      class="-ml-0.5 mr-1.5 h-2 w-2 text-green-400 mr-1.5"
                    ><circle
                      cx="4"
                      cy="4"
                      r="3"
                    /></svg>
                      OK
                    </span>
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-600 text-right whitespace-nowrap dark:text-gray-200">
                    <span
                      class="inline-flex rounded-md shadow-sm isolate"
                    ><button
                       type="button"
                       href="#"
                       title="Edit"
                       class="relative items-center p-2 text-xs font-semibold dark-hover:bg-gray-500 text-white transition duration-150 ease-in-out border border-gray-300 rounded-l-md hover:bg-gray-100 focus:z-10 focus:outline-none    focus:ring-2 group"
                     >

                       <svg
                         fill="none"
                         stroke="currentColor"
                         stroke-width="2"
                         viewBox="0 0 24 24"
                         xmlns="http://www.w3.org/2000/svg"
                         aria-hidden="true"
                         class="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700"
                       >
                         <path
                           stroke-linecap="round"
                           stroke-linejoin="round"
                           d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0M3.124 7.5A8.969 8.969 0 015.292 3m13.416 0a8.969 8.969 0 012.168 4.5"
                         />
                       </svg>
                     </button>
                      <button
                        type="button"
                        title="Delete"
                        class="relative items-center p-2 text-xs font-semibold dark-hover:bg-gray-500 text-white transition duration-150 ease-in-out border border-gray-300 rounded-r-md hover:bg-gray-100 focus:z-10 focus:outline-none focus:ring-red-500  focus:ring-2 group"
                      ><svg
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                        class="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      /></svg>
                      </button>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="alertModal"
      class="relative z-10"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div class="fixed inset-0 transition-opacity bg-gray-500 opacity-75" />

      <div class="fixed inset-0 z-10 overflow-y-auto">
        <div class="flex items-end justify-center min-h-full p-4 text-center sm:items-center sm:p-0">
          <div class="relative px-4 pt-5 pb-4 overflow-hidden text-left transition-all transform bg-white dark:bg-gray-700 rounded-lg shadow-xl sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
            <div>
              <div class="text-center">
                <div>
                  <label
                    for="type"
                    class="block text-sm font-medium text-left text-gray-700 dark:text-gray-200"
                  >When</label>
                  <select
                    id="type"
                    v-model="type"
                    name="type"
                    class="block dark:bg-gray-700 dark:text-gray-200 w-full rounded-md border-gray-300 py-2 px-4 text-gray-900 dark:text-gray-100 shadow-sm focus:border-teal-500   border dark:border-gray-600 focus:outline-none focus:ring-2"
                  >
                    <option
                      selected
                      value="CPU Usage"
                    >
                      CPU Usage
                    </option>
                    <option value="Used Disk Space">
                      Used Disk Space
                    </option>
                    <option value="Used Memory">
                      Used Memory
                    </option>
                  </select>
                </div>

                <div class="flex items-end mt-4 space-x-2">
                  <div class="w-3/4">
                    <label
                      for="operator"
                      class="block text-sm font-medium text-left text-gray-700 dark:text-gray-200"
                    >Is</label>
                    <select
                      id="operator"
                      v-model="operator"
                      name="operator"
                      class="block dark:bg-gray-700 dark:text-gray-200 w-full rounded-md border-gray-300 py-2 px-4 text-gray-900 dark:text-gray-100 shadow-sm focus:border-teal-500   border dark:border-gray-600 focus:outline-none focus:ring-2"
                    >
                      <option
                        selected
                        value="gte"
                      >
                        Greater Than Or Equal To
                      </option>
                      <option value="lte">
                        Less Than Or Equal To
                      </option>
                    </select>
                  </div>

                  <div class="flex items-center w-1/4">
                    <input
                      id="threshold"
                      v-model="threshold"
                      name="threshold"
                      type="number"
                      class="block dark:bg-gray-700 dark:text-gray-200 w-full rounded-md border-gray-300 py-2 px-4 text-gray-900 dark:text-gray-100 shadow-sm focus:border-teal-500   border dark:border-gray-600 focus:outline-none focus:ring-2"
                    >
                    <span class="ml-1 text-gray-700">
                      %
                    </span>
                  </div>
                </div>

                <div class="mt-4">
                  <label
                    for="duration"
                    class="block text-sm font-medium text-left text-gray-700 dark:text-gray-200"
                  >Duration</label>

                  <div class="flex items-center justify-start">
                    <input
                      id="duration"
                      v-model="duration"
                      name="duration"
                      type="number"
                      class="block dark:bg-gray-700 dark:text-gray-200 rounded-md border-gray-300 py-2 px-4 text-gray-900 dark:text-gray-100 shadow-sm focus:border-teal-500   border dark:border-gray-600 w-1/4"
                    >

                    <span class="ml-1 text-sm text-gray-700">
                      minutes
                    </span>
                  </div>
                </div>

                <div class="mt-4">
                  <label
                    for="notify"

                    class="block text-sm font-medium text-left text-gray-700 dark:text-gray-200"
                  >Notify To</label>

                  <input
                    id="notify"
                    v-model="notify_to"
                    name="notify"
                    type="email"
                    placeholder="johndoe@example.com"
                    class="block dark:bg-gray-700 dark:text-gray-200 w-full rounded-md border-gray-300 py-2 px-4 text-gray-900 dark:text-gray-100 shadow-sm focus:border-teal-500   border dark:border-gray-600 focus:outline-none focus:ring-2"
                  >
                </div>
              </div>
            </div>
            <div class="flex items-center mt-5 space-x-4 sm:mt-6">
              <button
                type="button"
                class="inline-flex dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500 dark-hover:bg-gray-500 items-center justify-center w-1/2 px-4 py-2 text-sm font-semibold text-gray-700 transition duration-150 ease-in-out bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-custom-blue focus:ring-offset-2"
                @click="closeAlertModal"
              >
                Cancel
              </button>

              <button
                type="button"
                class="inline-flex justify-center w-1/2 px-4 py-2 text-base font-semibold text-white transition duration-150 ease-in-out bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:text-sm"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
