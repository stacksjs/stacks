<template>
  <div class="px-4 sm:px-6 lg:px-8 py-8">
    <div class="rounded-lg bg-white px-6 py-4 text-sm dark:bg-blue-gray-800 mt-16">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">
            Components
          </h1>
        </div>
      </div>
      <div class="mt-8 flow-root">
        <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
              <thead>
                <tr>
                  <th
                    scope="col"
                    class="py-3 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 sm:pl-0 dark:text-gray-400"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    Size
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    Path
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    Created At
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    Updated At
                  </th>
                  <th
                    scope="col"
                    class="relative py-3 pl-3 pr-4 sm:pr-0"
                  >
                    <span class="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-600 bg-white dark:bg-blue-gray-800">
                <tr>
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0 dark:text-gray-100">
                    Component A
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    30kb
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    .stacks/stacks
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    01-03-2023 08:23:15
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    01-10-2023 08:23:15
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 flex justify-end text-sm font-medium sm:pr-0">
                    <a
                      href="#"
                      class="text-gray-400 text-left hover:text-blue-gray-500 duration-150 ease-in-out transition"
                    >
                      <div class="i-heroicons-ellipsis-vertical w-6 h-6" />

                      <div
                        class="absolute hidden dropdown-menu right-20 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                        role="menu"
                        aria-orientation="vertical"
                        aria-labelledby="menu-button"
                        tabindex="-1"
                      >
                        <div
                          class="py-1"
                          role="none"
                        >
                          <!-- Active: "bg-gray-100 text-gray-900", Not Active: "text-gray-700" -->
                          <a
                            id="menu-item-0"
                            href="#"
                            class="text-gray-700 block px-4 py-1.5 text-sm hover:bg-blue-gray-50 text-xs"
                            role="menuitem"
                            tabindex="-1"
                          >View</a>
                          <a
                            id="menu-item-1"
                            href="#"
                            class="text-gray-700 block px-4 py-1.5 text-sm hover:bg-blue-gray-50 text-xs"
                            role="menuitem"
                            tabindex="-1"
                          >Re-run</a>
                          <a
                            id="menu-item-2"
                            href="#"
                            class="text-gray-700 block px-4 py-1.5 text-sm hover:bg-blue-gray-50 text-xs"
                            role="menuitem"
                            tabindex="-1"
                          >Delete</a>
                        </div>
                      </div>
                    </a>
                  </td>
                </tr>
                <tr>
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0 dark:text-gray-100">
                    Component B
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    20kb
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    .stacks/core/components
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    01-04-2023 08:23:15
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    01-08-2023 08:23:15
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 flex justify-end text-sm font-medium sm:pr-0">
                    <a
                      href="#"
                      class="text-gray-400 text-left hover:text-blue-gray-500 duration-150 ease-in-out transition"
                    >
                      <div class="i-heroicons-ellipsis-vertical w-6 h-6" />

                      <div
                        class="absolute hidden dropdown-menu right-20 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                        role="menu"
                        aria-orientation="vertical"
                        aria-labelledby="menu-button"
                        tabindex="-1"
                      >
                        <div
                          class="py-1"
                          role="none"
                        >
                          <!-- Active: "bg-gray-100 text-gray-900", Not Active: "text-gray-700" -->
                          <a
                            id="menu-item-0"
                            href="#"
                            class="text-gray-700 block px-4 py-1.5 text-sm hover:bg-blue-gray-50 text-xs"
                            role="menuitem"
                            tabindex="-1"
                          >View</a>
                          <a
                            id="menu-item-1"
                            href="#"
                            class="text-gray-700 block px-4 py-1.5 text-sm hover:bg-blue-gray-50 text-xs"
                            role="menuitem"
                            tabindex="-1"
                          >Re-run</a>
                          <a
                            id="menu-item-2"
                            href="#"
                            class="text-gray-700 block px-4 py-1.5 text-sm hover:bg-blue-gray-50 text-xs"
                            role="menuitem"
                            tabindex="-1"
                          >Delete</a>
                        </div>
                      </div>
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-lg bg-white px-6 py-4 text-sm dark:bg-blue-gray-800 mt-16">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">
            Functions
          </h1>
        </div>
      </div>
      <div class="mt-8 flow-root">
        <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
              <thead>
                <tr>
                  <th
                    scope="col"
                    class="py-3 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 sm:pl-0 dark:text-gray-400"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    Size
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    Path
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    Created At
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    Updated At
                  </th>
                  <th
                    scope="col"
                    class="relative py-3 pl-3 pr-4 sm:pr-0"
                  >
                    <span class="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-600 bg-white dark:bg-blue-gray-800">
                <tr>
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0 dark:text-gray-100">
                    Function A
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    30kb
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    .stacks/stacks
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    01-03-2023 08:23:15
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    01-10-2023 08:23:15
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 flex justify-end text-sm font-medium sm:pr-0">
                    <a
                      href="#"
                      class="text-gray-400 text-left hover:text-blue-gray-500 duration-150 ease-in-out transition"
                    >
                      <div class="i-heroicons-ellipsis-vertical w-6 h-6" />

                      <div
                        class="absolute hidden dropdown-menu right-20 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                        role="menu"
                        aria-orientation="vertical"
                        aria-labelledby="menu-button"
                        tabindex="-1"
                      >
                        <div
                          class="py-1"
                          role="none"
                        >
                          <!-- Active: "bg-gray-100 text-gray-900", Not Active: "text-gray-700" -->
                          <a
                            id="menu-item-0"
                            href="#"
                            class="text-gray-700 block px-4 py-1.5 text-sm hover:bg-blue-gray-50 text-xs"
                            role="menuitem"
                            tabindex="-1"
                          >View</a>
                          <a
                            id="menu-item-1"
                            href="#"
                            class="text-gray-700 block px-4 py-1.5 text-sm hover:bg-blue-gray-50 text-xs"
                            role="menuitem"
                            tabindex="-1"
                          >Re-run</a>
                          <a
                            id="menu-item-2"
                            href="#"
                            class="text-gray-700 block px-4 py-1.5 text-sm hover:bg-blue-gray-50 text-xs"
                            role="menuitem"
                            tabindex="-1"
                          >Delete</a>
                        </div>
                      </div>
                    </a>
                  </td>
                </tr>
                <tr>
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0 dark:text-gray-100">
                    Function B
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    20kb
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    .stacks/core/functions
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    01-04-2023 08:23:15
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    01-08-2023 08:23:15
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 flex justify-end text-sm font-medium sm:pr-0">
                    <a
                      href="#"
                      class="text-gray-400 text-left hover:text-blue-gray-500 duration-150 ease-in-out transition"
                    >
                      <div class="i-heroicons-ellipsis-vertical w-6 h-6" />

                      <div
                        class="absolute hidden dropdown-menu right-20 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                        role="menu"
                        aria-orientation="vertical"
                        aria-labelledby="menu-button"
                        tabindex="-1"
                      >
                        <div
                          class="py-1"
                          role="none"
                        >
                          <!-- Active: "bg-gray-100 text-gray-900", Not Active: "text-gray-700" -->
                          <a
                            id="menu-item-0"
                            href="#"
                            class="text-gray-700 block px-4 py-1.5 text-sm hover:bg-blue-gray-50 text-xs"
                            role="menuitem"
                            tabindex="-1"
                          >View</a>
                          <a
                            id="menu-item-1"
                            href="#"
                            class="text-gray-700 block px-4 py-1.5 text-sm hover:bg-blue-gray-50 text-xs"
                            role="menuitem"
                            tabindex="-1"
                          >Re-run</a>
                          <a
                            id="menu-item-2"
                            href="#"
                            class="text-gray-700 block px-4 py-1.5 text-sm hover:bg-blue-gray-50 text-xs"
                            role="menuitem"
                            tabindex="-1"
                          >Delete</a>
                        </div>
                      </div>
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
