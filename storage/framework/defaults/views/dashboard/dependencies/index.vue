<script lang="ts" setup>
useHead({
  title: 'Dashboard - Dependencies',
})
</script>

<template>
  <div class="px-4 py-8 lg:px-8 sm:px-6">
    <form class="rounded-lg bg-white px-6 py-4 text-sm dark:bg-blue-gray-800">
      <div class="py-2">
        <div class="flex flex-row rounded-lg bg-gray-50 p-4 text-sm text-gray-600 dark:bg-blue-gray-700 dark:text-gray-400">
          <div class="i-hugeicons-information-circle h-6 w-6 flex-shrink-0 text-gray-400" />
          <div class="ml-4 mt-0.5 flex flex-grow">
            <p class="">
              Search for dependencies using tea.
            </p>
          </div>
        </div>
        <div class="mt-4 flex flex-col">
          <label class="dark:text-gray-100">Search for a depedency.</label>
          <div class="mt-1 flex flex-col">
            <input
              type="text"
              class="block w-full border border-gray-300 rounded-md px-4 py-2 text-gray-900 shadow-sm dark:border-gray-600 required:border-red-500 focus:border-none dark:bg-blue-gray-800 dark:text-gray-100 dark:text-gray-200 focus:ring-2 focus:ring-blue-500"
              list="artisanCommands"
            >
          </div>
        </div>
      </div>
      <div>
        <div class="mt-4 flex justify-end">
          <AppButton passed-class="primary-button" loading-text="Adding..." button-text="Add" />
        </div>
      </div>
    </form>

    <div class="mt-16 rounded-lg bg-white px-6 py-4 text-sm dark:bg-blue-gray-800">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base text-gray-900 font-semibold leading-6 dark:text-gray-100">
            Dependencies
          </h1>
        </div>
      </div>
      <div class="mt-8 flow-root">
        <div class="overflow-x-auto -mx-4 -my-2 lg:-mx-8 sm:-mx-6">
          <div class="inline-block min-w-full py-2 align-middle lg:px-8 sm:px-6">
            <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
              <thead>
                <tr>
                  <th
                    scope="col"
                    class="py-3 pl-4 pr-3 text-left text-xs text-gray-500 font-medium tracking-wide uppercase sm:pl-0 dark:text-gray-400"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs text-gray-500 font-medium tracking-wide uppercase dark:text-gray-400"
                  >
                    Version
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs text-gray-500 font-medium tracking-wide uppercase dark:text-gray-400"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    class="relative py-3 pl-3 pr-4 sm:pr-0"
                  >
                    <span class="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200 dark:bg-blue-gray-800 dark:divide-gray-600">
                <tr>
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 font-medium sm:pl-0 dark:text-gray-100">
                    NPM
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    18.15.1
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    Pending
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                    <a
                      href="#"
                      class="text-xs text-blue-600 font-normal hover:text-blue-900 hover:underline"
                    >Install</a>

                    <a
                      href="#"
                      class="pl-2 text-xs text-blue-600 font-normal hover:text-blue-900 hover:underline"
                    >Remove</a>
                  </td>
                </tr>
                <tr>
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 font-medium sm:pl-0 dark:text-gray-100">
                    Redis
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    6.9
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    Installed
                  </td>
                  <td class="flex justify-end whitespace-nowrap py-4 pl-3 pr-4 text-sm font-medium sm:pr-0">
                    <a
                      href="#"
                      class="text-left text-gray-400 transition duration-150 ease-in-out hover:text-blue-gray-500"
                    >

                      <div class="i-hugeicons-ellipsis-vertical h-5 w-5" />

                      <div
                        v-if="false"
                        class="dropdown-menu absolute right-16 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
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
                            class="block px-4 py-1.5 text-xs text-gray-700 hover:bg-blue-gray-50"
                            role="menuitem"
                            tabindex="-1"
                          >Edit</a>

                          <a
                            id="menu-item-2"
                            href="#"
                            class="block px-4 py-1.5 text-xs text-gray-700 hover:bg-blue-gray-50"
                            role="menuitem"
                            tabindex="-1"
                          >Uninstall</a>
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
