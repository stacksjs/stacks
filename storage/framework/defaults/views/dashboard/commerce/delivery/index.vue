<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Dashboard - Commerce Deliver',
})

// Sample shipping methods data
const shippingMethods = ref([
  {
    id: 1,
    name: 'Standard Shipping',
    description: 'Delivery in 3-5 business days',
    baseRate: 5.99,
    status: 'Active',
    handlingFee: 1.50,
    freeShippingThreshold: 50.00,
    zones: ['Domestic', 'North America']
  },
  {
    id: 2,
    name: 'Express Shipping',
    description: 'Delivery in 1-2 business days',
    baseRate: 12.99,
    status: 'Active',
    handlingFee: 2.00,
    freeShippingThreshold: 100.00,
    zones: ['Domestic']
  },
  {
    id: 3,
    name: 'Next Day Air',
    description: 'Guaranteed delivery by next business day',
    baseRate: 24.99,
    status: 'Active',
    handlingFee: 3.00,
    freeShippingThreshold: 150.00,
    zones: ['Domestic']
  },
  {
    id: 4,
    name: 'International Economy',
    description: 'Delivery in 7-14 business days',
    baseRate: 15.99,
    status: 'Active',
    handlingFee: 2.50,
    freeShippingThreshold: null,
    zones: ['International']
  },
  {
    id: 5,
    name: 'International Priority',
    description: 'Delivery in 3-5 business days',
    baseRate: 29.99,
    status: 'Active',
    handlingFee: 4.00,
    freeShippingThreshold: null,
    zones: ['International']
  },
  {
    id: 6,
    name: 'Local Pickup',
    description: 'Available for pickup at store',
    baseRate: 0.00,
    status: 'Active',
    handlingFee: 0.00,
    freeShippingThreshold: 0.00,
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
    zones: ['Domestic', 'North America']
  }
])

// Sample shipping zones data
const shippingZones = ref([
  {
    id: 1,
    name: 'Domestic',
    countries: ['United States'],
    regions: ['All states'],
    taxRate: 0.00,
    active: true
  },
  {
    id: 2,
    name: 'North America',
    countries: ['Canada', 'Mexico'],
    regions: ['All provinces/states'],
    taxRate: 0.00,
    active: true
  },
  {
    id: 3,
    name: 'Europe',
    countries: ['United Kingdom', 'France', 'Germany', 'Italy', 'Spain', 'Netherlands', 'Belgium'],
    regions: ['All regions'],
    taxRate: 0.00,
    active: true
  },
  {
    id: 4,
    name: 'Asia Pacific',
    countries: ['Japan', 'Australia', 'New Zealand', 'Singapore', 'Hong Kong'],
    regions: ['All regions'],
    taxRate: 0.00,
    active: true
  },
  {
    id: 5,
    name: 'International',
    countries: ['Rest of World'],
    regions: ['All regions'],
    taxRate: 0.00,
    active: true
  },
  {
    id: 6,
    name: 'Local',
    countries: ['United States'],
    regions: ['Store locations only'],
    taxRate: 0.00,
    active: true
  }
])

// Sample shipping rates data
const shippingRates = ref([
  {
    id: 1,
    methodId: 1,
    zoneId: 1,
    weightFrom: 0,
    weightTo: 1,
    rate: 5.99
  },
  {
    id: 2,
    methodId: 1,
    zoneId: 1,
    weightFrom: 1.01,
    weightTo: 5,
    rate: 8.99
  },
  {
    id: 3,
    methodId: 1,
    zoneId: 1,
    weightFrom: 5.01,
    weightTo: 10,
    rate: 12.99
  },
  {
    id: 4,
    methodId: 2,
    zoneId: 1,
    weightFrom: 0,
    weightTo: 1,
    rate: 12.99
  },
  {
    id: 5,
    methodId: 2,
    zoneId: 1,
    weightFrom: 1.01,
    weightTo: 5,
    rate: 18.99
  },
  {
    id: 6,
    methodId: 3,
    zoneId: 1,
    weightFrom: 0,
    weightTo: 1,
    rate: 24.99
  },
  {
    id: 7,
    methodId: 4,
    zoneId: 5,
    weightFrom: 0,
    weightTo: 1,
    rate: 15.99
  },
  {
    id: 8,
    methodId: 4,
    zoneId: 5,
    weightFrom: 1.01,
    weightTo: 5,
    rate: 29.99
  }
])

// Filter states
const searchQuery = ref('')
const selectedStatus = ref('All')
const selectedZone = ref('All')

