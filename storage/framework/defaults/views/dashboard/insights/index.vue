<script lang="ts" setup>
import { ref, onMounted, computed } from 'vue'
import { useHead } from '@vueuse/head'
import { Line, Doughnut } from 'vue-chartjs'
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
  ArcElement,
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
  ArcElement,
)

useHead({
  title: 'Dashboard - Insights',
})

interface SystemMetrics {
  cpu: number
  memory: {
    used: number
    total: number
  }
  storage: {
    used: number
    total: number
  }
}

interface QueueStats {
  queued: number
  processing: number
  processed: number
  released: number
  failed: number
}

interface Exception {
  type: string
  location: string
  count: number
  latest: string
}

interface CacheKey {
  name: string
  hits: number
  misses: number
  hitRate: number
  lastAccessed?: string
  ttl?: number
}

interface Cache {
  hits: number
  misses: number
  hitRate: number
  keys: CacheKey[]
}

interface SlowQuery {
  query: string
  location: string
  count: number
  slowest: number
}

interface User {
  name: string
  email: string
  requests: number
}

// Mock data for demonstration
const systemMetrics = ref<SystemMetrics>({
  cpu: 6,
  memory: {
    used: 786,
    total: 969,
  },
  storage: {
    used: 6,
    total: 10,
  },
})

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
})

const exceptions = ref<Exception[]>([
  {
    type: 'App\\Exceptions\\FlightOverbookedException',
    location: 'app/Jobs/ProcessBooking.php:33',
    count: 36,
    latest: '2 minutes ago',
  },
  {
    type: 'Illuminate\\Http\\Client\\RequestException',
    location: 'app/Http/Controllers/FlightController.php:91',
    count: 22,
    latest: '5 minutes ago',
  },
])

const cache = ref<Cache>({
  hits: 1675,
  misses: 284,
  hitRate: 85.5,
  keys: [
    {
      name: 'flight:2',
      hits: 137,
      misses: 14,
      hitRate: 90.73,
      lastAccessed: '2 minutes ago',
      ttl: 3600
    },
    {
      name: 'flight:3',
      hits: 132,
      misses: 15,
      hitRate: 89.8,
      lastAccessed: '5 minutes ago',
      ttl: 3600
    },
    {
      name: 'flight:8',
      hits: 138,
      misses: 7,
      hitRate: 95.17,
      lastAccessed: '1 minute ago',
      ttl: 3600
    },
  ],
})

const slowQueries = ref<SlowQuery[]>([
  {
    query: "insert into `tickets` (`flight_id`, `user_id`, `price`, `created_at`, `updated_at`) values (?, ?, ?, ?, ?)",
    location: "app/Http/Controllers/FlightTicketController.php:26",
    count: 347,
    slowest: 3099,
  },
  {
    query: "select `id`, `departs_at` from `flights` where `departs_at` > ? order by `departs_at` asc",
    location: "app/Http/Controllers/FlightController.php:91",
    count: 363,
    slowest: 3088,
  },
])

const users = ref<User[]>([
  { name: 'Joe Dixon', email: 'joe@laravel.com', requests: 68 },
  { name: 'Tim MacDonald', email: 'tim@laravel.com', requests: 65 },
  { name: 'Christoph Rumpel', email: 'christoph@laravel.com', requests: 51 },
  { name: 'James Brooks', email: 'james@laravel.com', requests: 50 },
  { name: 'Guus Leeuw', email: 'guus@laravel.com', requests: 47 },
])

// Chart data
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
      labels: {
        color: 'rgb(156, 163, 175)',
        font: {
          family: "'JetBrains Mono', monospace",
        },
      },
    },
  },
  elements: {
    line: {
      tension: 0.4,
    },
  },
}

const pieChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        color: 'rgb(156, 163, 175)',
        font: {
          family: "'JetBrains Mono', monospace",
        },
        padding: 20,
      },
    },
  },
  cutout: '65%',
}

const cpuData = {
  labels: ['12am', '1am', '2am', '3am', '4am', '5am', '6am'],
  datasets: [
    {
      label: 'CPU Usage',
      data: [4, 8, 15, 3, 7, 6, 5],
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
    },
  ],
}

const memoryData = {
  labels: ['12am', '1am', '2am', '3am', '4am', '5am', '6am'],
  datasets: [
    {
      label: 'Memory Usage',
      data: [750, 800, 850, 786, 820, 880, 786],
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
    },
  ],
}

