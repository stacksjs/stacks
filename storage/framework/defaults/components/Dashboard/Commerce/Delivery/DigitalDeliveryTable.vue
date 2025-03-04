<template>
  <div class="mt-6 flow-root">
    <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
      <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
        <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-blue-gray-700">
              <tr>
                <th scope="col" class="py-4 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Name</th>
                <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Description</th>
                <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Download Limit</th>
                <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Expiry Days</th>
                <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Requires Login</th>
                <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Automatic Delivery</th>
                <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                <th scope="col" class="relative py-4 pl-3 pr-4 sm:pr-6">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
              <tr v-for="method in methods" :key="method.id">
                <td class="whitespace-nowrap py-4.5 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                  {{ method.name }}
                </td>
                <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                  {{ method.description }}
                </td>
                <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                  {{ formatLimit(method.downloadLimit) }}
                </td>
                <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                  {{ formatExpiry(method.expiryDays) }}
                </td>
                <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                  {{ method.requiresLogin ? 'Yes' : 'No' }}
                </td>
                <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                  {{ method.automaticDelivery ? 'Yes' : 'No' }}
                </td>
                <td class="whitespace-nowrap px-4 py-4.5 text-sm">
                  <span
                    class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                    :class="{
                      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300': method.status === 'Active',
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300': method.status === 'Inactive'
                    }"
                  >
                    {{ method.status }}
                  </span>
                </td>
                <td class="relative whitespace-nowrap py-4.5 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <button type="button" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-2 rounded-md border border-transparent hover:border-blue-200 dark:hover:border-blue-800 mr-2" title="Edit" @click="$emit('edit', method)">
                    <div class="i-hugeicons-edit-01 h-5 w-5" />
                  </button>
                  <button type="button" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-2 rounded-md border border-transparent hover:border-red-200 dark:hover:border-red-800" title="Delete" @click="$emit('delete', method)">
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
interface DigitalDeliveryMethod {
  id: number
  name: string
  description: string
  downloadLimit: number | null
  expiryDays: number | null
  requiresLogin: boolean
  automaticDelivery: boolean
  status: string
}

defineProps({
  methods: {
    type: Array as () => DigitalDeliveryMethod[],
    required: true
  }
})

defineEmits(['edit', 'delete'])

const formatLimit = (value: number | null) => {
  return value !== null ? value.toString() : 'Unlimited'
}

const formatExpiry = (days: number | null) => {
  return days !== null ? `${days} days` : 'Never expires'
}
</script>
