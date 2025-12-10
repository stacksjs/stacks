<script setup lang="ts">
interface Props {
  status: 'sent' | 'delivered' | 'failed' | 'pending'
}

const props = defineProps<Props>()

// Status colors
const notificationStatusColors: Record<string, string> = {
  delivered: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/50 ring-green-600/20',
  sent: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/50 ring-blue-600/20',
  pending: 'text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/50 ring-yellow-600/20',
  failed: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/50 ring-red-600/20',
}

const getStatusColor = (status: string): string => {
  return notificationStatusColors[status] || 'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 ring-gray-600/20'
}
</script>

<template>
  <span
    class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset"
    :class="getStatusColor(props.status)"
  >
    {{ props.status }}
  </span>
</template>
