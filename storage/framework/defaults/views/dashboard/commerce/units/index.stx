<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Dashboard - Commerce Units',
})

// Sample units data
const units = ref([
  {
    id: 1,
    name: 'Slice',
    abbreviation: 'slice',
    type: 'Food',
    description: 'Individual slice of pizza or cake',
    isDefault: true,
    createdAt: '2023-05-15'
  },
  {
    id: 2,
    name: 'Whole',
    abbreviation: 'whole',
    type: 'Food',
    description: 'Complete item (e.g., whole pizza, whole cake)',
    isDefault: false,
    createdAt: '2023-05-15'
  },
  {
    id: 3,
    name: 'Milliliter',
    abbreviation: 'ml',
    type: 'Beverage',
    description: 'Volume measurement for beverages',
    isDefault: true,
    createdAt: '2023-06-02'
  },
  {
    id: 4,
    name: 'Bottle',
    abbreviation: 'btl',
    type: 'Beverage',
    description: 'Standard bottle size (varies by product)',
    isDefault: false,
    createdAt: '2023-06-02'
  },
  {
    id: 5,
    name: 'Piece',
    abbreviation: 'pc',
    type: 'General',
    description: 'Individual item count',
    isDefault: true,
    createdAt: '2023-06-10'
  },
  {
    id: 6,
    name: 'Box',
    abbreviation: 'box',
    type: 'Package',
    description: 'Box containing multiple items',
    isDefault: true,
    createdAt: '2023-07-05'
  },
  {
    id: 7,
    name: 'Serving',
    abbreviation: 'srv',
    type: 'Food',
    description: 'Individual portion size',
    isDefault: false,
    createdAt: '2023-07-12'
  },
  {
    id: 8,
    name: 'Gram',
    abbreviation: 'g',
    type: 'Weight',
    description: 'Weight measurement for food items',
    isDefault: true,
    createdAt: '2023-08-03'
  }
])

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('name')
const sortOrder = ref('asc')
const typeFilter = ref('all')
const defaultFilter = ref('all')

// Get unique unit types for filter
const unitTypes = computed(() => {
  const uniqueTypes = new Set(units.value.map(u => u.type))
  return Array.from(uniqueTypes).sort()
})

// Computed filtered and sorted units
const filteredUnits = computed(() => {
  return units.value
    .filter(unit => {
      // Apply search filter
      const matchesSearch = unit.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                           unit.abbreviation.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                           unit.description.toLowerCase().includes(searchQuery.value.toLowerCase())

      // Apply type filter
      const matchesType = typeFilter.value === 'all' || unit.type === typeFilter.value

      // Apply default filter
      const matchesDefault = defaultFilter.value === 'all' ||
                            (defaultFilter.value === 'default' && unit.isDefault) ||
                            (defaultFilter.value === 'not-default' && !unit.isDefault)

      return matchesSearch && matchesType && matchesDefault
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy.value === 'type') {
        comparison = a.type.localeCompare(b.type)
      } else if (sortBy.value === 'abbreviation') {
        comparison = a.abbreviation.localeCompare(b.abbreviation)
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
const newUnit = ref<{
  name: string;
  abbreviation: string;
  type: string;
  description: string;
  isDefault: boolean;
}>({
  name: '',
  abbreviation: '',
  type: '',
  description: '',
  isDefault: false
})

function openAddModal(): void {
  newUnit.value = {
    name: '',
    abbreviation: '',
    type: '',
    description: '',
    isDefault: false
  }
  showAddModal.value = true
}

function closeAddModal(): void {
  showAddModal.value = false
}

function addUnit(): void {
  // In a real app, this would send data to the server
  const id = Math.max(...units.value.map(u => u.id)) + 1
  const currentDate = new Date().toISOString().split('T')[0] as string;

  // If this is set as default, update other units of the same type
  if (newUnit.value.isDefault) {
    units.value.forEach(unit => {
      if (unit.type === newUnit.value.type) {
        unit.isDefault = false
      }
    })
  }

  units.value.push({
    id,
    name: newUnit.value.name || '',
    abbreviation: newUnit.value.abbreviation || '',
    type: newUnit.value.type || '',
    description: newUnit.value.description || '',
    isDefault: newUnit.value.isDefault,
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
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Units</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Manage measurement units for your products
            </p>
          </div>
          <div class="mt-4 sm:mt-0">
            <button
              type="button"
              @click="openAddModal"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-1"></div>
              Add unit
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
              placeholder="Search units..."
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-4">
            <select
              v-model="typeFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Types</option>
              <option v-for="type in unitTypes" :key="type" :value="type">{{ type }}</option>
            </select>

            <select
              v-model="defaultFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Units</option>
              <option value="default">Default Units</option>
              <option value="not-default">Non-Default Units</option>
            </select>
          </div>
        </div>

        <!-- Units table -->
        <div class="mt-6 flow-root">
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-blue-gray-700">
                    <tr>
                      <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-gray-200">
                        <button @click="toggleSort('name')" class="group inline-flex items-center">
                          Name
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'name'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('abbreviation')" class="group inline-flex items-center">
                          Abbreviation
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'abbreviation'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('type')" class="group inline-flex items-center">
                          Type
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'type'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Description</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Default</th>
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
                    <tr v-for="unit in filteredUnits" :key="unit.id">
                      <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 dark:text-white">
                        {{ unit.name }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ unit.abbreviation }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ unit.type }}
                      </td>
                      <td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ unit.description }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        <div v-if="unit.isDefault" class="i-hugeicons-checkmark-circle-02 h-5 w-5 text-green-500"></div>
                        <div v-else class="i-hugeicons-cancel-circle h-5 w-5 text-gray-400"></div>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300 text-right">
                        {{ unit.createdAt }}
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
                    <tr v-if="filteredUnits.length === 0">
                      <td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        No units found matching your criteria
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

    <!-- Add Unit Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeAddModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Add New Unit</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="unit-name" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Name</label>
                      <div class="mt-2">
                        <input
                          type="text"
                          id="unit-name"
                          v-model="newUnit.name"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        />
                      </div>
                    </div>
                    <div>
                      <label for="unit-abbreviation" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Abbreviation</label>
                      <div class="mt-2">
                        <input
                          type="text"
                          id="unit-abbreviation"
                          v-model="newUnit.abbreviation"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label for="unit-type" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Type</label>
                    <div class="mt-2">
                      <select
                        id="unit-type"
                        v-model="newUnit.type"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option value="">Select a type</option>
                        <option v-for="type in unitTypes" :key="type" :value="type">{{ type }}</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label for="unit-description" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Description</label>
                    <div class="mt-2">
                      <textarea
                        id="unit-description"
                        v-model="newUnit.description"
                        rows="2"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      ></textarea>
                    </div>
                  </div>
                  <div class="flex items-center">
                    <input
                      id="unit-default"
                      type="checkbox"
                      v-model="newUnit.isDefault"
                      class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700"
                    />
                    <label for="unit-default" class="ml-2 block text-sm text-gray-900 dark:text-gray-200">Set as default for this type</label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="addUnit"
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
