<script lang="ts" setup>
import { ref, computed } from 'vue'
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
  title: 'Dashboard - Jobs',
})

interface QueueStats {
  queued: number
  processing: number
  processed: number
  released: number
  failed: number
}

interface JobStats {
  id: string
  name: string
  queue: string
  attempts: number
  status: 'queued' | 'processing' | 'failed' | 'completed'
  started_at?: string
  finished_at?: string
  runtime?: number
  error?: string
  payload: any
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
}

interface Job {
  id: string
  name: string
  queue: string
  status: 'queued' | 'processing' | 'failed' | 'completed'
  runtime?: number
  started_at?: string
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

const recentJobs = ref<JobStats[]>([
  {
    id: '1',
    name: 'ProcessPayment',
    queue: 'high',
    attempts: 1,
    status: 'completed',
    started_at: '2024-03-14 10:15:23',
    finished_at: '2024-03-14 10:15:25',
    runtime: 2.3,
    payload: { order_id: '12345' },
  },
  {
    id: '2',
    name: 'SendWelcomeEmail',
    queue: 'default',
    attempts: 3,
    status: 'failed',
    started_at: '2024-03-14 10:14:00',
    finished_at: '2024-03-14 10:14:05',
    runtime: 5.1,
    error: 'SMTP connection failed',
    payload: { user_id: '789' },
  },
  {
    id: '3',
    name: 'GenerateReport',
    queue: 'low',
    attempts: 1,
    status: 'processing',
    started_at: '2024-03-14 10:16:00',
    payload: { report_type: 'monthly' },
  },
])

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

const throughputData = ref(getThroughputData())
const waitTimeData = ref(getWaitTimeData())

const queueStatusColors: Record<string, string> = {
  queued: 'bg-blue-500',
  processing: 'bg-yellow-500',
  processed: 'bg-green-500',
  released: 'bg-purple-500',
  failed: 'bg-red-500',
}

const jobStatusColors: Record<string, string> = {
  queued: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/50 ring-blue-600/20',
  processing: 'text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/50 ring-yellow-600/20',
  completed: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/50 ring-green-600/20',
  failed: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/50 ring-red-600/20',
}

const workerStatusColors: Record<string, string> = {
  running: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/50 ring-green-600/20',
  paused: 'text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/50 ring-yellow-600/20',
  stopped: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/50 ring-red-600/20',
}

const getQueueStatusColor = (status: string): string => {
  return queueStatusColors[status] || 'bg-gray-500'
}

const getJobStatusColor = (status: string): string => {
  return jobStatusColors[status] || 'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 ring-gray-600/20'
}

const getWorkerStatusColor = (status: string): string => {
  return workerStatusColors[status] || 'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 ring-gray-600/20'
}

// Watch for time range changes
watch([timeRange, selectedQueue], async () => {
  isLoading.value = true
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500))
  throughputData.value = getThroughputData()
  waitTimeData.value = getWaitTimeData()
  isLoading.value = false
})

// Initial load
onMounted(async () => {
  isLoading.value = true
  await new Promise(resolve => setTimeout(resolve, 500))
  isLoading.value = false
})

