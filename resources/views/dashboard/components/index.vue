<script lang="ts" setup>
useHead({
  title: 'Dashboard - Components',
})
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="mb-8 px-4 lg:px-8 sm:px-6">
      <div>
        <h3 class="text-base text-gray-900 font-semibold leading-6">
          Last 30 days
        </h3>

        <dl class="grid grid-cols-1 mt-5 gap-5 lg:grid-cols-3 sm:grid-cols-2">
          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-heroicons-arrow-down-tray h-6 w-6 text-white" />
              </div>

              <p class="ml-16 truncate text-sm text-gray-500 font-medium">
                Total Downloads
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold">
                71,897
              </p>

              <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>

                <span class="sr-only"> Increased by </span>
                122
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-heroicons-clock h-6 w-6 text-white" />
              </div>

              <p class="ml-16 truncate text-sm text-gray-500 font-medium">
                Avg. Release Time
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold">
                3.65 mins
              </p>

              <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Increased by </span>
                12 s
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-heroicons-rocket-launch h-6 w-6 text-white" />
              </div>

              <p class="ml-16 truncate text-sm text-gray-500 font-medium">
                Releases
              </p>
            </dt>

            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 font-semibold">
                420
              </p>

              <p class="ml-2 flex items-baseline text-sm text-red-600 font-semibold">
                <svg class="h-5 w-5 flex-shrink-0 self-center text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fill-rule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clip-rule="evenodd" />
                </svg>
                <span class="sr-only"> Decreased by </span>
                3.2%
              </p>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <div class="px-4 pt-12 lg:px-8 sm:px-6">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base text-gray-900 font-semibold leading-6">
            Components
          </h1>
          <p class="mt-2 text-sm text-gray-700">
            A list of all the components in your library.
          </p>
        </div>

        <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Create Component
          </button>
        </div>
      </div>

      <div class="mt-8 flow-root">
        <div class="overflow-x-auto -mx-4 -my-2 lg:-mx-8 sm:-mx-6">
          <div class="inline-block min-w-full py-2 align-middle lg:px-8 sm:px-6">
            <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table class="min-w-full divide-y divide-gray-300">
                <thead class="bg-gray-50">
                  <tr>
                    <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm text-gray-900 font-semibold sm:pl-6">
                      Name
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                      Size
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                      Path
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-right text-sm text-gray-900 font-semibold">
                      Updated At
                    </th>

                    <th scope="col" class="px-3 py-3.5 text-right text-sm text-gray-900 font-semibold">
                      Created At
                    </th>

                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span class="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>

                <tbody class="bg-white divide-y divide-gray-200">
                  <tr>
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 font-medium sm:pl-6">
                      Component A
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      30kb
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                      ./resources/components/component-a.vue
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500">
                      01-03-2023 08:23:15
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500">
                      04-19-2022 09:04:20
                    </td>

                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <a href="#" class="text-blue-600 hover:text-blue-900">Open<span class="sr-only">, Component A, in IDE</span></a>
                    </td>
                  </tr>

                  <tr>
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 font-medium sm:pl-6">
                      Component B
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      30kb
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                      ./resources/components/component-b.vue
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500">
                      01-03-2023 08:23:15
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500">
                      04-19-2022 09:04:20
                    </td>

                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <a href="#" class="text-blue-600 hover:text-blue-900">Open<span class="sr-only">, Component A, in IDE</span></a>
                    </td>
                  </tr>

                  <tr>
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 font-medium sm:pl-6">
                      Component C
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      30kb
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                      ./resources/components/component-c.vue
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500">
                      01-03-2023 08:23:15
                    </td>

                    <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500">
                      04-19-2022 09:04:20
                    </td>

                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <a href="#" class="text-blue-600 hover:text-blue-900">Open<span class="sr-only">, Component A, in IDE</span></a>
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