const storageData = {
  labels: ['Used', 'Available'],
  datasets: [
    {
      data: [systemMetrics.value.storage.used, systemMetrics.value.storage.total - systemMetrics.value.storage.used],
      backgroundColor: [
        'rgb(59, 130, 246)',
        'rgba(200, 200, 200, 0.2)',
      ],
      borderColor: [
        'rgb(59, 130, 246)',
        'rgba(200, 200, 200, 0.2)',
      ],
      borderWidth: 1,
    },
  ],
}

const queueData = {
  labels: ['12am', '1am', '2am', '3am', '4am', '5am', '6am'],
  datasets: [
    {
      label: 'Processed',
      data: [150, 220, 180, 200, 250, 230, 180],
      borderColor: 'rgb(16, 185, 129)',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      fill: true,
    },
    {
      label: 'Failed',
      data: [5, 8, 3, 4, 2, 5, 3],
      borderColor: 'rgb(239, 68, 68)',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      fill: true,
    },
  ],
}

// Update to include all queue statuses
const getQueueData = (name: string) => ({
  labels: ['12am', '1am', '2am', '3am', '4am', '5am', '6am'],
  datasets: [
    {
      label: 'Processed',
      data: name === 'default' ? [150, 220, 180, 200, 250, 230, 180] : [120, 180, 150, 170, 220, 200, 150],
      borderColor: 'rgb(16, 185, 129)',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      fill: true,
    },
    {
      label: 'Failed',
      data: name === 'default' ? [5, 8, 3, 4, 2, 5, 3] : [3, 5, 2, 3, 1, 4, 2],
      borderColor: 'rgb(239, 68, 68)',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      fill: true,
    }
  ],
})

const queueChartOptions = {
  ...chartOptions,
  plugins: {
    ...chartOptions.plugins,
    legend: {
      display: false
    }
  },
  scales: {
    ...chartOptions.scales,
    y: {
      ...chartOptions.scales.y,
      max: 300,
      ticks: {
        ...chartOptions.scales.y.ticks,
        stepSize: 50,
      }
    }
  }
}

const queueStatusColors: Record<string, string> = {
  queued: 'bg-blue-500',
  processing: 'bg-yellow-500',
  processed: 'bg-green-500',
  released: 'bg-purple-500',
  failed: 'bg-red-500',
}

const getQueueStatusColor = (status: string): string => {
  return queueStatusColors[status] || 'bg-gray-500'
}

