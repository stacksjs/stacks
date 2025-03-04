<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'
import TabNavigation from '../../../../components/Dashboard/Commerce/Delivery/TabNavigation.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'
import DigitalDeliveryTable from '../../../../components/Dashboard/Commerce/Delivery/DigitalDeliveryTable.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'

useHead({
  title: 'Dashboard - Digital Delivery',
})

interface DigitalDeliveryMethod {
  id: number
  name: string
  description: string
  status: string
  downloadLimit: number | null
  expiryDays: number | null
  requiresLogin: boolean
  automaticDelivery: boolean
}

// Sample digital delivery methods data
const digitalDeliveryMethods = ref<DigitalDeliveryMethod[]>([
  {
    id: 1,
    name: 'Standard Download',
    description: 'Basic download link sent via email',
    status: 'Active',
    downloadLimit: 3,
    expiryDays: 30,
    requiresLogin: false,
    automaticDelivery: true
  },
  {
    id: 2,
    name: 'Premium Download',
    description: 'Unlimited downloads with extended access',
    status: 'Active',
    downloadLimit: null,
    expiryDays: 365,
    requiresLogin: true,
    automaticDelivery: true
  },
  {
    id: 3,
    name: 'Secure Content',
    description: 'Login required with limited downloads',
    status: 'Active',
    downloadLimit: 5,
    expiryDays: 90,
    requiresLogin: true,
    automaticDelivery: true
  },
  {
    id: 4,
    name: 'Time-Limited Access',
    description: 'Short-term access to digital content',
    status: 'Active',
    downloadLimit: 2,
    expiryDays: 7,
    requiresLogin: true,
    automaticDelivery: true
  },
  {
    id: 5,
    name: 'Manual Delivery',
    description: 'Content delivered manually after review',
    status: 'Active',
    downloadLimit: 1,
    expiryDays: 14,
    requiresLogin: false,
    automaticDelivery: false
  },
  {
    id: 6,
    name: 'Permanent Access',
    description: 'Lifetime access to digital content',
    status: 'Active',
    downloadLimit: null,
    expiryDays: null,
    requiresLogin: true,
    automaticDelivery: true
  },
  {
    id: 7,
    name: 'Legacy Download',
    description: 'Old delivery method for archived products',
    status: 'Inactive',
    downloadLimit: 1,
    expiryDays: 30,
    requiresLogin: false,
    automaticDelivery: true
  }
])

// Search and filtering
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = 5

const filteredDigitalMethods = computed(() => {
  if (!searchQuery.value) return digitalDeliveryMethods.value

  const query = searchQuery.value.toLowerCase()
  return digitalDeliveryMethods.value.filter(method =>
    method.name.toLowerCase().includes(query) ||
    method.description.toLowerCase().includes(query)
  )
})

const paginatedDigitalMethods = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredDigitalMethods.value.slice(start, end)
})

// Event handlers
const handleSearch = (query: string) => {
  searchQuery.value = query
  currentPage.value = 1
}

const handleAddDigitalMethod = () => {
  alert('Add digital delivery method functionality would go here')
}

const handleEditDigitalMethod = (method: DigitalDeliveryMethod) => {
  alert(`Edit digital delivery method: ${method.name}`)
}

const handleDeleteDigitalMethod = (method: DigitalDeliveryMethod) => {
  alert(`Delete digital delivery method: ${method.name}`)
}

const handlePrevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const handleNextPage = () => {
  const totalPages = Math.ceil(filteredDigitalMethods.value.length / itemsPerPage)
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
          :methods="paginatedDigitalMethods"
          @edit="handleEditDigitalMethod"
          @delete="handleDeleteDigitalMethod"
        />

        <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <Pagination
            :current-page="currentPage"
            :total-items="filteredDigitalMethods.length"
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
