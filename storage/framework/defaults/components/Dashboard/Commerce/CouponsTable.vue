<script lang="ts" setup>
import type { Coupons } from '../../../types/defaults'

interface Props {
  coupons: Coupons[]
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
  (e: 'viewCoupon', coupon: Coupons): void
  (e: 'editCoupon', coupon: Coupons): void
  (e: 'deleteCoupon', coupon: Coupons): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Event handlers
function handleToggleSort(column: string): void {
  emit('toggleSort', column)
}

function handleViewCoupon(coupon: Coupons): void {
  emit('viewCoupon', coupon)
}

function handleEditCoupon(coupon: Coupons): void {
  emit('editCoupon', coupon)
}

function handleDeleteCoupon(coupon: Coupons): void {
  emit('deleteCoupon', coupon)
}

function getStatus(status: string | string[]): string {
  const statusStr = Array.isArray(status) ? status[0] : status

  if (!statusStr)
    return 'N/A'

  return statusStr
}

// Get status badge class
function getStatusClass(status: string | string[]): string {
  const statusStr = Array.isArray(status) ? status[0] : status
  
  switch (statusStr) {
    case 'Active':
      return 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400'
    case 'Expired':
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
    case 'Scheduled':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400'
    default:
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
  }
}
</script>

<template>
  <!-- Coupons table -->
  <div class="overflow-hidden">
    <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
      <thead class="bg-gray-50 dark:bg-blue-gray-700">
        <tr>
          <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-gray-200">
            <button @click="handleToggleSort('code')" class="group inline-flex items-center">
              Coupon Code
              <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                <div v-if="props.sortBy === 'code'" :class="[
                  props.sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                  'h-4 w-4'
                ]"></div>
                <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
              </span>
            </button>
          </th>
          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Type</th>
          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
            <button @click="handleToggleSort('discount_value')" class="group inline-flex items-center">
              Value
              <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                <div v-if="props.sortBy === 'discount_value'" :class="[
                  props.sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                  'h-4 w-4'
                ]"></div>
                <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
              </span>
            </button>
          </th>
          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Min Order Amount</th>
          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
            <button @click="handleToggleSort('usage_count')" class="group inline-flex items-center">
              Usage
              <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                <div v-if="props.sortBy === 'usage_count'" :class="[
                  props.sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                  'h-4 w-4'
                ]"></div>
                <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
              </span>
            </button>
          </th>
          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
            <button @click="handleToggleSort('end_date')" class="group inline-flex items-center">
              Expiry
              <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                <div v-if="props.sortBy === 'end_date'" :class="[
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
        <tr v-for="coupon in coupons" :key="coupon.id">
          <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 dark:text-white">
            {{ coupon.code }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
            {{ coupon.discount_type }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
            {{ coupon.discount_type === 'Percentage' ? `${coupon.discount_value}%` : `$${coupon.discount_value.toFixed(2)}` }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
            {{ coupon.min_order_amount > 0 ? `$${coupon.min_order_amount.toFixed(2)}` : 'None' }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
            {{ coupon.usage_count }} / {{ coupon.usage_limit }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
            {{ coupon.end_date }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm">
            <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium" :class="getStatusClass(getStatus(coupon.status))">
              {{ getStatus(coupon.status) }}
            </span>
          </td>
          <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
            <div class="flex items-center justify-end space-x-2">
              <button 
                type="button" 
                @click="handleViewCoupon(coupon)"
                class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <div class="i-hugeicons-view h-5 w-5"></div>
              </button>
              <button 
                type="button" 
                @click="handleEditCoupon(coupon)"
                class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <div class="i-hugeicons-edit-01 h-5 w-5"></div>
              </button>
              <button 
                type="button" 
                @click="handleDeleteCoupon(coupon)"
                class="text-red-400 transition-colors duration-150 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                title="Delete coupon"
              >
                <div class="i-hugeicons-waste h-5 w-5"></div>
              </button>
            </div>
          </td>
        </tr>
        <tr v-if="coupons.length === 0">
          <td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            No coupons found matching your criteria
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
