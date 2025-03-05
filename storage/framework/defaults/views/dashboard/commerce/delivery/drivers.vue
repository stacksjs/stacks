<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'
import TabNavigation from '../../../../components/Dashboard/Commerce/Delivery/TabNavigation.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'
import DriversTable from '../../../../components/Dashboard/Commerce/Delivery/DriversTable.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'
import { Driver } from '../../../../components/Dashboard/Commerce/Delivery/DriversTable.vue'

useHead({
  title: 'Dashboard - Delivery Drivers',
})

// Sample drivers data
const drivers = ref<Driver[]>([
  {
    id: 1,
    name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '(555) 123-4567',
    vehicle: 'Van #103',
    license: 'DL-12345678',
    status: 'Active',
    lastActive: new Date('2023-06-15'),
    avatar: 'https://randomuser.me/api/portraits/men/1.jpg',
    deliveryCount: 1243,
    rating: 4.8
  },
  {
    id: 2,
    name: 'Sarah Johnson',
    email: 'sarah.johnson@example.com',
    phone: '(555) 234-5678',
    vehicle: 'Truck #205',
    license: 'DL-23456789',
    status: 'On Delivery',
    lastActive: new Date('2023-06-15'),
    avatar: 'https://randomuser.me/api/portraits/women/2.jpg',
    deliveryCount: 987,
    rating: 4.9
  },
  {
    id: 3,
    name: 'Michael Brown',
    email: 'michael.brown@example.com',
    phone: '(555) 345-6789',
    vehicle: 'Van #104',
    license: 'DL-34567890',
    status: 'On Break',
    lastActive: new Date('2023-06-14'),
    avatar: 'https://randomuser.me/api/portraits/men/3.jpg',
    deliveryCount: 756,
    rating: 4.7
  },
  {
    id: 4,
    name: 'Emily Davis',
    email: 'emily.davis@example.com',
    phone: '(555) 456-7890',
    vehicle: 'Truck #206',
    license: 'DL-45678901',
    status: 'Active',
    lastActive: new Date('2023-06-15'),
    avatar: 'https://randomuser.me/api/portraits/women/4.jpg',
    deliveryCount: 1102,
    rating: 4.6
  },
  {
    id: 5,
    name: 'Robert Wilson',
    email: 'robert.wilson@example.com',
    phone: '(555) 567-8901',
    vehicle: 'Van #105',
    license: 'DL-56789012',
    status: 'On Delivery',
    lastActive: new Date('2023-06-15'),
    avatar: 'https://randomuser.me/api/portraits/men/5.jpg',
    deliveryCount: 892,
    rating: 4.5
  },
  {
    id: 6,
    name: 'Jennifer Lee',
    email: 'jennifer.lee@example.com',
    phone: '(555) 678-9012',
    vehicle: 'Van #106',
    license: 'DL-67890123',
    status: 'Inactive',
    lastActive: new Date('2023-06-10'),
    avatar: 'https://randomuser.me/api/portraits/women/6.jpg',
    deliveryCount: 543,
    rating: 4.4
  },
  {
    id: 7,
    name: 'David Martinez',
    email: 'david.martinez@example.com',
    phone: '(555) 789-0123',
    vehicle: 'Truck #207',
    license: 'DL-78901234',
    status: 'Active',
    lastActive: new Date('2023-06-14'),
    avatar: 'https://randomuser.me/api/portraits/men/7.jpg',
    deliveryCount: 678,
    rating: 4.7
  }
])

// Search and filtering
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = 5

const filteredDrivers = computed(() => {
  if (!searchQuery.value) return drivers.value

  const query = searchQuery.value.toLowerCase()
  return drivers.value.filter(driver =>
    driver.name.toLowerCase().includes(query) ||
    driver.email.toLowerCase().includes(query) ||
    driver.phone.toLowerCase().includes(query) ||
    driver.vehicle.toLowerCase().includes(query) ||
    driver.status.toLowerCase().includes(query)
  )
})

const paginatedDrivers = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredDrivers.value.slice(start, end)
})

// Event handlers
const handleSearch = (query: string) => {
  searchQuery.value = query
  currentPage.value = 1
}

const handleAddDriver = () => {
  alert('Add driver functionality would go here')
}

const handleEditDriver = (driver: Driver) => {
  alert(`Edit driver: ${driver.name}`)
}

const handleDeleteDriver = (driver: Driver) => {
  alert(`Delete driver: ${driver.name}`)
}

const viewDriverRoutes = (driver: Driver) => {
  alert(`View routes for driver: ${driver.name}`)
}

const handlePrevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const handleNextPage = () => {
  const totalPages = Math.ceil(filteredDrivers.value.length / itemsPerPage)
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
        modelValue="drivers"
        :tabs="tabs"
      />

      <!-- Stats section -->
      <div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6 dark:bg-gray-800">
          <dt>
            <div class="absolute rounded-md bg-blue-500 p-3">
              <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <p class="ml-16 truncate text-sm text-gray-500 font-medium dark:text-gray-400">
              Total Drivers
            </p>
          </dt>
          <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
            <p class="text-2xl text-gray-900 font-semibold dark:text-white">
              {{ drivers.length }}
            </p>
            <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
              <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
              </svg>
              <span class="sr-only"> Increased by </span>
              2
            </p>
          </dd>
        </div>

        <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6 dark:bg-gray-800">
          <dt>
            <div class="absolute rounded-md bg-green-500 p-3">
              <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
            </div>
            <p class="ml-16 truncate text-sm text-gray-500 font-medium dark:text-gray-400">
              Active Drivers
            </p>
          </dt>
          <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
            <p class="text-2xl text-gray-900 font-semibold dark:text-white">
              {{ drivers.filter(d => d.status === 'Active' || d.status === 'On Delivery').length }}
            </p>
            <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
              <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
              </svg>
              <span class="sr-only"> Increased by </span>
              1
            </p>
          </dd>
        </div>

        <div class="relative overflow-hidden rounded-lg bg-white px-4 pt-5 shadow sm:px-6 sm:pt-6 dark:bg-gray-800">
          <dt>
            <div class="absolute rounded-md bg-blue-500 p-3">
              <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            </div>
            <p class="ml-16 truncate text-sm text-gray-500 font-medium dark:text-gray-400">
              Average Rating
            </p>
          </dt>
          <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
            <p class="text-2xl text-gray-900 font-semibold dark:text-white">
              {{ (drivers.reduce((sum, driver) => sum + (driver.rating || 0), 0) / drivers.length).toFixed(1) }}
            </p>
            <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
              <svg class="h-5 w-5 flex-shrink-0 self-center text-green-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z" clip-rule="evenodd" />
              </svg>
              <span class="sr-only"> Increased by </span>
              0.2
            </p>
          </dd>
        </div>
      </div>

      <div class="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div class="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-medium text-gray-900 dark:text-white">Delivery Drivers</h2>
            <button
              @click="handleAddDriver"
              type="button"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-2" />
              Add Driver
            </button>
          </div>
          <div class="mt-4">
            <SearchFilter
              placeholder="Search drivers..."
              @search="handleSearch"
              class="w-full md:w-96"
            />
          </div>
        </div>

        <DriversTable
          :drivers="paginatedDrivers"
          @view-routes="viewDriverRoutes"
          @edit="handleEditDriver"
          @delete="handleDeleteDriver"
        />

        <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <Pagination
            :current-page="currentPage"
            :total-items="filteredDrivers.length"
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
