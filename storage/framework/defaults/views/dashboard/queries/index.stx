<route lang="yaml">
  meta:
    requiresAuth: true
</route>

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
  title: 'Dashboard - Queries',
})

interface QueryStats {
  total: number
  select: number
  insert: number
  update: number
  delete: number
  slow: number
}

interface QueryRecord {
  id: string
  query: string
  duration: number
  normalized_query: string
  connection: string
  status: 'completed' | 'failed' | 'slow'
  error?: string
  executed_at: string
  bindings?: any[]
  trace?: string
  model?: string
  method?: string
  file?: string
  line?: number
  memory_usage?: number
  rows_affected?: number
  transaction_id?: string
  tags?: string[]
}

// Mock data for demonstration
const stats = ref<QueryStats>({
  total: 1286,
  select: 954,
  insert: 152,
  update: 98,
  delete: 82,
  slow: 24,
})

const recentQueries = ref<QueryRecord[]>([
  {
    id: '1',
    query: 'SELECT * FROM users WHERE email = ? LIMIT 1',
    normalized_query: 'SELECT * FROM users WHERE email = ? LIMIT ?',
    duration: 3.2,
    connection: 'mysql',
    status: 'completed',
    executed_at: '2024-03-14 10:16:32',
    bindings: ['user@example.com', 1],
    model: 'User',
    method: 'findByEmail',
    file: 'app/Models/User.php',
    line: 45,
    memory_usage: 2.4,
    rows_affected: 1,
    tags: ['auth']
  },
  {
    id: '2',
    query: 'SELECT p.*, c.name as category_name FROM posts p JOIN categories c ON p.category_id = c.id WHERE p.published_at IS NOT NULL ORDER BY p.published_at DESC LIMIT 10',
    normalized_query: 'SELECT p.*, c.name as category_name FROM posts p JOIN categories c ON p.category_id = c.id WHERE p.published_at IS NOT NULL ORDER BY p.published_at DESC LIMIT ?',
    duration: 45.7,
    connection: 'mysql',
    status: 'slow',
    executed_at: '2024-03-14 10:15:30',
    bindings: [10],
    model: 'Post',
    method: 'getRecentPublishedWithCategory',
    file: 'app/Models/Post.php',
    line: 78,
    memory_usage: 5.8,
    rows_affected: 10,
    tags: ['content', 'frontend']
  },
  {
    id: '3',
    query: 'INSERT INTO user_logs (user_id, action, ip_address, created_at) VALUES (?, ?, ?, ?)',
    normalized_query: 'INSERT INTO user_logs (user_id, action, ip_address, created_at) VALUES (?, ?, ?, ?)',
    duration: 2.1,
    connection: 'mysql',
    status: 'completed',
    executed_at: '2024-03-14 10:14:55',
    bindings: [42, 'login', '192.168.1.1', '2024-03-14 10:14:55'],
    model: 'UserLog',
    method: 'logAction',
    file: 'app/Services/LogService.php',
    line: 28,
    memory_usage: 1.8,
    rows_affected: 1,
    tags: ['logging']
  },
  {
    id: '4',
    query: 'UPDATE products SET stock = stock - 1 WHERE id = ? AND stock > 0',
    normalized_query: 'UPDATE products SET stock = stock - ? WHERE id = ? AND stock > ?',
    duration: 4.5,
    connection: 'mysql',
    status: 'completed',
    executed_at: '2024-03-14 10:12:18',
    bindings: [1, 156, 0],
    model: 'Product',
    method: 'decrementStock',
    file: 'app/Models/Product.php',
    line: 112,
    memory_usage: 2.1,
    rows_affected: 1,
    tags: ['inventory', 'order']
  },
  {
    id: '5',
    query: 'DELETE FROM carts WHERE user_id = ? AND updated_at < ?',
    normalized_query: 'DELETE FROM carts WHERE user_id = ? AND updated_at < ?',
    duration: 2.8,
    connection: 'mysql',
    status: 'completed',
    executed_at: '2024-03-14 10:10:05',
    bindings: [78, '2024-03-13 10:10:05'],
    model: 'Cart',
    method: 'clearOldCarts',
    file: 'app/Jobs/ClearOldCarts.php',
    line: 35,
    memory_usage: 1.9,
    rows_affected: 3,
    tags: ['cleanup', 'scheduled']
  },
])

