<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHead } from '@vueuse/head'

const route = useRoute('/jobs/[id]')
const router = useRouter()
const jobId = route.params.id as string

interface JobDetails {
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
  exception?: string
  memory_usage?: number
  cpu_usage?: number
  worker?: string
}

const job = ref<JobDetails | null>(null)
const isLoading = ref(true)

useHead({
  title: `Dashboard - Job Details #${jobId}`,
})

const jobStatusColors: Record<string, string> = {
  queued: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/50 ring-blue-600/20',
  processing: 'text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/50 ring-yellow-600/20',
  completed: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/50 ring-green-600/20',
  failed: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/50 ring-red-600/20',
}

const getJobStatusColor = (status: string): string => {
  return jobStatusColors[status] || 'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 ring-gray-600/20'
}

const handleRetry = async () => {
  if (!job.value) return

  // Implement retry logic
  console.log('Retrying job:', job.value.id)
}

// Mock data for demonstration
onMounted(async () => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000))

  job.value = {
    id: jobId,
    name: 'ProcessPayment',
    queue: 'high',
    status: 'failed',
    attempts: 3,
    runtime: 5.2,
    started_at: '2024-03-14 10:15:23',
    finished_at: '2024-03-14 10:15:28',
    error: 'Connection timeout',
    payload: {
      order_id: '12345',
      amount: 99.99,
      currency: 'USD',
    },
    exception: 'Error: Connection timeout at ProcessPayment.handle (/app/jobs/ProcessPayment.ts:25:7)',
    memory_usage: 128.5,
    cpu_usage: 23.4,
    worker: 'worker-1',
  }

  isLoading.value = false
})
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="px-4 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <div class="flex items-center space-x-3">
            <button
              type="button"
              class="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              @click="router.back()"
            >
              <div class="i-heroicons-arrow-left h-5 w-5" />
              <span class="ml-1">Back</span>
            </button>
            <h1 class="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">
              Job Details #{{ jobId }}
            </h1>
          </div>
        </div>
      </div>

      <div v-if="isLoading" class="mt-8 flex justify-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>

      <template v-else-if="job">
        <!-- Job Overview -->
        <div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow p-6">
            <h3 class="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">Overview</h3>
            <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt class="text-sm text-gray-500 dark:text-gray-400">Name</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100 font-medium">{{ job.name }}</dd>
              </div>
              <div>
                <dt class="text-sm text-gray-500 dark:text-gray-400">Queue</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100 font-medium">{{ job.queue }}</dd>
              </div>
              <div>
                <dt class="text-sm text-gray-500 dark:text-gray-400">Status</dt>
                <dd class="mt-1">
                  <span
                    class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset"
                    :class="getJobStatusColor(job.status)"
                  >
                    {{ job.status }}
                  </span>
                </dd>
              </div>
              <div>
                <dt class="text-sm text-gray-500 dark:text-gray-400">Attempts</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100 font-medium">{{ job.attempts }}</dd>
              </div>
              <div>
                <dt class="text-sm text-gray-500 dark:text-gray-400">Started At</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100 font-medium">{{ job.started_at || '-' }}</dd>
              </div>
              <div>
                <dt class="text-sm text-gray-500 dark:text-gray-400">Finished At</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100 font-medium">{{ job.finished_at || '-' }}</dd>
              </div>
              <div>
                <dt class="text-sm text-gray-500 dark:text-gray-400">Runtime</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100 font-medium font-mono">{{ job.runtime ? `${job.runtime.toFixed(1)}s` : '-' }}</dd>
              </div>
              <div>
                <dt class="text-sm text-gray-500 dark:text-gray-400">Worker</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100 font-medium">{{ job.worker || '-' }}</dd>
              </div>
            </dl>
          </div>

          <!-- Performance Metrics -->
          <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow p-6">
            <h3 class="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">Performance</h3>
            <dl class="grid grid-cols-1 gap-4">
              <div>
                <dt class="text-sm text-gray-500 dark:text-gray-400">Memory Usage</dt>
                <dd class="mt-1">
                  <div class="flex items-center">
                    <div class="flex-1">
                      <div class="bg-gray-100 dark:bg-blue-gray-600 rounded-full h-2">
                        <div
                          class="bg-blue-500 h-2 rounded-full"
                          :style="{ width: `${(job.memory_usage || 0) / 2}%` }"
                        />
                      </div>
                    </div>
                    <span class="ml-3 text-sm text-gray-900 dark:text-gray-100 font-medium font-mono">{{ job.memory_usage }}MB</span>
                  </div>
                </dd>
              </div>
              <div>
                <dt class="text-sm text-gray-500 dark:text-gray-400">CPU Usage</dt>
                <dd class="mt-1">
                  <div class="flex items-center">
                    <div class="flex-1">
                      <div class="bg-gray-100 dark:bg-blue-gray-600 rounded-full h-2">
                        <div
                          class="bg-green-500 h-2 rounded-full"
                          :style="{ width: `${job.cpu_usage || 0}%` }"
                        />
                      </div>
                    </div>
                    <span class="ml-3 text-sm text-gray-900 dark:text-gray-100 font-medium font-mono">{{ job.cpu_usage }}%</span>
                  </div>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <!-- Job Payload -->
        <div class="mt-6 bg-white dark:bg-blue-gray-700 rounded-lg shadow p-6">
          <h3 class="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">Payload</h3>
          <pre class="mt-2 p-4 bg-gray-50 dark:bg-blue-gray-600 rounded-lg overflow-x-auto text-sm text-gray-900 dark:text-gray-100 font-mono">{{ JSON.stringify(job.payload, null, 2) }}</pre>
        </div>

        <!-- Error Information -->
        <div v-if="job.error || job.exception" class="mt-6 bg-white dark:bg-blue-gray-700 rounded-lg shadow p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Error Information</h3>
            <button
              v-if="job.status === 'failed'"
              type="button"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              @click="handleRetry"
            >
              Retry Job
            </button>
          </div>
          <div v-if="job.error" class="mb-4">
            <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100">Error Message</h4>
            <p class="mt-1 text-sm text-red-600 dark:text-red-400">{{ job.error }}</p>
          </div>
          <div v-if="job.exception">
            <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100">Stack Trace</h4>
            <pre class="mt-2 p-4 bg-gray-50 dark:bg-blue-gray-600 rounded-lg overflow-x-auto text-sm text-red-600 dark:text-red-400 font-mono">{{ job.exception }}</pre>
          </div>
        </div>
      </template>

      <div v-else class="mt-8 text-center text-gray-500 dark:text-gray-400">
        Job not found
      </div>
    </div>
  </div>
</template>
