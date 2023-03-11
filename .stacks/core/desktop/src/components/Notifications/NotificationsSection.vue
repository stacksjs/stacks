<script setup lang="ts">
import { useLogStore } from '~/stores/log'

const logStore = useLogStore()

onMounted(async () => {
  await fetchLogs(1)
})

async function fetchLogs(page: number) {
  await logStore.fetchLogs({ page })
}

async function goToPage(page: number) {
  await fetchLogs(page)
}
</script>

<template>
  <div>
    <h2 class="mt-8 mb-4 text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 dark:text-gray-50">
      Notifications
    </h2>
    <div class="mt-2 rounded-lg dark:border dark:border-gray-600">
      <div class="mx-auto">
        <div class="flex flex-col">
          <div class="min-w-full align-middle rounded-lg dark:bg-gray-800">
            <TableList
              v-if="logStore.hasLogs"
              :results="logStore.results"
              @navigate-to-page="goToPage"
            >
              <thead>
                <tr>
                  <th class="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-transparent dark:text-gray-400 dark:text-gray-300 ">
                    Type
                  </th>
                  <th class="hidden px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase bg-transparent dark:text-gray-400 dark:text-gray-300 md:block">
                    Description
                  </th>
                  <th class="px-6 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase bg-transparent dark:text-gray-400 dark:text-gray-300">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200 dark:divide-gray-600">
                <tr
                  v-for="(log, index) in logStore.logs"
                  :key="index"
                  class="bg-white dark:bg-gray-800"
                >
                  <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    <div class="flex">
                      <a
                        href="#"
                        class="inline-flex space-x-2 text-sm truncate group"
                      >
                        <p class="text-gray-500 truncate dark:text-gray-400 group-hover:text-gray-900 dark:text-gray-100 dark:text-gray-300 dark:group-hover:text-gray-200">
                          {{ log.task_type }} user
                        </p>
                      </a>
                    </div>
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap">
                    {{ log.activity }}
                  </td>
                  <td class="px-6 py-4 text-sm text-right text-gray-500 dark:text-gray-400 dark:text-gray-300 whitespace-nowrap">
                    <time datetime="2020-07-11">2023-01-13 00:53:58</time>
                  </td>
                </tr>
              </tbody>
            </TableList>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