// Active tab state
const activeTab = ref('methods') // 'methods', 'zones', or 'rates'

// Status options
const statusOptions = ['All', 'Active', 'Inactive']

// Zone options computed from shipping zones
const zoneOptions = computed(() => {
  const zones = ['All']
  shippingZones.value.forEach(zone => {
    zones.push(zone.name)
  })
  return zones
})

// Filtered shipping methods
const filteredShippingMethods = computed(() => {
  return shippingMethods.value.filter(method => {
    // Filter by search query
    const matchesSearch = method.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                          method.description.toLowerCase().includes(searchQuery.value.toLowerCase())

    // Filter by status
    const matchesStatus = selectedStatus.value === 'All' || method.status === selectedStatus.value

    // Filter by zone
    const matchesZone = selectedZone.value === 'All' || method.zones.includes(selectedZone.value)

    return matchesSearch && matchesStatus && matchesZone
  })
})

// Modal state
const showAddMethodModal = ref(false)
const showAddZoneModal = ref(false)
const showAddRateModal = ref(false)

// Toggle modals
const toggleAddMethodModal = () => {
  showAddMethodModal.value = !showAddMethodModal.value
}

const toggleAddZoneModal = () => {
  showAddZoneModal.value = !showAddZoneModal.value
}

const toggleAddRateModal = () => {
  showAddRateModal.value = !showAddRateModal.value
}

// Format currency
const formatCurrency = (value: number | null) => {
  return value !== null ? `$${value.toFixed(2)}` : 'N/A'
}
</script>

