<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'
import TabNavigation from '../../../../components/Dashboard/Commerce/Delivery/TabNavigation.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'
import ShippingZonesTable from '../../../../components/Dashboard/Commerce/Delivery/ShippingZonesTable.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'

useHead({
  title: 'Dashboard - Shipping Zones',
})

interface ShippingZone {
  id: number
  name: string
  countries: string[]
  regions: string[]
  postalCodes: string[]
  status: string
}

// Sample shipping zones data
const shippingZones = ref<ShippingZone[]>([
  {
    id: 1,
    name: 'Domestic',
    countries: ['United States'],
    regions: ['All'],
    postalCodes: [],
    status: 'Active'
  },
  {
    id: 2,
    name: 'North America',
    countries: ['Canada', 'Mexico'],
    regions: ['All'],
    postalCodes: [],
    status: 'Active'
  },
  {
    id: 3,
    name: 'Europe',
    countries: ['United Kingdom', 'France', 'Germany', 'Italy', 'Spain'],
    regions: ['All'],
    postalCodes: [],
    status: 'Active'
  },
  {
    id: 4,
    name: 'Asia Pacific',
    countries: ['Japan', 'Australia', 'China', 'South Korea', 'Singapore'],
    regions: ['All'],
    postalCodes: [],
    status: 'Active'
  },
  {
    id: 5,
    name: 'Rest of World',
    countries: ['Other'],
    regions: ['All'],
    postalCodes: [],
    status: 'Active'
  },
  {
    id: 6,
    name: 'Local',
    countries: ['United States'],
    regions: ['California', 'New York', 'Texas'],
    postalCodes: ['90210', '10001', '75001'],
    status: 'Active'
  },
  {
    id: 7,
    name: 'International',
    countries: ['All except United States'],
    regions: ['All'],
    postalCodes: [],
    status: 'Active'
  }
])

// Search and filtering
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = 5

const filteredShippingZones = computed(() => {
  if (!searchQuery.value) return shippingZones.value

  const query = searchQuery.value.toLowerCase()
  return shippingZones.value.filter(zone =>
    zone.name.toLowerCase().includes(query) ||
    zone.countries.some(country => country.toLowerCase().includes(query)) ||
    zone.regions.some(region => region.toLowerCase().includes(query))
  )
})

const paginatedShippingZones = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredShippingZones.value.slice(start, end)
})

// Event handlers
const handleSearch = (query: string) => {
  searchQuery.value = query
  currentPage.value = 1
}

const handleAddZone = () => {
  alert('Add shipping zone functionality would go here')
}

const handleEditZone = (zone: ShippingZone) => {
  alert(`Edit shipping zone: ${zone.name}`)
}

const handleDeleteZone = (zone: ShippingZone) => {
  alert(`Delete shipping zone: ${zone.name}`)
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
  </div>
</template>
