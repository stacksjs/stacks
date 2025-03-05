<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'
import TabNavigation from '../../../../components/Dashboard/Commerce/Delivery/TabNavigation.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'
import ShippingRatesTable from '../../../../components/Dashboard/Commerce/Delivery/ShippingRatesTable.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'

useHead({
  title: 'Dashboard - Shipping Rates',
})

interface ShippingMethod {
  id: number
  name: string
}

interface ShippingZone {
  id: number
  name: string
}

interface ShippingRate {
  id: number
  methodId: number
  zoneId: number
  weightFrom: number
  weightTo: number
  rate: number
}

// Sample shipping methods data
const shippingMethods = ref<ShippingMethod[]>([
  { id: 1, name: 'Standard Shipping' },
  { id: 2, name: 'Express Shipping' },
  { id: 3, name: 'Next Day Air' },
  { id: 4, name: 'International Economy' },
  { id: 5, name: 'International Priority' }
])

// Sample shipping zones data
const shippingZones = ref<ShippingZone[]>([
  { id: 1, name: 'Domestic' },
  { id: 2, name: 'North America' },
  { id: 3, name: 'Europe' },
  { id: 4, name: 'Asia Pacific' },
  { id: 5, name: 'Rest of World' }
])

// Sample shipping rates data
const shippingRates = ref<ShippingRate[]>([
  { id: 1, methodId: 1, zoneId: 1, weightFrom: 0, weightTo: 1, rate: 5.99 },
  { id: 2, methodId: 1, zoneId: 1, weightFrom: 1, weightTo: 5, rate: 8.99 },
  { id: 3, methodId: 1, zoneId: 1, weightFrom: 5, weightTo: 10, rate: 12.99 },
  { id: 4, methodId: 1, zoneId: 2, weightFrom: 0, weightTo: 1, rate: 9.99 },
  { id: 5, methodId: 1, zoneId: 2, weightFrom: 1, weightTo: 5, rate: 14.99 },
  { id: 6, methodId: 2, zoneId: 1, weightFrom: 0, weightTo: 1, rate: 12.99 },
  { id: 7, methodId: 2, zoneId: 1, weightFrom: 1, weightTo: 5, rate: 18.99 },
  { id: 8, methodId: 3, zoneId: 1, weightFrom: 0, weightTo: 1, rate: 24.99 },
  { id: 9, methodId: 3, zoneId: 1, weightFrom: 1, weightTo: 5, rate: 34.99 },
  { id: 10, methodId: 4, zoneId: 3, weightFrom: 0, weightTo: 1, rate: 19.99 },
  { id: 11, methodId: 4, zoneId: 4, weightFrom: 0, weightTo: 1, rate: 24.99 },
  { id: 12, methodId: 5, zoneId: 3, weightFrom: 0, weightTo: 1, rate: 34.99 },
  { id: 13, methodId: 5, zoneId: 4, weightFrom: 0, weightTo: 1, rate: 39.99 }
])

// Search and filtering
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = 5

const filteredShippingRates = computed(() => {
  if (!searchQuery.value) return shippingRates.value

  const query = searchQuery.value.toLowerCase()
  return shippingRates.value.filter(rate => {
    const method = shippingMethods.value.find(m => m.id === rate.methodId)
    const zone = shippingZones.value.find(z => z.id === rate.zoneId)

    return (method && method.name.toLowerCase().includes(query)) ||
           (zone && zone.name.toLowerCase().includes(query)) ||
           rate.weightFrom.toString().includes(query) ||
           rate.weightTo.toString().includes(query) ||
           rate.rate.toString().includes(query)
  })
})

const paginatedShippingRates = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredShippingRates.value.slice(start, end)
})

// Event handlers
const handleSearch = (query: string) => {
  searchQuery.value = query
  currentPage.value = 1
}

const handleAddRate = () => {
  alert('Add shipping rate functionality would go here')
}

const handleEditRate = (rate: ShippingRate) => {
  const method = shippingMethods.value.find(m => m.id === rate.methodId)
  const zone = shippingZones.value.find(z => z.id === rate.zoneId)
  alert(`Edit shipping rate: ${method?.name} - ${zone?.name}`)
}

const handleDeleteRate = (rate: ShippingRate) => {
  const method = shippingMethods.value.find(m => m.id === rate.methodId)
  const zone = shippingZones.value.find(z => z.id === rate.zoneId)
  alert(`Delete shipping rate: ${method?.name} - ${zone?.name}`)
}

const handlePrevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const handleNextPage = () => {
  const totalPages = Math.ceil(filteredShippingRates.value.length / itemsPerPage)
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
        modelValue="rates"
        :tabs="tabs"
      />

      <div class="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div class="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-medium text-gray-900 dark:text-white">Shipping Rates</h2>
            <button
              @click="handleAddRate"
              type="button"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-2" />
              Add Rate
            </button>
          </div>
          <div class="mt-4">
            <SearchFilter
              placeholder="Search shipping rates..."
              @search="handleSearch"
              class="w-full md:w-96"
            />
          </div>
        </div>

        <ShippingRatesTable
          :rates="paginatedShippingRates"
          :methods="shippingMethods"
          :zones="shippingZones"
          @edit="handleEditRate"
          @delete="handleDeleteRate"
        />

        <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <Pagination
            :current-page="currentPage"
            :total-items="filteredShippingRates.length"
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
