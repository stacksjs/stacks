<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import TabNavigation from '../../../../components/Dashboard/Commerce/Delivery/TabNavigation.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'
import DeliveryRoutesTable from '../../../../components/Dashboard/Commerce/Delivery/DeliveryRoutesTable.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'
import { useDeliveryRoutes } from '../../../../functions/commerce/shippings/delivery-routes'
import type { DeliveryRoutes, NewDeliveryRoute } from '../../../../types/defaults'

useHead({
  title: 'Dashboard - Delivery Routes',
})

// Get delivery routes data and functions from the composable
const { deliveryRoutes, createDeliveryRoute, fetchDeliveryRoutes, updateDeliveryRoute, deleteDeliveryRoute } = useDeliveryRoutes()

// Fetch data on component mount
onMounted(async () => {
  await fetchDeliveryRoutes()
})

// Modal state
const showAddModal = ref(false)
const showEditModal = ref(false)
const editingRoute = ref<DeliveryRoutes | null>(null)
const newDeliveryRoute = ref<NewDeliveryRoute>({
  driver: '',
  vehicle: '',
  stops: 0,
  delivery_time: 0,
  total_distance: 0
})

function openAddModal(): void {
  newDeliveryRoute.value = {
    driver: '',
    vehicle: '',
    stops: 0,
    delivery_time: 0,
    total_distance: 0
  }
  showAddModal.value = true
}

function closeAddModal(): void {
  showAddModal.value = false
}

function openEditModal(route: DeliveryRoutes): void {
  editingRoute.value = route
  newDeliveryRoute.value = {
    driver: route.driver,
    vehicle: route.vehicle,
    stops: route.stops,
    delivery_time: route.delivery_time,
    total_distance: route.total_distance
  }
  showEditModal.value = true
}

function closeEditModal(): void {
  showEditModal.value = false
  editingRoute.value = null
}

async function addDeliveryRoute(): Promise<void> {
  try {
    await createDeliveryRoute(newDeliveryRoute.value)
    closeAddModal()
  } catch (error) {
    console.error('Failed to create delivery route:', error)
  }
}

async function saveDeliveryRoute(): Promise<void> {
  if (!editingRoute.value) return

  try {
    await updateDeliveryRoute({
      ...editingRoute.value,
      ...newDeliveryRoute.value
    })
    closeEditModal()
  } catch (error) {
    console.error('Failed to update delivery route:', error)
  }
}

// Search and filtering
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = 5

const filteredRoutes = computed(() => {
  const routes = Array.isArray(deliveryRoutes.value) ? deliveryRoutes.value : []
  
  if (!searchQuery.value) return routes

  const query = searchQuery.value.toLowerCase()
  return routes.filter(route =>
    route.driver.toLowerCase().includes(query) ||
    route.vehicle.toLowerCase().includes(query) ||
    route.stops.toString().includes(query) ||
    route.delivery_time.toString().includes(query) ||
    route.total_distance.toString().includes(query)
  )
})

const paginatedRoutes = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredRoutes.value.slice(start, end)
})

// Event handlers
const handleSearch = (query: string) => {
  searchQuery.value = query
  currentPage.value = 1
}

const handleAddRoute = () => {
  openAddModal()
}

const handleEditRoute = (route: DeliveryRoutes) => {
  openEditModal(route)
}

const handleDeleteRoute = async (route: DeliveryRoutes) => {
  if (confirm(`Are you sure you want to delete this delivery route?`)) {
    try {
      await deleteDeliveryRoute(route.id)
    } catch (error) {
      console.error('Failed to delete delivery route:', error)
    }
  }
}

const viewRouteOnMap = (route: DeliveryRoutes) => {
  alert(`View route on map: ${route.driver} (${route.stops} stops)`)
}

const handlePrevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const handleNextPage = () => {
  const totalPages = Math.ceil(filteredRoutes.value.length / itemsPerPage)
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
        modelValue="routes"
        :tabs="tabs"
      />

      <div class="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div class="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-medium text-gray-900 dark:text-white">Delivery Routes</h2>
            <button
              @click="handleAddRoute"
              type="button"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-2" />
              Add Route
            </button>
          </div>
          <div class="mt-4">
            <SearchFilter
              placeholder="Search delivery routes..."
              @search="handleSearch"
              class="w-full md:w-96"
            />
          </div>
        </div>

        <DeliveryRoutesTable
          :routes="paginatedRoutes"
          @view-map="viewRouteOnMap"
          @edit="handleEditRoute"
          @delete="handleDeleteRoute"
        />

        <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <Pagination
            :current-page="currentPage"
            :total-items="filteredRoutes.length"
            :items-per-page="itemsPerPage"
            @prev="handlePrevPage"
            @next="handleNextPage"
            @page="handlePageChange"
          />
        </div>
      </div>
    </div>

    <!-- Add Delivery Route Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeAddModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Add New Delivery Route</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="route-driver" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Driver</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="route-driver"
                        v-model="newDeliveryRoute.driver"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter driver name"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="route-vehicle" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Vehicle</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="route-vehicle"
                        v-model="newDeliveryRoute.vehicle"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter vehicle information"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-3 gap-4">
                    <div>
                      <label for="route-stops" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Stops</label>
                      <div class="mt-2">
                        <input
                          type="number"
                          id="route-stops"
                          v-model="newDeliveryRoute.stops"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div>
                      <label for="route-delivery-time" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Delivery Time (hours)</label>
                      <div class="mt-2">
                        <input
                          type="number"
                          id="route-delivery-time"
                          v-model="newDeliveryRoute.delivery_time"
                          step="0.1"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div>
                      <label for="route-total-distance" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Total Distance (km)</label>
                      <div class="mt-2">
                        <input
                          type="number"
                          id="route-total-distance"
                          v-model="newDeliveryRoute.total_distance"
                          step="0.1"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="addDeliveryRoute"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            >
              Add Route
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

    <!-- Edit Delivery Route Modal -->
    <div v-if="showEditModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeEditModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Edit Delivery Route</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="edit-route-driver" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Driver</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="edit-route-driver"
                        v-model="newDeliveryRoute.driver"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter driver name"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="edit-route-vehicle" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Vehicle</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="edit-route-vehicle"
                        v-model="newDeliveryRoute.vehicle"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter vehicle information"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-3 gap-4">
                    <div>
                      <label for="edit-route-stops" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Stops</label>
                      <div class="mt-2">
                        <input
                          type="number"
                          id="edit-route-stops"
                          v-model="newDeliveryRoute.stops"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div>
                      <label for="edit-route-delivery-time" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Delivery Time (hours)</label>
                      <div class="mt-2">
                        <input
                          type="number"
                          id="edit-route-delivery-time"
                          v-model="newDeliveryRoute.delivery_time"
                          step="0.1"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div>
                      <label for="edit-route-total-distance" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Total Distance (km)</label>
                      <div class="mt-2">
                        <input
                          type="number"
                          id="edit-route-total-distance"
                          v-model="newDeliveryRoute.total_distance"
                          step="0.1"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="saveDeliveryRoute"
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
