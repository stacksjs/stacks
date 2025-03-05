<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'
import TabNavigation from '../../../../components/Dashboard/Commerce/Delivery/TabNavigation.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'
import LicenseKeysTable from '../../../../components/Dashboard/Commerce/Delivery/LicenseKeysTable.vue'
import LicenseTemplatesTable from '../../../../components/Dashboard/Commerce/Delivery/LicenseTemplatesTable.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'

useHead({
  title: 'Dashboard - License Keys',
})

interface LicenseKeyTemplate {
  id: number
  name: string
  format: string
  prefix: string
  suffix: string
  separator: string
  charSet: string
  segmentLength: number
  segmentCount: number
  active: boolean
}

interface LicenseKey {
  id: number
  key: string
  templateId: number
  customerId: number
  customerName: string
  customerEmail: string
  productId: number
  productName: string
  orderId: number
  dateCreated: string
  dateAssigned: string | null
  expiryDate: string | null
  status: string
  notes: string | null
}

// Sample license key templates data
const licenseKeyTemplates = ref<LicenseKeyTemplate[]>([
  {
    id: 1,
    name: 'Standard License',
    format: 'Alphanumeric',
    prefix: 'STD-',
    suffix: '',
    separator: '-',
    charSet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    segmentLength: 4,
    segmentCount: 4,
    active: true
  },
  {
    id: 2,
    name: 'Premium License',
    format: 'Alphanumeric',
    prefix: 'PREM-',
    suffix: '',
    separator: '-',
    charSet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    segmentLength: 5,
    segmentCount: 5,
    active: true
  },
  {
    id: 3,
    name: 'Enterprise License',
    format: 'Alphanumeric',
    prefix: 'ENT-',
    suffix: '-LIC',
    separator: '-',
    charSet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    segmentLength: 6,
    segmentCount: 4,
    active: true
  },
  {
    id: 4,
    name: 'Legacy License',
    format: 'Numeric',
    prefix: 'L-',
    suffix: '',
    separator: '-',
    charSet: '0123456789',
    segmentLength: 4,
    segmentCount: 3,
    active: false
  }
])

// Sample license keys data
const licenseKeys = ref<LicenseKey[]>([
  {
    id: 1,
    key: 'STD-A1B2-C3D4-E5F6-G7H8',
    templateId: 1,
    customerId: 1001,
    customerName: 'John Doe',
    customerEmail: 'john.doe@example.com',
    productId: 101,
    productName: 'Software Pro',
    orderId: 5001,
    dateCreated: '2023-01-15',
    dateAssigned: '2023-01-15',
    expiryDate: '2024-01-15',
    status: 'Active',
    notes: null
  },
  {
    id: 2,
    key: 'STD-J9K0-L1M2-N3O4-P5Q6',
    templateId: 1,
    customerId: 1002,
    customerName: 'Jane Smith',
    customerEmail: 'jane.smith@example.com',
    productId: 101,
    productName: 'Software Pro',
    orderId: 5002,
    dateCreated: '2023-02-20',
    dateAssigned: '2023-02-20',
    expiryDate: '2024-02-20',
    status: 'Active',
    notes: null
  },
  {
    id: 3,
    key: 'PREM-R7S8T-9U0V1-W2X3Y-4Z5A6-B7C8D',
    templateId: 2,
    customerId: 1003,
    customerName: 'Robert Johnson',
    customerEmail: 'robert.johnson@example.com',
    productId: 102,
    productName: 'Software Enterprise',
    orderId: 5003,
    dateCreated: '2023-03-10',
    dateAssigned: '2023-03-10',
    expiryDate: '2025-03-10',
    status: 'Active',
    notes: 'Premium customer'
  },
  {
    id: 4,
    key: 'ENT-E9F0G1-H2I3J4-K5L6M7-N8O9P0-LIC',
    templateId: 3,
    customerId: 1004,
    customerName: 'Acme Corporation',
    customerEmail: 'it@acmecorp.com',
    productId: 103,
    productName: 'Software Ultimate',
    orderId: 5004,
    dateCreated: '2023-04-05',
    dateAssigned: '2023-04-05',
    expiryDate: '2026-04-05',
    status: 'Active',
    notes: 'Enterprise customer with extended support'
  },
  {
    id: 5,
    key: 'STD-Q1R2-S3T4-U5V6-W7X8',
    templateId: 1,
    customerId: 1005,
    customerName: 'Sarah Williams',
    customerEmail: 'sarah.williams@example.com',
    productId: 101,
    productName: 'Software Pro',
    orderId: 5005,
    dateCreated: '2023-05-12',
    dateAssigned: null,
    expiryDate: null,
    status: 'Unassigned',
    notes: null
  },
  {
    id: 6,
    key: 'L-1234-5678-9012',
    templateId: 4,
    customerId: 1006,
    customerName: 'Michael Brown',
    customerEmail: 'michael.brown@example.com',
    productId: 104,
    productName: 'Software Basic',
    orderId: 5006,
    dateCreated: '2022-06-30',
    dateAssigned: '2022-06-30',
    expiryDate: '2023-06-30',
    status: 'Expired',
    notes: 'Legacy license format'
  }
])

// Active tab for license keys section
const licenseActiveTab = ref('keys')

// Search and filtering
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = 5

const filteredLicenseKeys = computed(() => {
  if (!searchQuery.value) return licenseKeys.value

  const query = searchQuery.value.toLowerCase()
  return licenseKeys.value.filter(key =>
    key.key.toLowerCase().includes(query) ||
    key.customerName.toLowerCase().includes(query) ||
    key.customerEmail.toLowerCase().includes(query) ||
    key.productName.toLowerCase().includes(query) ||
    (key.status && key.status.toLowerCase().includes(query))
  )
})

const filteredLicenseTemplates = computed(() => {
  if (!searchQuery.value) return licenseKeyTemplates.value

  const query = searchQuery.value.toLowerCase()
  return licenseKeyTemplates.value.filter(template =>
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
  alert('Add license key functionality would go here')
}

const handleEditLicenseKey = (key: LicenseKey) => {
  alert(`Edit license key: ${key.key}`)
}

const handleDeleteLicenseKey = (key: LicenseKey) => {
  alert(`Delete license key: ${key.key}`)
}

const handleAddLicenseTemplate = () => {
  alert('Add license template functionality would go here')
}

const handleEditLicenseTemplate = (template: LicenseKeyTemplate) => {
  alert(`Edit license template: ${template.name}`)
}

const handleDeleteLicenseTemplate = (template: LicenseKeyTemplate) => {
  alert(`Delete license template: ${template.name}`)
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
            :templates="licenseKeyTemplates"
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
  </div>
</template>
