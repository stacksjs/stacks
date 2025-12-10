<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref } from 'vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Queries - Slow Queries',
})

interface SlowQueryRecord {
  id: string
  query: string
  duration: number
  normalized_query: string
  connection: string
  status: 'slow'
  executed_at: string
  bindings?: any[]
  model?: string
  method?: string
  file?: string
  line?: number
  memory_usage?: number
  rows_affected?: number
  transaction_id?: string
  tags?: string[]
  optimization_suggestions?: string[]
  affected_tables?: string[]
  indexes_used?: string[]
  missing_indexes?: string[]
  explain_plan?: string
}

// Mock data for slow queries
const slowQueries = ref<SlowQueryRecord[]>([
  {
    id: '1',
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
    tags: ['content', 'frontend'],
    affected_tables: ['posts', 'categories'],
    indexes_used: ['categories.primary'],
    missing_indexes: ['posts.published_at'],
    optimization_suggestions: [
      'Add index on posts.published_at column',
      'Consider paginating results',
      'Limit selected columns instead of using SELECT *'
    ],
    explain_plan: 'EXPLAIN: id-1, select_type-SIMPLE, table-p, partitions-NULL, type-ALL, possible_keys-NULL, key-NULL, key_len-NULL, ref-NULL, rows-200, filtered-50.00, Extra-Using where; Using filesort...'
  },
  {
    id: '2',
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
    tags: ['reporting'],
    affected_tables: ['orders'],
    indexes_used: [],
    missing_indexes: ['orders.status'],
    optimization_suggestions: [
      'Add index on orders.status column',
      'Consider caching count results',
      'Use Redis counters for high-frequency status counts'
    ],
    explain_plan: 'EXPLAIN: id-1, select_type-SIMPLE, table-orders, partitions-NULL, type-ALL, possible_keys-NULL, key-NULL, key_len-NULL, ref-NULL, rows-10000, filtered-10.00, Extra-Using where...'
  },
  {
    id: '3',
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
    tags: ['reporting', 'monthly'],
    affected_tables: ['orders'],
    indexes_used: [],
    missing_indexes: ['orders.created_at'],
    optimization_suggestions: [
      'Add index on orders.created_at column',
      'Precalculate and store aggregate data for reports',
      'Consider using materialized views or summary tables'
    ],
    explain_plan: 'EXPLAIN: id-1, select_type-SIMPLE, table-orders, partitions-NULL, type-ALL, possible_keys-NULL, key-NULL, key_len-NULL, ref-NULL, rows-10000, filtered-33.33, Extra-Using where...'
  },
  {
    id: '4',
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
    tags: ['cache', 'console'],
    affected_tables: ['cache'],
    indexes_used: [],
    missing_indexes: [],
    optimization_suggestions: [
      'Schedule cache clearing during low traffic periods',
      'Consider incremental cache invalidation instead of truncating',
      'Partition cache table for more efficient truncation'
    ],
    explain_plan: 'N/A - DDL Operation'
  },
  {
    id: '5',
    query: 'SELECT u.*, (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) as order_count FROM users u WHERE u.created_at > ? ORDER BY order_count DESC LIMIT 50',
    normalized_query: 'SELECT u.*, (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) as order_count FROM users u WHERE u.created_at > ? ORDER BY order_count DESC LIMIT ?',
    duration: 230.5,
    connection: 'mysql',
    status: 'slow',
    executed_at: '2024-03-14 09:45:00',
    bindings: ['2023-03-14 09:45:00', 50],
    model: 'User',
    method: 'getTopNewCustomers',
    file: 'app/Reports/CustomerReport.php',
    line: 58,
    memory_usage: 8.7,
    rows_affected: 50,
    tags: ['reporting', 'customers'],
    affected_tables: ['users', 'orders'],
    indexes_used: ['users.created_at_index', 'orders.primary'],
    missing_indexes: ['orders.user_id'],
    optimization_suggestions: [
      'Add index on orders.user_id',
      'Replace correlated subquery with JOIN and GROUP BY',
      'Use a materialized view for frequent reporting',
      'Pre-compute order counts in a denormalized column or table'
    ],
    explain_plan: 'EXPLAIN: id-1, select_type-PRIMARY, table-u, partitions-NULL, type-range, possible_keys-created_at_index, key-created_at_index, key_len-8, ref-NULL, rows-500, filtered-100.00, Extra-Using where; Using filesort...'
  }
])

