<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import TabNavigation from '../../../../components/Dashboard/Commerce/Delivery/TabNavigation.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'
import LicenseKeysTable from '../../../../components/Dashboard/Commerce/Delivery/LicenseKeysTable.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'
import { useLicenseKeys } from '../../../../functions/commerce/shippings/license-keys'
import { useCustomers } from '../../../../functions/commerce/customers'
import type { LicenseKeys, NewLicenseKey } from '../../../../types/defaults'

useHead({
  title: 'Dashboard - License Keys',
})

// Get license keys data and functions from the composable
const { licenseKeys, createLicenseKey, fetchLicenseKeys, updateLicenseKey, deleteLicenseKey } = useLicenseKeys()

// Get customers for dropdown
const { customers, fetchCustomers } = useCustomers()

// Fetch data on component mount
onMounted(async () => {
  await Promise.all([
    fetchLicenseKeys(),
    fetchCustomers()
  ])
})

// Modal state
const showAddModal = ref(false)
const showEditModal = ref(false)
const editingLicenseKey = ref<LicenseKeys | null>(null)
const newLicenseKey = ref<NewLicenseKey>({
  key: '',
  template: '',
  customer_id: 0,
  product: '',
  order_id: 0,
  expiry_date: '',
  status: 'Active'
})

function openAddModal(): void {
  newLicenseKey.value = {
    key: '',
    template: '',
    customer_id: 0,
    product: '',
    order_id: 0,
    expiry_date: '',
    status: 'Active'
  }
  showAddModal.value = true
}

function closeAddModal(): void {
  showAddModal.value = false
}

function openEditModal(licenseKey: LicenseKeys): void {
  editingLicenseKey.value = licenseKey
  newLicenseKey.value = {
    key: licenseKey.key,
    template: licenseKey.template,
    customer_id: licenseKey.customer_id,
    product: licenseKey.product,
    order_id: licenseKey.order_id,
    expiry_date: typeof licenseKey.expiry_date === 'string' ? licenseKey.expiry_date : new Date(licenseKey.expiry_date).toISOString().split('T')[0] || '',
    status: licenseKey.status
  }
  showEditModal.value = true
}

function closeEditModal(): void {
  showEditModal.value = false
  editingLicenseKey.value = null
}

async function addLicenseKey(): Promise<void> {
  try {
    await createLicenseKey(newLicenseKey.value)
    closeAddModal()
  } catch (error) {
    console.error('Failed to create license key:', error)
  }
}

async function saveLicenseKey(): Promise<void> {
  if (!editingLicenseKey.value) return

  try {
    await updateLicenseKey({
      ...editingLicenseKey.value,
      ...newLicenseKey.value
    })
    closeEditModal()
  } catch (error) {
    console.error('Failed to update license key:', error)
  }
}

// Search and filtering
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = 5

const filteredLicenseKeys = computed(() => {
  const keys = Array.isArray(licenseKeys.value) ? licenseKeys.value : []
  
  if (!searchQuery.value) return keys

  const query = searchQuery.value.toLowerCase()
  return keys.filter(key =>
    key.key.toLowerCase().includes(query) ||
    key.customer.name.toLowerCase().includes(query) ||
    key.customer.email.toLowerCase().includes(query) ||
    key.product.toLowerCase().includes(query) ||
    key.status.toLowerCase().includes(query)
  )
})

const paginatedLicenseKeys = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredLicenseKeys.value.slice(start, end)
})

// Event handlers
const handleSearch = (query: string) => {
  searchQuery.value = query
  currentPage.value = 1
}

const handleAddLicenseKey = () => {
  openAddModal()
}

const handleEditLicenseKey = (licenseKey: LicenseKeys) => {
  openEditModal(licenseKey)
}

const handleDeleteLicenseKey = async (licenseKey: LicenseKeys) => {
  if (confirm(`Are you sure you want to delete this license key?`)) {
    try {
      await deleteLicenseKey(licenseKey.id)
    } catch (error) {
      console.error('Failed to delete license key:', error)
    }
  }
}

const handlePrevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const handleNextPage = () => {
  const totalPages = Math.ceil(filteredLicenseKeys.value.length / itemsPerPage)
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
        modelValue="license"
        :tabs="tabs"
      />

      <div class="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div class="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-medium text-gray-900 dark:text-white">License Keys</h2>
            <button
              @click="handleAddLicenseKey"
              type="button"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-2" />
              Add License Key
            </button>
          </div>
          <div class="mt-4">
            <SearchFilter
              placeholder="Search license keys..."
              @search="handleSearch"
              class="w-full md:w-96"
            />
          </div>
        </div>

        <LicenseKeysTable
          :licenseKeys="paginatedLicenseKeys"
          @edit="handleEditLicenseKey"
          @delete="handleDeleteLicenseKey"
        />

        <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <Pagination
            :current-page="currentPage"
            :total-items="filteredLicenseKeys.length"
            :items-per-page="itemsPerPage"
            @prev="handlePrevPage"
            @next="handleNextPage"
            @page="handlePageChange"
          />
        </div>
      </div>
    </div>

    <!-- Add License Key Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeAddModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Add New License Key</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="license-key" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">License Key</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="license-key"
                        v-model="newLicenseKey.key"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter license key"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="license-template" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Template</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="license-template"
                        v-model="newLicenseKey.template"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter template name"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="license-customer" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Customer</label>
                    <div class="mt-2">
                      <select
                        id="license-customer"
                        v-model="newLicenseKey.customer_id"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option value="0">Select a customer</option>
                        <option v-for="customer in customers" :key="customer.id" :value="customer.id">
                          {{ customer.name }} ({{ customer.email }})
                        </option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label for="product" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Product</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="product"
                        v-model="newLicenseKey.product"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Product name"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="order-id" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Order ID</label>
                      <div class="mt-2">
                        <input
                          type="number"
                          id="order-id"
                          v-model="newLicenseKey.order_id"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="Order ID"
                        />
                      </div>
                    </div>

                    <div>
                      <label for="expiry-date" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Expiry Date</label>
                      <div class="mt-2">
                        <input
                          type="date"
                          id="expiry-date"
                          v-model="newLicenseKey.expiry_date"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label for="license-status" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Status</label>
                    <div class="mt-2">
                      <select
                        id="license-status"
                        v-model="newLicenseKey.status"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Expired">Expired</option>
                        <option value="Revoked">Revoked</option>
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
              @click="addLicenseKey"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            >
              Add License Key
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

    <!-- Edit License Key Modal -->
    <div v-if="showEditModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeEditModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Edit License Key</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="edit-license-key" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">License Key</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="edit-license-key"
                        v-model="newLicenseKey.key"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter license key"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="edit-license-template" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Template</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="edit-license-template"
                        v-model="newLicenseKey.template"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter template name"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="edit-license-customer" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Customer</label>
                    <div class="mt-2">
                      <select
                        id="edit-license-customer"
                        v-model="newLicenseKey.customer_id"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option value="0">Select a customer</option>
                        <option v-for="customer in customers" :key="customer.id" :value="customer.id">
                          {{ customer.name }} ({{ customer.email }})
                        </option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label for="edit-product" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Product</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="edit-product"
                        v-model="newLicenseKey.product"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Product name"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="edit-order-id" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Order ID</label>
                      <div class="mt-2">
                        <input
                          type="number"
                          id="edit-order-id"
                          v-model="newLicenseKey.order_id"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="Order ID"
                        />
                      </div>
                    </div>

                    <div>
                      <label for="edit-expiry-date" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Expiry Date</label>
                      <div class="mt-2">
                        <input
                          type="date"
                          id="edit-expiry-date"
                          v-model="newLicenseKey.expiry_date"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label for="edit-license-status" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Status</label>
                    <div class="mt-2">
                      <select
                        id="edit-license-status"
                        v-model="newLicenseKey.status"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Expired">Expired</option>
                        <option value="Revoked">Revoked</option>
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
              @click="saveLicenseKey"
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
