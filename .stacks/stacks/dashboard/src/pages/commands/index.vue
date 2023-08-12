<script setup lang="ts">
import { ref } from 'vue'

interface DummyRefItem {
  value: boolean
}

const dummyRef: DummyRefItem[] = [
  ref(false),
  ref(false),
]

function toggleDropdown(index: number) {
  dummyRef[index].value = !dummyRef[index].value
}
</script>

<template>
  <div class="px-4 sm:px-6 lg:px-8 py-8">
    <form class="rounded-lg bg-white px-6 py-4 text-sm dark:bg-gray-800">
      <div class="flex items-center justify-between">
        <h5 class="dark:text-gray-100">
          Commands
        </h5>
      </div>
      <div class="py-2">
        <div class="bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-400 flex flex-row rounded-lg p-4 text-sm">
          <div class="i-heroicons-information-circle text-gray-400 h-6 w-6 flex-shrink-0" />
          <div class="ml-4 mt-0.5 flex flex-grow">
            <p class="">
              Stacks allows you to easily execute arbitrary commands on your server. All commands are executed from within the site's root directory <br> Commands will be executed as the <code class="text-red-400">stacks</code> user and may run for two minutes before timing out.
            </p>
          </div>
        </div>
        <div class="mt-4 flex flex-col">
          <label class="dark:text-gray-100">Type a Command</label>
          <div class="mt-1 flex flex-col">
            <input
              type="text"
              class="block w-full px-4 py-2 text-gray-900 border border-gray-300 rounded-md shadow-sm required:border-red-500 dark:bg-gray-800 dark:text-gray-200 dark:text-gray-100 dark:border-gray-600 focus:border-none focus:ring-2 focus:ring-blue-500"
              list="artisanCommands"
              placeholder="ls -la"
              autocorrect="off"
            >
          </div>
        </div>
      </div>
      <div>
        <div class="mt-4 flex justify-end">
          <button
            type="button"
            class="primary-button"
          >
            Submit
          </button>
        </div>
      </div>
    </form>

    <div class="rounded-lg bg-white px-6 py-4 text-sm dark:bg-gray-800 mt-16">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base font-semibold leading-6 dark:text-gray-100 text-gray-900">
            History
          </h1>
        </div>
      </div>
      <div class="mt-8 flow-root">
        <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div class="inline-block table-responsive min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
              <thead>
                <tr>
                  <th
                    scope="col"
                    class="py-3 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 sm:pl-0 dark:text-gray-400"
                  >
                    User
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    Command
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    Time
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    Duration
                  </th>
                  <th
                    scope="col"
                    class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
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
              <tbody class="divide-y divide-gray-200 dark:divide-gray-600 bg-white dark:bg-gray-800 dark:bg-gray-800">
                <tr>
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-100 sm:pl-0">
                    Chris Breuer
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-400">
                    <pre
                      v-highlightjs
                    ><code class="bash"> buddy dev:components </code></pre>
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-400">
                    3 hours ago
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-400">
                    30s
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-400">
                    Finished
                  </td>
                  <td class="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                    <a
                      class="text-gray-400 text-left hover:text-gray-500 duration-150 ease-in-out transition cursor-pointer"
                      @click="toggleDropdown(0)"
                    >
                      <div class="i-heroicons-ellipsis-vertical w-6 h-6" />

                      <div
                        v-if="dummyRef[0].value"
                        class="absolute dropdown-menu right-20 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
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
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-100 sm:pl-0">
                    Chris Breuer
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-400">
                    <pre
                      v-highlightjs
                    ><code class="bash"> buddy dev:desktop </code></pre>
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm dark:text-gray-400 text-gray-500">
                    3 hours ago
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm dark:text-gray-400 text-gray-500">
                    30s
                  </td>
                  <td class="whitespace-nowrap px-3 py-4 text-sm dark:text-gray-400 text-gray-500">
                    Finished
                  </td>
                  <td class=" whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                    <a
                      class="text-gray-400 text-left hover:text-gray-500 duration-150 ease-in-out transition cursor-pointer"
                      @click="toggleDropdown(1)"
                    >
                      <div class="i-heroicons-ellipsis-vertical w-6 h-6" />

                      <div
                        v-if="dummyRef[1].value"
                        class="absolute dropdown-menu right-20 z-10 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
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
