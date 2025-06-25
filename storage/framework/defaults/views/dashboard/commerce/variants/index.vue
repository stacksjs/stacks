<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Dashboard - Commerce Variants',
})

// Helper function to ensure we have a string
function ensureString(value: string | undefined): string {
  return value || ''
}

// Sample variant types data
const variantTypes = ref([
  {
    id: 1,
    name: 'Size',
    description: 'Food portion size options',
    options: ['Small', 'Medium', 'Large', 'Family Size'],
    active: true,
    createdAt: '2023-05-10'
  },
  {
    id: 2,
    name: 'Crust Type',
    description: 'Pizza crust options',
    options: ['Thin', 'Regular', 'Thick', 'Stuffed', 'Gluten-Free'],
    active: true,
    createdAt: '2023-05-15'
  },
  {
    id: 3,
    name: 'Spice Level',
    description: 'Heat intensity options',
    options: ['Mild', 'Medium', 'Hot', 'Extra Hot'],
    active: true,
    createdAt: '2023-06-01'
  },
  {
    id: 4,
    name: 'Protein',
    description: 'Protein options for dishes',
    options: ['Chicken', 'Beef', 'Pork', 'Tofu', 'Shrimp', 'None'],
    active: true,
    createdAt: '2023-06-10'
  },
  {
    id: 5,
    name: 'Toppings',
    description: 'Additional toppings for dishes',
    options: ['Cheese', 'Mushrooms', 'Peppers', 'Onions', 'Olives', 'Bacon'],
    active: true,
    createdAt: '2023-06-20'
  },
  {
    id: 6,
    name: 'Dietary',
    description: 'Dietary preference options',
    options: ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Low-Carb'],
    active: true,
    createdAt: '2023-07-05'
  },
  {
    id: 7,
    name: 'Sauce',
    description: 'Sauce options for dishes',
    options: ['Marinara', 'Alfredo', 'BBQ', 'Buffalo', 'Sweet & Sour', 'None'],
    active: true,
    createdAt: '2023-07-15'
  },
  {
    id: 8,
    name: 'Sweetness',
    description: 'Sweetness level options',
    options: ['Not Sweet', 'Slightly Sweet', 'Medium Sweet', 'Very Sweet'],
    active: true,
    createdAt: '2023-08-01'
  }
])

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('name')
const sortOrder = ref('asc')
const activeFilter = ref('all')

// Computed filtered and sorted variant types
const filteredVariantTypes = computed(() => {
  return variantTypes.value
    .filter(variantType => {
      // Apply search filter
      const matchesSearch = variantType.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                           variantType.description.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                           variantType.options.some(option => option.toLowerCase().includes(searchQuery.value.toLowerCase()))

      // Apply active filter
      const matchesActive = activeFilter.value === 'all' ||
                           (activeFilter.value === 'active' && variantType.active) ||
                           (activeFilter.value === 'inactive' && !variantType.active)

      return matchesSearch && matchesActive
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy.value === 'optionCount') {
        comparison = a.options.length - b.options.length
      } else if (sortBy.value === 'createdAt') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
})

// Toggle sort order
function toggleSort(column: string): void {
  if (sortBy.value === column) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = column
    sortOrder.value = 'asc'
  }
}

// Modal state
const showAddModal = ref(false)
const newVariantType = ref<{
  name: string;
  description: string;
  options: string[];
  active: boolean;
}>({
  name: '',
  description: '',
  options: [],
  active: true
})

// New option input
const newOption = ref('')

function addOption(): void {
  if (newOption.value.trim()) {
    newVariantType.value.options.push(newOption.value.trim())
    newOption.value = ''
  }
}

function removeOption(index: number): void {
  newVariantType.value.options.splice(index, 1)
}

function openAddModal(): void {
  newVariantType.value = {
    name: '',
    description: '',
    options: [],
    active: true
  }
  newOption.value = ''
  showAddModal.value = true
}

function closeAddModal(): void {
  showAddModal.value = false
}