const timeRange = ref<'day' | 'week' | 'month'>('day')
const thresholdMs = ref<number>(10)
const selectedConnection = ref<string>('all')
const searchQuery = ref('')
const isLoading = ref(false)
const currentExpandedQueryId = ref<string | null>(null)

// Filter functions
const filteredQueries = computed(() => {
  let filtered = [...slowQueries.value]

  // Filter by connection
  if (selectedConnection.value !== 'all') {
    filtered = filtered.filter(query => query.connection === selectedConnection.value)
  }

  // Filter by threshold
  filtered = filtered.filter(query => query.duration >= thresholdMs.value)

  // Filter by search query
  if (searchQuery.value) {
    const lowerSearch = searchQuery.value.toLowerCase()
    filtered = filtered.filter(query =>
      query.query.toLowerCase().includes(lowerSearch) ||
      (query.model && query.model.toLowerCase().includes(lowerSearch)) ||
      (query.method && query.method.toLowerCase().includes(lowerSearch)) ||
      (query.affected_tables && query.affected_tables.some(table => table.toLowerCase().includes(lowerSearch)))
    )
  }

  return filtered.sort((a, b) => b.duration - a.duration) // Sort by duration descending
})

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

// Toggle expanded query details
const toggleQueryDetails = (queryId: string) => {
  if (currentExpandedQueryId.value === queryId) {
    currentExpandedQueryId.value = null
  } else {
    currentExpandedQueryId.value = queryId
  }
}

// Refresh data
const refreshData = () => {
  isLoading.value = true
  setTimeout(() => {
    isLoading.value = false
  }, 500)
}

// Watch for changes and refresh
watch([timeRange, selectedConnection, thresholdMs], () => {
  refreshData()
})

// Add functions for copying to clipboard
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).catch(err => {
    console.error('Could not copy text: ', err)
  })
}

const copiedQuery = ref<string | null>(null)

const copyQuery = (queryId: string, queryText: string) => {
  copyToClipboard(queryText)
  copiedQuery.value = queryId

  // Reset copied state after 2 seconds
  setTimeout(() => {
    if (copiedQuery.value === queryId) {
      copiedQuery.value = null
    }
  }, 2000)
}
</script>