const timeRange = ref<'hour' | 'day' | 'week'>('hour')
const selectedConnection = ref<string>('all')
const selectedType = ref<string>('all')
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

const queryStatusColors: Record<string, string> = {
  completed: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/50 ring-green-600/20',
  slow: 'text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/50 ring-yellow-600/20',
  failed: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/50 ring-red-600/20',
}

const getQueryStatusColor = (status: string): string => {
  return queryStatusColors[status] || 'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 ring-gray-600/20'
}

// Generate mock query performance data
const getPerformanceData = () => {
  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`)
  return {
    labels,
    datasets: [
      {
        label: 'SELECT',
        data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 50) + 30),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
      },
      {
        label: 'INSERT',
        data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 15) + 5),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
      },
      {
        label: 'UPDATE',
        data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 12) + 3),
        borderColor: 'rgb(245, 158, 11)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
      },
      {
        label: 'DELETE',
        data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 8) + 2),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
      },
    ],
  }
}

// Generate mock query duration data
const getDurationData = () => {
  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`)
  return {
    labels,
    datasets: [{
      label: 'Average Duration (ms)',
      data: Array.from({ length: 24 }, () => Math.random() * 25 + 5),
      borderColor: 'rgb(124, 58, 237)',
      backgroundColor: 'rgba(124, 58, 237, 0.1)',
      fill: true,
    }],
  }
}

const performanceData = ref(getPerformanceData())
const durationData = ref(getDurationData())

// Functions to refresh data when time range changes
const refreshData = () => {
  isLoading.value = true

  setTimeout(() => {
    performanceData.value = getPerformanceData()
    durationData.value = getDurationData()
    isLoading.value = false
  }, 500)
}

// Watch for time range or connection changes
watch([timeRange, selectedConnection, selectedType], () => {
  refreshData()
})

// Format queries for better display
const formatQuery = (query: string): string => {
  if (query.length > 100) {
    return query.substring(0, 100) + '...'
  }
  return query
}

// Format duration for better display
const formatDuration = (duration: number): string => {
  return duration.toFixed(2) + ' ms'
}

// Add a function to determine query type
const getQueryType = (query: string): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER' => {
  const upperQuery = query.trim().toUpperCase()
  if (upperQuery.startsWith('SELECT')) return 'SELECT'
  if (upperQuery.startsWith('INSERT')) return 'INSERT'
  if (upperQuery.startsWith('UPDATE')) return 'UPDATE'
  if (upperQuery.startsWith('DELETE')) return 'DELETE'
  return 'OTHER'
}

// Add styles for query type badges
const queryTypeBadges: Record<string, string> = {
  SELECT: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-blue-700/10 dark:ring-blue-400/30',
  INSERT: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 ring-green-700/10 dark:ring-green-400/30',
  UPDATE: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 ring-amber-700/10 dark:ring-amber-400/30',
  DELETE: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 ring-red-700/10 dark:ring-red-400/30',
  OTHER: 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300 ring-gray-700/10 dark:ring-gray-400/30'
}

// Add filteredQueries computed property
const filteredQueries = computed(() => {
  let filtered = [...recentQueries.value]

  // Filter by connection
  if (selectedConnection.value !== 'all') {
    filtered = filtered.filter(query => query.connection === selectedConnection.value)
  }

  // Filter by query type
  if (selectedType.value !== 'all') {
    filtered = filtered.filter(query => getQueryType(query.query) === selectedType.value)
  }

  return filtered
})
</script>

