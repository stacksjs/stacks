<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Dashboard - Servers',
})

interface ServerConfig {
  name: string
  domain: string
  region: string
  type: string
  size: string
  diskSize: number
  privateNetwork?: string
  subnet?: string
  serverOS: string
  bunVersion?: string
  database?: string
  databaseName?: string
  searchEngine?: string
  userData?: string
}

const servers = ref<Record<string, ServerConfig>>({
  app1: {
    name: 'app-cosmic-nebula',
    domain: 'stacksjs.org',
    region: 'us-east-1',
    type: 'app',
    size: 't3.micro',
    diskSize: 20,
    serverOS: 'ubuntu-24-lts-x86_64',
    bunVersion: 'v1.2.3',
    database: 'sqlite',
    databaseName: 'stacks',
    searchEngine: 'meilisearch'
  }
})

const sortKey = ref<keyof ServerConfig>('name')
const sortOrder = ref<'asc' | 'desc'>('asc')

const setSorting = (key: keyof ServerConfig) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'asc'
  }
}

const sortedServers = computed(() => {
  return Object.entries(servers.value).sort(([, a], [, b]) => {
    const aValue = a[sortKey.value]
    const bValue = b[sortKey.value]

    if (aValue === bValue) return 0
    if (sortOrder.value === 'asc') {
      return aValue < bValue ? -1 : 1
    }
    return aValue < bValue ? 1 : -1
  })
})

const searchQuery = ref('')
const filteredServers = computed(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) return sortedServers.value

  return sortedServers.value.filter(([, server]) => {
    return (
      server.name.toLowerCase().includes(query) ||
      server.domain.toLowerCase().includes(query) ||
      server.type.toLowerCase().includes(query) ||
      server.region.toLowerCase().includes(query)
    )
  })
})
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="px-4 lg:px-8 sm:px-6">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2">
            <div>
              <h3 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
                Servers
              </h3>
              <p class="mt-2 text-sm text-gray-700 dark:text-gray-400">
                Manage all your application servers.
              </p>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <router-link
              to="/cloud"
              class="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200"
            >
              <div class="i-heroicons-arrow-left w-4 h-4"></div>
              Back to Dashboard
            </router-link>
          </div>
        </div>
      </div>

      <!-- Search and Filters -->
      <div class="mb-6">
        <div class="flex items-center gap-4">
          <div class="flex-1">
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <div class="i-heroicons-magnifying-glass w-5 h-5 text-gray-400"></div>
              </div>
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search servers..."
                class="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-blue-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Servers Table -->
      <div class="bg-white dark:bg-blue-gray-700 shadow rounded-lg overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
            <thead class="bg-gray-50 dark:bg-blue-gray-800">
              <tr>
                <th
                  v-for="header in ['Name', 'Type', 'Region', 'Size', 'OS', 'Database', 'Search']"
                  :key="header"
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                  @click="setSorting(header.toLowerCase() as keyof ServerConfig)"
                >
                  <div class="flex items-center gap-1">
                    {{ header }}
                    <div
                      v-if="sortKey === header.toLowerCase()"
                      class="w-4 h-4"
                      :class="sortOrder === 'asc' ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                    ></div>
                  </div>
                </th>
                <th scope="col" class="relative px-6 py-3">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-blue-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
              <tr v-for="[key, server] in filteredServers" :key="key" class="hover:bg-gray-50 dark:hover:bg-blue-gray-600">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {{ server.name }}
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                    :class="{
                      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300': server.type === 'app',
                      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300': server.type === 'web',
                      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300': server.type === 'worker',
                      'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300': server.type === 'cache',
                      'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300': server.type === 'database',
                      'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300': server.type === 'search',
                    }"
                  >
                    {{ server.type }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ server.region }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ server.size }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ server.serverOS }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ server.database || 'None' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ server.searchEngine || 'None' }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <router-link
                    :to="`/servers/${key}`"
                    class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Edit
                  </router-link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