<template>
  <div class="min-h-screen">
    <header class="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-6 bg-white px-4 py-4 shadow-sm dark:bg-blue-gray-900 sm:px-6 lg:px-8">
      <div>
        <h1 class="text-lg text-gray-900 font-semibold leading-7 dark:text-white">
          Slow Queries
        </h1>
        <p class="mt-1 text-sm text-gray-500 leading-6 dark:text-gray-400">
          Identify and optimize slow database queries
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
          <div class="flex items-center rounded-md border-gray-300 dark:border-blue-gray-700">
            <span class="pl-3 pr-1 text-sm text-gray-600 dark:text-gray-400">Threshold:</span>
            <input
              type="number"
              v-model.number="thresholdMs"
              min="1"
              step="5"
              class="w-20 rounded-md border-gray-300 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-blue-600 bg-white dark:bg-blue-gray-800 dark:border-blue-gray-700 dark:text-gray-200"
            />
            <span class="pl-1 pr-3 text-sm text-gray-600 dark:text-gray-400">ms</span>
          </div>
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
      <!-- Summary Stats -->
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">
        <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow dark:bg-blue-gray-800 sm:p-6">
          <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Slow Queries</dt>
          <dd class="mt-1 text-3xl font-semibold tracking-tight text-yellow-600 dark:text-yellow-400">{{ filteredQueries.length }}</dd>
        </div>
        <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow dark:bg-blue-gray-800 sm:p-6">
          <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Avg Duration</dt>
          <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
            {{ filteredQueries.length ? formatDuration(filteredQueries.reduce((sum, q) => sum + q.duration, 0) / filteredQueries.length) : '0 ms' }}
          </dd>
        </div>
        <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow dark:bg-blue-gray-800 sm:p-6">
          <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Max Duration</dt>
          <dd class="mt-1 text-3xl font-semibold tracking-tight text-red-600 dark:text-red-400">
            {{ filteredQueries.length ? formatDuration(Math.max(...filteredQueries.map(q => q.duration))) : '0 ms' }}
          </dd>
        </div>
        <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow dark:bg-blue-gray-800 sm:p-6">
          <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Most Affected Table</dt>
          <dd class="mt-1 text-3xl font-semibold tracking-tight text-blue-600 dark:text-blue-400">
            {{
              filteredQueries.length
                ? Object.entries(
                    filteredQueries.flatMap(q => q.affected_tables || [])
                      .reduce((acc: Record<string, number>, table) => {
                        acc[table] = (acc[table] || 0) + 1;
                        return acc;
                      }, {})
                  ).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
                : 'N/A'
            }}
          </dd>
        </div>
      </div>

      <!-- Queries Table -->
      <div class="mt-8">
        <div class="relative">
          <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-blue-gray-900/50 z-10">
            <div class="i-hugeicons-loading-01 h-8 w-8 animate-spin text-blue-600 dark:text-blue-400"></div>
          </div>

          <div class="overflow-hidden bg-white shadow dark:bg-blue-gray-900 sm:rounded-md">
            <ul role="list" class="divide-y divide-gray-200 dark:divide-blue-gray-700">
              <li v-for="query in filteredQueries" :key="query.id" class="group cursor-pointer hover:bg-gray-50 dark:hover:bg-blue-gray-800" @click="toggleQueryDetails(query.id)">
                <!-- Summary view -->
                <div class="px-4 py-4 sm:px-6">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                      <p class="truncate text-sm font-medium text-blue-600 dark:text-blue-400">
                        {{ query.model ? `${query.model}.${query.method}` : query.method }}
                      </p>
                      <span
                        class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/50 ring-yellow-600/20"
                      >
                        {{ formatDuration(query.duration) }}
                      </span>
                    </div>
                    <div class="ml-2 flex-shrink-0 flex">
                      <div class="i-hugeicons-chevron-down h-5 w-5 text-gray-400 transition-transform duration-200" :class="{ 'transform rotate-180': currentExpandedQueryId === query.id }"></div>
                    </div>
                  </div>
                  <div class="mt-2 sm:flex sm:justify-between">
                    <div class="sm:flex">
                      <p class="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <span class="truncate font-mono text-xs">{{ formatQuery(query.query) }}</span>
                      </p>
                    </div>
                    <div class="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400 sm:mt-0">
                      <div class="i-hugeicons-calendar h-4 w-4 mr-1.5"></div>
                      <p>{{ query.executed_at }}</p>
                    </div>
                  </div>
                  <div class="mt-2 flex flex-wrap gap-1">
                    <span v-for="table in query.affected_tables" :key="table" class="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-900/20 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 ring-1 ring-inset ring-blue-700/10 dark:ring-blue-400/30">
                      {{ table }}
                    </span>
                  </div>
                </div>

                <!-- Expanded details -->
                <div v-if="currentExpandedQueryId === query.id" class="border-t border-gray-200 dark:border-blue-gray-700 bg-gray-50 dark:bg-blue-gray-800 px-4 py-4 sm:px-6">
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <!-- Query details column -->
                    <div class="md:col-span-2">
                      <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">Full Query</h4>
                      <div class="relative">
                        <pre class="mt-1 text-xs font-mono bg-gray-800 text-gray-100 p-3 rounded-md overflow-x-auto sql-highlight">{{ query.query }}</pre>
                        <button
                          @click="copyQuery(query.id, query.query)"
                          class="absolute top-2 right-2 p-1.5 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white"
                          :class="{ 'bg-green-700 hover:bg-green-600': copiedQuery === query.id }"
                        >
                          <div v-if="copiedQuery === query.id" class="i-hugeicons-checkmark h-4 w-4"></div>
                          <div v-else class="i-hugeicons-copy-01 h-4 w-4"></div>
                        </button>
                      </div>

                      <h4 class="text-sm font-medium text-gray-900 dark:text-white mt-4 mb-2">Bindings</h4>
                      <div class="mt-1 bg-gray-100 dark:bg-blue-gray-700 p-3 rounded-md">
                        <pre v-if="query.bindings && query.bindings.length" class="text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto">{{ JSON.stringify(query.bindings, null, 2) }}</pre>
                        <p v-else class="text-xs text-gray-500 dark:text-gray-400">No bindings</p>
                      </div>

                      <h4 class="text-sm font-medium text-gray-900 dark:text-white mt-4 mb-2">Explain Plan</h4>
                      <div class="mt-1 bg-gray-100 dark:bg-blue-gray-700 p-3 rounded-md">
                        <pre class="text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto">{{ query.explain_plan }}</pre>
                      </div>
                    </div>

                    <!-- Recommendations column -->
                    <div>
                      <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">Optimization Suggestions</h4>
                      <ul class="mt-1 space-y-2">
                        <li v-for="(suggestion, i) in query.optimization_suggestions" :key="i" class="flex items-start">
                          <div class="i-hugeicons-lightbulb-02 h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5"></div>
                          <span class="text-sm text-gray-700 dark:text-gray-300">{{ suggestion }}</span>
                        </li>
                      </ul>

                      <h4 class="text-sm font-medium text-gray-900 dark:text-white mt-4 mb-2">Source</h4>
                      <div class="mt-1">
                        <p class="text-sm text-gray-700 dark:text-gray-300">{{ query.file }}:{{ query.line }}</p>
                      </div>

                      <h4 class="text-sm font-medium text-gray-900 dark:text-white mt-4 mb-2">Index Information</h4>
                      <div class="mt-1">
                        <div class="mb-2">
                          <h5 class="text-xs font-medium text-gray-600 dark:text-gray-400">Used Indexes</h5>
                          <div v-if="query.indexes_used && query.indexes_used.length" class="mt-1">
                            <span v-for="index in query.indexes_used" :key="index" class="inline-flex items-center rounded-md bg-green-50 dark:bg-green-900/20 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-300 ring-1 ring-inset ring-green-700/10 dark:ring-green-400/30 mr-2 mb-2">
                              {{ index }}
                            </span>
                          </div>
                          <p v-else class="text-xs text-gray-500 dark:text-gray-400">No indexes used</p>
                        </div>

                        <div>
                          <h5 class="text-xs font-medium text-gray-600 dark:text-gray-400">Missing Indexes</h5>
                          <div v-if="query.missing_indexes && query.missing_indexes.length" class="mt-1">
                            <span v-for="index in query.missing_indexes" :key="index" class="inline-flex items-center rounded-md bg-red-50 dark:bg-red-900/20 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-300 ring-1 ring-inset ring-red-700/10 dark:ring-red-400/30 mr-2 mb-2">
                              {{ index }}
                            </span>
                          </div>
                          <p v-else class="text-xs text-gray-500 dark:text-gray-400">No missing indexes identified</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
              <li v-if="filteredQueries.length === 0" class="px-4 py-6 sm:px-6 text-center text-sm text-gray-500 dark:text-gray-400">
                No slow queries found matching your criteria.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
