<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import TabNavigation from '../../../../components/Dashboard/Commerce/Delivery/TabNavigation.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'
import ShippingZonesTable from '../../../../components/Dashboard/Commerce/Delivery/ShippingZonesTable.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'
import { useShippingZones } from '../../../../functions/commerce/shippings/shipping-zones'
import type { NewShippingZone } from '../../../../types/defaults'

useHead({
  title: 'Dashboard - Shipping Zones',
})

// Get shipping zones data and functions from the composable
const { shippingZones, createShippingZone, fetchShippingZones, updateShippingZone, deleteShippingZone } = useShippingZones()

// Fetch shipping zones on component mount
onMounted(async () => {
  await fetchShippingZones()
})

// Modal state
const showAddModal = ref(false)
const showEditModal = ref(false)
const editingZone = ref<any>(null)
const newShippingZone = ref<NewShippingZone>({
  name: '',
  countries: '',
  regions: '',
  postal_codes: '',
  shipping_method_id: 0,
  status: 'Active'
})

function openAddModal(): void {
  newShippingZone.value = {
    name: '',
    countries: '',
    regions: '',
    postal_codes: '', 
    shipping_method_id: 0,
    status: 'Active'
  }
  showAddModal.value = true
}

function closeAddModal(): void {
  showAddModal.value = false
}

function openEditModal(zone: any): void {
  editingZone.value = zone
  newShippingZone.value = {
    name: zone.name,
    countries: zone.countries || '',
    regions: zone.regions || '',
    postal_codes: zone.postal_codes || '',
    shipping_method_id: zone.shipping_method_id,
    status: zone.status
  }
  showEditModal.value = true
}

function closeEditModal(): void {
  showEditModal.value = false
  editingZone.value = null
}

async function addShippingZone(): Promise<void> {
  try {
    const zoneData = {
      ...newShippingZone.value,
      shipping_method_id: 1 // TODO: Get from selected shipping method
    }
    await createShippingZone(zoneData)
    closeAddModal()
  } catch (error) {
    console.error('Failed to create shipping zone:', error)
  }
}

async function saveShippingZone(): Promise<void> {
  if (!editingZone.value) return

  try {
    await updateShippingZone({
      ...editingZone.value,
      ...newShippingZone.value
    })
    closeEditModal()
  } catch (error) {
    console.error('Failed to update shipping zone:', error)
  }
}

// Search and filtering
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = 5

const filteredShippingZones = computed(() => {
  // Ensure shippingZones.value is always an array
  const zones = Array.isArray(shippingZones.value) ? shippingZones.value : []
  
  if (!searchQuery.value) return zones

  const query = searchQuery.value.toLowerCase()
  return zones.filter(zone =>
    zone.name.toLowerCase().includes(query) ||
    zone.countries?.toLowerCase().includes(query) ||
    zone.regions?.toLowerCase().includes(query)
  )
})

const paginatedShippingZones = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  const sliced = filteredShippingZones.value.slice(start, end)
  
  // Transform data to match the expected interface
  return sliced.map(zone => ({
    id: zone.id,
    name: zone.name,
    countries: zone.countries || '',
    regions: zone.regions || '',
    postal_codes: zone.postal_codes || '',
    status: zone.status,
    shipping_method_id: zone.shipping_method_id
  }))
})

// Event handlers
const handleSearch = (query: string) => {
  searchQuery.value = query
  currentPage.value = 1
}

const handleAddZone = () => {
  openAddModal()
}

const handleEditZone = (zone: any) => {
  openEditModal(zone)
}

const handleDeleteZone = async (zone: any) => {
  if (confirm(`Are you sure you want to delete ${zone.name}?`)) {
    try {
      await deleteShippingZone(zone.id)
    } catch (error) {
      console.error('Failed to delete shipping zone:', error)
    }
  }
}

const handlePrevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const handleNextPage = () => {
  const totalPages = Math.ceil(filteredShippingZones.value.length / itemsPerPage)
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
        modelValue="zones"
        :tabs="tabs"
      />

      <div class="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div class="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-medium text-gray-900 dark:text-white">Shipping Zones</h2>
            <button
              @click="handleAddZone"
              type="button"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-2" />
              Add Zone
            </button>
          </div>
          <div class="mt-4">
            <SearchFilter
              placeholder="Search shipping zones..."
              @search="handleSearch"
              class="w-full md:w-96"
            />
          </div>
        </div>

        <ShippingZonesTable
          :zones="paginatedShippingZones"
          @edit="handleEditZone"
          @delete="handleDeleteZone"
        />

        <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <Pagination
            :current-page="currentPage"
            :total-items="filteredShippingZones.length"
            :items-per-page="itemsPerPage"
            @prev="handlePrevPage"
            @next="handleNextPage"
            @page="handlePageChange"
          />
        </div>
      </div>
    </div>

    <!-- Add Shipping Zone Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeAddModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Add New Shipping Zone</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="zone-name" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Zone Name</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="zone-name"
                        v-model="newShippingZone.name"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter zone name"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="zone-countries" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Countries</label>
                    <div class="mt-2">
                      <textarea
                        id="zone-countries"
                        v-model="newShippingZone.countries"
                        rows="3"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter countries (comma-separated)"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="zone-regions" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Regions</label>
                    <div class="mt-2">
                      <textarea
                        id="zone-regions"
                        v-model="newShippingZone.regions"
                        rows="3"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter regions (comma-separated)"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="zone-postal-codes" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Postal Codes</label>
                    <div class="mt-2">
                      <textarea
                        id="zone-postal-codes"
                        v-model="newShippingZone.postal_codes"
                        rows="3"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter postal codes (comma-separated)"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="zone-status" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Status</label>
                    <div class="mt-2">
                      <select
                        id="zone-status"
                        v-model="newShippingZone.status"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="addShippingZone"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            >
              Add Zone
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

    <!-- Edit Shipping Zone Modal -->
    <div v-if="showEditModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeEditModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Edit Shipping Zone</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="edit-zone-name" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Zone Name</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="edit-zone-name"
                        v-model="newShippingZone.name"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter zone name"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="edit-zone-countries" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Countries</label>
                    <div class="mt-2">
                      <textarea
                        id="edit-zone-countries"
                        v-model="newShippingZone.countries"
                        rows="3"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter countries (comma-separated)"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="edit-zone-regions" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Regions</label>
                    <div class="mt-2">
                      <textarea
                        id="edit-zone-regions"
                        v-model="newShippingZone.regions"
                        rows="3"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter regions (comma-separated)"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="edit-zone-postal-codes" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Postal Codes</label>
                    <div class="mt-2">
                      <textarea
                        id="edit-zone-postal-codes"
                        v-model="newShippingZone.postal_codes"
                        rows="3"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter postal codes (comma-separated)"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="edit-zone-status" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Status</label>
                    <div class="mt-2">
                      <select
                        id="edit-zone-status"
                        v-model="newShippingZone.status"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="saveShippingZone"
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
