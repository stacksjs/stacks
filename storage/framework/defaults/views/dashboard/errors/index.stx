<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'
import Tooltip from '../../../components/Dashboard/Tooltip.vue'
// import { useToast } from '../../../../../../composables/useToast'

// Set page title
useHead({
  title: 'Dashboard - Errors',
})

// const toast = useToast()
const activeTab = ref('active') // 'active' or 'resolved'
const selectedEnvironment = ref('all') // 'all', 'production', or 'staging'
const isAiAnalyzing = ref(false)
const isDark = ref(false) // You might want to use useDark() from @vueuse/core instead

interface ErrorStats {
  total: number
  resolved: number
  totalChange: number
  resolvedChange: number
}

interface Error {
  id: string
  message: string
  type: string
  environment: string
  location: string
  lastSeen: string
  count: number
  status: 'active' | 'resolved'
  resolvedAt?: string
  resolvedBy?: string
}

// Mock data
const errorStats = ref<ErrorStats>({
  total: 2847,
  resolved: 1624,
  totalChange: -24,
  resolvedChange: 12,
})

const allErrors = ref<Error[]>([
  {
    id: '1',
    message: "Cannot read property 'length' of undefined",
    type: 'JavaScript Error',
    environment: 'production',
    location: 'main.js:156',
    lastSeen: '2 minutes ago',
    count: 36,
    status: 'active'
  },
  {
    id: '2',
    message: "Cannot read property 'length' of undefined",
    type: 'JavaScript Error',
    environment: 'staging',
    location: 'main.js:156',
    lastSeen: '15 minutes ago',
    count: 22,
    status: 'active'
  },
  {
    id: '3',
    message: 'Database connection failed',
    type: 'Fatal Error',
    environment: 'production',
    location: 'UserAction.ts:42',
    lastSeen: '1 hour ago',
    count: 15,
    status: 'active'
  },
  {
    id: '4',
    message: 'Invalid API response format',
    type: 'API Error',
    environment: 'production',
    location: 'api/handlers.ts:89',
    lastSeen: '2 days ago',
    count: 56,
    status: 'resolved',
    resolvedAt: '1 day ago',
    resolvedBy: 'John Doe'
  }
])

const activeErrors = computed(() => {
  const filtered = allErrors.value.filter(error => error.status === 'active')
  return selectedEnvironment.value === 'all'
    ? filtered
    : filtered.filter(error => error.environment === selectedEnvironment.value)
})

const resolvedErrors = computed(() => {
  const filtered = allErrors.value.filter(error => error.status === 'resolved')
  return selectedEnvironment.value === 'all'
    ? filtered
    : filtered.filter(error => error.environment === selectedEnvironment.value)
})

const getTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    'TypeScript Error': 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-400/10',
    'JavaScript Error': 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-400/10',
    'Fatal Error': 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-400/10',
    'API Error': 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-400/10'
  }
  return colors[type] || 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-400/10'
}

const getEnvironmentColor = (env: string): string => {
  const colors: Record<string, string> = {
    production: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-400/10',
    staging: 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-400/10',
    development: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-400/10'
  }
  return colors[env] || 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-400/10'
}

const openInEditor = (location: string) => {
  // Send request to open file in editor
  fetch('/api/editor/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location })
  })
  .then(() => {
    // toast.success('Opening file in editor...')
  })
  .catch(() => {
    // toast.error('Failed to open file in editor')
  })
}

const resolveError = (errorId: string) => {
  const error = allErrors.value.find(e => e.id === errorId)
  if (error) {
    error.status = 'resolved'
    error.resolvedAt = 'Just now'
    error.resolvedBy = 'Current User'
    // toast.success('Error marked as resolved')
  }
}

const analyzeWithAI = async (errorId: string) => {
  const error = allErrors.value.find(e => e.id === errorId)
  if (!error) return

  isAiAnalyzing.value = true
  try {
    const response = await fetch('/api/ai/analyze-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        errorId,
        message: error.message,
        type: error.type,
        location: error.location
      })
    })

    if (!response.ok) throw new Error('AI analysis failed')

    const data = await response.json()
    // toast.success('AI analysis complete')
    // Here you would typically show the AI analysis in a modal or panel
  } catch (err) {
    // toast.error('Failed to analyze error with AI')
  } finally {
    isAiAnalyzing.value = false
  }
}
</script>

