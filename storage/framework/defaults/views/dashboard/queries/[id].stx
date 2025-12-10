<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const isLoading = ref(true)

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
  optimization_suggestions?: string[]
  affected_tables?: string[]
  indexes_used?: string[]
  missing_indexes?: string[]
  explain_plan?: string
}

const query = ref<QueryRecord | null>(null)

// Mock fetch function (replace with actual API call in production)
const fetchQuery = async (id: string) => {
  isLoading.value = true

  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500))

  // Mock data for demonstration
  if (id === '1') {
    query.value = {
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
      tags: ['auth'],
      affected_tables: ['users'],
      indexes_used: ['users.email_index'],
      missing_indexes: [],
      explain_plan: 'EXPLAIN: id-1, select_type-SIMPLE, table-users, partitions-NULL, type-ref, possible_keys-email_index, key-email_index, key_len-767, ref-const, rows-1, filtered-100.00, Extra-Using where'
    }
  } else if (id === '2') {
    query.value = {
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
    }
  } else {
    // Default fallback for demo
    query.value = {
      id: id,
      query: 'SELECT * FROM example_table WHERE id = ?',
      normalized_query: 'SELECT * FROM example_table WHERE id = ?',
      duration: 5.2,
      connection: 'mysql',
      status: 'completed',
      executed_at: '2024-03-14 10:00:00',
      bindings: [id],
      model: 'Example',
      method: 'findById',
      file: 'app/Models/Example.php',
      line: 42,
      memory_usage: 1.5,
      rows_affected: 1,
      tags: ['example'],
      affected_tables: ['example_table'],
      indexes_used: ['example_table.primary'],
      missing_indexes: [],
      explain_plan: 'EXPLAIN: id-1, select_type-SIMPLE, table-example_table, partitions-NULL, type-const, possible_keys-PRIMARY, key-PRIMARY, key_len-4, ref-const, rows-1, filtered-100.00'
    }
  }

  isLoading.value = false
}

// Format functions
const formatDuration = (duration: number): string => {
  return duration.toFixed(2) + ' ms'
}

const formatBindings = (bindings: any[] = []): string => {
  return JSON.stringify(bindings, null, 2)
}

// Style mappings
const statusColors: Record<string, string> = {
  completed: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/50 ring-green-600/20',
  slow: 'text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/50 ring-yellow-600/20',
  failed: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/50 ring-red-600/20',
}

const getStatusColor = (status: string): string => {
  return statusColors[status] || 'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 ring-gray-600/20'
}

const getQueryType = (query: string): 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER' => {
  const upperQuery = query.trim().toUpperCase()
  if (upperQuery.startsWith('SELECT')) return 'SELECT'
  if (upperQuery.startsWith('INSERT')) return 'INSERT'
  if (upperQuery.startsWith('UPDATE')) return 'UPDATE'
  if (upperQuery.startsWith('DELETE')) return 'DELETE'
  return 'OTHER'
}

const queryTypeBadges: Record<string, string> = {
  SELECT: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-blue-700/10 dark:ring-blue-400/30',
  INSERT: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 ring-green-700/10 dark:ring-green-400/30',
  UPDATE: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 ring-amber-700/10 dark:ring-amber-400/30',
  DELETE: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 ring-red-700/10 dark:ring-red-400/30',
  OTHER: 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300 ring-gray-700/10 dark:ring-gray-400/30'
}

// Dynamic page title
useHead({
  title: computed(() => query.value ? `Query Details: ${query.value.id}` : 'Query Details')
})

// On mount, fetch query data
onMounted(() => {
  const id = route.params.id as string
  fetchQuery(id)
})
</script>

