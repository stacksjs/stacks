<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import TabNavigation from '../../../../components/Dashboard/Commerce/Delivery/TabNavigation.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'
import DriversTable from '../../../../components/Dashboard/Commerce/Delivery/DriversTable.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'
import { useDrivers } from '../../../../functions/commerce/shippings/drivers'
import type { Drivers } from '../../../../types/defaults'

useHead({
  title: 'Dashboard - Delivery Drivers',
})

// Get drivers data and functions from the composable
const { drivers, createDriver, fetchDrivers, updateDriver, deleteDriver } = useDrivers()

// Fetch data on component mount
onMounted(async () => {
  await fetchDrivers()
})

// Define new driver type
interface NewDriverForm {
  user_id: number
  name: string
  phone: string
  vehicle_number: string
  license: string
  status: string
}

// Modal state
const showAddModal = ref(false)
const showEditModal = ref(false)
const editingDriver = ref<Drivers | null>(null)
const newDriver = ref<NewDriverForm>({
  user_id: 0,
  name: '',
  phone: '',
  vehicle_number: '',
  license: '',
  status: 'Active'
})

function openAddModal(): void {
  newDriver.value = {
    user_id: 0,
    name: '',
    phone: '',
    vehicle_number: '',
    license: '',
    status: 'Active'
  }
  showAddModal.value = true
}

function closeAddModal(): void {
  showAddModal.value = false
}

function openEditModal(driver: Drivers): void {
  editingDriver.value = driver
  newDriver.value = {
    user_id: driver.user_id,
    name: driver.name,
    phone: driver.phone,
    vehicle_number: driver.vehicle_number,
    license: driver.license,
    status: typeof driver.status === 'string' ? driver.status : (Array.isArray(driver.status) ? driver.status[0] || 'Active' : 'Active')
  }
  showEditModal.value = true
}

function closeEditModal(): void {
  showEditModal.value = false
  editingDriver.value = null
}

async function addDriver(): Promise<void> {
  try {
    await createDriver(newDriver.value)
    closeAddModal()
  } catch (error) {
    console.error('Failed to create driver:', error)
  }
}

async function saveDriver(): Promise<void> {
  if (!editingDriver.value) return

  try {
    await updateDriver({
      ...editingDriver.value,
      ...newDriver.value
    })
    closeEditModal()
  } catch (error) {
    console.error('Failed to update driver:', error)
  }
}

// Search and filtering
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = 5

const filteredDrivers = computed(() => {
  const driverList = Array.isArray(drivers.value) ? drivers.value : []
  
  if (!searchQuery.value) return driverList

  const query = searchQuery.value.toLowerCase()
  return driverList.filter(driver =>
    driver.name.toLowerCase().includes(query) ||
    driver.phone.toLowerCase().includes(query) ||
    driver.vehicle_number.toLowerCase().includes(query) ||
    driver.license.toLowerCase().includes(query) ||
    (typeof driver.status === 'string' ? driver.status.toLowerCase().includes(query) : false)
  )
})

const paginatedDrivers = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredDrivers.value.slice(start, end)
})

// Event handlers
const handleSearch = (query: string) => {
  searchQuery.value = query
  currentPage.value = 1
}

const handleAddDriver = () => {
  openAddModal()
}

const handleEditDriver = (driver: Drivers) => {
  openEditModal(driver)
}

const handleDeleteDriver = async (driver: Drivers) => {
  if (confirm(`Are you sure you want to delete this driver?`)) {
    try {
      await deleteDriver(driver.id)
    } catch (error) {
      console.error('Failed to delete driver:', error)
    }
  }
}

const viewDriverRoutes = (driver: Drivers) => {
  alert(`View routes for driver: ${driver.name}`)
}

const handlePrevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const handleNextPage = () => {
  const totalPages = Math.ceil(filteredDrivers.value.length / itemsPerPage)
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
        modelValue="drivers"
        :tabs="tabs"
      />

      <!-- Stats section -->
      <div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6 dark:bg-gray-800">
          <dt>
            <div class="absolute rounded-md bg-blue-500 p-3">
              <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <p class="ml-16 truncate text-sm text-gray-500 font-medium dark:text-gray-400">
              Total Drivers
            </p>
          </dt>
          <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
            <p class="text-2xl text-gray-900 font-semibold dark:text-white">
              {{ drivers.length }}
            </p>
            <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
              <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
              </svg>
              <span class="sr-only"> Increased by </span>
              2
            </p>
          </dd>
        </div>

        <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6 dark:bg-gray-800">
          <dt>
            <div class="absolute rounded-md bg-green-500 p-3">
              <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
            </div>
            <p class="ml-16 truncate text-sm text-gray-500 font-medium dark:text-gray-400">
              Active Drivers
            </p>
          </dt>
          <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
            <p class="text-2xl text-gray-900 font-semibold dark:text-white">
              {{ drivers.filter(d => d.status === 'Active' || d.status === 'On Delivery').length }}
            </p>
            <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
              <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
              </svg>
              <span class="sr-only"> Increased by </span>
              1
            </p>
          </dd>
        </div>

        <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6 dark:bg-gray-800">
          <dt>
            <div class="absolute rounded-md bg-blue-500 p-3">
              <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            </div>
            <p class="ml-16 truncate text-sm text-gray-500 font-medium dark:text-gray-400">
              Average Rating
            </p>
          </dt>
          <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
            <p class="text-2xl text-gray-900 font-semibold dark:text-white">
              {{ drivers.length > 0 ? '4.7' : '0.0' }}
            </p>
            <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
              <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
              </svg>
              <span class="sr-only"> Increased by </span>
              0.2
            </p>
          </dd>
        </div>
      </div>

      <div class="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div class="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-medium text-gray-900 dark:text-white">Delivery Drivers</h2>
            <button
              @click="handleAddDriver"
              type="button"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-2" />
              Add Driver
            </button>
          </div>
          <div class="mt-4">
            <SearchFilter
              placeholder="Search drivers..."
              @search="handleSearch"
              class="w-full md:w-96"
            />
          </div>
        </div>

        <DriversTable
          :drivers="paginatedDrivers"
          @view-routes="viewDriverRoutes"
          @edit="handleEditDriver"
          @delete="handleDeleteDriver"
        />

        <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <Pagination
            :current-page="currentPage"
            :total-items="filteredDrivers.length"
            :items-per-page="itemsPerPage"
            @prev="handlePrevPage"
            @next="handleNextPage"
            @page="handlePageChange"
          />
        </div>
      </div>
    </div>

    <!-- Add Driver Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeAddModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Add New Driver</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="driver-name" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Name</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="driver-name"
                        v-model="newDriver.name"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter driver name"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="driver-phone" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Phone</label>
                    <div class="mt-2">
                      <input
                        type="tel"
                        id="driver-phone"
                        v-model="newDriver.phone"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter phone number"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="driver-vehicle" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Vehicle Number</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="driver-vehicle"
                        v-model="newDriver.vehicle_number"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter vehicle number"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="driver-license" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">License</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="driver-license"
                        v-model="newDriver.license"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter license number"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="driver-status" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Status</label>
                    <div class="mt-2">
                      <select
                        id="driver-status"
                        v-model="newDriver.status"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option value="Active">Active</option>
                        <option value="On Delivery">On Delivery</option>
                        <option value="On Break">On Break</option>
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
              @click="addDriver"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            >
              Add Driver
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

    <!-- Edit Driver Modal -->
    <div v-if="showEditModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeEditModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Edit Driver</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="edit-driver-name" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Name</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="edit-driver-name"
                        v-model="newDriver.name"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter driver name"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="edit-driver-phone" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Phone</label>
                    <div class="mt-2">
                      <input
                        type="tel"
                        id="edit-driver-phone"
                        v-model="newDriver.phone"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter phone number"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="edit-driver-vehicle" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Vehicle Number</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="edit-driver-vehicle"
                        v-model="newDriver.vehicle_number"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter vehicle number"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="edit-driver-license" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">License</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="edit-driver-license"
                        v-model="newDriver.license"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter license number"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="edit-driver-status" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Status</label>
                    <div class="mt-2">
                      <select
                        id="edit-driver-status"
                        v-model="newDriver.status"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option value="Active">Active</option>
                        <option value="On Delivery">On Delivery</option>
                        <option value="On Break">On Break</option>
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
              @click="saveDriver"
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
