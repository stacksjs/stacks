<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'
import TabNavigation from '../../../../components/Dashboard/Commerce/Delivery/TabNavigation.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'
import ShippingMethodsTable from '../../../../components/Dashboard/Commerce/Delivery/ShippingMethodsTable.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'

useHead({
  title: 'Dashboard - Shipping Methods',
})

interface ShippingMethod {
  id: number
  name: string
  description: string
  baseRate: number
  status: string
  handlingFee: number
  freeShippingThreshold: number | null
  zones: string[]
}

// Sample shipping methods data
const shippingMethods = ref<ShippingMethod[]>([
  {
    id: 1,
    name: 'Standard Shipping',
    description: 'Delivery within 5-7 business days',
    baseRate: 5.99,
    status: 'Active',
    handlingFee: 1.50,
    freeShippingThreshold: 50,
    zones: ['Domestic', 'North America']
  },
  {
    id: 2,
    name: 'Express Shipping',
    description: 'Delivery within 2-3 business days',
    baseRate: 12.99,
    status: 'Active',
    handlingFee: 2.00,
    freeShippingThreshold: 100,
    zones: ['Domestic']
  },
  {
    id: 3,
    name: 'Next Day Air',
    description: 'Delivery by end of next business day',
    baseRate: 24.99,
    status: 'Active',
    handlingFee: 3.50,
    freeShippingThreshold: null,
    zones: ['Domestic']
  },
  {
    id: 4,
    name: 'International Economy',
    description: 'Delivery within 7-14 business days',
    baseRate: 15.99,
    status: 'Active',
    handlingFee: 2.50,
    freeShippingThreshold: 150,
    zones: ['International']
  },
  {
    id: 5,
    name: 'International Priority',
    description: 'Delivery within 3-5 business days',
    baseRate: 34.99,
    status: 'Active',
    handlingFee: 4.00,
    freeShippingThreshold: null,
    zones: ['International']
  },
  {
    id: 6,
    name: 'Local Pickup',
    description: 'Available for pickup at store location',
    baseRate: 0,
    status: 'Active',
    handlingFee: 0,
    freeShippingThreshold: null,
    zones: ['Local']
  },
  {
    id: 7,
    name: 'Freight Shipping',
    description: 'For large or heavy items',
    baseRate: 49.99,
    status: 'Inactive',
    handlingFee: 10.00,
    freeShippingThreshold: null,
    zones: ['Domestic', 'International']
  }
])

// Search and filtering
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = 5

const filteredShippingMethods = computed(() => {
  if (!searchQuery.value) return shippingMethods.value

  const query = searchQuery.value.toLowerCase()
  return shippingMethods.value.filter(method =>
    method.name.toLowerCase().includes(query) ||
    method.description.toLowerCase().includes(query)
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
  alert('Add shipping method functionality would go here')
}

const handleEditMethod = (method: ShippingMethod) => {
  alert(`Edit shipping method: ${method.name}`)
}

const handleDeleteMethod = (method: ShippingMethod) => {
  alert(`Delete shipping method: ${method.name}`)
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
  </div>
</template>
