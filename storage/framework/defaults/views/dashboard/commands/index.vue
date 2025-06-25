<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script setup lang="ts">
useHead({
  title: 'Dashboard - Commands',
})
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="mb-8 px-4 lg:px-8 sm:px-6">
      <div>
        <h3 class="text-base text-gray-900 font-semibold leading-6 dark:text-gray-100">
          Last 30 days
        </h3>

        <dl class="grid grid-cols-1 mt-5 gap-5 lg:grid-cols-3 sm:grid-cols-2">
          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6 dark:bg-blue-gray-700">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-hugeicons-command-line h-6 w-6 text-white" />
              </div>

              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-400 font-medium">
                Commands Triggered
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold dark:text-gray-100">
                71,897
              </p>

              <p class="ml-2 flex items-baseline text-sm text-green-600 dark:text-green-400 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500 dark:text-green-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Increased by </span>
                122
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6 dark:bg-blue-gray-700">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-hugeicons-clock-01 h-6 w-6 text-white" />
              </div>

              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-400 font-medium">
                Avg. Run Time
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold dark:text-gray-100">
                3.65 mins
              </p>

              <p class="ml-2 flex items-baseline text-sm text-green-600 dark:text-green-400 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500 dark:text-green-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Increased by </span>
                12 s
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6 dark:bg-blue-gray-700">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-hugeicons-checkmark-circle-02 h-6 w-6 text-white" />
              </div>

              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-400 font-medium">
                Success Rate
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold dark:text-gray-100">
                94.57%
              </p>

              <p class="ml-2 flex items-baseline text-sm text-red-600 dark:text-red-400 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-red-500 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Decreased by </span>
                3.2%
              </p>

              <!-- <div class="absolute inset-x-0 bottom-0 bg-gray-50 px-4 py-4 sm:px-6">
                <div class="text-sm">
                  <a href="#" class="font-medium text-blue-600 hover:text-blue-500">View all<span class="sr-only"> Success Rate</span></a>
                </div>
              </div> -->
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <div class="px-4 pt-12 lg:px-8 sm:px-6">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
            Commands
          </h1>
          <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
            A list of all the Commands.
          </p>
        </div>

        <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button type="button" class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm text-white font-semibold shadow-sm hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline">
            Create Command
          </button>
        </div>
      </div>

      <div class="mt-8 flow-root">
        <div class="overflow-x-auto -mx-4 -my-2 lg:-mx-8 sm:-mx-6">
          <div class="inline-block min-w-full py-2 align-middle lg:px-8 sm:px-6">
            <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 dark:ring-gray-600 sm:rounded-lg">
              <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                <thead class="bg-gray-50 dark:bg-blue-gray-700">
                  <tr>
                    <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold sm:pl-6">
                      Signature
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold">
                      Alias
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold">
                      Path
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold">
                      Options
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold sm:text-right">
                      Created At
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold sm:text-right">
                      Updated At
                    </th>

                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span class="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>

                <tbody class="bg-white dark:bg-blue-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                  <tr>
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 dark:text-gray-100 font-medium font-mono sm:pl-6">
                      buddy inspire
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300 font-mono">
                      insp
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300 font-mono">
                      ./app/Commands/Inspire.ts
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300 font-mono">
                      --two, -t
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500 dark:text-gray-300">
                      01-03-2023 08:23:15
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500 dark:text-gray-300">
                      04-19-2022 09:04:20
                    </td>

                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <a href="#" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">Open<span class="sr-only">, Action in IDE</span></a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <TerminalContainer class="px-4 pt-12 lg:px-8 sm:px-6" />

    <div class="px-4 pt-12 lg:px-8 sm:px-6">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
            Command History
          </h1>
          <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
            A list of all the command executions relating your project/s.
          </p>
        </div>
        <!-- <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button type="button" class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
            Deploy
          </button>
        </div> -->
      </div>

      <div class="mt-8 flow-root">
        <div class="overflow-x-auto -mx-4 -my-2 lg:-mx-8 sm:-mx-6">
          <div class="inline-block min-w-full py-2 align-middle lg:px-8 sm:px-6">
            <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 dark:ring-gray-600 sm:rounded-lg">
              <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                <thead class="bg-gray-50 dark:bg-blue-gray-700">
                  <tr>
                    <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold sm:pl-6">
                      Triggered By
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold">
                      Command
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold">
                      Duration
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold">
                      Time
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 dark:text-gray-100 font-semibold">
                      Status
                    </th>

                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span class="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>

                <tbody class="bg-white dark:bg-blue-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                  <tr>
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 dark:text-gray-100 font-medium sm:pl-6">
                      <div class="flex items-center">
                        <div class="h-10 w-10 flex-shrink-0">
                          <img
                            src="https://avatars.githubusercontent.com/u/6228425?v=4"
                            alt=""
                            class="h-10 w-10 rounded-full"
                          >
                        </div>
                        <div class="ml-4">
                          <div class="flex items-center text-sm text-gray-900 font-medium dark:text-gray-100">
                            Chris Breuer
                          </div>
                          <div class="text-sm text-gray-500 dark:text-gray-300 dark:text-gray-400">
                            chris@stacksjs.org
                          </div>
                        </div>
                      </div>
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                      <span class="font-mono">buddy build:components</span>
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                      30s
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                      3 hours ago
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                      Finished
                    </td>

                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <a href="#" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">View<span class="sr-only">, Deployment</span></a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
