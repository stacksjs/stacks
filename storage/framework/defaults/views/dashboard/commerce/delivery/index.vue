<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'
import TabNavigation from '../../../../components/Dashboard/Commerce/Delivery/TabNavigation.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'
import ShippingMethodsTable from '../../../../components/Dashboard/Commerce/Delivery/ShippingMethodsTable.vue'
import ShippingZonesTable from '../../../../components/Dashboard/Commerce/Delivery/ShippingZonesTable.vue'
import ShippingRatesTable from '../../../../components/Dashboard/Commerce/Delivery/ShippingRatesTable.vue'
import DeliveryRoutesTable from '../../../../components/Dashboard/Commerce/Delivery/DeliveryRoutesTable.vue'
import DigitalDeliveryTable from '../../../../components/Dashboard/Commerce/Delivery/DigitalDeliveryTable.vue'
import LicenseKeysTable from '../../../../components/Dashboard/Commerce/Delivery/LicenseKeysTable.vue'
import LicenseTemplatesTable from '../../../../components/Dashboard/Commerce/Delivery/LicenseTemplatesTable.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'
import { DeliveryRoute as BaseDeliveryRoute } from '../../../../components/Dashboard/Commerce/Delivery/DeliveryRoutesTable.vue'

useHead({
  title: 'Dashboard - Commerce Delivery',
})

// Extend the DeliveryRoute interface to include additional properties
interface DeliveryRoute extends BaseDeliveryRoute {
  name: string
  status: string
  startCoords: { lat: number; lng: number }
  endCoords: { lat: number; lng: number }
  waypoints: { lat: number; lng: number }[]
}

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

interface ShippingZone {
  id: number
  name: string
  countries: string[]
  regions: string[]
  postalCodes: string[]
  status: string
}

interface ShippingRate {
  id: number
  methodId: number
  zoneId: number
  weightFrom: number
  weightTo: number
  rate: number
}

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