// Stats cards data
const statsCards = [
  {
    title: 'Total Requests',
    value: '71,897',
    change: '+122',
    changeType: 'increase',
    icon: 'i-heroicons-arrow-trending-up',
  },
  {
    title: 'Average Response Time',
    value: '235ms',
    change: '-12ms',
    changeType: 'decrease',
    icon: 'i-heroicons-clock',
  },
  {
    title: 'Success Rate',
    value: '99.95%',
    change: '+0.2%',
    changeType: 'increase',
    icon: 'i-heroicons-check-circle',
  },
]
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <!-- Stats Overview -->
    <div class="mb-8 px-4 lg:px-8 sm:px-6">
      <div>
        <h3 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
          System Overview
        </h3>

        <dl class="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3 sm:grid-cols-2">
          <div v-for="stat in statsCards" :key="stat.title"
               class="relative overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div :class="[stat.icon, 'h-6 w-6 text-white']" />
              </div>
              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-300 font-medium">
                {{ stat.title }}
              </p>
            </dt>
            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 dark:text-gray-100 font-semibold">
                {{ stat.value }}
              </p>
              <p :class="[
                'ml-2 flex items-baseline text-sm font-semibold',
                stat.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
              ]">
                <span v-if="stat.changeType === 'increase'" class="i-heroicons-arrow-up h-5 w-5 flex-shrink-0 self-center text-green-500" />
                <span v-else class="i-heroicons-arrow-down h-5 w-5 flex-shrink-0 self-center text-red-500" />
                {{ stat.change }}
              </p>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- System Metrics -->
    <div class="px-4 lg:px-8 sm:px-6">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
            System Metrics
          </h1>
          <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
            Real-time monitoring of your system's performance and resource usage.
          </p>
        </div>
      </div>

      <div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- CPU Usage -->
        <div class="overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 shadow">
          <div class="p-6">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">CPU Usage</h3>
              <span class="text-sm font-mono text-gray-500 dark:text-gray-400">{{ systemMetrics.cpu }}%</span>
            </div>
            <div class="mt-2 h-2 rounded-full bg-gray-200 dark:bg-blue-gray-600">
              <div
                class="h-2 rounded-full bg-blue-500"
                :style="{ width: `${systemMetrics.cpu}%` }"
              ></div>
            </div>
            <div class="mt-4 h-32">
              <Line :data="cpuData" :options="chartOptions" />
            </div>
          </div>
        </div>

        <!-- Memory Usage -->
        <div class="overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 shadow">
          <div class="p-6">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">Memory</h3>
              <span class="text-sm font-mono text-gray-500 dark:text-gray-400">
                {{ systemMetrics.memory.used }}MB / {{ systemMetrics.memory.total }}MB
              </span>
            </div>
            <div class="mt-2 h-2 rounded-full bg-gray-200 dark:bg-blue-gray-600">
              <div
                class="h-2 rounded-full bg-blue-500"
                :style="{ width: `${(systemMetrics.memory.used / systemMetrics.memory.total) * 100}%` }"
              ></div>
            </div>
            <div class="mt-4 h-32">
              <Line :data="memoryData" :options="chartOptions" />
            </div>
          </div>
        </div>

        <!-- Storage Usage -->
        <div class="overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 shadow">
          <div class="p-6">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">Storage</h3>
              <span class="text-sm font-mono text-gray-500 dark:text-gray-400">
                {{ systemMetrics.storage.used }}GB / {{ systemMetrics.storage.total }}GB
              </span>
            </div>
            <div class="mt-4 h-32">
              <Doughnut :data="storageData" :options="pieChartOptions" />
            </div>
            <div class="mt-4 flex justify-center space-x-4">
              <div class="flex items-center">
                <div class="h-3 w-3 rounded-full bg-blue-500 mr-2"></div>
                <span class="text-xs font-mono text-gray-500 dark:text-gray-400">Used ({{ systemMetrics.storage.used }}GB)</span>
              </div>
              <div class="flex items-center">
                <div class="h-3 w-3 rounded-full bg-gray-200 dark:bg-gray-600 mr-2"></div>
                <span class="text-xs font-mono text-gray-500 dark:text-gray-400">Available ({{ systemMetrics.storage.total - systemMetrics.storage.used }}GB)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Queue Monitoring -->
    <div class="mt-8 px-4 lg:px-8 sm:px-6">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
            Queue Monitoring
          </h1>
          <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
            Real-time monitoring of your application's queue processing.
          </p>
        </div>
      </div>

      <div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Queues -->
        <div class="overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 shadow">
          <div class="p-6">
            <div class="space-y-8">
              <!-- Queue Stats -->
              <div v-for="(stats, name) in queues" :key="name" class="space-y-4">
                <div>
                  <h4 class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ name }}</h4>
                </div>

                <!-- Status Pills -->
                <div class="flex items-center space-x-2">
                  <div v-for="(value, status) in stats" :key="status"
                       class="inline-flex items-center space-x-1"
                       :class="{
                         'text-blue-700 dark:text-blue-300': status === 'queued',
                         'text-yellow-700 dark:text-yellow-300': status === 'processing',
                         'text-green-700 dark:text-green-300': status === 'processed',
                         'text-purple-700 dark:text-purple-300': status === 'released',
                         'text-red-700 dark:text-red-300': status === 'failed'
                       }">
                    <div :class="[getQueueStatusColor(status), 'h-1.5 w-1.5 rounded-full']"></div>
                    <span class="text-xs font-mono">{{ value }}</span>
                  </div>
                </div>

                <!-- Queue Chart -->
                <div>
                  <div class="flex items-center space-x-4 mb-2">
                    <div class="flex items-center space-x-2">
                      <div class="h-1 w-4 bg-green-500 rounded"></div>
                      <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Processed</span>
                    </div>
                    <div class="flex items-center space-x-2">
                      <div class="h-1 w-4 bg-red-500 rounded"></div>
                      <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Failed</span>
                    </div>
                  </div>
                  <div class="h-48">
                    <Line :data="getQueueData(name)" :options="queueChartOptions" />
                  </div>
                  <div class="flex justify-between text-xs font-mono text-gray-500 dark:text-gray-400 mt-2">
                    <span>12am</span>
                    <span>6am</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Cache Stats -->
        <div>
          <div class="sm:flex sm:items-center">
            <div class="sm:flex-auto">
              <h1 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
                Cache Performance
              </h1>
              <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
                Real-time monitoring of your application's cache performance and hit rates.
              </p>
            </div>
          </div>

          <div class="mt-8 overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 shadow">
            <div class="p-6">
              <!-- Main Stats -->
              <div class="grid grid-cols-3 gap-8">
                <div class="text-center">
                  <p class="text-3xl font-mono font-semibold text-gray-900 dark:text-gray-100">{{ cache.hits }}</p>
                  <p class="mt-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">Hits</p>
                </div>
                <div class="text-center">
                  <p class="text-3xl font-mono font-semibold text-gray-900 dark:text-gray-100">{{ cache.misses }}</p>
                  <p class="mt-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">Misses</p>
                </div>
                <div class="text-center">
                  <p class="text-3xl font-mono font-semibold text-gray-900 dark:text-gray-100">{{ cache.hitRate }}%</p>
                  <p class="mt-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">Hit Rate</p>
                </div>
              </div>

              <!-- Cache Keys -->
              <div class="mt-8">
                <div class="space-y-4">
                  <div v-for="key in cache.keys" :key="key.name"
                       class="rounded-lg border border-gray-100 dark:border-blue-gray-600 p-4 hover:border-blue-500 dark:hover:border-blue-400 transition-colors duration-150">
                    <div class="flex items-center justify-between mb-3">
                      <div class="flex items-center space-x-3">
                        <div class="h-2 w-2 rounded-full bg-blue-500"></div>
                        <span class="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">{{ key.name }}</span>
                      </div>
                      <div class="flex items-center space-x-2">
                        <span class="text-xs font-mono text-gray-500 dark:text-gray-400">TTL: {{ key.ttl }}s</span>
                        <span class="text-xs font-mono text-gray-400">|</span>
                        <span class="text-xs font-mono text-gray-500 dark:text-gray-400">{{ key.lastAccessed }}</span>
                      </div>
                    </div>

                    <!-- Hit Rate Progress -->
                    <div class="flex items-center space-x-3">
                      <div class="flex-1 h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-blue-gray-600">
                        <div class="h-full rounded-full bg-blue-500" :style="{ width: `${key.hitRate}%` }"></div>
                      </div>
                      <span class="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">{{ key.hitRate }}%</span>
                    </div>

                    <!-- Hits/Misses Stats -->
                    <div class="mt-3 flex items-center space-x-4 text-xs">
                      <div class="flex items-center space-x-1">
                        <div class="i-heroicons-check-circle h-4 w-4 text-green-500" />
                        <span class="font-mono text-gray-500 dark:text-gray-400">{{ key.hits }} hits</span>
                      </div>
                      <div class="flex items-center space-x-1">
                        <div class="i-heroicons-x-circle h-4 w-4 text-red-500" />
                        <span class="font-mono text-gray-500 dark:text-gray-400">{{ key.misses }} misses</span>
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

    <!-- Exceptions & Slow Queries -->
    <div class="mt-8 px-4 lg:px-8 sm:px-6">
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Exceptions -->
        <div class="overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 shadow">
          <div class="p-6">
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Exceptions</h3>
            <div class="mt-6 space-y-4">
              <div v-for="exception in exceptions" :key="exception.type" class="space-y-2">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">{{ exception.type }}</p>
                    <p class="text-xs font-mono text-gray-500 dark:text-gray-400">{{ exception.location }}</p>
                  </div>
                  <div class="text-right">
                    <p class="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">{{ exception.count }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">{{ exception.latest }}</p>
                  </div>
                </div>
                <div class="h-1 w-full rounded-full bg-gray-200 dark:bg-blue-gray-600">
                  <div class="h-1 rounded-full bg-red-500" style="width: 75%"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Slow Queries -->
        <div class="overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 shadow">
          <div class="p-6">
            <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Slow Queries</h3>
            <div class="mt-6 space-y-4">
              <div v-for="query in slowQueries" :key="query.location"
                   class="group rounded-lg border border-gray-200 dark:border-blue-gray-600 p-4 hover:border-blue-500 dark:hover:border-blue-400 transition-colors duration-150">
                <div class="mb-3">
                  <div class="font-mono text-sm text-gray-900 dark:text-gray-100 leading-relaxed break-all">
                    {{ query.query }}
                  </div>
                </div>
                <div class="flex items-center justify-between text-sm border-t border-gray-100 dark:border-blue-gray-600 pt-3">
                  <div class="flex items-center space-x-2">
                    <div class="i-heroicons-code-bracket-square h-4 w-4 text-gray-400" />
                    <span class="font-mono text-gray-500 dark:text-gray-400">{{ query.location }}</span>
                  </div>
                  <div class="flex items-center space-x-4">
                    <div class="flex items-center space-x-1">
                      <div class="i-heroicons-clock h-4 w-4 text-gray-400" />
                      <span class="font-mono text-gray-500 dark:text-gray-400">{{ query.count }}</span>
                    </div>
                    <div class="flex items-center space-x-1">
                      <div class="i-heroicons-bolt h-4 w-4 text-gray-400" />
                      <span class="font-mono text-gray-500 dark:text-gray-400">{{ query.slowest }}ms</span>
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
