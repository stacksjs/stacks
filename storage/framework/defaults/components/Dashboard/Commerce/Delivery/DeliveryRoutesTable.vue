<template>
  <div class="overflow-hidden">
    <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
      <thead class="bg-gray-50 dark:bg-blue-gray-700">
        <tr>
          <th scope="col" class="py-4 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Route ID</th>
          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Driver</th>
          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Vehicle</th>
          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Stops</th>
          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Delivery Time</th>
          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Total Distance</th>
          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white text-right">Last Active</th>
          <th scope="col" class="relative py-4 pl-3 pr-4 sm:pr-6 text-right">
            <span class="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
        <tr v-for="route in routes" :key="route.id">
          <td class="whitespace-nowrap py-4.5 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
            {{ route.id }}
          </td>
          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
            {{ route.driver }}
          </td>
          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
            {{ route.vehicle }}
          </td>
          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
            {{ route.stops }}
          </td>
          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
            {{ route.delivery_time }} hours
          </td>
          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
            {{ route.total_distance }} km
          </td>
          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300 text-right">
            {{ formatDate(route.last_active) }}
          </td>
          <td class="relative whitespace-nowrap py-4.5 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
            <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-md border border-transparent hover:border-blue-200 dark:hover:border-blue-800 mr-2" @click="$emit('view-map', route)" title="View Map">
              <div class="i-hugeicons-route-02 h-5 w-5" />
            </button>
            <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-md border border-transparent hover:border-blue-200 dark:hover:border-blue-800 mr-2" title="Edit" @click="$emit('edit', route)">
              <div class="i-hugeicons-edit-01 h-5 w-5" />
            </button>
            <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-2 rounded-md border border-transparent hover:border-red-200 dark:hover:border-red-800" title="Delete" @click="$emit('delete', route)">
              <div class="i-hugeicons-waste h-5 w-5" />
            </button>
          </td>
        </tr>
        <tr v-if="routes.length === 0">
          <td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            No delivery routes found
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { DeliveryRoutes } from '../../../../types/defaults'

defineProps({
  routes: {
    type: Array as () => DeliveryRoutes[],
    required: true
  }
})

defineEmits(['view-map', 'edit', 'delete'])

const formatDate = (date: Date | string | null | undefined): string => {
  if (!date) return 'N/A'

  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
</script>
