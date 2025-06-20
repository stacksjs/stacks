<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import TabNavigation from '../../../../components/Dashboard/Commerce/Delivery/TabNavigation.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'
import LicenseKeysTable from '../../../../components/Dashboard/Commerce/Delivery/LicenseKeysTable.vue'
import LicenseTemplatesTable from '../../../../components/Dashboard/Commerce/Delivery/LicenseTemplatesTable.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'
import { useLicenseKeys } from '../../../../functions/commerce/shippings/license-keys'
import { useLicenseTemplates } from '../../../../functions/commerce/shippings/license-templates'
import type { LicenseKeys, LicenseTemplates } from '../../../../functions/types'

useHead({
  title: 'Dashboard - License Keys',
})

// Get license keys and templates data and functions from the composables
const { licenseKeys, createLicenseKey, fetchLicenseKeys, updateLicenseKey, deleteLicenseKey } = useLicenseKeys()
const { licenseTemplates, createLicenseTemplate, fetchLicenseTemplates, updateLicenseTemplate, deleteLicenseTemplate } = useLicenseTemplates()

// Fetch data on component mount
onMounted(async () => {
  await Promise.all([
    fetchLicenseKeys(),
    fetchLicenseTemplates()
  ])
})

// Define new license key type
interface NewLicenseKeyForm {
  key: string
  template: string
  customer: {
    id: number
    name: string
    email: string
  }
  product: string
  order_id: number
  expiry_date: string
  status: string
}

// Define new license template type
interface NewLicenseTemplateForm {
  name: string
  format: string
  prefix: string
  suffix: string
  separator: string
  char_set: string
  segment_length: number
  segment_count: number
  active: boolean
  status: string
}

// Modal state
const showAddLicenseKeyModal = ref(false)
const showEditLicenseKeyModal = ref(false)
const showAddTemplateModal = ref(false)
const showEditTemplateModal = ref(false)
const editingLicenseKey = ref<LicenseKeys | null>(null)
const editingTemplate = ref<LicenseTemplates | null>(null)

const newLicenseKey = ref<NewLicenseKeyForm>({
  key: '',
  template: '',
  customer: { id: 0, name: '', email: '' },
  product: '',
  order_id: 0,
  expiry_date: '',
  status: 'Active'
})

const newLicenseTemplate = ref<NewLicenseTemplateForm>({
  name: '',
  format: 'Alphanumeric',
  prefix: '',
  suffix: '',
  separator: '-',
  char_set: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  segment_length: 4,
  segment_count: 4,
  active: true,
  status: 'Active'
})

// License Keys Modal Functions
function openAddLicenseKeyModal(): void {
  newLicenseKey.value = {
    key: '',
    template: '',
    customer: { id: 0, name: '', email: '' },
    product: '',
    order_id: 0,
    expiry_date: '',
    status: 'Active'
  }
  showAddLicenseKeyModal.value = true
}

function closeAddLicenseKeyModal(): void {
  showAddLicenseKeyModal.value = false
}

function openEditLicenseKeyModal(licenseKey: LicenseKeys): void {
  editingLicenseKey.value = licenseKey
  newLicenseKey.value = {
    key: licenseKey.key,
    template: licenseKey.template,
    customer: licenseKey.customer,
    product: licenseKey.product,
    order_id: licenseKey.order_id,
    expiry_date: typeof licenseKey.expiry_date === 'string' ? licenseKey.expiry_date : new Date(licenseKey.expiry_date).toISOString().split('T')[0],
    status: licenseKey.status
  }
  showEditLicenseKeyModal.value = true
}

function closeEditLicenseKeyModal(): void {
  showEditLicenseKeyModal.value = false
  editingLicenseKey.value = null
}

async function addLicenseKey(): Promise<void> {
  try {
    await createLicenseKey(newLicenseKey.value)
    closeAddLicenseKeyModal()
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
    closeEditLicenseKeyModal()
  } catch (error) {
    console.error('Failed to update license key:', error)
  }
}

