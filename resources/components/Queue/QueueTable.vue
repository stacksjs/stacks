<script setup lang="ts">
const queueStore = useQueueStore()

onMounted(async () => {
  await queueStore.fetchQueues()
})
</script>
<template>
  <div class="px-4 pt-12 lg:px-8 sm:px-6">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-base text-gray-900 font-semibold leading-6">
          Jobs
        </h1>
        <p class="mt-2 text-sm text-gray-700">
          A list of all the Jobs.
        </p>
      </div>

      <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
        <button type="button" class="block rounded-md bg-blue-600 px-3 py-2 text-center text-sm text-white font-semibold shadow-sm hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 focus-visible:outline">
          Create Job
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
                    Description
                  </th>

                  <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                    Path
                  </th>

                  <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold">
                    Tries
                  </th>

                  <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold sm:text-right">
                    Created At
                  </th>

                  <th scope="col" class="px-3 py-3.5 text-left text-sm text-gray-900 font-semibold sm:text-right">
                    Updated At
                  </th>

                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span class="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>

              <tbody class="bg-white divide-y divide-gray-200">
                <tr>
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 font-medium sm:pl-6">
                    Example Job
                  </td>

                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    Demo job that runs every minute
                  </td>

                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                    ./app/Jobs/ExampleJob.ts
                  </td>

                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    3
                  </td>

                  <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500">
                    01-03-2023 08:23:15
                  </td>

                  <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500">
                    04-19-2022 09:04:20
                  </td>

                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <a href="#" class="text-blue-600 hover:text-blue-900">Open<span class="sr-only">, Action in IDE</span></a>
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