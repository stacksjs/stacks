<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute('/jobs/[id]')
const router = useRouter()

interface JobDetails {
  id: string
  name: string
  queue: string
  connection: string
  status: 'queued' | 'processing' | 'failed' | 'completed'
  attempts: number
  max_tries: number
  timeout: number
  runtime?: number
  started_at?: string
  finished_at?: string
  error?: string
  worker: string
  memory_usage: number
  cpu_usage: number
  payload: any
  tags: string[]
  chain?: string[]
  exception?: {
    message: string
    trace: string[]
    file: string
    line: number
  }
  logs?: Array<{
    timestamp: string
    level: 'info' | 'warning' | 'error'
    message: string
  }>
}

const job = ref<JobDetails | null>(null)
const isLoading = ref(true)
const showPayload = ref(false)
const showTrace = ref(false)

useHead({
  title: `Dashboard - Job Details #${route.params.id}`,
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

const getLogLevelColor = (level: string | undefined): string => {
  if (!level) return 'text-gray-600 dark:text-gray-400'
  switch (level) {
    case 'error':
      return 'text-red-600 dark:text-red-400'
    case 'warning':
      return 'text-yellow-600 dark:text-yellow-400'
    default:
      return 'text-gray-600 dark:text-gray-400'
  }
}

const handleRetry = async () => {
  // Implement retry logic
  console.log('Retrying job:', route.params.id)
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

const openFile = (file: string | undefined, line?: number) => {
  if (!file) return

  // Extract path and line number from stack trace
  const match = file.match(/\(([^:]+):(\d+)/)
  const filePath = match ? match[1] : file
  const lineNumber = line || (match ? parseInt(match[2]) : 1)

  console.log('Opening file:', filePath, 'at line:', lineNumber)
  // TODO: Implement file opening logic
}

// Mock data for demonstration
onMounted(async () => {
  isLoading.value = true
  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500))

    job.value = {
      id: route.params.id as string,
      name: 'ProcessPayment',
      queue: 'high',
      connection: 'redis',
      status: 'failed',
      attempts: 3,
      max_tries: 3,
      timeout: 60,
      runtime: 5.2,
      started_at: '2024-03-14 10:15:23',
      finished_at: '2024-03-14 10:15:28',
      error: 'Connection timeout at ProcessPayment.handle (/app/jobs/ProcessPayment.ts:25:7)',
      worker: 'worker-1',
      memory_usage: 128.5 * 1024 * 1024, // 128.5 MB
      cpu_usage: 23.4,
      tags: ['payment', 'order:12345', 'user:1234'],
      chain: [
        'App\\Jobs\\ProcessPayment',
        'App\\Jobs\\SendPaymentConfirmation',
        'App\\Jobs\\UpdateOrderStatus'
      ],
      payload: {
        order_id: '12345',
        amount: 99.99,
        currency: 'USD',
      },
      exception: {
        message: 'Connection timeout',
        file: '/app/jobs/ProcessPayment.ts',
        line: 25,
        trace: [
          '#0 /app/jobs/ProcessPayment.ts(25): ProcessPayment->handle()',
          '#1 /vendor/laravel/framework/src/Illuminate/Queue/CallQueuedHandler.php(59): ProcessPayment->handle()',
          '#2 /vendor/laravel/framework/src/Illuminate/Queue/Jobs/Job.php(88): CallQueuedHandler->call()',
        ]
      },
      logs: [
        { timestamp: '2024-03-14 10:15:23', level: 'info', message: 'Starting payment processing' },
        { timestamp: '2024-03-14 10:15:24', level: 'info', message: 'Validating payment details' },
        { timestamp: '2024-03-14 10:15:25', level: 'warning', message: 'Slow response from payment gateway' },
        { timestamp: '2024-03-14 10:15:28', level: 'error', message: 'Connection timeout while processing payment' }
      ],
    }
  } catch (error) {
    console.error('Failed to load job details:', error)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="px-4 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center">
          <button
            type="button"
            class="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            @click="router.back()"
          >
            <div class="i-hugeicons-arrow-left h-5 w-5 mr-1" />
            Back
          </button>
          <h1 class="ml-4 text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">
            Job Details #{{ route.params.id }}
          </h1>
        </div>
      </div>

      <div v-if="isLoading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>

      <div v-else-if="!job" class="text-center py-12">
        <div class="i-hugeicons-exclamation-circle h-12 w-12 mx-auto text-gray-400" />
        <h3 class="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Job not found</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">The job you're looking for doesn't exist or has been deleted.</p>
      </div>

      <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Overview -->
        <div class="bg-white dark:bg-blue-gray-700 shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100 mb-4">Overview</h3>

            <dl class="grid grid-cols-1 gap-4">
              <div class="grid grid-cols-3 gap-4">
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
                <dd class="text-sm text-gray-900 dark:text-gray-100 col-span-2 font-mono">{{ job.name }}</dd>
              </div>

              <div class="grid grid-cols-3 gap-4">
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Connection</dt>
                <dd class="text-sm text-gray-900 dark:text-gray-100 col-span-2 capitalize">{{ job.connection }}</dd>
              </div>

              <div class="grid grid-cols-3 gap-4">
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Queue</dt>
                <dd class="text-sm text-gray-900 dark:text-gray-100 col-span-2 capitalize">{{ job.queue }}</dd>
              </div>

              <div class="grid grid-cols-3 gap-4">
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Status</dt>
                <dd class="col-span-2">
                  <span
                    class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset"
                    :class="getJobStatusColor(job.status)"
                  >
                    {{ job.status }}
                  </span>
                </dd>
              </div>

              <div class="grid grid-cols-3 gap-4">
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Attempts</dt>
                <dd class="text-sm text-gray-900 dark:text-gray-100 col-span-2">
                  {{ job.attempts }} / {{ job.max_tries }}
                </dd>
              </div>

              <div class="grid grid-cols-3 gap-4">
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Timeout</dt>
                <dd class="text-sm text-gray-900 dark:text-gray-100 col-span-2 font-mono">{{ job.timeout }}s</dd>
              </div>

              <div class="grid grid-cols-3 gap-4">
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Started At</dt>
                <dd class="text-sm text-gray-900 dark:text-gray-100 col-span-2">{{ job.started_at }}</dd>
              </div>

              <div class="grid grid-cols-3 gap-4">
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Finished At</dt>
                <dd class="text-sm text-gray-900 dark:text-gray-100 col-span-2">{{ job.finished_at || '-' }}</dd>
              </div>

              <div class="grid grid-cols-3 gap-4">
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Runtime</dt>
                <dd class="text-sm text-gray-900 dark:text-gray-100 col-span-2 font-mono">{{ job.runtime ? `${job.runtime.toFixed(1)}s` : '-' }}</dd>
              </div>

              <div class="grid grid-cols-3 gap-4">
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Worker</dt>
                <dd class="text-sm text-gray-900 dark:text-gray-100 col-span-2 font-mono">{{ job.worker }}</dd>
              </div>

              <div class="grid grid-cols-3 gap-4">
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Tags</dt>
                <dd class="text-sm text-gray-900 dark:text-gray-100 col-span-2">
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="tag in job.tags"
                      :key="tag"
                      class="inline-flex items-center rounded-md bg-gray-50 dark:bg-blue-gray-600 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 ring-1 ring-inset ring-gray-500/10"
                    >
                      {{ tag }}
                    </span>
                  </div>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <!-- Right Column Stack -->
        <div class="space-y-6">
          <!-- Job Chain -->
          <div v-if="job.chain?.length" class="bg-white dark:bg-blue-gray-700 shadow rounded-lg">
            <div class="px-4 py-5 sm:p-6">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100 mb-6">Job Chain</h3>

              <div class="relative">
                <div class="absolute left-4 top-4 bottom-4 w-px bg-gray-200 dark:bg-gray-600"></div>
                <ul class="relative space-y-6">
                  <li v-for="(chainJob, index) in job.chain" :key="index" class="relative pl-10">
                    <div
                      class="absolute left-0 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-blue-gray-700"
                    >
                      <span class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ index + 1 }}</span>
                    </div>
                    <div class="py-2 text-sm font-mono text-gray-900 dark:text-gray-100">{{ chainJob.replace('App\\Jobs\\', '') }}</div>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Logs -->
          <div v-if="job.logs?.length" class="bg-white dark:bg-blue-gray-700 shadow rounded-lg">
            <div class="px-4 py-5 sm:p-6">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100 mb-4">Logs</h3>
              <div class="space-y-2">
                <div
                  v-for="log in job.logs"
                  :key="log.timestamp"
                  class="flex items-start gap-2 text-sm font-mono"
                >
                  <span class="text-gray-500 dark:text-gray-400 shrink-0">{{ log.timestamp }}</span>
                  <span :class="getLogLevelColor(log.level)" class="shrink-0">[{{ log.level }}]</span>
                  <span class="text-gray-900 dark:text-gray-100">{{ log.message }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Performance -->
          <div class="bg-white dark:bg-blue-gray-700 shadow rounded-lg">
            <div class="px-4 py-5 sm:p-6">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100 mb-6">Performance</h3>

              <dl class="grid grid-cols-1 gap-8">
                <!-- Memory Usage -->
                <div>
                  <dt class="flex items-center justify-between text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    <span>Memory Usage</span>
                    <span class="font-mono">{{ formatBytes(job.memory_usage) }}</span>
                  </dt>
                  <dd>
                    <div class="bg-gray-100 dark:bg-blue-gray-600 rounded-full h-2.5 overflow-hidden">
                      <div
                        class="bg-blue-500 h-full rounded-full transition-all duration-300"
                        :style="{ width: `${(job.memory_usage / (512 * 1024 * 1024)) * 100}%` }"
                      />
                    </div>
                  </dd>
                </div>

                <!-- CPU Usage -->
                <div>
                  <dt class="flex items-center justify-between text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    <span>CPU Usage</span>
                    <span class="font-mono">{{ job.cpu_usage.toFixed(1) }}%</span>
                  </dt>
                  <dd>
                    <div class="bg-gray-100 dark:bg-blue-gray-600 rounded-full h-2.5 overflow-hidden">
                      <div
                        class="bg-green-500 h-full rounded-full transition-all duration-300"
                        :style="{ width: `${job.cpu_usage}%` }"
                      />
                    </div>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <!-- Payload -->
        <div class="bg-white dark:bg-blue-gray-700 shadow rounded-lg lg:col-span-2">
          <div class="px-4 py-5 sm:p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">Payload</h3>
              <button
                type="button"
                class="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                @click="showPayload = !showPayload"
              >
                {{ showPayload ? 'Hide' : 'Show' }} Raw
              </button>
            </div>

            <div v-if="showPayload" class="mt-4">
              <pre class="bg-gray-50 dark:bg-blue-gray-600 rounded-lg p-4 text-sm text-gray-900 dark:text-gray-100 font-mono overflow-x-auto">{{ JSON.stringify(job.payload, null, 2) }}</pre>
            </div>
            <div v-else class="mt-4">
              <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <template v-for="(value, key) in job.payload" :key="key">
                  <div class="grid grid-cols-3 gap-4">
                    <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ key }}</dt>
                    <dd class="text-sm text-gray-900 dark:text-gray-100 col-span-2 font-mono">{{ value }}</dd>
                  </div>
                </template>
              </dl>
            </div>
          </div>
        </div>

        <!-- Error Information (if failed) -->
        <div v-if="job.status === 'failed'" class="bg-white dark:bg-blue-gray-700 shadow rounded-lg lg:col-span-2">
          <div class="px-4 py-5 sm:p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">Error Information</h3>
              <div class="flex items-center space-x-3">
                <button
                  type="button"
                  class="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                  @click="showTrace = !showTrace"
                >
                  {{ showTrace ? 'Hide' : 'Show' }} Full Trace
                </button>
                <button
                  type="button"
                  class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  @click="handleRetry"
                >
                  Retry Job
                </button>
              </div>
            </div>

            <div class="mt-4">
              <h4 class="text-sm font-medium text-gray-500 dark:text-gray-400">Error Message</h4>
              <p class="mt-1 text-sm text-red-600 dark:text-red-400">{{ job.exception?.message }}</p>

              <div class="mt-4 flex items-center text-sm text-gray-500 dark:text-gray-400">
                <button
                  type="button"
                  class="font-mono hover:text-blue-600 dark:hover:text-blue-400"
                  @click="openFile(job.exception?.file || '')"
                >
                  {{ job.exception?.file }}:{{ job.exception?.line }}
                </button>
              </div>

              <h4 class="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">Stack Trace</h4>
              <div class="mt-1 bg-gray-50 dark:bg-blue-gray-600 rounded-lg overflow-hidden">
                <div v-if="!showTrace" class="p-4">
                  <div
                    class="text-sm font-mono text-red-600 dark:text-red-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                    @click="openFile(job.exception?.trace[0] || '')"
                  >
                    {{ job.exception?.trace[0] }}
                  </div>
                </div>
                <div v-else class="divide-y divide-gray-200 dark:divide-gray-500">
                  <div
                    v-for="(line, index) in job.exception?.trace"
                    :key="index"
                    class="p-4 text-sm font-mono text-red-600 dark:text-red-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                    @click="openFile(line)"
                  >
                    {{ line }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
