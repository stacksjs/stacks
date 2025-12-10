<script lang="ts" setup>
import type { Customers } from '../../../types/defaults'

interface Props {
  customers: Customers[]
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
  (e: 'viewCustomer', customer: Customers): void
  (e: 'editCustomer', customer: Customers): void
  (e: 'deleteCustomer', customer: Customers): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Event handlers
function handleToggleSort(column: string): void {
  emit('toggleSort', column)
}

function handleViewCustomer(customer: Customers): void {
  emit('viewCustomer', customer)
}

function handleEditCustomer(customer: Customers): void {
  emit('editCustomer', customer)
}

function handleDeleteCustomer(customer: Customers): void {
  emit('deleteCustomer', customer)
}

// Get status badge class
function getStatusClass(status: string | string[]): string {
  const statusStr = Array.isArray(status) ? status[0] : status
  switch (statusStr) {
    case 'Active':
      return 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400'
    case 'Inactive':
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
    default:
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
  }
}
</script>

<template>
  <!-- Customers table -->
  <div class="overflow-hidden">
    <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
      <thead class="bg-gray-50 dark:bg-blue-gray-700">
        <tr>
          <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-gray-200">
            <button @click="handleToggleSort('name')" class="group inline-flex items-center">
              Customer
              <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                <div v-if="props.sortBy === 'name'" :class="[
                  props.sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                  'h-4 w-4'
                ]"></div>
                <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
              </span>
            </button>
          </th>
          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Contact</th>
          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
            <button @click="handleToggleSort('total_spent')" class="group inline-flex items-center">
              Total Spent
              <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                <div v-if="props.sortBy === 'total_spent'" :class="[
                  props.sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                  'h-4 w-4'
                ]"></div>
                <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
              </span>
            </button>
          </th>
          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
            <button @click="handleToggleSort('last_order')" class="group inline-flex items-center">
              Last Order
              <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus-visible">
                <div v-if="props.sortBy === 'last_order'" :class="[
                  props.sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                  'h-4 w-4'
                ]"></div>
                <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
              </span>
            </button>
          </th>
          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Status</th>
          <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
            <span class="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-blue-gray-800">
        <tr v-for="customer in customers" :key="customer.id">
          <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 dark:text-white">
            <div class="flex items-center">
              <img :src="customer.avatar" alt="" class="h-10 w-10 flex-shrink-0 rounded-full">
              <div class="ml-4">
                <div>{{ customer.name }}</div>
                <div class="text-gray-500 dark:text-gray-400 text-xs">ID: {{ customer.id }}</div>
              </div>
            </div>
          </td>
          <td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
            <div>{{ customer.email }}</div>
            <div>{{ customer.phone }}</div>
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
            ${{ (customer.total_spent ?? 0).toFixed(2) }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
            {{ customer.last_order || 'Never' }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm">
            <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium" :class="getStatusClass(customer.status)">
              {{ customer.status }}
            </span>
          </td>
          <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
            <div class="flex items-center justify-end space-x-2">
              <button 
                type="button" 
                @click="handleViewCustomer(customer)"
                class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <div class="i-hugeicons-view h-5 w-5"></div>
              </button>
              <button 
                type="button" 
                @click="handleEditCustomer(customer)"
                class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <div class="i-hugeicons-edit-01 h-5 w-5"></div>
              </button>
              <button 
                type="button" 
                @click="handleDeleteCustomer(customer)"
                class="text-red-400 transition-colors duration-150 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                title="Delete customer"
              >
                <div class="i-hugeicons-waste h-5 w-5"></div>
              </button>
            </div>
          </td>
        </tr>
        <tr v-if="customers.length === 0">
          <td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            No customers found matching your criteria
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