<template>
  <div class="min-h-screen">
    <header class="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-6 bg-white px-4 py-4 shadow-sm dark:bg-blue-gray-900 sm:px-6 lg:px-8">
      <div>
        <h1 class="text-lg text-gray-900 font-semibold leading-7 dark:text-white">
          Queries Dashboard
        </h1>
        <p class="mt-1 text-sm text-gray-500 leading-6 dark:text-gray-400">
          Monitor and analyze database query performance
        </p>
      </div>
      <div class="flex items-center gap-3">
        <div class="inline-flex rounded-md shadow-sm">
          <button
            type="button"
            class="relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-medium"
            :class="timeRange === 'hour' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-gray-200 dark:ring-blue-gray-700 dark:hover:bg-blue-gray-700'"
            @click="timeRange = 'hour'"
          >
            Hour
          </button>
          <button
            type="button"
            class="relative -ml-px inline-flex items-center px-3 py-2 text-sm font-medium"
            :class="timeRange === 'day' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-gray-200 dark:ring-blue-gray-700 dark:hover:bg-blue-gray-700'"
            @click="timeRange = 'day'"
          >
            Day
          </button>
          <button
            type="button"
            class="relative -ml-px inline-flex items-center rounded-r-md px-3 py-2 text-sm font-medium"
            :class="timeRange === 'week' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-gray-200 dark:ring-blue-gray-700 dark:hover:bg-blue-gray-700'"
            @click="timeRange = 'week'"
          >
            Week
          </button>
        </div>
        <div>
          <select
            id="connection"
            name="connection"
            class="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-blue-600 focus:outline-none focus:ring-blue-600 bg-white dark:bg-blue-gray-800 dark:border-blue-gray-700 dark:text-gray-200"
            v-model="selectedConnection"
          >
            <option value="all">All connections</option>
            <option value="mysql">MySQL</option>
            <option value="postgres">PostgreSQL</option>
            <option value="sqlite">SQLite</option>
            <option value="mongodb">MongoDB</option>
          </select>
        </div>
        <div>
          <select
            id="type"
            name="type"
            class="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-blue-600 focus:outline-none focus:ring-blue-600 bg-white dark:bg-blue-gray-800 dark:border-blue-gray-700 dark:text-gray-200"
            v-model="selectedType"
          >
            <option value="all">All types</option>
            <option value="SELECT">SELECT</option>
            <option value="INSERT">INSERT</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="OTHER">OTHER</option>
          </select>
        </div>
      </div>
    </header>

    <main class="px-4 py-8 sm:px-6 lg:px-8">
      <!-- Stats section -->
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6">
        <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow dark:bg-blue-gray-800 sm:p-6">
          <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Queries</dt>
          <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ stats.total }}</dd>
        </div>
        <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow dark:bg-blue-gray-800 sm:p-6">
          <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">SELECT Queries</dt>
          <dd class="mt-1 text-3xl font-semibold tracking-tight text-blue-600 dark:text-blue-400">{{ stats.select }}</dd>
        </div>
        <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow dark:bg-blue-gray-800 sm:p-6">
          <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">INSERT Queries</dt>
          <dd class="mt-1 text-3xl font-semibold tracking-tight text-green-600 dark:text-green-400">{{ stats.insert }}</dd>
        </div>
        <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow dark:bg-blue-gray-800 sm:p-6">
          <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">UPDATE Queries</dt>
          <dd class="mt-1 text-3xl font-semibold tracking-tight text-amber-600 dark:text-amber-400">{{ stats.update }}</dd>
        </div>
        <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow dark:bg-blue-gray-800 sm:p-6">
          <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">DELETE Queries</dt>
          <dd class="mt-1 text-3xl font-semibold tracking-tight text-red-600 dark:text-red-400">{{ stats.delete }}</dd>
        </div>
        <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow dark:bg-blue-gray-800 sm:p-6">
          <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Slow Queries</dt>
          <dd class="mt-1 text-3xl font-semibold tracking-tight text-yellow-600 dark:text-yellow-400">{{ stats.slow }}</dd>
        </div>
      </div>

      <!-- Charts section -->
      <div class="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
          <div class="p-6">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Query Volume</h3>
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Number of queries by type over time</p>
            <div class="relative mt-6 h-80">
              <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-gray-100/50 dark:bg-blue-gray-800/50">
                <div class="i-hugeicons-loading-01 h-8 w-8 animate-spin text-blue-600 dark:text-blue-400"></div>
              </div>
              <Line :data="performanceData" :options="chartOptions" />
            </div>
          </div>
        </div>
        <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
          <div class="p-6">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Query Duration</h3>
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Average query execution time over time</p>
            <div class="relative mt-6 h-80">
              <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-gray-100/50 dark:bg-blue-gray-800/50">
                <div class="i-hugeicons-loading-01 h-8 w-8 animate-spin text-blue-600 dark:text-blue-400"></div>
              </div>
              <Line :data="durationData" :options="chartOptions" />
            </div>
          </div>
        </div>
      </div>

      <!-- Recent queries section -->
      <div class="mt-8">
        <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Recent Queries</h3>
        <div class="mt-6 overflow-hidden rounded-lg shadow ring-1 ring-black ring-opacity-5">
          <table class="min-w-full divide-y divide-gray-300 dark:divide-blue-gray-700">
            <thead class="bg-gray-50 dark:bg-blue-gray-800">
              <tr>
                <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">
                  Query
                </th>
                <th scope="col" class="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white lg:table-cell">
                  Connection
                </th>
                <th scope="col" class="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white sm:table-cell">
                  Duration
                </th>
                <th scope="col" class="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white lg:table-cell">
                  Model
                </th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Status
                </th>
                <th scope="col" class="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white sm:table-cell">
                  Executed At
                </th>
                <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span class="sr-only">View</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-blue-gray-700 dark:bg-blue-gray-900">
              <tr v-for="query in filteredQueries" :key="query.id">
                <td class="py-4 pl-4 pr-3 text-sm sm:pl-6">
                  <div class="flex items-center gap-2 mb-1">
                    <span
                      class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset"
                      :class="queryTypeBadges[getQueryType(query.query)]"
                    >
                      {{ getQueryType(query.query) }}
                    </span>
                    <div class="font-medium text-gray-900 dark:text-white font-mono text-xs">
                      {{ formatQuery(query.query) }}
                    </div>
                  </div>
                  <div class="hidden text-gray-500 dark:text-gray-400 xl:block">
                    <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium mr-1" v-for="tag in query.tags" :key="tag">
                      {{ tag }}
                    </span>
                  </div>
                </td>
                <td class="hidden px-3 py-4 text-sm text-gray-500 dark:text-gray-400 lg:table-cell">
                  {{ query.connection }}
                </td>
                <td class="hidden px-3 py-4 text-sm text-gray-500 dark:text-gray-400 sm:table-cell" :class="query.duration > 10 ? 'text-yellow-600 dark:text-yellow-400' : ''">
                  {{ formatDuration(query.duration) }}
                </td>
                <td class="hidden px-3 py-4 text-sm text-gray-500 dark:text-gray-400 lg:table-cell">
                  {{ query.model }}
                </td>
                <td class="px-3 py-4 text-sm">
                  <span
                    class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset"
                    :class="getQueryStatusColor(query.status)"
                  >
                    {{ query.status }}
                  </span>
                </td>
                <td class="hidden px-3 py-4 text-sm text-gray-500 dark:text-gray-400 sm:table-cell">
                  {{ query.executed_at }}
                </td>
                <td class="relative py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <router-link :to="`/queries/${query.id}`" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                    View<span class="sr-only">, {{ query.id }}</span>
                  </router-link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
</template>

<style>
/* Simple SQL syntax highlighting */
.sql-highlight {
  color: #f8f8f2;
}

.sql-highlight .keyword {
  color: #ff79c6;
}

.sql-highlight .function {
  color: #50fa7b;
}

.sql-highlight .number {
  color: #bd93f9;
}

.sql-highlight .string {
  color: #f1fa8c;
}

.sql-highlight .comment {
  color: #6272a4;
}

/* Make monospace font more readable */
.font-mono {
  font-family: 'JetBrains Mono', Menlo, Monaco, Consolas, 'Courier New', monospace;
  font-size: 0.85em;
  line-height: 1.5;
}
</style>
