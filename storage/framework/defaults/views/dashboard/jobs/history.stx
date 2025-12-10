<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Dashboard - Jobs History',
})

interface JobHistoryEntry {
  id: string
  name: string
  queue: string
  status: 'queued' | 'processing' | 'failed' | 'completed'
  attempts: number
  runtime?: number
  started_at?: string
  finished_at?: string
  error?: string
  payload: any
}

const jobs = ref<JobHistoryEntry[]>([])
const isLoading = ref(true)
const currentPage = ref(1)
const perPage = ref(25)
const totalJobs = ref(0)
const selectedQueue = ref<string>('all')
const selectedStatus = ref<string>('all')
const searchQuery = ref('')

const queues = ['all', 'default', 'high', 'low']
const statuses = ['all', 'queued', 'processing', 'completed', 'failed']

const jobStatusColors: Record<string, string> = {
  queued: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/50 ring-blue-600/20',
  processing: 'text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/50 ring-yellow-600/20',
  completed: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/50 ring-green-600/20',
  failed: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/50 ring-red-600/20',
}

const getJobStatusColor = (status: string): string => {
  return jobStatusColors[status] || 'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 ring-gray-600/20'
}

// Mock data for demonstration
onMounted(async () => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000))

  type JobName = 'ProcessPayment' | 'SendWelcomeEmail' | 'GenerateReport' | 'SyncInventory'
  type QueueName = 'default' | 'high' | 'low'
  type StatusType = 'queued' | 'processing' | 'completed' | 'failed'

  const jobNames: readonly JobName[] = ['ProcessPayment', 'SendWelcomeEmail', 'GenerateReport', 'SyncInventory']
  const queueNames: readonly QueueName[] = ['default', 'high', 'low']
  const statusTypes: readonly StatusType[] = ['queued', 'processing', 'completed', 'failed']

  const randomItem = <T>(arr: readonly T[]): T => {
    return arr[Math.floor(Math.random() * arr.length)]!
  }

  jobs.value = Array.from({ length: 100 }, (_, i) => ({
    id: `${i + 1}`,
    name: randomItem(jobNames),
    queue: randomItem(queueNames),
    status: randomItem(statusTypes),
    attempts: Math.floor(Math.random() * 3) + 1,
    runtime: Math.random() * 10,
    started_at: new Date(Date.now() - Math.random() * 86400000).toISOString(),
    finished_at: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    payload: { data: 'sample' },
  }))

  totalJobs.value = jobs.value.length
  isLoading.value = false
})

const filteredJobs = computed(() => {
  return jobs.value.filter((job) => {
    if (selectedQueue.value !== 'all' && job.queue !== selectedQueue.value) return false
    if (selectedStatus.value !== 'all' && job.status !== selectedStatus.value) return false
    if (searchQuery.value && !job.name.toLowerCase().includes(searchQuery.value.toLowerCase())) return false
    return true
  })
})

const paginatedJobs = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  const end = start + perPage.value
  return filteredJobs.value.slice(start, end)
})

const totalPages = computed(() => Math.ceil(filteredJobs.value.length / perPage.value))

const handleRetry = async (jobId: string) => {
  // Implement retry logic
  console.log('Retrying job:', jobId)
}
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="px-4 sm:px-6 lg:px-8">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">Jobs History</h1>
          <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
            A complete history of all jobs processed by the system
          </p>
        </div>
      </div>

      <!-- Filters -->
      <div class="mt-4 flex flex-col space-y-4 sm:flex-row sm:items-center sm:space-x-4 sm:space-y-0">
        <div class="flex-1 min-w-0">
          <label for="search" class="sr-only">Search jobs</label>
          <div class="relative rounded-md shadow-sm">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <div class="i-hugeicons-search-01 h-5 w-5 text-gray-400" />
            </div>
            <input
              v-model="searchQuery"
              type="search"
              name="search"
              id="search"
              class="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 dark:text-gray-100 dark:bg-blue-gray-600 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              placeholder="Search jobs..."
            >
          </div>
        </div>

        <div class="sm:flex-shrink-0">
          <select
            v-model="selectedQueue"
            class="h-9 w-full rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 dark:text-gray-100 dark:bg-blue-gray-600 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
          >
            <option v-for="queue in queues" :key="queue" :value="queue">
              {{ queue.charAt(0).toUpperCase() + queue.slice(1) }} Queue
            </option>
          </select>
        </div>

        <div class="sm:flex-shrink-0">
          <select
            v-model="selectedStatus"
            class="h-9 w-full rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 dark:text-gray-100 dark:bg-blue-gray-600 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
          >
            <option v-for="status in statuses" :key="status" :value="status">
              {{ status.charAt(0).toUpperCase() + status.slice(1) }}
            </option>
          </select>
        </div>
      </div>

      <!-- Table -->
      <div class="mt-8 flow-root">
        <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 dark:ring-opacity-20 rounded-lg">
              <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                <thead class="bg-gray-50 dark:bg-blue-gray-600">
                  <tr>
                    <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 sm:pl-6">Job</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Queue</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Status</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Attempts</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Runtime</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 text-right">Started</th>
                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span class="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-600 bg-white dark:bg-blue-gray-700">
                  <tr v-if="isLoading" class="animate-pulse">
                    <td colspan="7" class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      Loading jobs...
                    </td>
                  </tr>
                  <tr v-else-if="paginatedJobs.length === 0" class="hover:bg-gray-50 dark:hover:bg-blue-gray-600/50">
                    <td colspan="7" class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                      No jobs found matching your criteria
                    </td>
                  </tr>
                  <tr v-for="job in paginatedJobs" :key="job.id" class="hover:bg-gray-50 dark:hover:bg-blue-gray-600/50">
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                      <div class="font-medium text-gray-900 dark:text-gray-100">{{ job.name }}</div>
                      <div class="text-gray-500 dark:text-gray-400 font-mono text-xs">{{ job.id }}</div>
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{{ job.queue }}</td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm">
                      <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset"
                            :class="getJobStatusColor(job.status)">
                        {{ job.status }}
                      </span>
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{{ job.attempts }}</td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {{ job.runtime ? `${job.runtime.toFixed(1)}s` : '-' }}
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-right">{{ job.started_at }}</td>
                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div class="flex items-center justify-end space-x-3">
                        <router-link
                          :to="`/jobs/${job.id}`"
                          class="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400"
                        >
                          View
                        </router-link>
                        <button
                          v-if="job.status === 'failed'"
                          type="button"
                          class="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400"
                          @click="handleRetry(job.id)"
                        >
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div class="mt-4 flex items-center justify-between">
        <div class="flex items-center">
          <p class="text-sm text-gray-700 dark:text-gray-300">
            Showing
            <span class="font-medium">{{ (currentPage - 1) * perPage + 1 }}</span>
            to
            <span class="font-medium">{{ Math.min(currentPage * perPage, filteredJobs.length) }}</span>
            of
            <span class="font-medium">{{ filteredJobs.length }}</span>
            results
          </p>
        </div>
        <div class="flex items-center space-x-2">
          <button
            type="button"
            class="relative inline-flex items-center rounded-md bg-white dark:bg-blue-gray-600 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-blue-gray-500 focus:z-10"
            :disabled="currentPage === 1"
            @click="currentPage--"
          >
            Previous
          </button>
          <button
            type="button"
            class="relative inline-flex items-center rounded-md bg-white dark:bg-blue-gray-600 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-blue-gray-500 focus:z-10"
            :disabled="currentPage === totalPages"
            @click="currentPage++"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