const handleRetry = async (job: Job) => {
  // Implement retry logic
  console.log('Retrying job:', job.id)
}
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <!-- Stats Overview -->
    <div class="mb-8 px-4 lg:px-8 sm:px-6">
      <div>
        <h3 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
          Queue Overview
        </h3>

        <dl class="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3 sm:grid-cols-2">
          <div class="relative overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-heroicons-queue-list h-6 w-6 text-white" />
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
                <div class="i-heroicons-arrow-up h-5 w-5 flex-shrink-0 self-center text-green-500" />
                <span class="sr-only">Increased by</span>
                122
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-green-500 p-3">
                <div class="i-heroicons-clock h-6 w-6 text-white" />
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
                <div class="i-heroicons-arrow-down h-5 w-5 flex-shrink-0 self-center text-green-500" />
                <span class="sr-only">Decreased by</span>
                0.4s
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-yellow-500 p-3">
                <div class="i-heroicons-bolt h-6 w-6 text-white" />
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
                <div class="i-heroicons-arrow-down h-5 w-5 flex-shrink-0 self-center text-red-500" />
                <span class="sr-only">Decreased by</span>
                8
              </p>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Queue Performance -->
    <div class="px-4 lg:px-8 sm:px-6">
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Throughput Chart -->
        <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow">
          <div class="p-6">
            <div class="flex items-center justify-between mb-6">
              <div>
                <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Job Throughput</h3>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Processed vs failed jobs over time</p>
              </div>
              <div class="flex items-center space-x-4">
                <select
                  v-model="timeRange"
                  class="h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 pl-3 pr-8 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
                >
                  <option value="hour">Last Hour</option>
                  <option value="day">Last 24 Hours</option>
                  <option value="week">Last Week</option>
                </select>
              </div>
            </div>
            <div class="h-[300px] relative">
              <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 dark:bg-blue-gray-700 dark:bg-opacity-75 z-10">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
              <Line :data="throughputData" :options="chartOptions" />
            </div>
          </div>
        </div>

        <!-- Wait Time Chart -->
        <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow">
          <div class="p-6">
            <div class="flex items-center justify-between mb-6">
              <div>
                <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Job Wait Time</h3>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Average time jobs spend in queue</p>
              </div>
            </div>
            <div class="h-[300px] relative">
              <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 dark:bg-blue-gray-700 dark:bg-opacity-75 z-10">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
              <Line :data="waitTimeData" :options="chartOptions" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Queue Stats -->
    <div class="mt-8 px-4 lg:px-8 sm:px-6">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Queue Statistics</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Detailed breakdown of jobs by queue and status</p>
        </div>
        <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <router-link
            to="/dashboard/jobs/history"
            class="inline-flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <span>View Full History</span>
            <div class="i-heroicons-arrow-right h-4 w-4" />
          </router-link>
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
                <div class="text-2xl font-semibold" :class="{
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

    <!-- Recent Jobs -->
    <div class="mt-8 bg-white dark:bg-blue-gray-700 rounded-lg shadow">
      <div class="px-4 py-5 sm:p-6">
        <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">Recent Jobs</h3>
        <div class="mt-4 flow-root">
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <table class="min-w-full divide-y divide-gray-300 dark:divide-blue-gray-600">
                <thead>
                  <tr>
                    <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 sm:pl-0">Job</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Queue</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Status</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Runtime</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Started</th>
                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-0">
                      <span class="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-blue-gray-600">
                  <tr v-for="job in recentJobs" :key="job.id">
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-100 sm:pl-0">{{ job.name }}</td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{{ job.queue }}</td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm">
                      <span
                        class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset"
                        :class="getJobStatusColor(job.status)"
                      >
                        {{ job.status }}
                      </span>
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 font-mono">{{ job.runtime ? `${job.runtime.toFixed(1)}s` : '-' }}</td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{{ job.started_at }}</td>
                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                      <div class="flex justify-end space-x-2">
                        <router-link
                          :to="`/dashboard/jobs/${job.id}`"
                          class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          View
                        </router-link>
                        <button
                          v-if="job.status === 'failed'"
                          type="button"
                          class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          @click="handleRetry(job)"
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
    </div>

    <!-- Workers -->
    <div class="mt-8 px-4 lg:px-8 sm:px-6">
      <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="p-6">
          <div class="sm:flex sm:items-center">
            <div class="sm:flex-auto">
              <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Workers</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Active job processing workers</p>
            </div>
          </div>

          <div class="mt-6">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                <thead>
                  <tr>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Name</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Status</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Queue</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Jobs Processed</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Memory</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">CPU</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Last Heartbeat</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-600">
                  <tr v-for="worker in workers" :key="worker.id" class="hover:bg-gray-50 dark:hover:bg-blue-gray-600/50">
                    <td class="whitespace-nowrap px-3 py-4 text-sm">
                      <div class="font-medium text-gray-900 dark:text-gray-100">{{ worker.name }}</div>
                      <div class="text-gray-500 dark:text-gray-400 font-mono text-xs">{{ worker.id }}</div>
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm">
                      <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset"
                            :class="getWorkerStatusColor(worker.status)">
                        {{ worker.status }}
                      </span>
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {{ worker.queue }}
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm">
                      <div class="text-gray-900 dark:text-gray-100">{{ worker.jobs_processed }}</div>
                      <div class="text-gray-500 dark:text-gray-400 text-xs">{{ worker.failed_jobs }} failed</div>
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {{ worker.memory_usage.toFixed(1) }}MB
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {{ worker.cpu_usage.toFixed(1) }}%
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {{ worker.last_heartbeat }}
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
