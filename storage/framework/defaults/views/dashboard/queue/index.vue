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
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="px-4 lg:px-8 sm:px-6">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex justify-between items-center">
          <div>
            <h3 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
              Queue Management
            </h3>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-400">
              Monitor and manage your queue workers and statistics.
            </p>
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
                    <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">Last Heartbeat</th>
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
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-right">
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

      <!-- Queue Statistics -->
      <div class="mb-8 bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <h4 class="text-base font-medium text-gray-900 dark:text-gray-100">Queue Statistics</h4>
            <div class="flex items-center gap-4">
              <select
                v-model="selectedQueue"
                class="block h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 px-3 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
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

          <div class="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
            <div
              v-for="(stats, queue) in queues"
              :key="queue"
              class="bg-gray-50 dark:bg-blue-gray-600 rounded-lg p-4"
            >
              <h5 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">{{ queue }}</h5>
              <div class="space-y-2">
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">Queued</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ stats.queued }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">Processing</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ stats.processing }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">Processed</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ stats.processed }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">Released</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ stats.released }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-sm text-gray-500 dark:text-gray-400">Failed</span>
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ stats.failed }}</span>
                </div>
              </div>
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
                  <div class="space-y-2">
                    <div>
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-gray-500 dark:text-gray-400">Memory Usage</span>
                        <span class="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {{ worker.memory_usage.toFixed(1) }}MB
                        </span>
                      </div>
                      <div class="mt-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          class="h-full bg-blue-600 rounded-full"
                          :style="{ width: `${Math.min(worker.memory_usage / 2, 100)}%` }"
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-gray-500 dark:text-gray-400">CPU Usage</span>
                        <span class="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {{ worker.cpu_usage.toFixed(1) }}%
                        </span>
                      </div>
                      <div class="mt-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          class="h-full bg-green-600 rounded-full"
                          :style="{ width: `${worker.cpu_usage}%` }"
                        ></div>
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
