<script setup lang="ts">
import { useDateFormat } from '@vueuse/core'
import { useHealthStore } from '~/stores/health'

const healthStore = useHealthStore()

const loading = ref(true)
onMounted(async () => {
  await fetchUptimeStats()

  loading.value = false
})

async function fetchUptimeStats() {
  await Promise.all([
    healthStore.fetchUptimeWeek(),
    healthStore.fetchUptimeYear(),
    healthStore.fetchDowntime(),
  ])
}

function formatTime(date: Date) {
  return useDateFormat(date, 'YYYY-MM-DD').value
}

function getDuration(date1: string, date2: string) {
  const firstDate = new Date(date1)
  const secondDate = new Date(date2)
  const diffInMilliseconds = Math.abs(secondDate - firstDate)
  const diffInMinutes = diffInMilliseconds / (1000 * 60)

  return diffInMinutes.toFixed(2)
}
</script>

<template>
  <div class="flex items-center justify-between dark:border-gray-600 md:flex-row flex-col">
    <h3 class="font-semibold">
      Uptime
    </h3>
    <div class="px-4 py-2 rounded-md bg-green-50 dark:bg-green-100">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg
            class="w-5 h-5 text-green-400"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clip-rule="evenodd"
            />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm font-semibold text-green-800">
            <a
              href="https://carefreeagency.com"
              class="underline"
            >carefreeagency.com</a> is up
          </p>
        </div>
      </div>
    </div>
  </div>

  <div class="mt-4 bg-white rounded-lg shadow dark:bg-gray-700">
    <div class="p-4">
      <div>
        <div class="mt-8">
          <h3 class="text-lg text-gray-700">
            Past 7 Days
          </h3>

          <ListLoader
            v-if="loading"
            :lines="2"
            :cols="7"
          />

          <dl
            v-if="healthStore.uptimeWeek.length && !loading"
            class="grid grid-cols-1 mt-3 overflow-hidden bg-white border divide-y divide-gray-200 rounded-lg dark:divide-gray-500 dark:bg-gray-600 dark:border-gray-500 md:grid-cols-7 md:divide-y-0 md:divide-x"
          >
            <div
              v-for="(uptime, key) in healthStore.uptimeWeek"
              :key="key"
              class="p-2 sm:p-3"
            >
              <dt class="text-sm text-gray-500 dark:text-gray-200">
                {{ formatTime(uptime.datetime) }}
                <!-- {{ uptime.datetime }} -->
              </dt>
              <dd class="flex items-baseline justify-between mt-1 md:block lg:flex">
                <div class="pt-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {{ uptime.uptimePercentage }}%
                </div>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div
        class="mt-8"
      >
        <h3 class="text-lg text-gray-700">
          Past 12 Months
        </h3>

        <ListLoader
          v-if="loading"
          :lines="2"
          :cols="6"
        />

        <dl
          v-if="healthStore.uptimeYear.length && !loading"
          class="grid grid-cols-1 mt-3 overflow-hidden bg-white border divide-y divide-gray-200 rounded-lg dark:bg-gray-600 dark:border-gray-500 md:grid-cols-6 md:divide-y-0"
        >
          <div
            v-for="(uptime, key) in healthStore.uptimeYear"
            :key="key"
            class="p-2 sm:p-3"
          >
            <dt class="text-sm text-gray-500 dark:text-gray-200">
              {{ formatTime(uptime.datetime) }}
            </dt>
            <dd class="flex items-baseline justify-between mt-1 md:block lg:flex">
              <div class="pt-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {{ uptime.uptimePercentage }}%
              </div>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <div class="px-4 sm:px-6 lg:px-8">
      <div class="flex flex-col mt-8">
        <div class="p-4 -mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <h3 class="text-lg text-gray-700">
            Downtime - Past 12 Months
          </h3>
          <div class="relative">
            <TableLoader
              v-if="loading"
              :lines="8"
              :cols="3"
            />
          </div>
          <div
            v-if="healthStore.downtime && !loading"
            class="inline-block min-w-full py-2 align-middle"
          >
            <table class="min-w-full divide-y divide-gray-300">
              <thead>
                <tr>
                  <th
                    scope="col"
                    class="py-3.5 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Started At
                  </th>
                  <th
                    scope="col"
                    class="py-3.5 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Ended At
                  </th>
                  <th
                    scope="col"
                    class="py-3.5 px-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100"
                  >
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr
                  v-for="(downtime, index) in healthStore.downtime"
                  :key="index"
                >
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    {{ downtime.startedAt }}
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    {{ downtime.endedAt }}
                  </td>
                  <td class="px-3 py-4 text-sm text-gray-500 whitespace-nowrap dark:text-gray-300">
                    {{ getDuration(downtime.startedAt, downtime.endedAt) }}m
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
