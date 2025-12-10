<script lang="ts" setup>
import type { Categories } from '../../../types/defaults'

interface Props {
  categories: Categories[]
  searchQuery: string
  featuredFilter: string
  sortBy: string
  sortOrder: string
  currentPage: number
  itemsPerPage: number
}

interface Emits {
  (e: 'toggleSort', column: string): void
  (e: 'viewCategory', category: Categories): void
  (e: 'editCategory', category: Categories): void
  (e: 'deleteCategory', category: Categories): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

// Event handlers
function handleToggleSort(column: string): void {
  emit('toggleSort', column)
}

function handleViewCategory(category: Categories): void {
  emit('viewCategory', category)
}

function handleEditCategory(category: Categories): void {
  emit('editCategory', category)
}

function handleDeleteCategory(category: Categories): void {
  emit('deleteCategory', category)
}

// Color mapping for initial letters
const initialColors: Record<string, string> = {
  'Burgers': 'bg-red-500',
  'Mexican': 'bg-green-500',
  'Desserts': 'bg-purple-500',
  'Asian Fusion': 'bg-blue-500'
}
</script>

<template>
  <!-- Categories table -->
  <div class="overflow-hidden">
    <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
      <thead class="bg-gray-50 dark:bg-blue-gray-700">
        <tr>
          <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-gray-200">
            <button @click="handleToggleSort('name')" class="group inline-flex items-center">
              Category
              <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus-visible">
                <div v-if="sortBy === 'name'" :class="[
                  sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                  'h-4 w-4'
                ]"></div>
                <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
              </span>
            </button>
          </th>
          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Description</th>
          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
            <button @click="handleToggleSort('display_order')" class="group inline-flex items-center">
              Display Order
              <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus-visible">
                <div v-if="sortBy === 'display_order'" :class="[
                  sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                  'h-4 w-4'
                ]"></div>
                <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
              </span>
            </button>
          </th>
          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Active</th>
          <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
            <span class="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-blue-gray-800">
        <tr v-for="category in categories" :key="category.id" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700">
          <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white">
            <div class="flex items-center space-x-3">
              <template v-if="category.image_url">
                <img
                  :src="category.image_url"
                  :alt="category.name"
                  class="h-10 w-10 rounded-full object-cover border border-gray-200 dark:border-gray-700 shadow-sm"
                  onerror="this.src='/images/categories/placeholder.jpg'"
                />
              </template>
              <template v-else>
                <div
                  :class="['h-10 w-10 rounded-full flex items-center justify-center text-white font-medium shadow-sm',
                    initialColors[category.name] || 'bg-blue-500']"
                >
                  {{ category.name ? category.name.charAt(0).toUpperCase() : '?' }}
                </div>
              </template>
              <span>{{ category.name }}</span>
            </div>
          </td>
          <td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
            {{ category.description || 'No description' }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
            {{ category.display_order }}
          </td>
          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
            <div v-if="category.is_active" class="i-hugeicons-checkmark-circle-02 h-5 w-5 text-green-500"></div>
            <div v-else class="i-hugeicons-cancel-circle h-5 w-5 text-gray-400"></div>
          </td>
          <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
            <div class="flex items-center justify-end space-x-2">
              <button 
                type="button" 
                @click="handleViewCategory(category)"
                class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <div class="i-hugeicons-view h-5 w-5"></div>
              </button>
              <button 
                type="button" 
                @click="handleEditCategory(category)"
                class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <div class="i-hugeicons-edit-01 h-5 w-5"></div>
              </button>
              <button 
                type="button" 
                @click="handleDeleteCategory(category)"
                class="text-gray-400 transition-colors duration-150 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
              >
                <div class="i-hugeicons-waste h-5 w-5"></div>
              </button>
            </div>
          </td>
        </tr>
        <tr v-if="categories.length === 0">
          <td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            No categories found matching your criteria
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template> 