// License Templates Modal Functions
function openAddTemplateModal(): void {
  newLicenseTemplate.value = {
    name: '',
    format: 'Alphanumeric',
    prefix: '',
    suffix: '',
    separator: '-',
    char_set: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    segment_length: 4,
    segment_count: 4,
    active: true,
    status: 'Active'
  }
  showAddTemplateModal.value = true
}

function closeAddTemplateModal(): void {
  showAddTemplateModal.value = false
}

function openEditTemplateModal(template: LicenseTemplates): void {
  editingTemplate.value = template
  newLicenseTemplate.value = {
    name: template.name,
    format: template.format,
    prefix: template.prefix,
    suffix: template.suffix,
    separator: template.separator,
    char_set: template.char_set,
    segment_length: template.segment_length,
    segment_count: template.segment_count,
    active: template.active,
    status: Array.isArray(template.status) ? template.status[0] || 'Active' : template.status || 'Active'
  }
  showEditTemplateModal.value = true
}

function closeEditTemplateModal(): void {
  showEditTemplateModal.value = false
  editingTemplate.value = null
}

async function addLicenseTemplate(): Promise<void> {
  try {
    await createLicenseTemplate(newLicenseTemplate.value)
    closeAddTemplateModal()
  } catch (error) {
    console.error('Failed to create license template:', error)
  }
}

async function saveLicenseTemplate(): Promise<void> {
  if (!editingTemplate.value) return

  try {
    await updateLicenseTemplate({
      ...editingTemplate.value,
      ...newLicenseTemplate.value
    })
    closeEditTemplateModal()
  } catch (error) {
    console.error('Failed to update license template:', error)
  }
}

// Active tab for license keys section
const licenseActiveTab = ref('keys')

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

const filteredLicenseTemplates = computed(() => {
  const templates = Array.isArray(licenseTemplates.value) ? licenseTemplates.value : []
  
  if (!searchQuery.value) return templates

  const query = searchQuery.value.toLowerCase()
  return templates.filter(template =>
    template.name.toLowerCase().includes(query) ||
    template.format.toLowerCase().includes(query)
  )
})

const paginatedLicenseKeys = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredLicenseKeys.value.slice(start, end)
})

const paginatedLicenseTemplates = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredLicenseTemplates.value.slice(start, end)
})

// Event handlers
const handleSearch = (query: string) => {
  searchQuery.value = query
  currentPage.value = 1
}

const handleAddLicenseKey = () => {
  openAddLicenseKeyModal()
}