<template>
  <main>
    <div class="relative isolate overflow-hidden">
      <div class="px-6 py-6 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-7xl">
          <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Shipping</h1>

          <!-- Tabs -->
          <div class="mt-4 border-b border-gray-200 dark:border-gray-700">
            <nav class="-mb-px flex space-x-8" aria-label="Tabs">
              <a
                href="#"
                @click.prevent="activeTab = 'methods'"
                :class="[
                  activeTab === 'methods'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                  'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium'
                ]"
              >
                Shipping Methods
              </a>
              <a
                href="#"
                @click.prevent="activeTab = 'zones'"
                :class="[
                  activeTab === 'zones'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                  'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium'
                ]"
              >
                Shipping Zones
              </a>
              <a
                href="#"
                @click.prevent="activeTab = 'rates'"
                :class="[
                  activeTab === 'rates'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                  'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium'
                ]"
              >
                Shipping Rates
              </a>
            </nav>
          </div>

          <!-- Filters -->
          <div v-if="activeTab === 'methods'" class="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div class="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <!-- Search -->
              <div class="relative rounded-md shadow-sm">
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <div class="i-hugeicons-search-01 h-5 w-5 text-gray-400" />
                </div>
                <input
                  v-model="searchQuery"
                  type="text"
                  class="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:placeholder:text-gray-500 w-full"
                  placeholder="Search shipping methods..."
                />
              </div>

              <!-- Status filter -->
              <div class="relative">
                <select
                  v-model="selectedStatus"
                  class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
                >
                  <option v-for="status in statusOptions" :key="status" :value="status">
                    {{ status }} Status
                  </option>
                </select>
              </div>

              <!-- Zone filter -->
              <div class="relative">
                <select
                  v-model="selectedZone"
                  class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
                >
                  <option v-for="zone in zoneOptions" :key="zone" :value="zone">
                    {{ zone }} Zone
                  </option>
                </select>
              </div>
            </div>

            <!-- Add buttons -->
            <div class="mt-4 sm:mt-0 flex space-x-3">
              <button
                @click="toggleAddMethodModal"
                type="button"
                class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <div class="i-hugeicons-plus-sign h-5 w-5 mr-1" />
                Add Method
              </button>
              <button
                @click="toggleAddZoneModal"
                type="button"
                class="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700"
              >
                <div class="i-hugeicons-plus-sign h-5 w-5 mr-1" />
                Add Zone
              </button>
              <button
                @click="toggleAddRateModal"
                type="button"
                class="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700"
              >
                <div class="i-hugeicons-plus-sign h-5 w-5 mr-1" />
                Add Rate
              </button>
            </div>
          </div>

          <!-- Shipping Methods Table -->
          <div v-if="activeTab === 'methods'" class="mt-8 flow-root">
            <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                  <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                    <thead class="bg-gray-50 dark:bg-blue-gray-700">
                      <tr>
                        <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Name</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Description</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Base Rate</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Handling Fee</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Free Shipping</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Zones</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                        <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                          <span class="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                      <tr v-for="method in filteredShippingMethods" :key="method.id">
                        <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                          {{ method.name }}
                        </td>
                        <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                          {{ method.description }}
                        </td>
                        <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                          {{ formatCurrency(method.baseRate) }}
                        </td>
                        <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                          {{ formatCurrency(method.handlingFee) }}
                        </td>
                        <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                          <span v-if="method.freeShippingThreshold !== null">
                            Over {{ formatCurrency(method.freeShippingThreshold) }}
                          </span>
                          <span v-else>Not available</span>
                        </td>
                        <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                          <div class="flex flex-wrap gap-1">
                            <span
                              v-for="zone in method.zones"
                              :key="zone"
                              class="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            >
                              {{ zone }}
                            </span>
                          </div>
                        </td>
                        <td class="whitespace-nowrap px-3 py-4 text-sm">
                          <span
                            class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                            :class="{
                              'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300': method.status === 'Active',
                              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300': method.status === 'Inactive'
                            }"
                          >
                            {{ method.status }}
                          </span>
                        </td>
                        <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <button type="button" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                            Edit
                          </button>
                          <span class="mx-2 text-gray-300 dark:text-gray-600">|</span>
                          <button type="button" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                            Delete
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <!-- Shipping Zones Content -->
          <div v-if="activeTab === 'zones'" class="mt-4">
            <!-- Zones filters -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div class="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <!-- Search -->
                <div class="relative rounded-md shadow-sm">
                  <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <div class="i-hugeicons-search-01 h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    class="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:placeholder:text-gray-500"
                    placeholder="Search shipping zones"
                  />
                </div>
              </div>

              <!-- Add Zone button -->
              <div class="mt-4 sm:mt-0">
                <button
                  @click="toggleAddZoneModal"
                  type="button"
                  class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <div class="i-hugeicons-plus-sign h-5 w-5 mr-1" />
                  Add Zone
                </button>
              </div>
            </div>

            <!-- Shipping Zones Table -->
            <div class="mt-8 flow-root">
              <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                  <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                    <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                      <thead class="bg-gray-50 dark:bg-blue-gray-700">
                        <tr>
                          <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Name</th>
                          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Countries</th>
                          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Regions</th>
                          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Tax Rate</th>
                          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                          <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                            <span class="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                        <tr v-for="zone in shippingZones" :key="zone.id">
                          <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                            {{ zone.name }}
                          </td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                            {{ zone.countries.join(', ') }}
                          </td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                            {{ zone.regions.join(', ') }}
                          </td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                            {{ zone.taxRate }}%
                          </td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm">
                            <span
                              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                              :class="{
                                'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300': zone.active,
                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300': !zone.active
                              }"
                            >
                              {{ zone.active ? 'Active' : 'Inactive' }}
                            </span>
                          </td>
                          <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <button type="button" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                              Edit
                            </button>
                            <span class="mx-2 text-gray-300 dark:text-gray-600">|</span>
                            <button type="button" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                              Delete
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Shipping Rates Content -->
          <div v-if="activeTab === 'rates'" class="mt-4">
            <!-- Rates filters -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div class="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <!-- Method filter -->
                <div class="relative">
                  <select
                    class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
                  >
                    <option value="all">All Methods</option>
                    <option v-for="method in shippingMethods" :key="method.id" :value="method.id">
                      {{ method.name }}
                    </option>
                  </select>
                </div>

                <!-- Zone filter -->
                <div class="relative">
                  <select
                    class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
                  >
                    <option value="all">All Zones</option>
                    <option v-for="zone in shippingZones" :key="zone.id" :value="zone.id">
                      {{ zone.name }}
                    </option>
                  </select>
                </div>
              </div>

              <!-- Add Rate button -->
              <div class="mt-4 sm:mt-0">
                <button
                  @click="toggleAddRateModal"
                  type="button"
                  class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <div class="i-hugeicons-plus-sign h-5 w-5 mr-1" />
                  Add Rate
                </button>
              </div>
            </div>

            <!-- Shipping Rates Table -->
            <div class="mt-8 flow-root">
              <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                  <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                    <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                      <thead class="bg-gray-50 dark:bg-blue-gray-700">
                        <tr>
                          <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Method</th>
                          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Zone</th>
                          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Weight From</th>
                          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Weight To</th>
                          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Rate</th>
                          <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                            <span class="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                        <tr v-for="rate in shippingRates" :key="rate.id">
                          <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                            {{ shippingMethods.find(m => m.id === rate.methodId)?.name || 'Unknown' }}
                          </td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                            {{ shippingZones.find(z => z.id === rate.zoneId)?.name || 'Unknown' }}
                          </td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                            {{ rate.weightFrom }} kg
                          </td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                            {{ rate.weightTo }} kg
                          </td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                            {{ formatCurrency(rate.rate) }}
                          </td>
                          <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <button type="button" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                              Edit
                            </button>
                            <span class="mx-2 text-gray-300 dark:text-gray-600">|</span>
                            <button type="button" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                              Delete
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Pagination for Methods -->
          <div v-if="activeTab === 'methods'" class="mt-5 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6">
            <div class="flex flex-1 justify-between sm:hidden">
              <a href="#" class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-gray-200 dark:hover:bg-blue-gray-700">Previous</a>
              <a href="#" class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-gray-200 dark:hover:bg-blue-gray-700">Next</a>
            </div>
            <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p class="text-sm text-gray-700 dark:text-gray-300">
                  Showing <span class="font-medium">1</span> to <span class="font-medium">{{ filteredShippingMethods.length }}</span> of <span class="font-medium">{{ filteredShippingMethods.length }}</span> results
                </p>
              </div>
              <div>
                <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <a href="#" class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-gray-600 dark:hover:bg-blue-gray-700">
                    <span class="sr-only">Previous</span>
                    <div class="i-hugeicons-chevron-left h-5 w-5" />
                  </a>
                  <a href="#" aria-current="page" class="relative z-10 inline-flex items-center bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">1</a>
                  <a href="#" class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-gray-600 dark:hover:bg-blue-gray-700">
                    <span class="sr-only">Next</span>
                    <div class="i-hugeicons-chevron-right h-5 w-5" />
                  </a>
                </nav>
              </div>
            </div>
          </div>

          <!-- Pagination for Zones -->
          <div v-if="activeTab === 'zones'" class="mt-5 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6">
            <div class="flex flex-1 justify-between sm:hidden">
              <a href="#" class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-gray-200 dark:hover:bg-blue-gray-700">Previous</a>
              <a href="#" class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-gray-200 dark:hover:bg-blue-gray-700">Next</a>
            </div>
            <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p class="text-sm text-gray-700 dark:text-gray-300">
                  Showing <span class="font-medium">1</span> to <span class="font-medium">{{ shippingZones.length }}</span> of <span class="font-medium">{{ shippingZones.length }}</span> results
                </p>
              </div>
              <div>
                <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <a href="#" class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-gray-600 dark:hover:bg-blue-gray-700">
                    <span class="sr-only">Previous</span>
                    <div class="i-hugeicons-chevron-left h-5 w-5" />
                  </a>
                  <a href="#" aria-current="page" class="relative z-10 inline-flex items-center bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">1</a>
                  <a href="#" class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-gray-600 dark:hover:bg-blue-gray-700">
                    <span class="sr-only">Next</span>
                    <div class="i-hugeicons-chevron-right h-5 w-5" />
                  </a>
                </nav>
              </div>
            </div>
          </div>

          <!-- Pagination for Rates -->
          <div v-if="activeTab === 'rates'" class="mt-5 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6">
            <div class="flex flex-1 justify-between sm:hidden">
              <a href="#" class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-gray-200 dark:hover:bg-blue-gray-700">Previous</a>
              <a href="#" class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-gray-200 dark:hover:bg-blue-gray-700">Next</a>
            </div>
            <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p class="text-sm text-gray-700 dark:text-gray-300">
                  Showing <span class="font-medium">1</span> to <span class="font-medium">{{ shippingRates.length }}</span> of <span class="font-medium">{{ shippingRates.length }}</span> results
                </p>
              </div>
              <div>
                <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <a href="#" class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-gray-600 dark:hover:bg-blue-gray-700">
                    <span class="sr-only">Previous</span>
                    <div class="i-hugeicons-chevron-left h-5 w-5" />
                  </a>
                  <a href="#" aria-current="page" class="relative z-10 inline-flex items-center bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">1</a>
                  <a href="#" class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-gray-600 dark:hover:bg-blue-gray-700">
                    <span class="sr-only">Next</span>
                    <div class="i-hugeicons-chevron-right h-5 w-5" />
                  </a>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.section-content {
  @apply overflow-hidden transition-all duration-300 ease-in-out;
}

.collapsed {
  @apply max-h-0;
}

.expanded {
  @apply max-h-96;
}
</style>
