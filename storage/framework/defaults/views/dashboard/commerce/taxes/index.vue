<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Dashboard - Commerce Taxes',
})

// Sample taxes data
const taxes = ref([
  {
    id: 1,
    name: 'US Digital Services',
    rate: 0.0,
    type: 'Sales Tax',
    country: 'United States',
    region: 'All',
    active: true,
    createdAt: '2023-05-10',
    isDefault: true
  },
  {
    id: 2,
    name: 'EU Digital VAT',
    rate: 20.0,
    type: 'VAT',
    country: 'European Union',
    region: 'All',
    active: true,
    createdAt: '2023-05-15',
    isDefault: false
  },
  {
    id: 3,
    name: 'UK Digital Services',
    rate: 20.0,
    type: 'VAT',
    country: 'United Kingdom',
    region: 'All',
    active: true,
    createdAt: '2023-05-20',
    isDefault: false
  },
  {
    id: 4,
    name: 'Canada GST/HST',
    rate: 5.0,
    type: 'GST',
    country: 'Canada',
    region: 'All',
    active: true,
    createdAt: '2023-06-01',
    isDefault: false
  },
  {
    id: 5,
    name: 'Australia GST',
    rate: 10.0,
    type: 'GST',
    country: 'Australia',
    region: 'All',
    active: true,
    createdAt: '2023-06-15',
    isDefault: false
  },
  {
    id: 6,
    name: 'Japan Consumption Tax',
    rate: 10.0,
    type: 'Consumption Tax',
    country: 'Japan',
    region: 'All',
    active: true,
    createdAt: '2023-07-01',
    isDefault: false
  },
  {
    id: 7,
    name: 'Norway VAT',
    rate: 25.0,
    type: 'VAT',
    country: 'Norway',
    region: 'All',
    active: true,
    createdAt: '2023-07-15',
    isDefault: false
  },
  {
    id: 8,
    name: 'New Zealand GST',
    rate: 15.0,
    type: 'GST',
    country: 'New Zealand',
    region: 'All',
    active: true,
    createdAt: '2023-08-01',
    isDefault: false
  },
  {
    id: 9,
    name: 'Singapore GST',
    rate: 8.0,
    type: 'GST',
    country: 'Singapore',
    region: 'All',
    active: true,
    createdAt: '2023-08-15',
    isDefault: false
  },
  {
    id: 10,
    name: 'South Africa VAT',
    rate: 15.0,
    type: 'VAT',
    country: 'South Africa',
    region: 'All',
    active: true,
    createdAt: '2023-09-01',
    isDefault: false
  }
])

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('name')
const sortOrder = ref('asc')
const activeFilter = ref('all')
const countryFilter = ref('all')
const typeFilter = ref('all')

// Get unique countries for filter
const countries = computed(() => {
  const uniqueCountries = new Set(taxes.value.map(t => t.country))
  return Array.from(uniqueCountries).sort()
})

// Get unique tax types for filter
const taxTypes = computed(() => {
  const uniqueTypes = new Set(taxes.value.map(t => t.type))
  return Array.from(uniqueTypes).sort()
})