<template>
  <div class="min-h-screen">
    <header class="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-6 bg-white px-4 py-4 shadow-sm dark:bg-blue-gray-900 sm:px-6 lg:px-8">
      <div>
        <div class="flex items-center gap-2">
          <button
            @click="router.back()"
            class="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-blue-gray-800 transition-colors"
          >
            <div class="i-hugeicons-arrow-left h-5 w-5 text-gray-500 dark:text-gray-400"></div>
          </button>
          <h1 class="text-lg text-gray-900 font-semibold leading-7 dark:text-white">
            Query Details
          </h1>
        </div>
        <p class="mt-1 text-sm text-gray-500 leading-6 dark:text-gray-400 pl-7">
          Detailed information about the database query
        </p>
      </div>
      <div class="flex-shrink-0">
        <router-link
          to="/queries"
          class="inline-flex items-center gap-x-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <div class="i-hugeicons-apps-04 h-5 w-5 -ml-0.5" aria-hidden="true"></div>
          Dashboard
        </router-link>
      </div>
    </header>

    <main class="px-4 py-8 sm:px-6 lg:px-8">
      <!-- Loading state -->
      <div v-if="isLoading" class="flex justify-center items-center py-12">
        <div class="i-hugeicons-loading-01 h-8 w-8 animate-spin text-blue-600 dark:text-blue-400"></div>
      </div>

      <div v-else-if="query" class="space-y-6">
        <!-- Query header section -->
        <div class="bg-white shadow dark:bg-blue-gray-900 sm:rounded-lg overflow-hidden">
          <div class="px-4 py-5 sm:px-6">
            <div class="flex flex-wrap justify-between items-start gap-4">
              <div>
                <div class="flex flex-wrap items-center gap-3 mb-2">
                  <span
                    class="inline-flex items-center rounded-md px-2.5 py-1 text-sm font-medium ring-1 ring-inset"
                    :class="getStatusColor(query.status)"
                  >
                    {{ query.status }}
                  </span>
                  <span
                    class="inline-flex items-center rounded-md px-2.5 py-1 text-sm font-medium ring-1 ring-inset"
                    :class="queryTypeBadges[getQueryType(query.query)]"
                  >
                    {{ getQueryType(query.query) }}
                  </span>
                  <span class="text-lg font-medium text-blue-600 dark:text-blue-400">
                    {{ formatDuration(query.duration) }}
                  </span>
                </div>
                <h3 class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ query.model ? `${query.model}.${query.method}` : 'Unknown Source' }}
                </h3>
                <p class="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                  {{ query.file }}:{{ query.line }}
                </p>
              </div>
              <div class="text-right">
                <p class="text-sm text-gray-500 dark:text-gray-400">Executed</p>
                <p class="text-sm font-medium text-gray-900 dark:text-white">{{ query.executed_at }}</p>
              </div>
            </div>
          </div>

          <div class="border-t border-gray-200 dark:border-blue-gray-700">
            <dl>
              <div class="bg-gray-50 dark:bg-blue-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Query</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-white sm:col-span-2 sm:mt-0">
                  <pre class="font-mono text-xs bg-gray-800 text-gray-100 p-3 rounded-md overflow-x-auto">{{ query.query }}</pre>
                </dd>
              </div>
              <div class="bg-white dark:bg-blue-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Normalized Query</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-white sm:col-span-2 sm:mt-0">
                  <pre class="font-mono text-xs bg-gray-100 dark:bg-blue-gray-800 text-gray-800 dark:text-gray-200 p-3 rounded-md overflow-x-auto">{{ query.normalized_query }}</pre>
                </dd>
              </div>
              <div class="bg-gray-50 dark:bg-blue-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Bindings</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-white sm:col-span-2 sm:mt-0">
                  <pre v-if="query.bindings && query.bindings.length" class="font-mono text-xs bg-gray-100 dark:bg-blue-gray-700 text-gray-800 dark:text-gray-200 p-3 rounded-md overflow-x-auto">{{ formatBindings(query.bindings) }}</pre>
                  <p v-else class="text-sm text-gray-500 dark:text-gray-400">No bindings</p>
                </dd>
              </div>
              <div class="bg-white dark:bg-blue-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Connection</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-white sm:col-span-2 sm:mt-0">{{ query.connection }}</dd>
              </div>
              <div class="bg-gray-50 dark:bg-blue-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Affected Tables</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-white sm:col-span-2 sm:mt-0">
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="table in query.affected_tables"
                      :key="table"
                      class="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-900/20 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 ring-1 ring-inset ring-blue-700/10 dark:ring-blue-400/30"
                    >
                      {{ table }}
                    </span>
                  </div>
                </dd>
              </div>
              <div class="bg-white dark:bg-blue-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Indexes</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-white sm:col-span-2 sm:mt-0">
                  <div class="space-y-4">
                    <div>
                      <h4 class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Used Indexes</h4>
                      <div v-if="query.indexes_used && query.indexes_used.length" class="flex flex-wrap gap-2">
                        <span
                          v-for="index in query.indexes_used"
                          :key="index"
                          class="inline-flex items-center rounded-md bg-green-50 dark:bg-green-900/20 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-300 ring-1 ring-inset ring-green-700/10 dark:ring-green-400/30"
                        >
                          {{ index }}
                        </span>
                      </div>
                      <p v-else class="text-xs text-gray-500 dark:text-gray-400">No indexes used</p>
                    </div>
                    <div>
                      <h4 class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Missing Indexes</h4>
                      <div v-if="query.missing_indexes && query.missing_indexes.length" class="flex flex-wrap gap-2">
                        <span
                          v-for="index in query.missing_indexes"
                          :key="index"
                          class="inline-flex items-center rounded-md bg-red-50 dark:bg-red-900/20 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-300 ring-1 ring-inset ring-red-700/10 dark:ring-red-400/30"
                        >
                          {{ index }}
                        </span>
                      </div>
                      <p v-else class="text-xs text-gray-500 dark:text-gray-400">No missing indexes identified</p>
                    </div>
                  </div>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <!-- Performance section -->
        <div class="bg-white shadow dark:bg-blue-gray-900 sm:rounded-lg overflow-hidden">
          <div class="px-4 py-5 sm:px-6">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Performance Details</h3>
            <p class="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">Execution metrics and optimization information.</p>
          </div>
          <div class="border-t border-gray-200 dark:border-blue-gray-700">
            <dl>
              <div class="bg-gray-50 dark:bg-blue-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Memory Usage</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-white sm:col-span-2 sm:mt-0">{{ query.memory_usage }} MB</dd>
              </div>
              <div class="bg-white dark:bg-blue-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Rows Affected</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-white sm:col-span-2 sm:mt-0">{{ query.rows_affected }}</dd>
              </div>
              <div class="bg-gray-50 dark:bg-blue-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Explain Plan</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-white sm:col-span-2 sm:mt-0">
                  <pre class="font-mono text-xs bg-gray-100 dark:bg-blue-gray-700 text-gray-800 dark:text-gray-200 p-3 rounded-md overflow-x-auto whitespace-pre-wrap">{{ query.explain_plan }}</pre>
                </dd>
              </div>
              <div v-if="query.optimization_suggestions && query.optimization_suggestions.length" class="bg-white dark:bg-blue-gray-900 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Optimization Suggestions</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-white sm:col-span-2 sm:mt-0">
                  <ul class="space-y-2">
                    <li v-for="(suggestion, i) in query.optimization_suggestions" :key="i" class="flex items-start">
                      <div class="i-hugeicons-lightbulb-02 h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5"></div>
                      <span class="text-sm text-gray-800 dark:text-gray-200">{{ suggestion }}</span>
                    </li>
                  </ul>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <!-- Tags section -->
        <div class="bg-white shadow dark:bg-blue-gray-900 sm:rounded-lg overflow-hidden">
          <div class="px-4 py-5 sm:px-6">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Tags</h3>
          </div>
          <div class="border-t border-gray-200 dark:border-blue-gray-700 px-4 py-5 sm:px-6">
            <div class="flex flex-wrap gap-2">
              <span
                v-for="tag in query.tags"
                :key="tag"
                class="inline-flex items-center rounded-md bg-gray-50 dark:bg-blue-gray-800 px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 ring-1 ring-inset ring-gray-300 dark:ring-gray-700"
              >
                {{ tag }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Error state -->
      <div v-else class="bg-white shadow dark:bg-blue-gray-900 sm:rounded-lg overflow-hidden">
        <div class="px-4 py-5 sm:p-6 text-center">
          <div class="i-hugeicons-file-broken h-12 w-12 text-gray-400 mx-auto mb-4"></div>
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">Query not found</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">The requested query could not be found or has been deleted.</p>
          <div class="mt-6">
            <router-link
              to="/queries"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            >
              Return to Dashboard
            </router-link>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
