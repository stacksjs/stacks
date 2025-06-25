<template>
  <div class="overflow-hidden">
    <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
      <thead class="bg-gray-50 dark:bg-blue-gray-700">
        <tr>
          <th scope="col" class="py-4 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Name</th>
          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Format</th>
          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Prefix</th>
          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Segments</th>
          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Character Set</th>
          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
          <th scope="col" class="relative py-4 pl-3 pr-4 sm:pr-6">
            <span class="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
        <tr v-for="template in templates" :key="template.id">
          <td class="whitespace-nowrap py-4.5 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
            {{ template.name }}
          </td>
          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
            {{ template.format }}
          </td>
          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
            {{ template.prefix || 'None' }}
          </td>
          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
            {{ template.segment_count }} × {{ template.segment_length }}
          </td>
          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
            {{ template.char_set.length }} chars
          </td>
          <td class="whitespace-nowrap px-4 py-4.5 text-sm">
            <span
              class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
              :class="statusClass(template.active, template.status)"
            >
              {{ getStatusText(template.active, template.status) }}
            </span>
          </td>
          <td class="relative whitespace-nowrap py-4.5 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
            <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-md border border-transparent hover:border-blue-200 dark:hover:border-blue-800 mr-2" @click="$emit('view', template)" title="View">
              <div class="i-hugeicons-view h-5 w-5" />
            </button>
            <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-md border border-transparent hover:border-blue-200 dark:hover:border-blue-800 mr-2" @click="$emit('edit', template)" title="Edit">
              <div class="i-hugeicons-edit-01 h-5 w-5" />
            </button>
            <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-2 rounded-md border border-transparent hover:border-red-200 dark:hover:border-red-800" @click="$emit('delete', template)" title="Delete">
              <div class="i-hugeicons-waste h-5 w-5" />
            </button>
          </td>
        </tr>
        <tr v-if="templates.length === 0">
          <td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            No license templates found
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { LicenseTemplates } from '../../../../types/defaults'

defineProps({
  templates: {
    type: Array as () => LicenseTemplates[],
    required: true
  }
})

defineEmits(['view', 'edit', 'delete'])

function statusClass(active: boolean, status?: string | string[]) {
  if (status) {
    const statusStr = Array.isArray(status) ? (status.length > 0 ? status[0] : undefined) : status
    if (statusStr) {
      switch (statusStr.toLowerCase()) {
        case 'active':
          return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
        case 'inactive':
          return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
        default:
          return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      }
    }
  }
  
  return active 
    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
}

function getStatusText(active: boolean, status?: string | string[]) {
  if (status) {
    const statusStr = Array.isArray(status) ? (status.length > 0 ? status[0] : undefined) : status
    if (statusStr) {
      return statusStr.charAt(0).toUpperCase() + statusStr.slice(1)
    }
  }
  
  return active ? 'Active' : 'Inactive'
}
</script>
