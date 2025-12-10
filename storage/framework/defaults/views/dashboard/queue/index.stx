<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref } from 'vue'
import { useHead } from '@vueuse/head'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

useHead({
  title: 'Dashboard - Queue',
})

interface QueueStats {
  queued: number
  processing: number
  processed: number
  released: number
  failed: number
}

interface WorkerStats {
  id: string
  name: string
  status: 'running' | 'paused' | 'stopped'
  jobs_processed: number
  failed_jobs: number
  last_heartbeat: string
  queue: string
  memory_usage: number
  cpu_usage: number
  memory_limit: number
  timeout: number
  supervisor_id: string
  connection: 'redis' | 'database' | 'sqs'
  tries: number
  retry_after: number
}

// Mock data for demonstration
const queues = ref<Record<string, QueueStats>>({
  default: {
    queued: 70,
    processing: 15,
    processed: 250,
    released: 5,
    failed: 2,
  },
  high: {
    queued: 23,
    processing: 8,
    processed: 180,
    released: 3,
    failed: 1,
  },
  low: {
    queued: 45,
    processing: 12,
    processed: 150,
    released: 4,
    failed: 3,
  },
})

const workers = ref<WorkerStats[]>([
  {
    id: '1',
    name: 'worker-1',
    status: 'running',
    jobs_processed: 1250,
    failed_jobs: 23,
    last_heartbeat: '2024-03-14 10:16:32',
    queue: 'default',
    memory_usage: 128.5,
    cpu_usage: 23.4,
    memory_limit: 128,
    timeout: 60,
    supervisor_id: 'supervisor-1',
    connection: 'redis',
    tries: 3,
    retry_after: 90,
  },
  {
    id: '2',
    name: 'worker-2',
    status: 'running',
    jobs_processed: 980,
    failed_jobs: 15,
    last_heartbeat: '2024-03-14 10:16:30',
    queue: 'high',
    memory_usage: 145.2,
    cpu_usage: 28.7,
    memory_limit: 128,
    timeout: 60,
    supervisor_id: 'supervisor-2',
    connection: 'redis',
    tries: 3,
    retry_after: 90,
  },
  {
    id: '3',
    name: 'worker-3',
    status: 'running',
    jobs_processed: 850,
    failed_jobs: 18,
    last_heartbeat: '2024-03-14 10:16:28',
    queue: 'low',
    memory_usage: 112.8,
    cpu_usage: 19.5,
    memory_limit: 128,
    timeout: 60,
    supervisor_id: 'supervisor-3',
    connection: 'redis',
    tries: 3,
    retry_after: 90,
  },
])

const timeRange = ref<'hour' | 'day' | 'week'>('hour')
const selectedQueue = ref<string>('all')
const isLoading = ref(false)

// Chart options
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(200, 200, 200, 0.1)',
      },
      ticks: {
        color: 'rgb(156, 163, 175)',
        font: {
          family: "'JetBrains Mono', monospace",
        },
      },
    },
    x: {
      grid: {
        display: false,
      },
      ticks: {
        color: 'rgb(156, 163, 175)',
        font: {
          family: "'JetBrains Mono', monospace",
        },
      },
    },
  },
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      align: 'end' as const,
      labels: {
        color: 'rgb(156, 163, 175)',
        font: {
          family: "'JetBrains Mono', monospace",
        },
        boxWidth: 12,
        padding: 15,
      },
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
    },
  },
  interaction: {
    mode: 'index' as const,
    intersect: false,
  },
}

const workerStatusColors: Record<string, string> = {
  running: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/50 ring-green-600/20',
  paused: 'text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/50 ring-yellow-600/20',
  stopped: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/50 ring-red-600/20',
}

const getWorkerStatusColor = (status: string): string => {
  return workerStatusColors[status] || 'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 ring-gray-600/20'
}