function addVariantType(): void {
  // In a real app, this would send data to the server
  const id = Math.max(...variantTypes.value.map(v => v.id)) + 1
  const currentDate = new Date().toISOString().split('T')[0] as string;

  variantTypes.value.push({
    id,
    name: ensureString(newVariantType.value.name),
    description: ensureString(newVariantType.value.description),
    options: [...newVariantType.value.options],
    active: newVariantType.value.active,
    createdAt: currentDate
  })
  closeAddModal()
}
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Variants</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Manage product variants and options
            </p>
          </div>
          <div class="mt-4 sm:mt-0">
            <button
              type="button"
              @click="openAddModal"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-1"></div>
              Add variant type
            </button>
          </div>
        </div>

        <!-- Filters -->
        <div class="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="relative max-w-sm">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <div class="i-hugeicons-search-01 h-5 w-5 text-gray-400"></div>
            </div>
            <input
              v-model="searchQuery"
              type="text"
              class="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:placeholder:text-gray-500"
              placeholder="Search variants..."
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-4">
            <select
              v-model="activeFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Variants</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        <!-- Variants table -->
        <div class="mt-6 flow-root">
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-blue-gray-700">
                    <tr>
                      <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-gray-200">
                        <button @click="toggleSort('name')" class="group inline-flex items-center">
                          Variant Type
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
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
                        <button @click="toggleSort('optionCount')" class="group inline-flex items-center">
                          Options
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'optionCount'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Status</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200 text-right">
                        <button @click="toggleSort('createdAt')" class="group inline-flex items-center text-right">
                          Created
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'createdAt'" :class="[
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
                    <tr v-for="variantType in filteredVariantTypes" :key="variantType.id">
                      <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white">
                        {{ variantType.name }}
                      </td>
                      <td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ variantType.description }}
                      </td>
                      <td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        <div class="flex flex-wrap gap-1">
                          <span
                            v-for="(option, index) in variantType.options.slice(0, 5)"
                            :key="index"
                            class="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                          >
                            {{ option }}
                          </span>
                          <span
                            v-if="variantType.options.length > 5"
                            class="inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                          >
                            +{{ variantType.options.length - 5 }} more
                          </span>
                        </div>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm">
                        <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                              :class="variantType.active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'">
                          {{ variantType.active ? 'Active' : 'Inactive' }}
                        </span>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300 text-right">
                        {{ variantType.createdAt }}
                      </td>
                      <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div class="flex items-center justify-end space-x-2">
                          <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                            <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                          </button>
                          <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                            <div class="i-hugeicons-waste h-5 w-5"></div>
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="filteredVariantTypes.length === 0">
                      <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        No variant types found matching your criteria
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add Variant Type Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeAddModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Add New Variant Type</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="variant-name" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Name</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="variant-name"
                        v-model="newVariantType.name"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label for="variant-description" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Description</label>
                    <div class="mt-2">
                      <textarea
                        id="variant-description"
                        v-model="newVariantType.description"
                        rows="2"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      ></textarea>
                    </div>
                  </div>
                  <div>
                    <label class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Options</label>
                    <div class="mt-2">
                      <div class="flex flex-wrap gap-2 mb-2">
                        <div
                          v-for="(option, index) in newVariantType.options"
                          :key="index"
                          class="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        >
                          {{ option }}
                          <button
                            type="button"
                            class="ml-1 text-blue-400 hover:text-blue-600 dark:text-blue-300 dark:hover:text-blue-100"
                            @click="removeOption(index)"
                          >
                            <div class="i-hugeicons-cancel-circle h-4 w-4"></div>
                          </button>
                        </div>
                      </div>
                      <div class="flex">
                        <input
                          type="text"
                          v-model="newOption"
                          placeholder="Add option"
                          class="block w-full rounded-l-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          @keyup.enter="addOption"
                        />
                        <button
                          type="button"
                          @click="addOption"
                          class="inline-flex items-center rounded-r-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center">
                    <input
                      id="variant-active"
                      type="checkbox"
                      v-model="newVariantType.active"
                      class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700"
                    />
                    <label for="variant-active" class="ml-2 block text-sm text-gray-900 dark:text-gray-200">Active</label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="addVariantType"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            >
              Add
            </button>
            <button
              type="button"
              @click="closeAddModal"
              class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