const handleEditLicenseKey = (licenseKey: LicenseKeys) => {
  openEditLicenseKeyModal(licenseKey)
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

const handleAddLicenseTemplate = () => {
  openAddTemplateModal()
}

const handleEditLicenseTemplate = (template: LicenseTemplates) => {
  openEditTemplateModal(template)
}

const handleDeleteLicenseTemplate = async (template: LicenseTemplates) => {
  if (confirm(`Are you sure you want to delete this license template?`)) {
    try {
      await deleteLicenseTemplate(template.id)
    } catch (error) {
      console.error('Failed to delete license template:', error)
    }
  }
}

const handlePrevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const handleNextPage = () => {
  const totalItems = licenseActiveTab.value === 'keys'
    ? filteredLicenseKeys.value.length
    : filteredLicenseTemplates.value.length

  const totalPages = Math.ceil(totalItems / itemsPerPage)
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

// License section tabs
const licenseTabs = [
  { name: 'License Keys', value: 'keys' },
  { name: 'License Templates', value: 'templates' }
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
        <!-- License section tabs -->
        <div class="border-b border-gray-200 dark:border-gray-700">
          <nav class="px-4 py-3 flex space-x-8">
            <button
              v-for="tab in licenseTabs"
              :key="tab.value"
              @click="licenseActiveTab = tab.value; currentPage = 1"
              :class="[
                tab.value === licenseActiveTab
                  ? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300',
                'whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium'
              ]"
            >
              {{ tab.name }}
            </button>
          </nav>
        </div>

        <!-- License Keys Tab -->
        <div v-if="licenseActiveTab === 'keys'">
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
        </div>

        <!-- License Templates Tab -->
        <div v-if="licenseActiveTab === 'templates'">
          <div class="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
            <div class="flex justify-between items-center">
              <h2 class="text-lg font-medium text-gray-900 dark:text-white">License Key Templates</h2>
              <button
                @click="handleAddLicenseTemplate"
                type="button"
                class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <div class="i-hugeicons-plus-sign h-5 w-5 mr-2" />
                Add Template
              </button>
            </div>
            <div class="mt-4">
              <SearchFilter
                placeholder="Search license templates..."
                @search="handleSearch"
                class="w-full md:w-96"
              />
            </div>
          </div>

          <LicenseTemplatesTable
            :templates="paginatedLicenseTemplates"
            @edit="handleEditLicenseTemplate"
            @delete="handleDeleteLicenseTemplate"
          />
        </div>

        <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <Pagination
            :current-page="currentPage"
            :total-items="licenseActiveTab === 'keys' ? filteredLicenseKeys.length : filteredLicenseTemplates.length"
            :items-per-page="itemsPerPage"
            @prev="handlePrevPage"
            @next="handleNextPage"
            @page="handlePageChange"
          />
        </div>
      </div>
    </div>

    <!-- Add License Key Modal -->
    <div v-if="showAddLicenseKeyModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeAddLicenseKeyModal"></div>

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

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="customer-name" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Customer Name</label>
                      <div class="mt-2">
                        <input
                          type="text"
                          id="customer-name"
                          v-model="newLicenseKey.customer.name"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="Customer name"
                        />
                      </div>
                    </div>

                    <div>
                      <label for="customer-email" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Customer Email</label>
                      <div class="mt-2">
                        <input
                          type="email"
                          id="customer-email"
                          v-model="newLicenseKey.customer.email"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="Customer email"
                        />
                      </div>
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
              @click="closeAddLicenseKeyModal"
              class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit License Key Modal -->
    <div v-if="showEditLicenseKeyModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeEditLicenseKeyModal"></div>

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

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="edit-customer-name" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Customer Name</label>
                      <div class="mt-2">
                        <input
                          type="text"
                          id="edit-customer-name"
                          v-model="newLicenseKey.customer.name"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="Customer name"
                        />
                      </div>
                    </div>

                    <div>
                      <label for="edit-customer-email" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Customer Email</label>
                      <div class="mt-2">
                        <input
                          type="email"
                          id="edit-customer-email"
                          v-model="newLicenseKey.customer.email"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="Customer email"
                        />
                      </div>
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
              @click="closeEditLicenseKeyModal"
              class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add License Template Modal -->
    <div v-if="showAddTemplateModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeAddTemplateModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Add New License Template</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="template-name" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Template Name</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="template-name"
                        v-model="newLicenseTemplate.name"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter template name"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="template-format" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Format</label>
                    <div class="mt-2">
                      <select
                        id="template-format"
                        v-model="newLicenseTemplate.format"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option value="Alphanumeric">Alphanumeric</option>
                        <option value="Numeric">Numeric</option>
                        <option value="Hexadecimal">Hexadecimal</option>
                      </select>
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="template-prefix" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Prefix</label>
                      <div class="mt-2">
                        <input
                          type="text"
                          id="template-prefix"
                          v-model="newLicenseTemplate.prefix"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="e.g., STD-"
                        />
                      </div>
                    </div>

                    <div>
                      <label for="template-suffix" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Suffix</label>
                      <div class="mt-2">
                        <input
                          type="text"
                          id="template-suffix"
                          v-model="newLicenseTemplate.suffix"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="e.g., -LIC"
                        />
                      </div>
                    </div>
                  </div>

                  <div class="grid grid-cols-3 gap-4">
                    <div>
                      <label for="template-separator" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Separator</label>
                      <div class="mt-2">
                        <input
                          type="text"
                          id="template-separator"
                          v-model="newLicenseTemplate.separator"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="-"
                        />
                      </div>
                    </div>

                    <div>
                      <label for="template-segment-length" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Segment Length</label>
                      <div class="mt-2">
                        <input
                          type="number"
                          id="template-segment-length"
                          v-model="newLicenseTemplate.segment_length"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="4"
                        />
                      </div>
                    </div>

                    <div>
                      <label for="template-segment-count" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Segment Count</label>
                      <div class="mt-2">
                        <input
                          type="number"
                          id="template-segment-count"
                          v-model="newLicenseTemplate.segment_count"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="4"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label for="template-char-set" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Character Set</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="template-char-set"
                        v-model="newLicenseTemplate.char_set"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                      />
                    </div>
                  </div>

                  <div class="space-y-3">
                    <div class="flex items-center">
                      <input
                        id="template-active"
                        v-model="newLicenseTemplate.active"
                        type="checkbox"
                        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700"
                      />
                      <label for="template-active" class="ml-2 block text-sm text-gray-900 dark:text-gray-200">
                        Active
                      </label>
                    </div>
                  </div>

                  <div>
                    <label for="template-status" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Status</label>
                    <div class="mt-2">
                      <select
                        id="template-status"
                        v-model="newLicenseTemplate.status"
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
              @click="addLicenseTemplate"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            >
              Add Template
            </button>
            <button
              type="button"
              @click="closeAddTemplateModal"
              class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit License Template Modal -->
    <div v-if="showEditTemplateModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeEditTemplateModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Edit License Template</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="edit-template-name" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Template Name</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="edit-template-name"
                        v-model="newLicenseTemplate.name"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter template name"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="edit-template-format" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Format</label>
                    <div class="mt-2">
                      <select
                        id="edit-template-format"
                        v-model="newLicenseTemplate.format"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option value="Alphanumeric">Alphanumeric</option>
                        <option value="Numeric">Numeric</option>
                        <option value="Hexadecimal">Hexadecimal</option>
                      </select>
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="edit-template-prefix" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Prefix</label>
                      <div class="mt-2">
                        <input
                          type="text"
                          id="edit-template-prefix"
                          v-model="newLicenseTemplate.prefix"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="e.g., STD-"
                        />
                      </div>
                    </div>

                    <div>
                      <label for="edit-template-suffix" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Suffix</label>
                      <div class="mt-2">
                        <input
                          type="text"
                          id="edit-template-suffix"
                          v-model="newLicenseTemplate.suffix"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="e.g., -LIC"
                        />
                      </div>
                    </div>
                  </div>

                  <div class="grid grid-cols-3 gap-4">
                    <div>
                      <label for="edit-template-separator" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Separator</label>
                      <div class="mt-2">
                        <input
                          type="text"
                          id="edit-template-separator"
                          v-model="newLicenseTemplate.separator"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="-"
                        />
                      </div>
                    </div>

                    <div>
                      <label for="edit-template-segment-length" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Segment Length</label>
                      <div class="mt-2">
                        <input
                          type="number"
                          id="edit-template-segment-length"
                          v-model="newLicenseTemplate.segment_length"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="4"
                        />
                      </div>
                    </div>

                    <div>
                      <label for="edit-template-segment-count" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Segment Count</label>
                      <div class="mt-2">
                        <input
                          type="number"
                          id="edit-template-segment-count"
                          v-model="newLicenseTemplate.segment_count"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          placeholder="4"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label for="edit-template-char-set" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Character Set</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="edit-template-char-set"
                        v-model="newLicenseTemplate.char_set"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                      />
                    </div>
                  </div>

                  <div class="space-y-3">
                    <div class="flex items-center">
                      <input
                        id="edit-template-active"
                        v-model="newLicenseTemplate.active"
                        type="checkbox"
                        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600 dark:bg-blue-gray-700"
                      />
                      <label for="edit-template-active" class="ml-2 block text-sm text-gray-900 dark:text-gray-200">
                        Active
                      </label>
                    </div>
                  </div>

                  <div>
                    <label for="edit-template-status" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Status</label>
                    <div class="mt-2">
                      <select
                        id="edit-template-status"
                        v-model="newLicenseTemplate.status"
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
              @click="saveLicenseTemplate"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            >
              Save Changes
            </button>
            <button
              type="button"
              @click="closeEditTemplateModal"
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
