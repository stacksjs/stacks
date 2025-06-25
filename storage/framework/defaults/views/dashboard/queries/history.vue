<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Queries - History',
})

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

// Mock data for query history
const queryHistory = ref<QueryRecord[]>([
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
  {
    id: '6',
    query: 'SELECT COUNT(*) FROM orders WHERE status = ?',
    normalized_query: 'SELECT COUNT(*) FROM orders WHERE status = ?',
    duration: 78.4,
    connection: 'mysql',
    status: 'slow',
    executed_at: '2024-03-14 10:08:22',
    bindings: ['pending'],
    model: 'Order',
    method: 'countPendingOrders',
    file: 'app/Models/Order.php',
    line: 67,
    memory_usage: 3.1,
    rows_affected: 1,
    tags: ['reporting']
  },
  {
    id: '7',
    query: 'SELECT AVG(total) FROM orders WHERE created_at BETWEEN ? AND ?',
    normalized_query: 'SELECT AVG(total) FROM orders WHERE created_at BETWEEN ? AND ?',
    duration: 65.2,
    connection: 'mysql',
    status: 'slow',
    executed_at: '2024-03-14 10:05:11',
    bindings: ['2023-03-01 00:00:00', '2023-03-31 23:59:59'],
    model: 'Order',
    method: 'getAverageOrderTotal',
    file: 'app/Reports/MonthlyReport.php',
    line: 134,
    memory_usage: 4.2,
    rows_affected: 1,
    tags: ['reporting', 'monthly']
  },
  {
    id: '8',
    query: 'UPDATE users SET last_login_at = ? WHERE id = ?',
    normalized_query: 'UPDATE users SET last_login_at = ? WHERE id = ?',
    duration: 3.5,
    connection: 'mysql',
    status: 'completed',
    executed_at: '2024-03-14 10:02:47',
    bindings: ['2024-03-14 10:02:47', 42],
    model: 'User',
    method: 'updateLastLogin',
    file: 'app/Http/Controllers/Auth/LoginController.php',
    line: 89,
    memory_usage: 1.7,
    rows_affected: 1,
    tags: ['auth']
  },
  {
    id: '9',
    query: 'SELECT * FROM failed_jobs',
    normalized_query: 'SELECT * FROM failed_jobs',
    duration: 12.8,
    connection: 'mysql',
    status: 'completed',
    executed_at: '2024-03-14 10:00:00',
    bindings: [],
    model: undefined,
    method: 'listFailedJobs',
    file: 'app/Console/Commands/ListFailedJobs.php',
    line: 42,
    memory_usage: 2.9,
    rows_affected: 5,
    tags: ['jobs', 'console']
  },
  {
    id: '10',
    query: 'TRUNCATE TABLE cache',
    normalized_query: 'TRUNCATE TABLE cache',
    duration: 125.3,
    connection: 'mysql',
    status: 'slow',
    executed_at: '2024-03-14 09:55:00',
    bindings: [],
    model: undefined,
    method: 'flush',
    file: 'app/Console/Commands/CacheClear.php',
    line: 28,
    memory_usage: 1.5,
    rows_affected: 0,
    tags: ['cache', 'console']
  },
  {
    id: '11',
    query: 'SELECT * FROM users WHERE role = ? AND last_login_at < ? LIMIT 100',
    normalized_query: 'SELECT * FROM users WHERE role = ? AND last_login_at < ? LIMIT ?',
    duration: 8.7,
    connection: 'mysql',
    status: 'completed',
    executed_at: '2024-03-14 09:50:12',
    bindings: ['customer', '2023-03-14 09:50:12', 100],
    model: 'User',
    method: 'getInactiveCustomers',
    file: 'app/Jobs/SendInactiveCustomerEmail.php',
    line: 37,
    memory_usage: 6.4,
    rows_affected: 23,
    tags: ['email', 'scheduled']
  },
  {
    id: '12',
    query: 'SELECT * FROM products WHERE stock < ? LIMIT 50',
    normalized_query: 'SELECT * FROM products WHERE stock < ? LIMIT ?',
    duration: 7.2,
    connection: 'mysql',
    status: 'completed',
    executed_at: '2024-03-14 09:45:00',
    bindings: [10, 50],
    model: 'Product',
    method: 'getLowStockProducts',
    file: 'app/Console/Commands/SendLowStockAlert.php',
    line: 45,
    memory_usage: 4.8,
    rows_affected: 12,
    tags: ['inventory', 'console']
  },
])

const timeRange = ref<'day' | 'week' | 'month'>('day')
const selectedConnection = ref<string>('all')
const selectedStatus = ref<string>('all')
const selectedType = ref<string>('all')
const isLoading = ref(false)
const searchQuery = ref('')

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

