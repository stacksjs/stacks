<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import TabNavigation from '../../../../components/Dashboard/Commerce/Delivery/TabNavigation.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'
import DigitalDeliveryTable from '../../../../components/Dashboard/Commerce/Delivery/DigitalDeliveryTable.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'
import { useDigitalDeliveries } from '../../../../functions/commerce/shippings/digital-deliveries'

useHead({
  title: 'Dashboard - Digital Delivery',
})

// Get digital deliveries data and functions from the composable
const { digitalDeliveries, createDigitalDelivery, fetchDigitalDeliveries, updateDigitalDelivery, deleteDigitalDelivery } = useDigitalDeliveries()

// Fetch data on component mount
onMounted(async () => {
  await fetchDigitalDeliveries()
})

// Define new digital delivery type
interface NewDigitalDeliveryForm {
  name: string
  description: string
  download_limit?: number
  expiry_days: number
  requires_login?: boolean
  automatic_delivery?: boolean
  status?: string
}

// Modal state
const showAddModal = ref(false)
const showEditModal = ref(false)
const editingDelivery = ref<any>(null)
const newDigitalDelivery = ref<NewDigitalDeliveryForm>({
  name: '',
  description: '',
  download_limit: undefined,
  expiry_days: 30,
  requires_login: false,
  automatic_delivery: true,
  status: 'Active'
})

function openAddModal(): void {
  newDigitalDelivery.value = {
    name: '',
    description: '',
    download_limit: undefined,
    expiry_days: 30,
    requires_login: false,
    automatic_delivery: true,
    status: 'Active'
  }
  showAddModal.value = true
}

function closeAddModal(): void {
  showAddModal.value = false
}

function openEditModal(delivery: any): void {
  editingDelivery.value = delivery
  newDigitalDelivery.value = {
    name: delivery.name,
    description: delivery.description,
    download_limit: delivery.download_limit ?? undefined,
    expiry_days: delivery.expiry_days ?? 30,
    requires_login: delivery.requires_login ?? false,
    automatic_delivery: delivery.automatic_delivery ?? true,
    status: delivery.status ?? 'Active'
  }
  showEditModal.value = true
}

function closeEditModal(): void {
  showEditModal.value = false
  editingDelivery.value = null
}

async function addDigitalDelivery(): Promise<void> {
  try {
    await createDigitalDelivery(newDigitalDelivery.value)
    closeAddModal()
  } catch (error) {
    console.error('Failed to create digital delivery:', error)
  }
}

async function saveDigitalDelivery(): Promise<void> {
  if (!editingDelivery.value) return

  try {
    await updateDigitalDelivery({
      ...editingDelivery.value,
      ...newDigitalDelivery.value
    })
    closeEditModal()
  } catch (error) {
    console.error('Failed to update digital delivery:', error)
  }
}

// Search and filtering
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = 5

const filteredDigitalDeliveries = computed(() => {
  // Ensure digitalDeliveries.value is always an array
  const deliveries = Array.isArray(digitalDeliveries.value) ? digitalDeliveries.value : []
  
  if (!searchQuery.value) return deliveries

  const query = searchQuery.value.toLowerCase()
  return deliveries.filter(delivery =>
    delivery.name.toLowerCase().includes(query) ||
    delivery.description.toLowerCase().includes(query)
  )
})

const paginatedDigitalDeliveries = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredDigitalDeliveries.value.slice(start, end)
})

// Event handlers
const handleSearch = (query: string) => {
  searchQuery.value = query
  currentPage.value = 1
}

const handleAddDigitalMethod = () => {
  openAddModal()
}

const handleEditDigitalMethod = (delivery: any) => {
  openEditModal(delivery)
}

const handleDeleteDigitalMethod = async (delivery: any) => {
  if (confirm(`Are you sure you want to delete this digital delivery method?`)) {
    try {
      await deleteDigitalDelivery(delivery.id)
    } catch (error) {
      console.error('Failed to delete digital delivery:', error)
    }
  }
}

const handlePrevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const handleNextPage = () => {
  const totalPages = Math.ceil(filteredDigitalDeliveries.value.length / itemsPerPage)
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
        modelValue="digital"
        :tabs="tabs"
      />

      <div class="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div class="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-medium text-gray-900 dark:text-white">Digital Delivery Methods</h2>
            <button
              @click="handleAddDigitalMethod"
              type="button"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-2" />
              Add Digital Method
            </button>
          </div>
          <div class="mt-4">
            <SearchFilter
              placeholder="Search digital delivery methods..."
              @search="handleSearch"
              class="w-full md:w-96"
            />
          </div>
        </div>

        <DigitalDeliveryTable
          :methods="paginatedDigitalDeliveries"
          @edit="handleEditDigitalMethod"
          @delete="handleDeleteDigitalMethod"
        />

        <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <Pagination
            :current-page="currentPage"
            :total-items="filteredDigitalDeliveries.length"
            :items-per-page="itemsPerPage"
            @prev="handlePrevPage"
            @next="handleNextPage"
            @page="handlePageChange"
          />
        </div>
      </div>
    </div>

    <!-- Add Digital Delivery Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeAddModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Add New Digital Delivery Method</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="delivery-name" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Name</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="delivery-name"
                        v-model="newDigitalDelivery.name"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter delivery method name"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="delivery-description" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Description</label>
                    <div class="mt-2">
                      <textarea
                        id="delivery-description"
                        v-model="newDigitalDelivery.description"
                        rows="3"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter description"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="delivery-download-limit" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Download Limit</label>
                      <div class="mt-2">
                        <input
                          type="number"
                          id="delivery-download-limit"
                          v-model="newDigitalDelivery.download_limit"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="Leave empty for unlimited"
                        />
                      </div>
                    </div>

                    <div>
                      <label for="delivery-expiry-days" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Expiry Days</label>
                      <div class="mt-2">
                        <input
                          type="number"
                          id="delivery-expiry-days"
                          v-model="newDigitalDelivery.expiry_days"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="Leave empty for no expiry"
                        />
                      </div>
                    </div>
                  </div>

                  <div class="space-y-3">
                    <div class="flex items-center">
                      <input
                        id="delivery-requires-login"
                        v-model="newDigitalDelivery.requires_login"
                        type="checkbox"
                        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700"
                      />
                      <label for="delivery-requires-login" class="ml-2 block text-sm text-gray-900 dark:text-gray-200">
                        Requires Login
                      </label>
                    </div>

                    <div class="flex items-center">
                      <input
                        id="delivery-automatic-delivery"
                        v-model="newDigitalDelivery.automatic_delivery"
                        type="checkbox"
                        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700"
                      />
                      <label for="delivery-automatic-delivery" class="ml-2 block text-sm text-gray-900 dark:text-gray-200">
                        Automatic Delivery
                      </label>
                    </div>
                  </div>

                  <div>
                    <label for="delivery-status" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Status</label>
                    <div class="mt-2">
                      <select
                        id="delivery-status"
                        v-model="newDigitalDelivery.status"
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
              @click="addDigitalDelivery"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            >
              Add Method
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

    <!-- Edit Digital Delivery Modal -->
    <div v-if="showEditModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeEditModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Edit Digital Delivery Method</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="edit-delivery-name" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Name</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="edit-delivery-name"
                        v-model="newDigitalDelivery.name"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter delivery method name"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="edit-delivery-description" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Description</label>
                    <div class="mt-2">
                      <textarea
                        id="edit-delivery-description"
                        v-model="newDigitalDelivery.description"
                        rows="3"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter description"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="edit-delivery-download-limit" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Download Limit</label>
                      <div class="mt-2">
                        <input
                          type="number"
                          id="edit-delivery-download-limit"
                          v-model="newDigitalDelivery.download_limit"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="Leave empty for unlimited"
                        />
                      </div>
                    </div>

                    <div>
                      <label for="edit-delivery-expiry-days" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Expiry Days</label>
                      <div class="mt-2">
                        <input
                          type="number"
                          id="edit-delivery-expiry-days"
                          v-model="newDigitalDelivery.expiry_days"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="Leave empty for no expiry"
                        />
                      </div>
                    </div>
                  </div>

                  <div class="space-y-3">
                    <div class="flex items-center">
                      <input
                        id="edit-delivery-requires-login"
                        v-model="newDigitalDelivery.requires_login"
                        type="checkbox"
                        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700"
                      />
                      <label for="edit-delivery-requires-login" class="ml-2 block text-sm text-gray-900 dark:text-gray-200">
                        Requires Login
                      </label>
                    </div>

                    <div class="flex items-center">
                      <input
                        id="edit-delivery-automatic-delivery"
                        v-model="newDigitalDelivery.automatic_delivery"
                        type="checkbox"
                        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700"
                      />
                      <label for="edit-delivery-automatic-delivery" class="ml-2 block text-sm text-gray-900 dark:text-gray-200">
                        Automatic Delivery
                      </label>
                    </div>
                  </div>

                  <div>
                    <label for="edit-delivery-status" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Status</label>
                    <div class="mt-2">
                      <select
                        id="edit-delivery-status"
                        v-model="newDigitalDelivery.status"
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
              @click="saveDigitalDelivery"
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
