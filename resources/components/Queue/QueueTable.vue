<script setup lang="ts">
const queueStore = useQueueStore()

interface QueuePayload {
  path: string
  name: string
  maxTries: number
  timeOut: number | null
  timeOutAt: Date | null
  params: any
  classPayload: string
}

onMounted(async () => {
  await queueStore.fetchQueues()
})

function parseName(payload: string): string {
  try {
    const parsedPayload = JSON.parse(payload) as QueuePayload

    return parsedPayload.name

  } catch (e) {
    console.error('Error parsing classPayload:', e)

    return ''
  }
}

function parseDescription(payload: string): string {
  try {
    const parsedPayload = JSON.parse(payload) as QueuePayload

    const parsedClassPayload = JSON.parse(parsedPayload.classPayload) as any

    return parsedClassPayload.description

  } catch (e) {
    console.error('Error parsing classPayload:', e)

    return ''
  }
}

function parseTries(payload: string): number {
  try {
    const parsedPayload = JSON.parse(payload) as QueuePayload

    const parsedClassPayload = JSON.parse(parsedPayload.classPayload) as any

    return Number(parsedClassPayload.tries)

  } catch (e) {
    console.error('Error parsing classPayload:', e)

    return 0
  }
}



function parsePath(payload: string): string {
  try {
    const parsedPayload = JSON.parse(payload) as QueuePayload

    return parsedPayload.path

  } catch (e) {
    console.error('Error parsing classPayload:', e)

    return ''
  }
}

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
                <tr v-for="queue in queueStore.queues" :key="queue.id">
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 font-medium sm:pl-6">
                    {{  parseName(queue.payload)  }}
                  </td>

                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {{ parseDescription(queue.payload) }}
                  </td>

                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 font-mono">
                    {{ parsePath(queue.payload) }}
                  </td>

                  <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {{ parseTries(queue.payload) }}
                  </td>

                  <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500">
                    {{ queue.created_at }}
                  </td>

                  <td class="whitespace-nowrap px-3 py-4 text-right text-sm text-gray-500">
                    {{ queue.updated_at }}
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