<template>
  <div class="min-h-screen py-8 dark:bg-blue-gray-800">
    <div class="px-4 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">Error Tracking</h1>
          <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
            Last 30 days error tracking and monitoring.
          </p>
        </div>
      </div>

      <!-- Stats Overview -->
      <dl class="grid grid-cols-1 mt-5 gap-5 lg:grid-cols-3 sm:grid-cols-2">
        <!-- Total Errors Card -->
        <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6">
          <dt>
            <div class="absolute rounded-md bg-red-500 p-3">
              <div class="i-hugeicons-alert-02 h-6 w-6 text-white" />
            </div>
            <p class="ml-16 truncate text-sm text-gray-500 font-medium">
              Total Unresolved Errors
            </p>
          </dt>
          <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
            <p class="text-2xl text-gray-900 font-semibold">
              2,847
            </p>
            <p class="ml-2 flex items-baseline text-sm text-red-600 font-semibold">
              <svg class="h-5 w-5 flex-shrink-0 self-center text-red-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clip-rule="evenodd" />
              </svg>
              <span class="sr-only">Increased by</span>
              24%
            </p>
          </dd>
        </div>

        <!-- Resolved Issues Card -->
        <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6">
          <dt>
            <div class="absolute rounded-md bg-green-500 p-3">
              <div class="i-hugeicons-checkmark-circle-02 h-6 w-6 text-white" />
            </div>
            <p class="ml-16 truncate text-sm text-gray-500 font-medium">
              Resolved Issues
            </p>
          </dt>
          <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
            <p class="text-2xl text-gray-900 font-semibold">
              1,624
            </p>
            <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
              <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
              </svg>
              <span class="sr-only">Increased by</span>
              12%
            </p>
          </dd>
        </div>
      </dl>

      <!-- Tabs -->
      <div class="mt-8 border-b border-gray-200 dark:border-blue-gray-600">
        <div class="flex justify-between items-center">
          <nav class="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              @click="activeTab = 'active'"
              :class="[
                activeTab === 'active'
                  ? 'border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium'
              ]"
            >
              Active Errors
              <span
                :class="[
                  activeTab === 'active' ? 'bg-red-100 text-red-600 dark:bg-red-400/10 dark:text-red-400' : 'bg-gray-100 text-gray-900 dark:bg-gray-600 dark:text-gray-300',
                  'ml-3 rounded-full py-0.5 px-2.5 text-xs font-medium'
                ]"
              >
                {{ activeErrors.length }}
              </span>
            </button>

            <button
              @click="activeTab = 'resolved'"
              :class="[
                activeTab === 'resolved'
                  ? 'border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium'
              ]"
            >
              Resolved
              <span
                :class="[
                  activeTab === 'resolved' ? 'bg-blue-100 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400' : 'bg-gray-100 text-gray-900 dark:bg-gray-600 dark:text-gray-300',
                  'ml-3 rounded-full py-0.5 px-2.5 text-xs font-medium'
                ]"
              >
                {{ resolvedErrors.length }}
              </span>
            </button>
          </nav>

          <!-- Environment Filter -->
          <div class="flex items-center">
            <label for="environment-filter" class="mr-2 text-sm font-medium text-gray-700 dark:text-gray-300">Environment:</label>
            <select
              id="environment-filter"
              v-model="selectedEnvironment"
              class="block w-32 rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-gray-100 dark:ring-gray-600"
            >
              <option value="all">All</option>
              <option value="production">Production</option>
              <option value="staging">Staging</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Error List -->
      <div class="mt-8 flow-root">
        <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 dark:ring-blue-gray-700 rounded-lg">
              <table class="min-w-full divide-y divide-gray-300 dark:divide-blue-gray-600">
                <thead class="bg-gray-50 dark:bg-blue-gray-700">
                  <tr>
                    <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 sm:pl-6">Error</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Type</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Environment</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Location</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 text-right">Last Seen</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 text-right">Count</th>
                    <th v-if="activeTab === 'resolved'" scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Resolved</th>
                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span class="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-blue-gray-600 bg-white dark:bg-blue-gray-800">
                  <tr v-for="error in (activeTab === 'active' ? activeErrors : resolvedErrors)"
                      :key="error.id"
                      class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50">
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-100 sm:pl-6">
                      {{ error.message }}
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm">
                      <span :class="['inline-flex items-center rounded-md px-2 py-1 text-xs font-medium', getTypeColor(error.type)]">
                        {{ error.type }}
                      </span>
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm">
                      <span :class="['inline-flex items-center rounded-md px-2 py-1 text-xs font-medium', getEnvironmentColor(error.environment)]">
                        {{ error.environment }}
                      </span>
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm font-mono text-gray-500 dark:text-gray-400">
                      <button
                        @click="openInEditor(error.location)"
                        class="hover:text-blue-600 dark:hover:text-blue-400 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                      >
                        {{ error.location }}
                      </button>
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-right">
                      {{ error.lastSeen }}
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-right">
                      {{ error.count }}
                    </td>
                    <td v-if="activeTab === 'resolved'" class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <div class="flex flex-col">
                        <span>{{ error.resolvedAt }}</span>
                        <span class="text-xs text-gray-400">by {{ error.resolvedBy }}</span>
                      </div>
                    </td>
                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div class="inline-flex rounded-md shadow-sm" role="group">
                        <template v-if="activeTab === 'active'">
                          <Tooltip text="Mark as resolved" position="top" :dark="isDark" :usePortal="true">
                            <button
                              @click="resolveError(error.id)"
                              type="button"
                              class="relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-semibold text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 hover:text-green-600 focus:z-10 dark:text-gray-400 dark:ring-gray-600 dark:hover:bg-gray-700 dark:hover:text-green-400"
                              aria-label="Mark error as resolved"
                            >
                              <div class="i-hugeicons-checkmark-circle-02 h-4 w-4" />
                            </button>
                          </Tooltip>
                          <Tooltip text="Analyze with AI" position="top" :dark="isDark" :usePortal="true">
                            <button
                              @click="analyzeWithAI(error.id)"
                              type="button"
                              :class="[
                                'relative -ml-px inline-flex items-center px-3 py-2 text-sm font-semibold ring-1 ring-inset ring-gray-300 hover:bg-gray-50 hover:text-purple-600 focus:z-10 dark:ring-gray-600 dark:hover:bg-gray-700 dark:hover:text-purple-400',
                                isAiAnalyzing ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 dark:text-gray-400'
                              ]"
                              :disabled="isAiAnalyzing"
                              aria-label="Analyze error with AI"
                            >
                              <div :class="[
                                'h-4 w-4',
                                isAiAnalyzing ? 'i-hugeicons-arrow-path animate-spin' : 'i-hugeicons-sparkles'
                              ]" />
                            </button>
                          </Tooltip>
                        </template>
                        <Tooltip text="Share error details" position="top" :dark="isDark" :usePortal="true">
                          <button
                            type="button"
                            class="relative -ml-px inline-flex items-center px-3 py-2 text-sm font-semibold text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 hover:text-blue-600 focus:z-10 dark:text-gray-400 dark:ring-gray-600 dark:hover:bg-gray-700 dark:hover:text-blue-400"
                            :class="{ 'rounded-l-md': activeTab === 'resolved' }"
                            aria-label="Share error details"
                          >
                            <div class="i-hugeicons-share-01 h-4 w-4" />
                          </button>
                        </Tooltip>
                        <Tooltip text="View error details" position="top" :dark="isDark" :usePortal="true" alignment="right">
                          <button
                            type="button"
                            class="relative -ml-px inline-flex items-center rounded-r-md px-3 py-2 text-sm font-semibold text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 hover:text-indigo-600 focus:z-10 dark:text-gray-400 dark:ring-gray-600 dark:hover:bg-gray-700 dark:hover:text-indigo-400"
                            aria-label="View error details"
                          >
                            <div class="i-hugeicons-view h-4 w-4" />
                          </button>
                        </Tooltip>
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
  </div>
</template>
