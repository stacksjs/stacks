<script lang="ts" setup>
import type { Orders } from '../../../types/defaults'

// Define props interface
interface Props {
  orders: Orders[]
  searchQuery: string
  statusFilter: string
  sortBy: string
  sortOrder: string
  currentPage: number
  itemsPerPage: number
  statuses: readonly string[]
}

interface Emits {
  (e: 'toggleSort', column: string): void
  (e: 'changePage', page: number): void
  (e: 'previousPage'): void
  (e: 'nextPage'): void
  (e: 'viewOrder', order: Orders): void
  (e: 'editOrder', order: Orders): void
  (e: 'deleteOrder', order: Orders): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Event handlers
function handleToggleSort(column: string): void {
  emit('toggleSort', column)
}

function handleViewOrder(order: Orders): void {
  emit('viewOrder', order)
}

function handleEditOrder(order: Orders): void {
  emit('editOrder', order)
}

function handleDeleteOrder(order: Orders): void {
  emit('deleteOrder', order)
}

// Get status badge class
function getStatusClass(status: string): string {
  switch (status) {
    case 'Completed':
      return 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400'
    case 'Processing':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400'
    case 'Shipped':
      return 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'Cancelled':
      return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400'
    case 'Refunded':
      return 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20 dark:bg-purple-900/30 dark:text-purple-400'
    default:
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
  }
}
</script>

<template>
  <!-- Orders table -->
  <div class="overflow-hidden">
    <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
      <thead class="bg-gray-50 dark:bg-blue-gray-700">
        <tr>
          <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-gray-200">
            Order ID
          </th>
          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
            Customer Info
          </th>
          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
            Date
          </th>
          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
            <button @click="handleToggleSort('total_amount')" class="group inline-flex items-center">
              Total
              <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                <div v-if="props.sortBy === 'total_amount'" :class="[
                  props.sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                  'h-4 w-4'
                ]"></div>
                <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
              </span>
            </button>
          </th>
          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Status</th>
          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Type</th>
          <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
            <span class="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-blue-gray-800">
        <tr v-for="order in orders" :key="order.id">
          <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 dark:text-white">
            #{{ order.id }}
          </td>
          <td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
            <div>Customer ID: {{ order.customer_id }}</div>
            <div class="text-xs text-gray-400">Order Type: {{ order.order_type }}</div>
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
            {{ new Date().toLocaleDateString() }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
            ${{ order.total_amount.toFixed(2) }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm">
            <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium" :class="getStatusClass(order.status)">
              {{ order.status }}
            </span>
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
            {{ order.order_type }}
          </td>
          <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
            <div class="flex items-center justify-end space-x-2">
              <button 
                type="button" 
                @click="handleViewOrder(order)"
                class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                title="View order"
              >
                <div class="i-hugeicons-view h-5 w-5"></div>
              </button>
              <button 
                type="button" 
                @click="handleEditOrder(order)"
                class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                title="Edit order"
              >
                <div class="i-hugeicons-edit-01 h-5 w-5"></div>
              </button>
              <button 
                type="button" 
                @click="handleDeleteOrder(order)"
                class="text-red-400 transition-colors duration-150 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                title="Delete order"
              >
                <div class="i-hugeicons-waste h-5 w-5"></div>
              </button>
            </div>
          </td>
        </tr>
        <tr v-if="orders.length === 0">
          <td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            No orders found matching your criteria
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template> 