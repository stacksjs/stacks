<script lang="ts" setup>
import type { Products } from '../../../types/defaults'

interface Props {
  products: Products[]
  searchQuery: string
  categoryFilter: string
  sortBy: string
  sortOrder: string
  currentPage: number
  itemsPerPage: number
  categories: readonly string[]
}

interface Emits {
  (e: 'toggleSort', column: string): void
  (e: 'changePage', page: number): void
  (e: 'previousPage'): void
  (e: 'nextPage'): void
  (e: 'viewProduct', product: Products): void
  (e: 'editProduct', product: Products): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

// Event handlers
function handleToggleSort(column: string): void {
  emit('toggleSort', column)
}

function handleViewProduct(product: Products): void {
  emit('viewProduct', product)
}

function handleEditProduct(product: Products): void {
  emit('editProduct', product)
}

// Get status badge class based on availability
function getStatusClass(isAvailable: number): string {
  switch (isAvailable) {
    case 1:
      return 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400'
    case 0:
      return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400'
    default:
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

// Get status text based on availability
function getStatusText(isAvailable: number): string {
  return isAvailable === 1 ? 'Available' : 'Unavailable'
}

// Format date
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString()
}
</script>

<template>
  <!-- Products table -->
  <div class="overflow-hidden">
    <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
      <thead class="bg-gray-50 dark:bg-blue-gray-700">
        <tr>
          <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-gray-200">
            <button @click="handleToggleSort('name')" class="group inline-flex items-center">
              Product
              <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                <div v-if="sortBy === 'name'" :class="[
                  sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                  'h-4 w-4'
                ]"></div>
                <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
              </span>
            </button>
          </th>
          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Manufacturer</th>
          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Category</th>
          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
            <button @click="handleToggleSort('price')" class="group inline-flex items-center">
              Price
              <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                <div v-if="sortBy === 'price'" :class="[
                  sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                  'h-4 w-4'
                ]"></div>
                <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
              </span>
            </button>
          </th>
          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Status</th>
          <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-200">Inventory</th>
          <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-200">
            <button @click="handleToggleSort('created_at')" class="group inline-flex items-center">
              Created At
              <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                <div v-if="sortBy === 'created_at'" :class="[
                  sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                  'h-4 w-4'
                ]"></div>
                <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
              </span>
            </button>
          </th>
          <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
            <span class="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-blue-gray-800">
        <tr v-for="product in products" :key="product.id" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700">
          <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
            <div class="flex items-center">
              <div class="h-10 w-10 flex-shrink-0">
                <img :src="product.image_url" :alt="product.name" class="h-10 w-10 rounded-md object-cover" />
              </div>
              <div class="ml-4">
                <div class="font-medium text-gray-900 dark:text-white">{{ product.name }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {{ product.description.substring(0, 50) }}{{ product.description.length > 50 ? '...' : '' }}
                </div>
              </div>
            </div>
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
            {{ product.manufacturer?.name || 'N/A' }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
            {{ product.category?.name || 'N/A' }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm">
            <div class="font-medium text-gray-900 dark:text-white">${{ product.price.toFixed(2) }}</div>
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm">
            <span :class="[getStatusClass(product.is_available), 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium']">
              {{ getStatusText(product.is_available) }}
            </span>
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-right">{{ product.inventory_count }}</td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-right">{{ formatDate(product.created_at) }}</td>
          <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
            <div class="flex items-center justify-end space-x-2">
              <button 
                type="button" 
                @click="handleViewProduct(product)"
                class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <div class="i-hugeicons-view h-5 w-5"></div>
              </button>
              <button 
                type="button" 
                @click="handleEditProduct(product)"
                class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <div class="i-hugeicons-edit-01 h-5 w-5"></div>
              </button>
            </div>
          </td>
        </tr>
        <tr v-if="products.length === 0">
          <td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            No products found matching your criteria
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template> 