// Generate mock throughput data
const getThroughputData = () => {
  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`)
  return {
    labels,
    datasets: [
      {
        label: 'Processed',
        data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 100) + 50),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
      },
      {
        label: 'Failed',
        data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 10)),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
      },
    ],
  }
}

// Generate mock wait time data
const getWaitTimeData = () => {
  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`)
  return {
    labels,
    datasets: [{
      label: 'Average Wait Time (seconds)',
      data: Array.from({ length: 24 }, () => Math.random() * 5 + 1),
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
    }],
  }
}

// Add worker configuration
const workerConfig = ref({
  memory_limit: 128,
  timeout: 60,
  tries: 3,
  retry_after: 90,
  connection: 'redis' as const,
})

// Add worker actions
const restartWorker = async (workerId: string) => {
  isLoading.value = true
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000))
  const worker = workers.value.find(w => w.id === workerId)
  if (worker) {
    worker.status = 'running'
    worker.last_heartbeat = new Date().toISOString()
  }
  isLoading.value = false
}

const pauseWorker = async (workerId: string) => {
  isLoading.value = true
  await new Promise(resolve => setTimeout(resolve, 1000))
  const worker = workers.value.find(w => w.id === workerId)
  if (worker) worker.status = 'paused'
  isLoading.value = false
}

const stopWorker = async (workerId: string) => {
  isLoading.value = true
  await new Promise(resolve => setTimeout(resolve, 1000))
  const worker = workers.value.find(w => w.id === workerId)
  if (worker) worker.status = 'stopped'
  isLoading.value = false
}

const retryFailedJobs = async () => {
  isLoading.value = true
  await new Promise(resolve => setTimeout(resolve, 1000))
  // Simulate retrying failed jobs
  Object.values(queues.value).forEach(queue => {
    queue.failed = 0
    queue.queued += queue.failed
  })
  isLoading.value = false
}

const clearFailedJobs = async () => {
  isLoading.value = true
  await new Promise(resolve => setTimeout(resolve, 1000))
  // Simulate clearing failed jobs
  Object.values(queues.value).forEach(queue => {
    queue.failed = 0
  })
  isLoading.value = false
}