// Sample shipping methods data
const shippingMethods = ref<ShippingMethod[]>([
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

// Sample digital delivery methods data
const digitalDeliveryMethods = ref<DigitalDeliveryMethod[]>([
  {
    id: 1,
    name: 'Direct Download',
    description: 'Customer receives immediate download link',
    status: 'Active',
    downloadLimit: 5,
    expiryDays: 30,
    requiresLogin: true,
    automaticDelivery: true
  },
  {
    id: 2,
    name: 'Email Attachment',
    description: 'Small files sent as email attachments',
    status: 'Active',
    downloadLimit: 3,
    expiryDays: 14,
    requiresLogin: false,
    automaticDelivery: true
  },
  {
    id: 3,
    name: 'License Key',
    description: 'Software activation key sent via email',
    status: 'Active',
    downloadLimit: null,
    expiryDays: null,
    requiresLogin: true,
    automaticDelivery: true
  },
  {
    id: 4,
    name: 'Secure Download Portal',
    description: 'Customer accesses files through secure portal',
    status: 'Active',
    downloadLimit: 10,
    expiryDays: 60,
    requiresLogin: true,
    automaticDelivery: true
  },
  {
    id: 5,
    name: 'Manual Fulfillment',
    description: 'Admin manually sends digital products',
    status: 'Active',
    downloadLimit: null,
    expiryDays: null,
    requiresLogin: false,
    automaticDelivery: false
  }
])

// Sample license key templates
const licenseKeyTemplates = ref<LicenseKeyTemplate[]>([
  {
    id: 1,
    name: 'Standard Software License',
    format: 'XXXX-XXXX-XXXX-XXXX',
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
    name: 'Premium Software License',
    format: 'PREM-XXXXX-XXXXX-XXXXX',
    prefix: 'PREM-',
    suffix: '',
    separator: '-',
    charSet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    segmentLength: 5,
    segmentCount: 3,
    active: true
  },
  {
    id: 3,
    name: 'Downloadable Content',
    format: 'DLC-XXXXXXX-XXX',
    prefix: 'DLC-',
    suffix: '',
    separator: '-',
    charSet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    segmentLength: 7,
    segmentCount: 2,
    active: false
  }
])

// Sample license keys data
const licenseKeys = ref<LicenseKey[]>([
  {
    id: 1,
    key: 'STD-XRTZ-F7P3-WY9K-V5HM',
    templateId: 1,
    customerId: 1023,
    customerName: 'John Smith',
    customerEmail: 'john.smith@example.com',
    productId: 237,
    productName: 'Pro Design Suite 2023',
    orderId: 8754,
    dateCreated: '2023-05-12',
    dateAssigned: '2023-05-12',
    expiryDate: '2024-05-12',
    status: 'Active',
    notes: 'Annual subscription'
  },
  {
    id: 2,
    key: 'STD-JK57-LP82-ZXM9-QR46',
    templateId: 1,
    customerId: 1045,
    customerName: 'Emma Wilson',
    customerEmail: 'emma.w@company.org',
    productId: 237,
    productName: 'Pro Design Suite 2023',
    orderId: 8801,
    dateCreated: '2023-06-03',
    dateAssigned: '2023-06-03',
    expiryDate: '2024-06-03',
    status: 'Active',
    notes: 'Requested additional activation'
  },
  {
    id: 3,
    key: 'PREM-K7JF2-XM50R-QZ93L',
    templateId: 2,
    customerId: 982,
    customerName: 'Carlos Mendez',
    customerEmail: 'carlos@mendez.net',
    productId: 245,
    productName: 'Enterprise Analytics Platform',
    orderId: 8602,
    dateCreated: '2023-04-18',
    dateAssigned: '2023-04-19',
    expiryDate: '2025-04-18',
    status: 'Active',
    notes: 'Premium support package included'
  },
  {
    id: 4,
    key: 'STD-P8J5-HT62-VB4M-NK3W',
    templateId: 1,
    customerId: 1156,
    customerName: 'Sarah Johnson',
    customerEmail: 's.johnson@example.com',
    productId: 237,
    productName: 'Pro Design Suite 2023',
    orderId: 9012,
    dateCreated: '2023-08-15',
    dateAssigned: '2023-08-15',
    expiryDate: '2024-08-15',
    status: 'Revoked',
    notes: 'Refunded - customer requested cancellation'
  },
  {
    id: 5,
    key: 'PREM-T93M5-FL26P-XB7RZ',
    templateId: 2,
    customerId: 1078,
    customerName: 'David Chen',
    customerEmail: 'david.chen@techcorp.com',
    productId: 245,
    productName: 'Enterprise Analytics Platform',
    orderId: 8930,
    dateCreated: '2023-07-22',
    dateAssigned: null,
    expiryDate: null,
    status: 'Unassigned',
    notes: 'Pre-generated for upcoming promotion'
  }
])

// Sample shipping zones data
const shippingZones = ref<ShippingZone[]>([
  {
    id: 1,
    name: 'Domestic',
    countries: ['United States'],
    regions: ['All states'],
    postalCodes: [],
    status: 'Active'
  },
  {
    id: 2,
    name: 'North America',
    countries: ['Canada', 'Mexico'],
    regions: ['All provinces/states'],
    postalCodes: [],
    status: 'Active'
  },
  {
    id: 3,
    name: 'Europe',
    countries: ['United Kingdom', 'France', 'Germany', 'Italy', 'Spain', 'Netherlands', 'Belgium'],
    regions: ['All regions'],
    postalCodes: [],
    status: 'Active'
  },
  {
    id: 4,
    name: 'Asia Pacific',
    countries: ['Japan', 'Australia', 'New Zealand', 'Singapore', 'Hong Kong'],
    regions: ['All regions'],
    postalCodes: [],
    status: 'Active'
  },
  {
    id: 5,
    name: 'International',
    countries: ['Rest of World'],
    regions: ['All regions'],
    postalCodes: [],
    status: 'Active'
  },
  {
    id: 6,
    name: 'Local',
    countries: ['United States'],
    regions: ['Store locations only'],
    postalCodes: [],
    status: 'Active'
  }
])

// Sample shipping rates data
const shippingRates = ref<ShippingRate[]>([
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

// Sample routes data
const deliveryRoutes = ref<DeliveryRoute[]>([
  {
    id: 1,
    name: 'San Francisco Downtown Route',
    driver: 'John Smith',
    vehicle: 'Van #103',
    startLocation: 'SF Warehouse',
    stops: 12,
    avgDeliveryTime: 1.5,
    totalDistance: 28.4,
    status: 'Active',
    lastActive: new Date('2023-05-15'),
    startCoords: { lat: 37.7749, lng: -122.4194 },
    endCoords: { lat: 37.7749, lng: -122.4194 },
    waypoints: [
      { lat: 37.7833, lng: -122.4167 },
      { lat: 37.7694, lng: -122.4862 },
      { lat: 37.7831, lng: -122.4039 }
    ]
  },
  {
    id: 2,
    name: 'Oakland Metro Route',
    driver: 'Sarah Johnson',
    vehicle: 'Truck #87',
    startLocation: 'Oakland Depot',
    stops: 18,
    avgDeliveryTime: 1.2,
    totalDistance: 32.7,
    status: 'Active',
    lastActive: new Date('2023-05-18'),
    startCoords: { lat: 37.8044, lng: -122.2711 },
    endCoords: { lat: 37.8044, lng: -122.2711 },
    waypoints: [
      { lat: 37.8115, lng: -122.2730 },
      { lat: 37.7903, lng: -122.2165 },
      { lat: 37.8270, lng: -122.2881 }
    ]
  },
  {
    id: 3,
    name: 'San Jose Route',
    driver: 'Michael Chen',
    vehicle: 'Van #56',
    startLocation: 'SJ Distribution Center',
    stops: 15,
    avgDeliveryTime: 1.8,
    totalDistance: 41.2,
    status: 'Inactive',
    lastActive: new Date('2023-05-10'),
    startCoords: { lat: 37.3382, lng: -121.8863 },
    endCoords: { lat: 37.3382, lng: -121.8863 },
    waypoints: [
      { lat: 37.3541, lng: -121.9552 },
      { lat: 37.3688, lng: -121.9129 },
      { lat: 37.2971, lng: -121.8193 }
    ]
  },
  {
    id: 4,
    name: 'Berkeley Campus Route',
    driver: 'David Wilson',
    vehicle: 'Car #22',
    startLocation: 'Berkeley Hub',
    stops: 8,
    avgDeliveryTime: 0.9,
    totalDistance: 12.5,
    status: 'Active',
    lastActive: new Date('2023-05-19'),
    startCoords: { lat: 37.8719, lng: -122.2585 },
    endCoords: { lat: 37.8719, lng: -122.2585 },
    waypoints: [
      { lat: 37.8715, lng: -122.2730 },
      { lat: 37.8677, lng: -122.2597 },
      { lat: 37.8742, lng: -122.2661 }
    ]
  },
  {
    id: 5,
    name: 'Palo Alto Tech Route',
    driver: 'Lisa Garcia',
    vehicle: 'Van #78',
    startLocation: 'PA Warehouse',
    stops: 10,
    avgDeliveryTime: 1.1,
    totalDistance: 18.9,
    status: 'Active',
    lastActive: new Date('2023-05-17'),
    startCoords: { lat: 37.4419, lng: -122.1430 },
    endCoords: { lat: 37.4419, lng: -122.1430 },
    waypoints: [
      { lat: 37.4292, lng: -122.1381 },
      { lat: 37.4419, lng: -122.1419 },
      { lat: 37.4519, lng: -122.1519 }
    ]
  }
])

// Tab navigation
const activeTab = ref('methods') // 'methods', 'zones', 'rates', 'digital', 'license', or 'routes'

// Pagination state
const currentPage = ref(1)
const itemsPerPage = ref(10)

// Search state
const searchQuery = ref('')

// Filtered data
const filteredShippingMethods = computed(() => {
  if (!searchQuery.value) return shippingMethods.value

  const query = searchQuery.value.toLowerCase()
  return shippingMethods.value.filter(method =>
    method.name.toLowerCase().includes(query) ||
    method.description.toLowerCase().includes(query)
  )
})

const filteredShippingZones = computed(() => {
  if (!searchQuery.value) return shippingZones.value

  const query = searchQuery.value.toLowerCase()
  return shippingZones.value.filter(zone =>
    zone.name.toLowerCase().includes(query) ||
    zone.countries.some(country => country.toLowerCase().includes(query)) ||
    zone.regions.some(region => region.toLowerCase().includes(query))
  )
})

const filteredShippingRates = computed(() => {
  if (!searchQuery.value) return shippingRates.value

  const query = searchQuery.value.toLowerCase()
  return shippingRates.value.filter(rate => {
    const method = shippingMethods.value.find(m => m.id === rate.methodId)
    const zone = shippingZones.value.find(z => z.id === rate.zoneId)

    return (method && method.name.toLowerCase().includes(query)) ||
           (zone && zone.name.toLowerCase().includes(query))
  })
})

const filteredDigitalMethods = computed(() => {
  if (!searchQuery.value) return digitalDeliveryMethods.value

  const query = searchQuery.value.toLowerCase()
  return digitalDeliveryMethods.value.filter(method =>
    method.name.toLowerCase().includes(query) ||
    method.description.toLowerCase().includes(query)
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

const filteredLicenseKeys = computed(() => {
  if (!searchQuery.value) return licenseKeys.value

  const query = searchQuery.value.toLowerCase()
  return licenseKeys.value.filter(key =>
    key.key.toLowerCase().includes(query) ||
    key.customerName.toLowerCase().includes(query) ||
    key.customerEmail.toLowerCase().includes(query) ||
    key.productName.toLowerCase().includes(query)
  )
})

const filteredRoutes = computed(() => {
  if (!searchQuery.value) return deliveryRoutes.value

  const query = searchQuery.value.toLowerCase()
  return deliveryRoutes.value.filter(route =>
    route.driver.toLowerCase().includes(query) ||
    route.vehicle.toLowerCase().includes(query) ||
    route.startLocation.toLowerCase().includes(query)
  )
})

// Methods
const handleSearch = (query: string) => {
  searchQuery.value = query
  currentPage.value = 1
}

const handleAddMethod = () => {
  // Implementation for adding a new shipping method
  console.log('Add new shipping method')
}

const handleAddZone = () => {
  // Implementation for adding a new shipping zone
  console.log('Add new shipping zone')
}

const handleAddRate = () => {
  // Implementation for adding a new shipping rate
  console.log('Add new shipping rate')
}

const handleAddDigitalMethod = () => {
  // Implementation for adding a new digital delivery method
  console.log('Add new digital delivery method')
}

const handleAddLicenseTemplate = () => {
  // Implementation for adding a new license key template
  console.log('Add new license key template')
}

const handleAddLicenseKey = () => {
  // Implementation for adding a new license key
  console.log('Add new license key')
}

const handleAddRoute = () => {
  // Implementation for adding a new delivery route
  console.log('Add new delivery route')
}

const viewRouteOnMap = (route: DeliveryRoute) => {
  // Implementation for viewing a route on the map
  console.log('View route on map', route)
}

const handleEditMethod = (method: ShippingMethod) => {
  // Implementation for editing a shipping method
  console.log('Edit shipping method', method)
}

const handleDeleteMethod = (method: ShippingMethod) => {
  // Implementation for deleting a shipping method
  console.log('Delete shipping method', method)
}

const handleEditZone = (zone: ShippingZone) => {
  // Implementation for editing a shipping zone
  console.log('Edit shipping zone', zone)
}

const handleDeleteZone = (zone: ShippingZone) => {
  // Implementation for deleting a shipping zone
  console.log('Delete shipping zone', zone)
}

const handleEditRate = (rate: ShippingRate) => {
  // Implementation for editing a shipping rate
  console.log('Edit shipping rate', rate)
}

const handleDeleteRate = (rate: ShippingRate) => {
  // Implementation for deleting a shipping rate
  console.log('Delete shipping rate', rate)
}

const handleEditDigitalMethod = (method: DigitalDeliveryMethod) => {
  // Implementation for editing a digital delivery method
  console.log('Edit digital delivery method', method)
}

const handleDeleteDigitalMethod = (method: DigitalDeliveryMethod) => {
  // Implementation for deleting a digital delivery method
  console.log('Delete digital delivery method', method)
}

const handleEditLicenseTemplate = (template: LicenseKeyTemplate) => {
  // Implementation for editing a license key template
  console.log('Edit license key template', template)
}

const handleDeleteLicenseTemplate = (template: LicenseKeyTemplate) => {
  // Implementation for deleting a license key template
  console.log('Delete license key template', template)
}

const handleViewLicenseKey = (key: LicenseKey) => {
  // Implementation for viewing a license key
  console.log('View license key', key)
}

const handleEditLicenseKey = (key: LicenseKey) => {
  // Implementation for editing a license key
  console.log('Edit license key', key)
}

const handleEditRoute = (route: DeliveryRoute) => {
  // Implementation for editing a delivery route
  console.log('Edit delivery route', route)
}

const handleDeleteRoute = (route: DeliveryRoute) => {
  // Implementation for deleting a delivery route
  console.log('Delete delivery route', route)
}

// Pagination methods
const handlePrevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const handleNextPage = () => {
  const totalItems = getTotalItems()
  const totalPages = Math.ceil(totalItems / itemsPerPage.value)

  if (currentPage.value < totalPages) {
    currentPage.value++
  }
}

const handlePageChange = (page: number) => {
  currentPage.value = page
}

const getTotalItems = () => {
  switch (activeTab.value) {
    case 'methods':
      return filteredShippingMethods.value.length
    case 'zones':
      return filteredShippingZones.value.length
    case 'rates':
      return filteredShippingRates.value.length
    case 'digital':
      return filteredDigitalMethods.value.length
    case 'license':
      return filteredLicenseKeys.value.length
    case 'routes':
      return filteredRoutes.value.length
    default:
      return 0
  }
}

// Tab configuration
const tabs = [
  { name: 'Shipping Methods', value: 'methods', href: '#methods' },
  { name: 'Shipping Zones', value: 'zones', href: '#zones' },
  { name: 'Shipping Rates', value: 'rates', href: '#rates' },
  { name: 'Digital Delivery', value: 'digital', href: '#digital' },
  { name: 'License Keys', value: 'license', href: '#license' },
  { name: 'Delivery Routes', value: 'routes', href: '#routes' },
]
</script>

<template>
  <div class="py-6">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Delivery</h1>
    </div>
    <div class="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
      <div class="py-4">
        <!-- Tab Navigation -->
        <TabNavigation
          v-model="activeTab"
          :tabs="tabs"
        />

        <!-- Shipping Methods Tab -->
        <div v-if="activeTab === 'methods'" class="mt-6">
          <div class="flex justify-between mb-6">
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

          <div class="mb-6">
            <SearchFilter
              placeholder="Search shipping methods..."
              @search="handleSearch"
              class="w-full md:w-96"
            />
          </div>

          <ShippingMethodsTable
            :methods="filteredShippingMethods"
            @edit="handleEditMethod"
            @delete="handleDeleteMethod"
          />

          <Pagination
            :current-page="currentPage"
            :total-items="filteredShippingMethods.length"
            :items-per-page="itemsPerPage"
            @prev="handlePrevPage"
            @next="handleNextPage"
            @page="handlePageChange"
            class="mt-6"
          />
        </div>

        <!-- Shipping Zones Tab -->
        <div v-if="activeTab === 'zones'" class="mt-6">
          <div class="flex justify-between mb-6">
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

          <div class="mb-6">
            <SearchFilter
              placeholder="Search shipping zones..."
              @search="handleSearch"
              class="w-full md:w-96"
            />
          </div>

          <ShippingZonesTable
            :zones="filteredShippingZones"
            @edit="handleEditZone"
            @delete="handleDeleteZone"
          />

          <Pagination
            :current-page="currentPage"
            :total-items="filteredShippingZones.length"
            :items-per-page="itemsPerPage"
            @prev="handlePrevPage"
            @next="handleNextPage"
            @page="handlePageChange"
            class="mt-6"
          />
        </div>

        <!-- Shipping Rates Tab -->
        <div v-if="activeTab === 'rates'" class="mt-6">
          <div class="flex justify-between mb-6">
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

          <div class="mb-6">
            <SearchFilter
              placeholder="Search shipping rates..."
              @search="handleSearch"
              class="w-full md:w-96"
            />
          </div>

          <ShippingRatesTable
            :rates="filteredShippingRates"
            :methods="shippingMethods"
            :zones="shippingZones"
            @edit="handleEditRate"
            @delete="handleDeleteRate"
          />

          <Pagination
            :current-page="currentPage"
            :total-items="filteredShippingRates.length"
            :items-per-page="itemsPerPage"
            @prev="handlePrevPage"
            @next="handleNextPage"
            @page="handlePageChange"
            class="mt-6"
          />
        </div>

        <!-- Digital Delivery Tab -->
        <div v-if="activeTab === 'digital'" class="mt-6">
          <div class="flex justify-between mb-6">
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

          <div class="mb-6">
            <SearchFilter
              placeholder="Search digital delivery methods..."
              @search="handleSearch"
              class="w-full md:w-96"
            />
          </div>

          <DigitalDeliveryTable
            :methods="filteredDigitalMethods"
            @edit="handleEditDigitalMethod"
            @delete="handleDeleteDigitalMethod"
          />

          <Pagination
            :current-page="currentPage"
            :total-items="filteredDigitalMethods.length"
            :items-per-page="itemsPerPage"
            @prev="handlePrevPage"
            @next="handleNextPage"
            @page="handlePageChange"
            class="mt-6"
          />
        </div>

        <!-- License Keys Tab -->
        <div v-if="activeTab === 'license'" class="mt-6">
          <div class="flex justify-between mb-6">
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

          <LicenseTemplatesTable
            :templates="filteredLicenseTemplates"
            @edit="handleEditLicenseTemplate"
            @delete="handleDeleteLicenseTemplate"
          />

          <div class="flex justify-between mt-10 mb-6">
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

          <div class="mb-6">
            <SearchFilter
              placeholder="Search license keys..."
              @search="handleSearch"
              class="w-full md:w-96"
            />
          </div>

          <LicenseKeysTable
            :license-keys="filteredLicenseKeys"
            :templates="licenseKeyTemplates"
            @view="handleViewLicenseKey"
            @edit="handleEditLicenseKey"
          />

          <Pagination
            :current-page="currentPage"
            :total-items="filteredLicenseKeys.length"
            :items-per-page="itemsPerPage"
            @prev="handlePrevPage"
            @next="handleNextPage"
            @page="handlePageChange"
            class="mt-6"
          />
        </div>

        <!-- Delivery Routes Tab -->
        <div v-if="activeTab === 'routes'" class="mt-6">
          <div class="flex justify-between mb-6">
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

          <div class="mb-6">
            <SearchFilter
              placeholder="Search delivery routes..."
              @search="handleSearch"
              class="w-full md:w-96"
            />
          </div>

          <DeliveryRoutesTable
            :routes="filteredRoutes"
            @view-map="viewRouteOnMap"
            @edit="handleEditRoute"
            @delete="handleDeleteRoute"
          />

          <Pagination
            :current-page="currentPage"
            :total-items="filteredRoutes.length"
            :items-per-page="itemsPerPage"
            @prev="handlePrevPage"
            @next="handleNextPage"
            @page="handlePageChange"
            class="mt-6"
          />
        </div>
      </div>
    </div>
  </div>
</template>
