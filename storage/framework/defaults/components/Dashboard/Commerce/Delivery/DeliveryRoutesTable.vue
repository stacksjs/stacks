<template>
  <div class="mt-8 flow-root">
    <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
      <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
        <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
          <thead>
            <tr>
              <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Route ID</th>
              <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Driver</th>
              <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Vehicle</th>
              <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Start Location</th>
              <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Stops</th>
              <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Avg. Delivery Time</th>
              <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Total Distance</th>
              <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Last Active</th>
              <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span class="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
            <tr v-for="route in routes" :key="route.id">
              <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                {{ route.id }}
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                {{ route.driver }}
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                {{ route.vehicle }}
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                {{ route.startLocation }}
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                {{ route.stops }}
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                {{ route.avgDeliveryTime }} hours
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                {{ route.totalDistance }} km
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                {{ formatDate(route.lastActive) }}
              </td>
              <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                <button type="button" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-md border border-transparent hover:border-blue-200 dark:hover:border-blue-800 mr-2" @click="$emit('view-map', route)" title="View Map">
                  <div class="i-hugeicons-map-01 h-5 w-5" />
                </button>
                <button type="button" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-md border border-transparent hover:border-blue-200 dark:hover:border-blue-800 mr-2" title="Edit" @click="$emit('edit', route)">
                  <div class="i-hugeicons-edit-01 h-5 w-5" />
                </button>
                <button type="button" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-2 rounded-md border border-transparent hover:border-red-200 dark:hover:border-red-800" title="Delete" @click="$emit('delete', route)">
                  <div class="i-hugeicons-waste h-5 w-5" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface DeliveryRoute {
  id: number
  driver: string
  vehicle: string
  startLocation: string
  stops: number
  avgDeliveryTime: number
  totalDistance: number
  lastActive: Date | string
}

defineProps({
  routes: {
    type: Array as () => DeliveryRoute[],
    required: true
  }
})

defineEmits(['view-map', 'edit', 'delete'])

const formatDate = (date: Date | string) => {
  if (!date) return 'N/A'

  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}
</script>
