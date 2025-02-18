<script setup lang="ts">
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Dashboard - Workers',
})

interface WorkerConfig {
  name: string
  size: string
  replicas: number
  specs: {
    vcpu: number
    ram: number
  }
}

const workers = ref<WorkerConfig[]>([
  {
    name: 'worker-stellar-nova',
    size: 't3.micro',
    replicas: 3,
    specs: {
      vcpu: 2,
      ram: 1024
    }
  }
])

const sortKey = ref<keyof WorkerConfig>('name')
const sortOrder = ref<'asc' | 'desc'>('asc')

const setSorting = (key: keyof WorkerConfig) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'asc'
  }
}

const sortedWorkers = computed(() => {
  return [...workers.value].sort((a, b) => {
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
const filteredWorkers = computed(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) return sortedWorkers.value

  return sortedWorkers.value.filter(worker => {
    return (
      worker.name.toLowerCase().includes(query) ||
      worker.size.toLowerCase().includes(query)
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
                Workers
              </h3>
              <p class="mt-2 text-sm text-gray-700 dark:text-gray-400">
                Manage your worker processes.
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
                placeholder="Search workers..."
                class="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-blue-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Workers Table -->
      <div class="bg-white dark:bg-blue-gray-700 shadow rounded-lg overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
            <thead class="bg-gray-50 dark:bg-blue-gray-800">
              <tr>
                <th
                  v-for="header in ['Name', 'Size', 'Replicas', 'vCPU', 'RAM']"
                  :key="header"
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                  @click="setSorting(header.toLowerCase() as keyof WorkerConfig)"
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
              <tr v-for="(worker, index) in filteredWorkers" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-600">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {{ worker.name }}
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ worker.size }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ worker.replicas }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ worker.specs.vcpu }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {{ (worker.specs.ram / 1024).toFixed(1) }}GB
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <router-link
                    :to="`/workers/${index}`"
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
