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
  title: 'Dashboard - Jobs',
})

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
  priority: number
  tags: string[]
  dependencies?: string[]
  retry_history?: {
    attempted_at: string
    failed_at: string
    error: string
  }[]
  stack_trace?: string
}

interface RetryAttempt {
  attempted_at: string
  error: string
}

interface Job {
  id: string
  name: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  queue: string
  payload: any
  created_at: string
  started_at?: string
  completed_at?: string
  error?: string
  stack_trace?: string
  tags?: string[]
  priority?: number
  dependencies?: string[]
  retry_history?: RetryAttempt[]
  attempts: number
  runtime?: number
  logs?: Array<{
    timestamp: string
    level: 'info' | 'warning' | 'error'
    message: string
  }>
}

const recentJobs = ref<Job[]>([
  {
    id: '1',
    name: 'ProcessPodcast',
    status: 'completed',
    queue: 'default',
    payload: { podcast_id: 123 },
    created_at: '2024-03-14 10:00:00',
    started_at: '2024-03-14 10:00:01',
    completed_at: '2024-03-14 10:00:05',
    attempts: 1,
    runtime: 4.2,
    tags: ['podcast', 'media'],
    priority: 1,
    logs: [
      { timestamp: '2024-03-14 10:00:01', level: 'info', message: 'Starting podcast processing' },
      { timestamp: '2024-03-14 10:00:03', level: 'info', message: 'Transcoding audio file' },
      { timestamp: '2024-03-14 10:00:05', level: 'info', message: 'Podcast processing completed' }
    ]
  },
  {
    id: '2',
    name: 'SendNewsletter',
    status: 'failed',
    queue: 'high',
    payload: { newsletter_id: 456 },
    created_at: '2024-03-14 10:01:00',
    started_at: '2024-03-14 10:01:01',
    error: 'SMTP connection failed',
    stack_trace: 'Error: SMTP connection failed\n    at SMTPClient.connect (/app/vendor/smtp.js:123)\n    at Newsletter.send (/app/app/Jobs/SendNewsletter.php:45)',
    attempts: 3,
    tags: ['email', 'newsletter'],
    priority: 2,
    retry_history: [
      {
        attempted_at: '2024-03-14 10:01:01',
        error: 'SMTP connection timeout'
      },
      {
        attempted_at: '2024-03-14 10:02:01',
        error: 'SMTP authentication failed'
      },
      {
        attempted_at: '2024-03-14 10:03:01',
        error: 'SMTP connection failed'
      }
    ],
    logs: [
      { timestamp: '2024-03-14 10:01:01', level: 'info', message: 'Starting newsletter delivery' },
      { timestamp: '2024-03-14 10:01:01', level: 'warning', message: 'SMTP connection timeout' },
      { timestamp: '2024-03-14 10:02:01', level: 'warning', message: 'SMTP authentication failed' },
      { timestamp: '2024-03-14 10:03:01', level: 'error', message: 'SMTP connection failed' }
    ]
  }
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

const jobStatusColors: Record<string, string> = {
  queued: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/50 ring-blue-600/20',
  processing: 'text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/50 ring-yellow-600/20',
  completed: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/50 ring-green-600/20',
  failed: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/50 ring-red-600/20',
}

const getJobStatusColor = (status: string): string => {
  return jobStatusColors[status] || 'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 ring-gray-600/20'
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

const retryJob = async (jobId: string) => {
  isLoading.value = true
  await new Promise(resolve => setTimeout(resolve, 1000))
  const job = recentJobs.value.find(j => j.id === jobId)
  if (job) {
    job.status = 'queued'
    job.attempts += 1
  }
  isLoading.value = false
}

const cancelJob = async (jobId: string) => {
  isLoading.value = true
  await new Promise(resolve => setTimeout(resolve, 1000))
  const job = recentJobs.value.find(j => j.id === jobId)
  if (job) {
    job.status = 'failed'
    job.error = 'Job cancelled by user'
  }
  isLoading.value = false
}

// Add state for expanded job rows
const expandedJobs = ref<Set<string>>(new Set())

// Toggle job expansion
const toggleJobExpansion = (jobId: string) => {
  if (expandedJobs.value.has(jobId)) {
    expandedJobs.value.delete(jobId)
  } else {
    expandedJobs.value.add(jobId)
  }
}

// Get log level color classes
const getLogLevelColor = (level: string): string => {
  switch (level) {
    case 'error':
      return 'text-red-600 dark:text-red-400'
    case 'warning':
      return 'text-yellow-600 dark:text-yellow-400'
    default:
      return 'text-gray-600 dark:text-gray-400'
  }
}
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <!-- Stats Overview -->
    <div class="mb-8 px-4 lg:px-8 sm:px-6">
      <div>
        <h3 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
          Jobs Overview
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

    <!-- Recent Jobs -->
    <div class="my-8 px-4 lg:px-8 sm:px-6">
      <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="px-4 py-5 sm:p-6">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">Recent Jobs</h3>
            <router-link
              to="/jobs/history"
              class="inline-flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <span>View All</span>
              <div class="i-hugeicons-arrow-right-01  h-4 w-4" />
            </router-link>
          </div>
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
                    <template v-for="job in recentJobs" :key="job.id">
                      <tr>
                        <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-0">
                          <div class="font-medium text-gray-900 dark:text-gray-100">{{ job.name }}</div>
                          <div class="mt-1 flex items-center gap-1">
                            <span v-for="tag in job.tags" :key="tag" class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/50 dark:text-blue-300">
                              {{ tag }}
                            </span>
                          </div>
                        </td>
                        <td class="whitespace-nowrap px-3 py-4 text-sm">
                          <div class="text-gray-900 dark:text-gray-100">{{ job.queue }}</div>
                          <div class="mt-1 text-gray-500 dark:text-gray-400">Priority: {{ job.priority }}</div>
                        </td>
                        <td class="whitespace-nowrap px-3 py-4 text-sm">
                          <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset" :class="getJobStatusColor(job.status)">
                            {{ job.status }}
                          </span>
                          <div v-if="job.status === 'failed'" class="mt-1 text-xs text-red-600 dark:text-red-400">
                            Attempts: {{ job.attempts }}
                          </div>
                        </td>
                        <td class="whitespace-nowrap px-3 py-4 text-sm">
                          <div class="font-mono text-gray-900 dark:text-gray-100">{{ job.runtime ? `${job.runtime.toFixed(1)}s` : '-' }}</div>
                        </td>
                        <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                          <div>Started: {{ job.started_at || '-' }}</div>
                          <div>Completed: {{ job.completed_at || '-' }}</div>
                        </td>
                        <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                          <div class="flex justify-end space-x-2">
                            <router-link
                              :to="`/jobs/${job.id}`"
                              class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              View
                            </router-link>
                          </div>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