// Computed filtered and sorted taxes
const filteredTaxes = computed(() => {
  return taxes.value
    .filter(tax => {
      // Apply search filter
      const matchesSearch = tax.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                           tax.country.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                           tax.region.toLowerCase().includes(searchQuery.value.toLowerCase())

      // Apply active filter
      const matchesActive = activeFilter.value === 'all' ||
                           (activeFilter.value === 'active' && tax.active) ||
                           (activeFilter.value === 'inactive' && !tax.active)

      // Apply country filter
      const matchesCountry = countryFilter.value === 'all' ||
                            tax.country === countryFilter.value

      // Apply type filter
      const matchesType = typeFilter.value === 'all' ||
                         tax.type === typeFilter.value

      return matchesSearch && matchesActive && matchesCountry && matchesType
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy.value === 'rate') {
        comparison = a.rate - b.rate
      } else if (sortBy.value === 'country') {
        comparison = a.country.localeCompare(b.country)
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
const newTax = ref<{
  name: string;
  rate: number;
  type: string;
  country: string;
  region: string;
  active: boolean;
  isDefault: boolean;
}>({
  name: '',
  rate: 0,
  type: 'Percentage',
  country: '',
  region: '',
  active: true,
  isDefault: false
})

function openAddModal(): void {
  newTax.value = {
    name: '',
    rate: 0,
    type: 'Percentage',
    country: '',
    region: '',
    active: true,
    isDefault: false
  }
  showAddModal.value = true
}

function closeAddModal(): void {
  showAddModal.value = false
}

function addTax(): void {
  // In a real app, this would send data to the server
  const id = Math.max(...taxes.value.map(t => t.id)) + 1
  const currentDate = new Date().toISOString().split('T')[0] as string;

  // If this is set as default, update other taxes
  if (newTax.value.isDefault) {
    taxes.value.forEach(tax => {
      tax.isDefault = false
    })
  }

  taxes.value.push({
    id,
    name: newTax.value.name || '',
    rate: newTax.value.rate,
    type: newTax.value.type || '',
    country: newTax.value.country || '',
    region: newTax.value.region || 'All',
    active: newTax.value.active,
    createdAt: currentDate,
    isDefault: newTax.value.isDefault || false
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
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Tax Rates</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Manage tax rates for your products across different countries and regions. Digital services often have specific tax requirements based on customer location.
            </p>
          </div>
          <div class="mt-4 sm:mt-0">
            <button
              type="button"
              @click="openAddModal"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-1"></div>
              Add tax
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
              placeholder="Search taxes..."
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-4">
            <select
              v-model="activeFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Taxes</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            <select
              v-model="countryFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Countries</option>
              <option v-for="country in countries" :key="country" :value="country">{{ country }}</option>
            </select>

            <select
              v-model="typeFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Types</option>
              <option v-for="type in taxTypes" :key="type" :value="type">{{ type }}</option>
            </select>
          </div>
        </div>

        <!-- Taxes table -->
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
                        <button @click="toggleSort('rate')" class="group inline-flex items-center">
                          Rate (%)
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'rate'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Type</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('country')" class="group inline-flex items-center">
                          Country
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'country'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Region</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Status</th>
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
                    <tr v-for="tax in filteredTaxes" :key="tax.id">
                      <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 dark:text-white">
                        {{ tax.name }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ tax.rate }}%</td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ tax.type }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ tax.country }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ tax.region }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm">
                        <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
                              :class="{
                                'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400': tax.active,
                                'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400': !tax.active
                              }">
                          {{ tax.active ? 'Active' : 'Inactive' }}
                        </span>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm">
                        <span v-if="tax.isDefault" class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400">
                          Default
                        </span>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300 text-right">
                        {{ tax.createdAt }}
                      </td>
                      <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div class="flex items-center justify-end space-x-2">
                          <button type="button" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                            <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                          </button>
                          <button type="button" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                            <div class="i-hugeicons-waste h-5 w-5"></div>
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="filteredTaxes.length === 0">
                      <td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        No taxes found matching your criteria
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

    <!-- Add Tax Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Add New Tax Rate</h3>
              <div class="mt-2">
                <div class="text-sm text-gray-500 dark:text-gray-400">
                  <p>Set up tax rates for different countries and regions where your SaaS products are sold.</p>
                  <p class="mt-2">For digital services, tax is typically based on the customer's location rather than your business location.</p>
                </div>
              </div>
            </div>

            <div class="mt-4">
              <div class="space-y-4">
                <div>
                  <label for="tax-name" class="block text-sm font-medium text-gray-700 dark:text-gray-200">Name</label>
                  <div class="mt-1">
                    <input
                      id="tax-name"
                      type="text"
                      v-model="newTax.name"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label for="tax-rate" class="block text-sm font-medium text-gray-700 dark:text-gray-200">Rate (%)</label>
                  <div class="mt-1">
                    <input
                      id="tax-rate"
                      type="number"
                      step="0.01"
                      v-model="newTax.rate"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white"
                    />
                  </div>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Enter the percentage rate (e.g., 20 for 20%)</p>
                </div>

                <div>
                  <label for="tax-type" class="block text-sm font-medium text-gray-700 dark:text-gray-200">Type</label>
                  <div class="mt-1">
                    <select
                      id="tax-type"
                      v-model="newTax.type"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white"
                    >
                      <option value="VAT">VAT</option>
                      <option value="GST">GST</option>
                      <option value="Sales Tax">Sales Tax</option>
                      <option value="Digital Services Tax">Digital Services Tax</option>
                      <option value="Consumption Tax">Consumption Tax</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label for="tax-country" class="block text-sm font-medium text-gray-700 dark:text-gray-200">Country</label>
                  <div class="mt-1">
                    <input
                      id="tax-country"
                      type="text"
                      v-model="newTax.country"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label for="tax-region" class="block text-sm font-medium text-gray-700 dark:text-gray-200">Region</label>
                  <div class="mt-1">
                    <input
                      id="tax-region"
                      type="text"
                      v-model="newTax.region"
                      placeholder="All"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <div class="flex items-center">
                  <input
                    id="active"
                    v-model="newTax.active"
                    type="checkbox"
                    class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700 dark:focus:ring-offset-blue-gray-800"
                  >
                  <label for="active" class="ml-2 block text-sm text-gray-900 dark:text-white">Active</label>
                </div>

                <div class="flex items-center">
                  <input
                    id="isDefault"
                    v-model="newTax.isDefault"
                    type="checkbox"
                    class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700 dark:focus:ring-offset-blue-gray-800"
                  >
                  <label for="isDefault" class="ml-2 block text-sm text-gray-900 dark:text-white">Set as default tax rate</label>
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-400">This tax rate will be applied to new SaaS subscriptions by default</p>
              </div>
            </div>
          </div>

          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
              @click="addTax"
            >
              Add
            </button>
            <button
              type="button"
              class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
              @click="closeAddModal"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
