<template>
  <div class="overflow-hidden">
    <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
      <thead class="bg-gray-50 dark:bg-blue-gray-700">
        <tr>
          <th scope="col" class="py-4 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Key</th>
          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Template</th>
          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Customer</th>
          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Product</th>
          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Order ID</th>
          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Date Created</th>
          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Expiry Date</th>
          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
        <tr v-for="licenseKey in licenseKeys" :key="licenseKey.id">
          <td class="whitespace-nowrap py-4.5 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
            {{ licenseKey.key }}
          </td>
          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
            {{ licenseKey.template }}
          </td>
          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
            {{ licenseKey.customer.name }}
            <div class="text-xs text-gray-400 dark:text-gray-500">{{ licenseKey.customer.email }}</div>
          </td>
          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
            {{ licenseKey.product }}
          </td>
          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
            {{ licenseKey.order_id }}
          </td>
          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
            {{ formatDate(licenseKey.created_at) }}
          </td>
          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
            {{ formatDate(licenseKey.expiry_date) }}
          </td>
          <td class="whitespace-nowrap px-4 py-4.5 text-sm">
            <span
              class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
              :class="statusClass(licenseKey.status)"
            >
              {{ uppercaseFirstLetter(licenseKey.status) }}
            </span>
          </td>
          <td class="relative whitespace-nowrap py-4.5 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
            <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-md border border-transparent hover:border-blue-200 dark:hover:border-blue-800 mr-2" @click="$emit('view', licenseKey)" title="View">
              <div class="i-hugeicons-view h-5 w-5" />
            </button>
            <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-md border border-transparent hover:border-blue-200 dark:hover:border-blue-800 mr-2" @click="$emit('edit', licenseKey)" title="Edit">
              <div class="i-hugeicons-edit-01 h-5 w-5" />
            </button>
            <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-2 rounded-md border border-transparent hover:border-red-200 dark:hover:border-red-800" @click="$emit('delete', licenseKey)" title="Delete">
              <div class="i-hugeicons-waste h-5 w-5" />
            </button>
          </td>
        </tr>
        <tr v-if="licenseKeys.length === 0">
          <td colspan="9" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            No license keys found
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { LicenseKeys } from '../../../../types/defaults'

defineProps({
  licenseKeys: {
    type: Array as () => LicenseKeys[],
    required: true
  }
})

defineEmits(['view', 'edit', 'delete'])

function statusClass(status: string) {
  switch (status.toLowerCase()) {
    case 'active':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'inactive':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    case 'revoked':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    case 'expired':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

function uppercaseFirstLetter(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString()
}
</script>
