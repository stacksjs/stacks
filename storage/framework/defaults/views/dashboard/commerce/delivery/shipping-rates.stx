<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import TabNavigation from '../../../../components/Dashboard/Commerce/Delivery/TabNavigation.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'
import ShippingRatesTable from '../../../../components/Dashboard/Commerce/Delivery/ShippingRatesTable.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'
import { useShippingRates } from '../../../../functions/commerce/shippings/shipping-rates'
import { useShippingMethods } from '../../../../functions/commerce/shippings/shipping-methods'
import { useShippingZones } from '../../../../functions/commerce/shippings/shipping-zones'
import type { NewShippingRate } from '../../../../types/defaults'

useHead({
  title: 'Dashboard - Shipping Rates',
})

// Get shipping rates data and functions from the composable
const { shippingRates, createShippingRate, fetchShippingRates, updateShippingRate, deleteShippingRate } = useShippingRates()

// Get shipping methods and zones for dropdowns
const { shippingMethods, fetchShippingMethods } = useShippingMethods()
const { shippingZones, fetchShippingZones } = useShippingZones()

// Fetch all data on component mount
onMounted(async () => {
  await Promise.all([
    fetchShippingRates(),
    fetchShippingMethods(),
    fetchShippingZones()
  ])
})


// Modal state
const showAddModal = ref(false)
const showEditModal = ref(false)
const editingRate = ref<any>(null)
const newShippingRate = ref<NewShippingRate>({
  shipping_method_id: 0,
  shipping_zone_id: 0,
  weight_from: 0,
  weight_to: 0,
  rate: 0
})

function openAddModal(): void {
  newShippingRate.value = {
    shipping_method_id: 0,
    shipping_zone_id: 0,
    weight_from: 0,
    weight_to: 0,
    rate: 0
  }
  showAddModal.value = true
}

function closeAddModal(): void {
  showAddModal.value = false
}

function openEditModal(rate: any): void {
  editingRate.value = rate
  newShippingRate.value = {
    shipping_method_id: rate.shipping_method_id,
    shipping_zone_id: rate.shipping_zone_id,
    weight_from: rate.weight_from,
    weight_to: rate.weight_to,
    rate: rate.rate
  }
  showEditModal.value = true
}

function closeEditModal(): void {
  showEditModal.value = false
  editingRate.value = null
}

async function addShippingRate(): Promise<void> {
  try {
    await createShippingRate(newShippingRate.value)
    closeAddModal()
  } catch (error) {
    console.error('Failed to create shipping rate:', error)
  }
}

async function saveShippingRate(): Promise<void> {
  if (!editingRate.value) return

  try {
    await updateShippingRate({
      ...editingRate.value,
      ...newShippingRate.value
    })
    closeEditModal()
  } catch (error) {
    console.error('Failed to update shipping rate:', error)
  }
}

// Search and filtering
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = 5

const filteredShippingRates = computed(() => {
  // Ensure shippingRates.value is always an array
  const rates = Array.isArray(shippingRates.value) ? shippingRates.value : []
  
  if (!searchQuery.value) return rates

  const query = searchQuery.value.toLowerCase()
  return rates.filter(rate =>
    rate.method.toLowerCase().includes(query) ||
    rate.zone.toLowerCase().includes(query) ||
    rate.weight_from.toString().includes(query) ||
    rate.weight_to.toString().includes(query) ||
    rate.rate.toString().includes(query)
  )
})

const paginatedShippingRates = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredShippingRates.value.slice(start, end)
})

// Event handlers
const handleSearch = (query: string) => {
  searchQuery.value = query
  currentPage.value = 1
}

const handleAddRate = () => {
  openAddModal()
}

const handleEditRate = (rate: any) => {
  openEditModal(rate)
}

const handleDeleteRate = async (rate: any) => {
  if (confirm(`Are you sure you want to delete this shipping rate?`)) {
    try {
      await deleteShippingRate(rate.id)
    } catch (error) {
      console.error('Failed to delete shipping rate:', error)
    }
  }
}

const handlePrevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const handleNextPage = () => {
  const totalPages = Math.ceil(filteredShippingRates.value.length / itemsPerPage)
  if (currentPage.value < totalPages) {
    currentPage.value++
  }
}

const handlePageChange = (page: number) => {
  currentPage.value = page
}

