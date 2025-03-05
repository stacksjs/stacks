<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'
import TabNavigation from '../../../../components/Dashboard/Commerce/Delivery/TabNavigation.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'
import DeliveryRoutesTable from '../../../../components/Dashboard/Commerce/Delivery/DeliveryRoutesTable.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'
import { DeliveryRoute as BaseDeliveryRoute } from '../../../../components/Dashboard/Commerce/Delivery/DeliveryRoutesTable.vue'

useHead({
  title: 'Dashboard - Delivery Routes',
})

// Extend the DeliveryRoute interface to include additional properties
interface DeliveryRoute extends BaseDeliveryRoute {
  name: string
  status: string
  startCoords: { lat: number; lng: number }
  endCoords: { lat: number; lng: number }
  waypoints: { lat: number; lng: number }[]
}

// Sample delivery routes data
const deliveryRoutes = ref<DeliveryRoute[]>([
  {
    id: 1,
    name: 'Downtown Route',
    driver: 'John Smith',
    vehicle: 'Van #103',
    startLocation: '123 Main St',
    stops: 8,
    avgDeliveryTime: 1.5,
    totalDistance: 12.4,
    lastActive: new Date('2023-06-15'),
    status: 'Active',
    startCoords: { lat: 40.7128, lng: -74.0060 },
    endCoords: { lat: 40.7328, lng: -73.9860 },
    waypoints: [
      { lat: 40.7228, lng: -73.9960 },
      { lat: 40.7328, lng: -73.9860 }
    ]
  },
  {
    id: 2,
    name: 'Uptown Route',
    driver: 'Sarah Johnson',
    vehicle: 'Truck #205',
    startLocation: '456 Oak Ave',
    stops: 12,
    avgDeliveryTime: 2.2,
    totalDistance: 18.7,
    lastActive: new Date('2023-06-14'),
    status: 'Active',
    startCoords: { lat: 40.8128, lng: -73.9060 },
    endCoords: { lat: 40.8328, lng: -73.8860 },
    waypoints: [
      { lat: 40.8228, lng: -73.8960 },
      { lat: 40.8328, lng: -73.8860 }
    ]
  },
  {
    id: 3,
    name: 'Suburban Route',
    driver: 'Michael Brown',
    vehicle: 'Van #104',
    startLocation: '789 Pine St',
    stops: 15,
    avgDeliveryTime: 2.8,
    totalDistance: 24.3,
    lastActive: new Date('2023-06-13'),
    status: 'Active',
    startCoords: { lat: 40.9128, lng: -73.8060 },
    endCoords: { lat: 40.9328, lng: -73.7860 },
    waypoints: [
      { lat: 40.9228, lng: -73.7960 },
      { lat: 40.9328, lng: -73.7860 }
    ]
  },
  {
    id: 4,
    name: 'Rural Route',
    driver: 'Emily Davis',
    vehicle: 'Truck #206',
    startLocation: '101 Maple Rd',
    stops: 6,
    avgDeliveryTime: 3.5,
    totalDistance: 42.1,
    lastActive: new Date('2023-06-12'),
    status: 'Active',
    startCoords: { lat: 41.0128, lng: -73.7060 },
    endCoords: { lat: 41.0328, lng: -73.6860 },
    waypoints: [
      { lat: 41.0228, lng: -73.6960 },
      { lat: 41.0328, lng: -73.6860 }
    ]
  },
  {
    id: 5,
    name: 'Express Route',
    driver: 'Robert Wilson',
    vehicle: 'Van #105',
    startLocation: '202 Cedar Blvd',
    stops: 4,
    avgDeliveryTime: 1.0,
    totalDistance: 8.6,
    lastActive: new Date('2023-06-11'),
    status: 'Active',
    startCoords: { lat: 40.7528, lng: -74.1060 },
    endCoords: { lat: 40.7728, lng: -74.0860 },
    waypoints: [
      { lat: 40.7628, lng: -74.0960 },
      { lat: 40.7728, lng: -74.0860 }
    ]
  },
  {
    id: 6,
    name: 'Weekend Route',
    driver: 'Jennifer Lee',
    vehicle: 'Van #106',
    startLocation: '303 Birch Ln',
    stops: 10,
    avgDeliveryTime: 2.0,
    totalDistance: 16.8,
    lastActive: new Date('2023-06-10'),
    status: 'Inactive',
    startCoords: { lat: 40.6128, lng: -74.2060 },
    endCoords: { lat: 40.6328, lng: -74.1860 },
    waypoints: [
      { lat: 40.6228, lng: -74.1960 },
      { lat: 40.6328, lng: -74.1860 }
    ]
  }
])

// Search and filtering
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = 5

const filteredRoutes = computed(() => {
  if (!searchQuery.value) return deliveryRoutes.value

  const query = searchQuery.value.toLowerCase()
  return deliveryRoutes.value.filter(route =>
    route.name.toLowerCase().includes(query) ||
    route.driver.toLowerCase().includes(query) ||
    route.vehicle.toLowerCase().includes(query) ||
    route.startLocation.toLowerCase().includes(query) ||
    route.status.toLowerCase().includes(query)
  )
})

const paginatedRoutes = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredRoutes.value.slice(start, end)
})

// Event handlers
const handleSearch = (query: string) => {
  searchQuery.value = query
  currentPage.value = 1
}

const handleAddRoute = () => {
  alert('Add delivery route functionality would go here')
}

const handleEditRoute = (route: DeliveryRoute) => {
  alert(`Edit delivery route: ${route.name}`)
}

const handleDeleteRoute = (route: DeliveryRoute) => {
  alert(`Delete delivery route: ${route.name}`)
}

const viewRouteOnMap = (route: DeliveryRoute) => {
  alert(`View route on map: ${route.name} (${route.startLocation} to ${route.stops} stops)`)
}

const handlePrevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const handleNextPage = () => {
  const totalPages = Math.ceil(filteredRoutes.value.length / itemsPerPage)
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
        modelValue="routes"
        :tabs="tabs"
      />

      <div class="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div class="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-medium text-gray-900 dark:text-white">Delivery Routes</h2>
            <button
              @click="handleAddRoute"
              type="button"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-2" />
              Add Route
            </button>
          </div>
          <div class="mt-4">
            <SearchFilter
              placeholder="Search delivery routes..."
              @search="handleSearch"
              class="w-full md:w-96"
            />
          </div>
        </div>

        <DeliveryRoutesTable
          :routes="paginatedRoutes"
          @view-map="viewRouteOnMap"
          @edit="handleEditRoute"
          @delete="handleDeleteRoute"
        />

        <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <Pagination
            :current-page="currentPage"
            :total-items="filteredRoutes.length"
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
