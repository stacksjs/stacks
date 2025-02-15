<script lang="ts" setup>
import { ref } from 'vue'
import { useHead } from '@vueuse/head' // Make sure this is installed

// Set page title
useHead({
  title: 'Dashboard - Errors',
})

interface ErrorStats {
  total: number
  resolved: number
  totalChange: number
  resolvedChange: number
}

interface Error {
  message: string
  type: string
  environment: string
  location: string
  lastSeen: string
  count: number
}

// Mock data
const errorStats = ref<ErrorStats>({
  total: 2847,
  resolved: 1624,
  totalChange: -24,
  resolvedChange: 12,
})

const errors = ref<Error[]>([
  {
    message: 'Undefined variable $user',
    type: 'PHP Exception',
    environment: 'production',
    location: 'UserAction.ts:42',
    lastSeen: '2 minutes ago',
    count: 36,
  },
  {
    message: "Cannot read property 'length' of undefined",
    type: 'JavaScript Error',
    environment: 'staging',
    location: 'main.js:156',
    lastSeen: '15 minutes ago',
    count: 22,
  },
  {
    message: 'Database connection failed',
    type: 'Fatal Error',
    environment: 'production',
    location: 'DatabaseService.php:89',
    lastSeen: '1 hour ago',
    count: 15,
  },
])

const getTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    'PHP Exception': 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-400/10',
    'JavaScript Error': 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-400/10',
    'Fatal Error': 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-400/10',
  }
  return colors[type] || 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-400/10'
}

const getEnvironmentColor = (env: string): string => {
  const colors: Record<string, string> = {
    production: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-400/10',
    staging: 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-400/10',
    development: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-400/10',
  }
  return colors[env] || 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-400/10'
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
      <dl class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div class="relative overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 px-4 pb-12 pt-5 shadow sm:px-6 sm:pt-6">
          <dt>
            <div class="absolute rounded-md bg-red-500 p-3">
              <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <p class="ml-16 truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Unresolved Errors</p>
          </dt>
          <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
            <p class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{{ errorStats.total }}</p>
            <p :class="[
              'ml-2 flex items-baseline text-sm font-semibold',
              errorStats.totalChange > 0 ? 'text-red-600' : 'text-green-600'
            ]">
              <span v-if="errorStats.totalChange < 0" class="i-heroicons-arrow-down h-5 w-5 flex-shrink-0 self-center text-green-500" />
              <span v-else class="i-heroicons-arrow-up h-5 w-5 flex-shrink-0 self-center text-red-500" />
              {{ Math.abs(errorStats.totalChange) }}%
            </p>
          </dd>
        </div>

        <div class="relative overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 px-4 pb-12 pt-5 shadow sm:px-6 sm:pt-6">
          <dt>
            <div class="absolute rounded-md bg-green-500 p-3">
              <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p class="ml-16 truncate text-sm font-medium text-gray-500 dark:text-gray-400">Resolved Issues</p>
          </dt>
          <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
            <p class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{{ errorStats.resolved }}</p>
            <p :class="[
              'ml-2 flex items-baseline text-sm font-semibold',
              errorStats.resolvedChange > 0 ? 'text-green-600' : 'text-red-600'
            ]">
              <span v-if="errorStats.resolvedChange > 0" class="i-heroicons-arrow-up h-5 w-5 flex-shrink-0 self-center text-green-500" />
              <span v-else class="i-heroicons-arrow-down h-5 w-5 flex-shrink-0 self-center text-red-500" />
              {{ Math.abs(errorStats.resolvedChange) }}%
            </p>
          </dd>
        </div>
      </dl>

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
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Last Seen</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Count</th>
                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span class="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-blue-gray-600 bg-white dark:bg-blue-gray-800">
                  <tr v-for="error in errors" :key="error.message" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50">
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
                      {{ error.location }}
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {{ error.lastSeen }}
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {{ error.count }}
                    </td>
                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div class="flex items-center justify-end space-x-2">
                        <button class="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300">
                          Resolve
                        </button>
                        <button class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                          Share
                        </button>
                        <button class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300">
                          View
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
  </div>
</template>
