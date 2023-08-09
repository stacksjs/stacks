<template>
  <div class="min-h-screen py-4 lg:py-8 dark:bg-gray-800">
    <div class="px-4 mb-8 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3 md:grid-cols-2">
        <div class="overflow-hidden bg-white rounded-lg shadow-lg dark:bg-gray-800 dark:border-gray-600 dark:border backdrop-blur-sm">
          <div class="p-5">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="i-heroicons-user-group w-8 h-8 text-gray-400" />
              </div>
              <div class="flex-1 ml-5">
                <dl>
                  <dt class="text-base font-medium dark:text-gray-300 text-gray-500 dark:text-gray-400 truncate">
                    Total Users
                  </dt>
                  <dd>
                    <div class="text-xl font-semibold dark:text-gray-50 text-gray-900 dark:text-gray-100">
                      5
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <!---->
        </div>
        <div class="overflow-hidden bg-white rounded-lg shadow-lg dark:bg-gray-800 dark:border-gray-600 dark:border backdrop-blur-sm">
          <div class="p-5">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="i-heroicons-user-group w-8 h-8 text-gray-400" />
              </div>
              <div class="flex-1 ml-5">
                <dl>
                  <dt class="text-base font-medium dark:text-gray-300 text-gray-500 dark:text-gray-400 truncate">
                    Total Agents
                  </dt>
                  <dd>
                    <div class="text-xl font-semibold dark:text-gray-50 text-gray-900 dark:text-gray-100">
                      5
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <!---->
        </div>
        <div class="overflow-hidden bg-white rounded-lg shadow-lg dark:bg-gray-800 dark:border-gray-600 dark:border backdrop-blur-sm">
          <div class="p-5">
            <div class="flex items-center">
              <div class="flex-shrink-0">
                <div class="i-heroicons-user-group w-8 h-8 text-gray-400" />
              </div>
              <div class="flex-1 ml-5">
                <dl>
                  <dt class="text-base font-medium dark:text-gray-300 text-gray-500 dark:text-gray-400 truncate">
                    Total Recruits
                  </dt>
                  <dd>
                    <div class="text-xl font-semibold dark:text-gray-50 text-gray-900 dark:text-gray-100">
                      5
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <!---->
        </div>
      </div>
    </div>
    <div class="px-4 mb-8 sm:px-6 lg:px-8">
      <div>
        <div class="flex items-center justify-between">
          <div class="flex items-start text-xl font-medium text-gray-900 sm:mx-none sm:mr-auto dark:text-gray-100">
            <div class="i-heroicons-plus flex-shrink-0 w-6 h-6 mr-3 text-gray-400 dark:text-gray-100 group-hover:text-gray-500 dark:text-gray-400" />
            <span>Events</span>
          </div>
          <div class="flex items-center">
            <div>
              <div class="relative inline-block mr-4 text-left">
                <button
                  id="menu-button"
                  type="button"
                  aria-expanded="true"
                  aria-haspopup="true"
                  class="bg-neutral-50 text-white py-2 px-2 rounded inline-flex border border-gray-300 hover:bg-blue-50"
                >
                  <div class="i-heroicons-funnel w-5 h-5 text-gray-700 " />
                </button>
                <!---->
              </div>
            </div>

            <button
              type="button"
              class="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-blue-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-blue-50"
            >
              <div class="i-heroicons-plus-small w-5 h-5 mr-1" />
              <span class="text-sm">User</span>
            </button>
          </div>
        </div>
        <!---->
      </div>
    </div>
    <div class="mt-4">
      <div class="px-4 sm:px-6 lg:px-8">
        <div class="mx-auto rounded-lg shadow-lg dark:border dark:border-gray-600">
          <div class="flex flex-col">
            <div class="min-w-full overflow-x-auto align-middle rounded-t-lg">
              <table class="min-w-full table-fixed divide-y divide-gray-200 dark:divide-gray-600 dark:divide-gray-600">
                <thead class="dark:bg-gray-800">
                  <tr>
                    <th
                      scope="col"
                      class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase cursor-pointer dark:text-gray-400 dark:text-gray-300"
                    >
                      <div class="flex items-center">
                        <span>Name</span>
                        <div class="pl-2">
                          <div class="i-heroicons-chevron-up-down w-5 h-5 text-gray-400" />
                        </div>
                      </div>
                    </th>
                    <th
                      scope="col"
                      class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase cursor-pointer whitespace-nowrap dark:text-gray-400 dark:text-gray-300"
                    >
                      <div class="flex items-center">
                        <span>ID</span>
                        <div class="pl-2">
                          <div class="i-heroicons-chevron-up-down w-5 h-5 text-gray-400" />
                        </div>
                      </div>
                    </th>
                    <th
                      scope="col"
                      class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400 dark:text-gray-300"
                    >
                      Phone
                    </th>
                    <th
                      scope="col"
                      class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase dark:text-gray-400 dark:text-gray-300"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      class="px-6 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase cursor-pointer dark:text-gray-400 dark:text-gray-300"
                    >
                      <div class="flex items-center justify-end">
                        <span>Created</span>
                        <div class="pl-2">
                          <div class="i-heroicons-chevron-up-down w-5 h-5 text-gray-400" />
                        </div>
                      </div>
                    </th>
                    <th
                      scope="col"
                      class="relative px-6 py-3"
                    >
                      <span class="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="bg-white dark:bg-gray-800">
                    <td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      <div class="flex items-center">
                        <div class="flex-shrink-0 w-10 h-10">
                          <img
                            src="https://carefreeagency-eliinova.s3.amazonaws.com/images/avatar/default.svg"
                            alt=""
                            class="w-10 h-10 rounded-full"
                          >
                        </div>
                        <div class="ml-4">
                          <div class="flex items-center text-sm font-medium text-gray-900 dark:text-gray-100">
                            John Doe Howell
                          </div>
                          <div class="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300">
                            johndoe@yahoo.com
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-left text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap">
                      2
                    </td>

                    <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap">
                      222222
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap">
                      Contracting
                    </td>
                    <td class="px-6 py-4 text-sm text-right text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap">
                      07-25-2023 08:12:36 PM
                    </td>
                    <td class="px-6 py-4 text-sm font-semibold text-right whitespace-nowrap">
                      <span class="inline-flex rounded-md shadow-sm isolate">
                        <button
                          type="button"
                          title="Edit User"
                          class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-gray-300 dark:border-gray-500 dark-hover:bg-gray-500 rounded-l-md hover:bg-blue-50 focus:z-10 focus:outline-none focus:ring-2 group"
                        >

                          <div class="i-heroicons-pencil-square w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700" />
                        </button>
                        <button
                          href="#"
                          title="View User"
                          class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark:border-gray-500 dark-hover:bg-gray-500 hover:bg-blue-50 focus:z-10 focus:outline-none focus:ring-2 group"
                        >

                          <div class="i-heroicons-eye w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700" />

                        </button>
                        <button
                          href="#"
                          title="Login As"
                          class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark:border-gray-500 dark-hover:bg-gray-500 hover:bg-blue-50 focus:z-10 focus:outline-none focus:ring-2 group"
                        >
                          <div class="i-heroicons-arrow-right-on-rectangle w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700" />

                        </button>
                        <button
                          type="button"
                          title="Sync User"
                          class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark:border-gray-500 dark-hover:bg-gray-500 hover:bg-blue-50 focus:z-10 focus:outline-none focus:ring-2 group"
                        >
                          <div class="i-heroicons-arrow-path w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark:border-gray-500 dark-hover:bg-gray-500 rounded-r-md hover:bg-blue-50 focus:z-10 focus:outline-none focus:ring-2 group"
                        >
                          <div class="i-heroicons-trash w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700" />
                        </button>
                      </span>
                    </td>
                  </tr>
                  <tr class="bg-white dark:bg-gray-800">
                    <td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      <div class="flex items-center">
                        <div class="flex-shrink-0 w-10 h-10">
                          <img
                            src="https://carefreeagency-eliinova.s3.amazonaws.com/images/avatar/default.svg"
                            alt=""
                            class="w-10 h-10 rounded-full"
                          >
                        </div>
                        <div class="ml-4">
                          <div class="flex items-center text-sm font-medium text-gray-900 dark:text-gray-100">
                            John Doe Howell
                          </div>
                          <div class="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300">
                            johndoe@yahoo.com
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-left text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap">
                      2
                    </td>

                    <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap">
                      222222
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap">
                      Contracting
                    </td>
                    <td class="px-6 py-4 text-sm text-right text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap">
                      07-25-2023 08:12:36 PM
                    </td>
                    <td class="px-6 py-4 text-sm font-semibold text-right whitespace-nowrap">
                      <span class="inline-flex rounded-md shadow-sm isolate">
                        <button
                          type="button"
                          title="Edit User"
                          class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-gray-300 dark:border-gray-500 dark-hover:bg-gray-500 rounded-l-md hover:bg-blue-50 focus:z-10 focus:outline-none focus:ring-2 group"
                        >

                          <div class="i-heroicons-pencil-square w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700" />
                        </button>
                        <button
                          href="#"
                          title="View User"
                          class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark:border-gray-500 dark-hover:bg-gray-500 hover:bg-blue-50 focus:z-10 focus:outline-none focus:ring-2 group"
                        >

                          <div class="i-heroicons-eye w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700" />

                        </button>
                        <button
                          href="#"
                          title="Login As"
                          class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark:border-gray-500 dark-hover:bg-gray-500 hover:bg-blue-50 focus:z-10 focus:outline-none focus:ring-2 group"
                        >
                          <div class="i-heroicons-arrow-right-on-rectangle w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700" />

                        </button>
                        <button
                          type="button"
                          title="Sync User"
                          class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark:border-gray-500 dark-hover:bg-gray-500 hover:bg-blue-50 focus:z-10 focus:outline-none focus:ring-2 group"
                        >
                          <div class="i-heroicons-arrow-path w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark:border-gray-500 dark-hover:bg-gray-500 rounded-r-md hover:bg-blue-50 focus:z-10 focus:outline-none focus:ring-2 group"
                        >
                          <div class="i-heroicons-trash w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700" />
                        </button>
                      </span>
                    </td>
                  </tr>
                  <tr class="bg-white dark:bg-gray-800">
                    <td class="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      <div class="flex items-center">
                        <div class="flex-shrink-0 w-10 h-10">
                          <img
                            src="https://carefreeagency-eliinova.s3.amazonaws.com/images/avatar/default.svg"
                            alt=""
                            class="w-10 h-10 rounded-full"
                          >
                        </div>
                        <div class="ml-4">
                          <div class="flex items-center text-sm font-medium text-gray-900 dark:text-gray-100">
                            John Doe Howell
                          </div>
                          <div class="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300">
                            johndoe@yahoo.com
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4 text-sm text-left text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap">
                      2
                    </td>

                    <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap">
                      222222
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap">
                      Contracting
                    </td>
                    <td class="px-6 py-4 text-sm text-right text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap">
                      07-25-2023 08:12:36 PM
                    </td>
                    <td class="px-6 py-4 text-sm font-semibold text-right whitespace-nowrap">
                      <span class="inline-flex rounded-md shadow-sm isolate">
                        <button
                          type="button"
                          title="Edit User"
                          class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-gray-300 dark:border-gray-500 dark-hover:bg-gray-500 rounded-l-md hover:bg-blue-50 focus:z-10 focus:outline-none focus:ring-2 group"
                        >

                          <div class="i-heroicons-pencil-square w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700" />
                        </button>
                        <button
                          href="#"
                          title="View User"
                          class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark:border-gray-500 dark-hover:bg-gray-500 hover:bg-blue-50 focus:z-10 focus:outline-none focus:ring-2 group"
                        >

                          <div class="i-heroicons-eye w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700" />

                        </button>
                        <button
                          href="#"
                          title="Login As"
                          class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark:border-gray-500 dark-hover:bg-gray-500 hover:bg-blue-50 focus:z-10 focus:outline-none focus:ring-2 group"
                        >
                          <div class="i-heroicons-arrow-right-on-rectangle w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700" />

                        </button>
                        <button
                          type="button"
                          title="Sync User"
                          class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark:border-gray-500 dark-hover:bg-gray-500 hover:bg-blue-50 focus:z-10 focus:outline-none focus:ring-2 group"
                        >
                          <div class="i-heroicons-arrow-path w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          class="relative items-center p-2 text-xs font-semibold text-white transition duration-150 ease-in-out border border-l-0 border-gray-300 dark:border-gray-500 dark-hover:bg-gray-500 rounded-r-md hover:bg-blue-50 focus:z-10 focus:outline-none focus:ring-2 group"
                        >
                          <div class="i-heroicons-trash w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-700" />
                        </button>
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 dark:border-gray-600 rounded-bl-lg rounded-br-lg dark:bg-gray-800 sm:px-6 dark:border-gray-600">
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
                    Showing <span class="font-semibold">1</span> to <span class="font-semibold">20</span> of <span class="font-semibold">5</span> results
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
                    >
                      <span class="sr-only">First</span>
                      <div class="i-heroicons-chevron-double-left-20-solid w-5 h-5" />
                    </a>
                    <a
                      href="#"
                      class="relative inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:text-gray-400 hover:bg-gray-50 focus:z-20"
                    >
                      <span class="sr-only">Previous</span>
                      <div class="i-heroicons-chevron-left-20-solid w-5 h-5" />
                    </a>
                    <a
                      href="#"
                      aria-current="page"
                      class="border-blue-500 z-20 text-blue-600 dark:bg-gray-600 bg-blue-50 relative inline-flex items-center px-4 py-2 text-sm font-medium border hover:bg-gray-50 dark:border-gray-600 dark:text-teal-50"
                    >1</a><a
                      href="#"
                      aria-current="page"
                      class="dark:bg-gray-700 dark-hover:bg-gray-600 relative inline-flex items-center px-4 py-2 text-sm font-medium border hover:bg-gray-50 dark:border-gray-600 dark:text-teal-50"
                    >2</a><a
                      href="#"
                      aria-current="page"
                      class="dark:bg-gray-700 dark-hover:bg-gray-600 relative inline-flex items-center px-4 py-2 text-sm font-medium border hover:bg-gray-50 dark:border-gray-600 dark:text-teal-50"
                    >3</a><a
                      href="#"
                      aria-current="page"
                      class="dark:bg-gray-700 dark-hover:bg-gray-600 relative inline-flex items-center px-4 py-2 text-sm font-medium border hover:bg-gray-50 dark:border-gray-600 dark:text-teal-50"
                    >4</a><a
                      href="#"
                      aria-current="page"
                      class="dark:bg-gray-700 dark-hover:bg-gray-600 relative inline-flex items-center px-4 py-2 text-sm font-medium border hover:bg-gray-50 dark:border-gray-600 dark:text-teal-50"
                    >5</a>
                    <a
                      href="#"
                      class="relative inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:text-gray-400 hover:bg-gray-50 focus:z-20"
                    >
                      <span class="sr-only">Next</span>
                      <div class="i-heroicons-chevron-right-20-solid w-5 h-5" />
                    </a>
                    <a
                      href="#"
                      class="relative inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-r-md dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:text-gray-400 hover:bg-gray-50 focus:z-20"
                    >
                      <span class="sr-only">Last</span>
                      <div class="i-heroicons-chevron-double-right-20-solid w-5 h-5" />
                    </a>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
