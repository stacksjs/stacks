<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import TabNavigation from '../../../../components/Dashboard/Commerce/Delivery/TabNavigation.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'
import ShippingMethodsTable from '../../../../components/Dashboard/Commerce/Delivery/ShippingMethodsTable.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'
import { useShippingMethods } from '../../../../functions/commerce/shippings/shipping-methods'
import type { NewShippingMethod } from '../../../../types/defaults'

useHead({
  title: 'Dashboard - Shipping Methods',
})

// Get shipping methods data and functions from the composable
const { shippingMethods, createShippingMethod, fetchShippingMethods, updateShippingMethod, deleteShippingMethod } = useShippingMethods()

// Fetch shipping methods on component mount
onMounted(async () => {
  await fetchShippingMethods()
})

// Modal state
const showAddModal = ref(false)
const showEditModal = ref(false)
const editingMethod = ref<any>(null)
const newShippingMethod = ref<NewShippingMethod>({
  name: '',
  description: '',
  base_rate: 0,
  free_shipping: undefined,
  status: 'Active'
})

function openAddModal(): void {
  newShippingMethod.value = {
    name: '',
    description: '',
    base_rate: 0,
    free_shipping: undefined,
    status: 'Active'
  }
  showAddModal.value = true
}

function closeAddModal(): void {
  showAddModal.value = false
}

function openEditModal(method: any): void {
  editingMethod.value = method
  newShippingMethod.value = {
    name: method.name,
    description: method.description || '',
    base_rate: method.base_rate,
    free_shipping: method.free_shipping,
    status: method.status
  }
  showEditModal.value = true
}

function closeEditModal(): void {
  showEditModal.value = false
  editingMethod.value = null
}

async function addShippingMethod(): Promise<void> {
  try {
    await createShippingMethod(newShippingMethod.value)
    closeAddModal()
  } catch (error) {
    console.error('Failed to create shipping method:', error)
  }
}

async function saveShippingMethod(): Promise<void> {
  if (!editingMethod.value) return

  try {
    await updateShippingMethod({
      ...editingMethod.value,
      ...newShippingMethod.value
    })
    closeEditModal()
  } catch (error) {
    console.error('Failed to update shipping method:', error)
  }
}

// Search and filtering
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = 5

const filteredShippingMethods = computed(() => {
  if (!searchQuery.value) return shippingMethods.value

  const query = searchQuery.value.toLowerCase()
  return shippingMethods.value.filter(method =>
    method.name.toLowerCase().includes(query) ||
    method.description?.toLowerCase().includes(query)
  )
})

const paginatedShippingMethods = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredShippingMethods.value.slice(start, end)
})

// Event handlers
const handleSearch = (query: string) => {
  searchQuery.value = query
  currentPage.value = 1
}

const handleAddMethod = () => {
  openAddModal()
}

const handleEditMethod = (method: any) => {
  openEditModal(method)
}

const handleDeleteMethod = async (method: any) => {
  if (confirm(`Are you sure you want to delete ${method.name}?`)) {
    try {
      await deleteShippingMethod(method.id)
    } catch (error) {
      console.error('Failed to delete shipping method:', error)
    }
  }
}

const handlePrevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const handleNextPage = () => {
  const totalPages = Math.ceil(filteredShippingMethods.value.length / itemsPerPage)
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
        modelValue="methods"
        :tabs="tabs"
      />

      <div class="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div class="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-medium text-gray-900 dark:text-white">Shipping Methods</h2>
            <button
              @click="handleAddMethod"
              type="button"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-2" />
              Add Method
            </button>
          </div>
          <div class="mt-4">
            <SearchFilter
              placeholder="Search shipping methods..."
              @search="handleSearch"
              class="w-full md:w-96"
            />
          </div>
        </div>

        <ShippingMethodsTable
          :methods="paginatedShippingMethods"
          @edit="handleEditMethod"
          @delete="handleDeleteMethod"
        />

        <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <Pagination
            :current-page="currentPage"
            :total-items="filteredShippingMethods.length"
            :items-per-page="itemsPerPage"
            @prev="handlePrevPage"
            @next="handleNextPage"
            @page="handlePageChange"
          />
        </div>
      </div>
    </div>

    <!-- Add Shipping Method Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeAddModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Add New Shipping Method</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="method-name" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Method Name</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="method-name"
                        v-model="newShippingMethod.name"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter method name"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="method-description" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Description</label>
                    <div class="mt-2">
                      <textarea
                        id="method-description"
                        v-model="newShippingMethod.description"
                        rows="3"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter method description"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="base-rate" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Base Rate ($)</label>
                    <div class="mt-2">
                      <div class="relative rounded-md shadow-sm">
                        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <span class="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          id="base-rate"
                          v-model="newShippingMethod.base_rate"
                          step="0.01"
                          min="0"
                          class="block w-full rounded-md border-0 py-1.5 pl-7 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label for="free-shipping" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Free Shipping Threshold ($)</label>
                    <div class="mt-2">
                      <div class="relative rounded-md shadow-sm">
                        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <span class="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          id="free-shipping"
                          v-model="newShippingMethod.free_shipping"
                          step="0.01"
                          min="0"
                          class="block w-full rounded-md border-0 py-1.5 pl-7 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="Leave empty for no threshold"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label for="method-status" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Status</label>
                    <div class="mt-2">
                      <select
                        id="method-status"
                        v-model="newShippingMethod.status"
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
              @click="addShippingMethod"
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

    <!-- Edit Shipping Method Modal -->
    <div v-if="showEditModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeEditModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Edit Shipping Method</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="edit-method-name" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Method Name</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="edit-method-name"
                        v-model="newShippingMethod.name"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter method name"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="edit-method-description" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Description</label>
                    <div class="mt-2">
                      <textarea
                        id="edit-method-description"
                        v-model="newShippingMethod.description"
                        rows="3"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter method description"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="edit-base-rate" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Base Rate ($)</label>
                    <div class="mt-2">
                      <div class="relative rounded-md shadow-sm">
                        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <span class="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          id="edit-base-rate"
                          v-model="newShippingMethod.base_rate"
                          step="0.01"
                          min="0"
                          class="block w-full rounded-md border-0 py-1.5 pl-7 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label for="edit-free-shipping" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Free Shipping Threshold ($)</label>
                    <div class="mt-2">
                      <div class="relative rounded-md shadow-sm">
                        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <span class="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          id="edit-free-shipping"
                          v-model="newShippingMethod.free_shipping"
                          step="0.01"
                          min="0"
                          class="block w-full rounded-md border-0 py-1.5 pl-7 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="Leave empty for no threshold"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label for="edit-method-status" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Status</label>
                    <div class="mt-2">
                      <select
                        id="edit-method-status"
                        v-model="newShippingMethod.status"
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
              @click="saveShippingMethod"
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