// Filter functions
const filteredQueries = computed(() => {
  let filtered = [...queryHistory.value]

  // Filter by connection
  if (selectedConnection.value !== 'all') {
    filtered = filtered.filter(query => query.connection === selectedConnection.value)
  }

  // Filter by status
  if (selectedStatus.value !== 'all') {
    filtered = filtered.filter(query => query.status === selectedStatus.value)
  }

  // Filter by query type
  if (selectedType.value !== 'all') {
    filtered = filtered.filter(query => getQueryType(query.query) === selectedType.value)
  }

  // Filter by search query
  if (searchQuery.value) {
    const lowerSearch = searchQuery.value.toLowerCase()
    filtered = filtered.filter(query =>
      query.query.toLowerCase().includes(lowerSearch) ||
      (query.model && query.model.toLowerCase().includes(lowerSearch)) ||
      (query.method && query.method.toLowerCase().includes(lowerSearch))
    )
  }

  return filtered
})

// Status colors
const queryStatusColors: Record<string, string> = {
  completed: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/50 ring-green-600/20',
  slow: 'text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/50 ring-yellow-600/20',
  failed: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/50 ring-red-600/20',
}

const getQueryStatusColor = (status: string): string => {
  return queryStatusColors[status] || 'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 ring-gray-600/20'
}

// Format helpers
const formatQuery = (query: string): string => {
  if (query.length > 100) {
    return query.substring(0, 100) + '...'
  }
  return query
}

const formatDuration = (duration: number): string => {
  return duration.toFixed(2) + ' ms'
}

// Refresh data
const refreshData = () => {
  isLoading.value = true
  setTimeout(() => {
    isLoading.value = false
  }, 500)
}

// Watch for changes and refresh
watch([timeRange, selectedConnection, selectedStatus, selectedType], () => {
  refreshData()
})
</script>

<template>
  <div class="min-h-screen">
    <header class="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-6 bg-white px-4 py-4 shadow-sm dark:bg-blue-gray-900 sm:px-6 lg:px-8">
      <div>
        <h1 class="text-lg text-gray-900 font-semibold leading-7 dark:text-white">
          Query History
        </h1>
        <p class="mt-1 text-sm text-gray-500 leading-6 dark:text-gray-400">
          View and analyze past database queries
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <div class="inline-flex rounded-md shadow-sm">
          <button
            type="button"
            class="relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-medium"
            :class="timeRange === 'day' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-gray-200 dark:ring-blue-gray-700 dark:hover:bg-blue-gray-700'"
            @click="timeRange = 'day'"
          >
            Day
          </button>
          <button
            type="button"
            class="relative -ml-px inline-flex items-center px-3 py-2 text-sm font-medium"
            :class="timeRange === 'week' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-gray-200 dark:ring-blue-gray-700 dark:hover:bg-blue-gray-700'"
            @click="timeRange = 'week'"
          >
            Week
          </button>
          <button
            type="button"
            class="relative -ml-px inline-flex items-center rounded-r-md px-3 py-2 text-sm font-medium"
            :class="timeRange === 'month' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-gray-200 dark:ring-blue-gray-700 dark:hover:bg-blue-gray-700'"
            @click="timeRange = 'month'"
          >
            Month
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
            id="status"
            name="status"
            class="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-blue-600 focus:outline-none focus:ring-blue-600 bg-white dark:bg-blue-gray-800 dark:border-blue-gray-700 dark:text-gray-200"
            v-model="selectedStatus"
          >
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="slow">Slow</option>
            <option value="failed">Failed</option>
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
        <div class="relative w-full sm:w-auto">
          <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <div class="i-hugeicons-search-01 h-5 w-5 text-gray-400"></div>
          </div>
          <input
            type="text"
            v-model="searchQuery"
            class="block w-full rounded-md border-gray-300 py-2 pl-10 text-sm focus:border-blue-600 focus:outline-none focus:ring-blue-600 bg-white dark:bg-blue-gray-800 dark:border-blue-gray-700 dark:text-gray-200"
            placeholder="Search queries..."
          />
        </div>
      </div>
    </header>

    <main class="px-4 py-8 sm:px-6 lg:px-8">
      <!-- Queries Table -->
      <div class="mt-4">
        <div class="relative">
          <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-blue-gray-900/50 z-10">
            <div class="i-hugeicons-loading-01 h-8 w-8 animate-spin text-blue-600 dark:text-blue-400"></div>
          </div>
          <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
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
                    Model / Method
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
                      <div
                        class="font-medium text-gray-900 dark:text-white font-mono text-xs overflow-hidden text-ellipsis"
                        :title="query.query"
                      >
                        {{ formatQuery(query.query) }}
                      </div>
                    </div>
                    <div class="hidden text-gray-500 dark:text-gray-400 xl:block mt-1">
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
                    <div>{{ query.model || '-' }}</div>
                    <div class="text-xs text-gray-400 dark:text-gray-500">{{ query.method || '-' }}</div>
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
                <tr v-if="filteredQueries.length === 0">
                  <td colspan="7" class="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No queries found matching your criteria.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