// Tab configuration
const tabs = [
  { name: 'Shipping Methods', value: 'methods', href: '/commerce/delivery/shipping-methods' },
  { name: 'Shipping Zones', value: 'zones', href: '/commerce/delivery/shipping-zones' },
  { name: 'Shipping Rates', value: 'rates', href: '/commerce/delivery/shipping-rates' },
  { name: 'Digital Delivery', value: 'digital', href: '/commerce/delivery/digital-delivery' },
  { name: 'License Keys', value: 'license', href: '/commerce/delivery/license-keys' },
  { name: 'Delivery Routes', value: 'routes', href: '/commerce/delivery/delivery-routes' },
  { name: 'Drivers', value: 'drivers', href: '/commerce/delivery/drivers' },
]
</script>

<template>
  <div class="py-6">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
      <!-- Tab Navigation -->
      <TabNavigation
        modelValue="rates"
        :tabs="tabs"
      />

      <div class="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div class="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-medium text-gray-900 dark:text-white">Shipping Rates</h2>
            <button
              @click="handleAddRate"
              type="button"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-2" />
              Add Rate
            </button>
          </div>
          <div class="mt-4">
            <SearchFilter
              placeholder="Search shipping rates..."
              @search="handleSearch"
              class="w-full md:w-96"
            />
          </div>
        </div>

        <ShippingRatesTable
          :rates="paginatedShippingRates"
          @edit="handleEditRate"
          @delete="handleDeleteRate"
        />

        <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <Pagination
            :current-page="currentPage"
            :total-items="filteredShippingRates.length"
            :items-per-page="itemsPerPage"
            @prev="handlePrevPage"
            @next="handleNextPage"
            @page="handlePageChange"
          />
        </div>
      </div>
    </div>

    <!-- Add Shipping Rate Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeAddModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Add New Shipping Rate</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="rate-method" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Method</label>
                    <div class="mt-2">
                      <select
                        id="rate-method"
                        v-model="newShippingRate.shipping_method_id"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option value="">Select a shipping method</option>
                        <option v-for="method in shippingMethods" :key="method.id" :value="method.id">
                          {{ method.name }}
                        </option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label for="rate-zone" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Zone</label>
                    <div class="mt-2">
                      <select
                        id="rate-zone"
                        v-model="newShippingRate.shipping_zone_id"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option value="">Select a shipping zone</option>
                        <option v-for="zone in shippingZones" :key="zone.id" :value="zone.id">
                          {{ zone.name }}
                        </option>
                      </select>
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="rate-weight-from" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Weight From</label>
                      <div class="mt-2">
                        <input
                          type="number"
                          id="rate-weight-from"
                          v-model="newShippingRate.weight_from"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div>
                      <label for="rate-weight-to" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Weight To</label>
                      <div class="mt-2">
                        <input
                          type="number"
                          id="rate-weight-to"
                          v-model="newShippingRate.weight_to"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="10"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label for="rate-rate" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Rate (in cents)</label>
                    <div class="mt-2">
                      <input
                        type="number"
                        id="rate-rate"
                        v-model="newShippingRate.rate"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="599"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="addShippingRate"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            >
              Add Rate
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

    <!-- Edit Shipping Rate Modal -->
    <div v-if="showEditModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeEditModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Edit Shipping Rate</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="edit-rate-method" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Method</label>
                    <div class="mt-2">
                      <select
                        id="edit-rate-method"
                        v-model="newShippingRate.method"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option value="">Select a shipping method</option>
                        <option v-for="method in shippingMethods" :key="method.id" :value="method.name">
                          {{ method.name }}
                        </option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label for="edit-rate-zone" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Zone</label>
                    <div class="mt-2">
                      <select
                        id="edit-rate-zone"
                        v-model="newShippingRate.zone"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option value="">Select a shipping zone</option>
                        <option v-for="zone in shippingZones" :key="zone.id" :value="zone.name">
                          {{ zone.name }}
                        </option>
                      </select>
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="edit-rate-weight-from" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Weight From</label>
                      <div class="mt-2">
                        <input
                          type="number"
                          id="edit-rate-weight-from"
                          v-model="newShippingRate.weight_from"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div>
                      <label for="edit-rate-weight-to" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Weight To</label>
                      <div class="mt-2">
                        <input
                          type="number"
                          id="edit-rate-weight-to"
                          v-model="newShippingRate.weight_to"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="10"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label for="edit-rate-rate" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Rate (in cents)</label>
                    <div class="mt-2">
                      <input
                        type="number"
                        id="edit-rate-rate"
                        v-model="newShippingRate.rate"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="599"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="saveShippingRate"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            >
              Save Changes
            </button>
            <button
              type="button"
              @click="closeEditModal"
              class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