// Update workers data with new fields
workers.value = workers.value.map(worker => ({
  ...worker,
  memory_limit: 128,
  timeout: 60,
  supervisor_id: `supervisor-${worker.id}`,
  connection: 'redis' as const,
  tries: 3,
  retry_after: 90,
}))
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="px-4 lg:px-8 sm:px-6">
      <!-- Stats Overview -->
    <div class="mb-8">
      <div>
        <h3 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
          Queue Overview
        </h3>

        <dl class="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3 sm:grid-cols-2">
          <div class="relative overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-hugeicons-queue-02 h-6 w-6 text-white" />
              </div>
              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-300 font-medium">
                Total Jobs
              </p>
            </dt>
            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 dark:text-gray-100 font-semibold">
                71,897
              </p>
              <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
                <div class="i-hugeicons-arrow-up-02 h-5 w-5 flex-shrink-0 self-center text-green-500" />
                <span class="sr-only">Increased by</span>
                122
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-hugeicons-clock-01 h-6 w-6 text-white" />
              </div>
              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-300 font-medium">
                Average Processing Time
              </p>
            </dt>
            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 dark:text-gray-100 font-semibold">
                2.3s
              </p>
              <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
                <div class="i-hugeicons-arrow-down-02 h-5 w-5 flex-shrink-0 self-center text-green-500" />
                <span class="sr-only">Decreased by</span>
                0.4s
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-hugeicons-energy h-6 w-6 text-white" />
              </div>
              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-300 font-medium">
                Jobs Per Minute
              </p>
            </dt>
            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 dark:text-gray-100 font-semibold">
                42
              </p>
              <p class="ml-2 flex items-baseline text-sm text-red-600 font-semibold">
                <div class="i-hugeicons-arrow-down-02 h-5 w-5 flex-shrink-0 self-center text-red-500" />
                <span class="sr-only">Decreased by</span>
                8
              </p>
            </dd>
          </div>
        </dl>
      </div>
    </div>


    <!-- Queue Stats -->
    <div class="mt-8">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Queue Statistics</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Detailed breakdown of jobs by queue and status</p>
        </div>
      </div>

      <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3 sm:grid-cols-2">
        <div v-for="(stats, name) in queues" :key="name" class="bg-white dark:bg-blue-gray-700 rounded-lg shadow p-6">
          <div class="flex items-center justify-between mb-4">
            <h4 class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-blue-gray-600 dark:text-gray-200">
              {{ name }}
            </h4>
          </div>

          <div class="space-y-4">
            <!-- Queue Stats -->
            <div class="grid grid-cols-3 gap-4">
              <div v-for="(value, status) in stats" :key="status" class="text-center">
                <div class="text-2xl font-semibold font-mono" :class="{
                  'text-blue-600 dark:text-blue-400': status === 'queued',
                  'text-yellow-600 dark:text-yellow-400': status === 'processing',
                  'text-green-600 dark:text-green-400': status === 'processed',
                  'text-purple-600 dark:text-purple-400': status === 'released',
                  'text-red-600 dark:text-red-400': status === 'failed'
                }">{{ value }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 capitalize">{{ status }}</div>
              </div>
            </div>

            <!-- Queue Progress -->
            <div class="h-2 bg-gray-100 dark:bg-blue-gray-600 rounded-full overflow-hidden">
              <div class="flex h-full">
                <div class="bg-green-500 h-full" :style="{ width: `${(stats.processed / (stats.processed + stats.failed)) * 100}%` }" />
                <div class="bg-red-500 h-full" :style="{ width: `${(stats.failed / (stats.processed + stats.failed)) * 100}%` }" />
              </div>
            </div>
            <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Success Rate: {{ ((stats.processed / (stats.processed + stats.failed)) * 100).toFixed(1) }}%</span>
              <span>Failure Rate: {{ ((stats.failed / (stats.processed + stats.failed)) * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>

      <!-- Queue Statistics -->
      <div class="my-8 bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <h4 class="text-base font-medium text-gray-900 dark:text-gray-100">Queue Statistics</h4>
            <div class="flex items-center gap-4">
              <select
                v-model="selectedQueue"
                class="block h-9 w-32 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">All Queues</option>
                <option v-for="(_, queue) in queues" :key="queue" :value="queue">
                  {{ queue }}
                </option>
              </select>

              <select
                v-model="timeRange"
                class="block h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
              >
                <option value="hour">Last Hour</option>
                <option value="day">Last 24 Hours</option>
                <option value="week">Last Week</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <!-- Throughput Chart -->
            <div class="h-80">
              <Line :data="getThroughputData()" :options="chartOptions" />
            </div>

            <!-- Wait Time Chart -->
            <div class="h-80">
              <Line :data="getWaitTimeData()" :options="chartOptions" />
            </div>
          </div>
        </div>
      </div>

      <!-- Workers -->
      <div class="mb-8 bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h4 class="text-base font-medium text-gray-900 dark:text-gray-100">Workers</h4>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Monitor your queue workers and their performance.</p>
            </div>
            <div class="flex items-center gap-4">
              <button
                @click="retryFailedJobs"
                class="inline-flex items-center px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <div class="i-hugeicons-arrow-path h-5 w-5 mr-1" />
                Retry Failed Jobs
              </button>
              <button
                @click="clearFailedJobs"
                class="inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 bg-white dark:bg-blue-gray-600 rounded-md shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-blue-gray-500"
              >
                <div class="i-hugeicons-trash h-5 w-5 mr-1" />
                Clear Failed Jobs
              </button>
            </div>
          </div>

          <div class="space-y-6">
            <div
              v-for="worker in workers"
              :key="worker.id"
              class="relative border dark:border-gray-600 rounded-lg p-6 transition-all duration-200 hover:border-blue-200 dark:hover:border-blue-500"
            >
              <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <h5 class="text-lg font-medium text-gray-900 dark:text-gray-100">{{ worker.name }}</h5>
                  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Queue: {{ worker.queue }}</p>
                </div>

                <div>
                  <div class="flex items-center gap-2">
                    <div
                      class="w-2 h-2 rounded-full"
                      :class="{
                        'bg-green-500': worker.status === 'running',
                        'bg-yellow-500': worker.status === 'paused',
                        'bg-red-500': worker.status === 'stopped',
                      }"
                    ></div>
                    <span class="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {{ worker.status.charAt(0).toUpperCase() + worker.status.slice(1) }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2 mt-2">
                    <button
                      v-if="worker.status !== 'running'"
                      @click="restartWorker(worker.id)"
                      class="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/50 rounded-md hover:bg-green-100 dark:hover:bg-green-900"
                    >
                      <div class="i-hugeicons-play h-4 w-4 mr-1" />
                      Start
                    </button>
                    <button
                      v-if="worker.status === 'running'"
                      @click="pauseWorker(worker.id)"
                      class="inline-flex items-center px-2 py-1 text-xs font-medium text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/50 rounded-md hover:bg-yellow-100 dark:hover:bg-yellow-900"
                    >
                      <div class="i-hugeicons-pause h-4 w-4 mr-1" />
                      Pause
                    </button>
                    <button
                      v-if="worker.status === 'running'"
                      @click="stopWorker(worker.id)"
                      class="inline-flex items-center px-2 py-1 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/50 rounded-md hover:bg-red-100 dark:hover:bg-red-900"
                    >
                      <div class="i-hugeicons-stop h-4 w-4 mr-1" />
                      Stop
                    </button>
                  </div>
                  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Last heartbeat: {{ worker.last_heartbeat }}
                  </p>
                </div>

                <div>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Jobs Processed</p>
                  <p class="mt-1 text-lg font-medium text-gray-900 dark:text-gray-100">
                    {{ worker.jobs_processed.toLocaleString() }}
                  </p>
                  <p class="mt-1 text-sm text-red-600 dark:text-red-400">
                    {{ worker.failed_jobs }} failed
                  </p>
                </div>

                <div>
                  <div class="space-y-4">
                    <div>
                      <div class="flex items-center justify-between text-sm">
                        <span class="text-gray-500 dark:text-gray-400">Connection</span>
                        <span class="font-medium text-gray-900 dark:text-gray-100">{{ worker.connection }}</span>
                      </div>
                      <div class="flex items-center justify-between text-sm mt-2">
                        <span class="text-gray-500 dark:text-gray-400">Memory Limit</span>
                        <span class="font-medium text-gray-900 dark:text-gray-100">{{ worker.memory_limit }}MB</span>
                      </div>
                      <div class="flex items-center justify-between text-sm mt-2">
                        <span class="text-gray-500 dark:text-gray-400">Timeout</span>
                        <span class="font-medium text-gray-900 dark:text-gray-100">{{ worker.timeout }}s</span>
                      </div>
                      <div class="flex items-center justify-between text-sm mt-2">
                        <span class="text-gray-500 dark:text-gray-400">Supervisor</span>
                        <span class="font-medium text-gray-900 dark:text-gray-100">{{ worker.supervisor_id }}</span>
                      </div>
                    </div>

                    <div v-if="worker.memory_usage / worker.memory_limit > 0.9" class="rounded-md bg-yellow-50 dark:bg-yellow-900/50 p-3">
                      <div class="flex">
                        <div class="i-hugeicons-exclamation-triangle h-5 w-5 text-yellow-400" />
                        <div class="ml-3">
                          <h3 class="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                            High Memory Usage
                          </h3>
                          <div class="mt-2 text-sm text-yellow-700 dark:text-yellow-200">
                            <p>Worker is approaching memory limit. Consider restarting or increasing the limit.</p>
                          </div>
                        </div>
                      </div>
                    </div>
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
