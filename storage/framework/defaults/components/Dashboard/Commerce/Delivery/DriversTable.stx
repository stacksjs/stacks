<template>
  <div class="mt-6 flow-root">
    <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
      <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
        <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-blue-gray-700">
              <tr>
                <th scope="col" class="py-4 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">ID</th>
                <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Name</th>
                <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Phone</th>
                <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Vehicle</th>
                <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">License</th>
                <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white text-right">Last Active</th>
                <th scope="col" class="relative py-4 pl-3 pr-4 sm:pr-6">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
              <tr v-for="driver in drivers" :key="driver.id">
                <td class="whitespace-nowrap py-4.5 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                  {{ driver.id }}
                </td>
                <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                  <div class="flex items-center">
                    <div class="h-10 w-10 flex-shrink-0">
                      <img
                        :src="driver.avatar || 'https://carefreeagency-eliinova.s3.amazonaws.com/images/avatar/default.svg'"
                        alt=""
                        class="h-10 w-10 rounded-full"
                      >
                    </div>
                    <div class="ml-4">
                      <div class="font-medium text-gray-900 dark:text-white">{{ driver.name }}</div>
                    </div>
                  </div>
                </td>
                <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                  {{ driver.phone }}
                </td>
                <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                  {{ driver.vehicle_number }}
                </td>
                <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                  {{ driver.license }}
                </td>
                <td class="whitespace-nowrap px-4 py-4.5 text-sm">
                  <span :class="[
                    'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium',
                    driver.status === 'Active' ? 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400' :
                    driver.status === 'On Delivery' ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400' :
                    driver.status === 'On Break' ? 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400'
                  ]">
                    {{ driver.status }}
                  </span>
                </td>
                <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300 text-right">
                  {{ formatDate(driver.last_active) }}
                </td>
                <td class="relative whitespace-nowrap py-4.5 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-md border border-transparent hover:border-blue-200 dark:hover:border-blue-800 mr-2" @click="$emit('view-routes', driver)" title="View Routes">
                    <div class="i-hugeicons-route-02 h-5 w-5" />
                  </button>
                  <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-md border border-transparent hover:border-blue-200 dark:hover:border-blue-800 mr-2" title="Edit" @click="$emit('edit', driver)">
                    <div class="i-hugeicons-edit-01 h-5 w-5" />
                  </button>
                  <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-2 rounded-md border border-transparent hover:border-red-200 dark:hover:border-red-800" title="Delete" @click="$emit('delete', driver)">
                    <div class="i-hugeicons-waste h-5 w-5" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Drivers } from '../../../../types/defaults'

defineProps({
  drivers: {
    type: Array as () => Drivers[],
    required: true
  }
})

defineEmits(['view-routes', 'edit', 'delete'])

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
