<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Dashboard - Commerce Delivery',
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

// Sample digital delivery methods data
const digitalDeliveryMethods = ref([
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
const licenseKeyTemplates = ref([
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

// Add license key interface
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

// Filter states for digital delivery
const digitalSearchQuery = ref('')
const selectedDigitalStatus = ref('All')
const licenseKeySearchQuery = ref('')
const selectedLicenseStatus = ref('All')

// Active tab state
const activeTab = ref('methods') // 'methods', 'zones', 'rates', 'digital', 'license', or 'routes'

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

// Filtered digital delivery methods
const filteredDigitalMethods = computed(() => {
  return digitalDeliveryMethods.value.filter(method => {
    // Filter by search query
    const matchesSearch = method.name.toLowerCase().includes(digitalSearchQuery.value.toLowerCase()) ||
                          method.description.toLowerCase().includes(digitalSearchQuery.value.toLowerCase())

    // Filter by status
    const matchesStatus = selectedDigitalStatus.value === 'All' || method.status === selectedDigitalStatus.value

    return matchesSearch && matchesStatus
  })
})

// Filtered license keys
const filteredLicenseKeys = computed(() => {
  return licenseKeys.value.filter(licenseKey => {
    // Filter by search query
    const matchesSearch =
      licenseKey.key.toLowerCase().includes(licenseKeySearchQuery.value.toLowerCase()) ||
      licenseKey.customerName.toLowerCase().includes(licenseKeySearchQuery.value.toLowerCase()) ||
      licenseKey.customerEmail.toLowerCase().includes(licenseKeySearchQuery.value.toLowerCase()) ||
      licenseKey.productName.toLowerCase().includes(licenseKeySearchQuery.value.toLowerCase()) ||
      (licenseKey.notes && licenseKey.notes.toLowerCase().includes(licenseKeySearchQuery.value.toLowerCase()))

    // Filter by status
    const matchesStatus = selectedLicenseStatus.value === 'All' || licenseKey.status === selectedLicenseStatus.value

    return matchesSearch && matchesStatus
  })
})

// Modal state
const showAddMethodModal = ref(false)
const showAddZoneModal = ref(false)
const showAddRateModal = ref(false)
const showAddDigitalMethodModal = ref(false)
const showAddLicenseTemplateModal = ref(false)
const showAddLicenseKeyModal = ref(false)
const showViewLicenseKeyModal = ref(false)
const selectedLicenseKey = ref<LicenseKey | null>(null)

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

const toggleAddDigitalMethodModal = () => {
  showAddDigitalMethodModal.value = !showAddDigitalMethodModal.value
}

const toggleAddLicenseTemplateModal = () => {
  showAddLicenseTemplateModal.value = !showAddLicenseTemplateModal.value
}

const toggleAddLicenseKeyModal = () => {
  showAddLicenseKeyModal.value = !showAddLicenseKeyModal.value
}

const viewLicenseKey = (licenseKey: LicenseKey) => {
  selectedLicenseKey.value = licenseKey
  showViewLicenseKeyModal.value = true
}

const closeLicenseKeyModal = () => {
  showViewLicenseKeyModal.value = false
  selectedLicenseKey.value = null
}

// Format currency
const formatCurrency = (value: number | null) => {
  return value !== null ? `$${value.toFixed(2)}` : 'N/A'
}

// Format display for unlimited/null values
const formatLimit = (value: number | null) => {
  return value !== null ? value.toString() : 'Unlimited'
}

// Format display for expiry days
const formatExpiry = (days: number | null) => {
  return days !== null ? `${days} days` : 'Never expires'
}

// Format date display
const formatDate = (date: string | null | undefined): string => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString();
}

// Define route type
interface DeliveryRoute {
  id: number;
  name: string;
  driver: string;
  vehicle: string;
  startLocation: string;
  stops: number;
  avgDeliveryTime: number;
  totalDistance: number;
  status: string;
  lastActive?: string;
  startCoords: { lat: number; lng: number };
  endCoords: { lat: number; lng: number };
  waypoints: Array<{ lat: number; lng: number }>;
}

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
    startCoords: { lat: 37.4419, lng: -122.1430 },
    endCoords: { lat: 37.4419, lng: -122.1430 },
    waypoints: [
      { lat: 37.4292, lng: -122.1381 },
      { lat: 37.4419, lng: -122.1419 },
      { lat: 37.4519, lng: -122.1519 }
    ]
  }
])

// Routes search and filter
const routesSearchQuery = ref('')
const selectedRouteStatus = ref('All')

// Filtered routes
const filteredRoutes = computed(() => {
  return deliveryRoutes.value.filter(route => {
    // Filter by search query
    const matchesSearch =
      route.name.toLowerCase().includes(routesSearchQuery.value.toLowerCase()) ||
      route.driver.toLowerCase().includes(routesSearchQuery.value.toLowerCase()) ||
      route.vehicle.toLowerCase().includes(routesSearchQuery.value.toLowerCase()) ||
      route.startLocation.toLowerCase().includes(routesSearchQuery.value.toLowerCase())

    // Filter by status
    const matchesStatus = selectedRouteStatus.value === 'All' || route.status === selectedRouteStatus.value

    return matchesSearch && matchesStatus
  })
})

// Modal state for route map
const showRouteMapModal = ref(false)
const selectedRoute = ref<DeliveryRoute | null>(null)

// Toggle route map modal
const viewRouteOnMap = (routeItem: DeliveryRoute) => {
  selectedRoute.value = routeItem
  showRouteMapModal.value = true
}

const closeRouteMapModal = () => {
  showRouteMapModal.value = false
  selectedRoute.value = null
}

// Generate Google Maps URL for the selected route
const getGoogleMapsEmbedUrl = computed(() => {
  if (!selectedRoute.value) return ''

  const origin = `${selectedRoute.value.startCoords.lat},${selectedRoute.value.startCoords.lng}`
  const destination = `${selectedRoute.value.endCoords.lat},${selectedRoute.value.endCoords.lng}`

  let waypointsParam = ''
  if (selectedRoute.value.waypoints && selectedRoute.value.waypoints.length > 0) {
    waypointsParam = selectedRoute.value.waypoints
      .map(wp => `${wp.lat},${wp.lng}`)
      .join('|')
  }

  return `https://www.google.com/maps/embed/v1/directions?key=YOUR_API_KEY&origin=${origin}&destination=${destination}${waypointsParam ? '&waypoints=' + waypointsParam : ''}&mode=driving`
})
</script>

<template>
  <main>
    <div class="relative isolate overflow-hidden">
      <div class="px-6 py-6 sm:px-6 lg:px-8">
        <div class="mx-auto max-w-7xl">
          <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Delivery</h1>

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
              <a
                href="#"
                @click.prevent="activeTab = 'digital'"
                :class="[
                  activeTab === 'digital'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                  'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium'
                ]"
              >
                Digital Delivery
              </a>
              <a
                href="#"
                @click.prevent="activeTab = 'license'"
                :class="[
                  activeTab === 'license'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                  'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium'
                ]"
              >
                License Keys
              </a>
              <a
                href="#"
                @click.prevent="activeTab = 'routes'"
                :class="[
                  activeTab === 'routes'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                  'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium'
                ]"
              >
                Routes
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
                          <button type="button" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 px-3 py-1.5 rounded-md border border-transparent hover:border-blue-200 dark:hover:border-blue-800 mr-2" @click="viewRouteOnMap(route as DeliveryRoute)">
                            View Map
                          </button>
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
                    placeholder="Search shipping zones..."
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

          <!-- Digital Delivery Section -->
          <div v-if="activeTab === 'digital'" class="mt-4">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div class="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <!-- Search -->
                <div class="relative rounded-md shadow-sm">
                  <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <div class="i-hugeicons-search-01 h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    v-model="digitalSearchQuery"
                    type="text"
                    class="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:placeholder:text-gray-500"
                    placeholder="Search digital delivery methods..."
                  />
                </div>

                <!-- Status filter -->
                <div class="relative">
                  <select
                    v-model="selectedDigitalStatus"
                    class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
                  >
                    <option v-for="status in statusOptions" :key="status" :value="status">
                      {{ status }} Status
                    </option>
                  </select>
                </div>
              </div>

              <!-- Add Digital Method button -->
              <div class="mt-4 sm:mt-0">
                <button
                  @click="toggleAddDigitalMethodModal"
                  type="button"
                  class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <div class="i-hugeicons-plus-sign h-5 w-5 mr-1" />
                  Add Digital Method
                </button>
              </div>
            </div>

            <!-- Digital Delivery Methods Table -->
            <div class="mt-8 flow-root">
              <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                  <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                    <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                      <thead class="bg-gray-50 dark:bg-blue-gray-700">
                        <tr>
                          <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Name</th>
                          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Description</th>
                          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Download Limit</th>
                          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Expiry Days</th>
                          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Requires Login</th>
                          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Automatic Delivery</th>
                          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                          <th scope="col" class="relative py-4 pl-3 pr-4 sm:pr-6">
                            <span class="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                        <tr v-for="method in filteredDigitalMethods" :key="method.id">
                          <td class="whitespace-nowrap py-4.5 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                            {{ method.name }}
                          </td>
                          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                            {{ method.description }}
                          </td>
                          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                            {{ formatLimit(method.downloadLimit) }}
                          </td>
                          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                            {{ formatExpiry(method.expiryDays) }}
                          </td>
                          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                            {{ method.requiresLogin ? 'Yes' : 'No' }}
                          </td>
                          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                            {{ method.automaticDelivery ? 'Yes' : 'No' }}
                          </td>
                          <td class="whitespace-nowrap px-4 py-4.5 text-sm">
                            <span
                              class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                              :class="{
                                'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300': method.status === 'Active',
                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300': method.status === 'Inactive'
                              }"
                            >
                              {{ method.status }}
                            </span>
                          </td>
                          <td class="relative whitespace-nowrap py-4.5 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
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

          <!-- Pagination for Digital Delivery -->
          <div v-if="activeTab === 'digital'" class="mt-5 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6">
            <div class="flex flex-1 justify-between sm:hidden">
              <a href="#" class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-gray-200 dark:hover:bg-blue-gray-700">Previous</a>
              <a href="#" class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-gray-200 dark:hover:bg-blue-gray-700">Next</a>
            </div>
            <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p class="text-sm text-gray-700 dark:text-gray-300">
                  Showing <span class="font-medium">1</span> to <span class="font-medium">{{ filteredDigitalMethods.length }}</span> of <span class="font-medium">{{ filteredDigitalMethods.length }}</span> results
                </p>
              </div>
              <div>
                <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <a href="#" class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-gray-700 dark:hover:bg-blue-gray-700">
                    <span class="sr-only">Previous</span>
                    <div class="i-hugeicons-chevron-left h-5 w-5" />
                  </a>
                  <a href="#" aria-current="page" class="relative z-10 inline-flex items-center bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">1</a>
                  <a href="#" class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-gray-700 dark:hover:bg-blue-gray-700">
                    <span class="sr-only">Next</span>
                    <div class="i-hugeicons-chevron-right h-5 w-5" />
                  </a>
                </nav>
              </div>
            </div>
          </div>

          <!-- License Keys Section -->
          <div v-if="activeTab === 'license'" class="mt-4">
            <div class="pb-5 sm:flex sm:items-center sm:justify-between">
              <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">License Keys</h3>

              <div class="mt-3 sm:mt-0 sm:ml-4">
                <button
                  @click="toggleAddLicenseKeyModal"
                  type="button"
                  class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <div class="i-hugeicons-plus-sign h-5 w-5 mr-2" />
                  Add License Key
                </button>
              </div>
            </div>

            <!-- License Keys filters -->
            <div class="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div class="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-6">
                <!-- Search -->
                <div class="relative rounded-md shadow-sm w-full sm:w-80">
                  <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <div class="i-hugeicons-search-01 h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    v-model="licenseKeySearchQuery"
                    type="text"
                    class="block w-full rounded-md border-0 py-2.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:placeholder:text-gray-500"
                    placeholder="Search license keys..."
                  />
                </div>

                <!-- Status filter -->
                <div class="relative w-full sm:w-52">
                  <select
                    v-model="selectedLicenseStatus"
                    class="block w-full rounded-md border-0 py-2.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
                  >
                    <option v-for="status in ['All', 'Active', 'Inactive', 'Revoked', 'Unassigned']" :key="status" :value="status">
                      {{ status }} Status
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <!-- License Keys Table -->
            <div class="mt-6 flow-root">
              <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                  <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                    <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                      <thead class="bg-gray-50 dark:bg-blue-gray-700">
                        <tr>
                          <th scope="col" class="py-4 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Key</th>
                          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Template</th>
                          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Customer</th>
                          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Product</th>
                          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Order ID</th>
                          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Date Created</th>
                          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Expiry Date</th>
                          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                          <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                        <tr v-for="licenseKey in filteredLicenseKeys" :key="licenseKey.id">
                          <td class="whitespace-nowrap py-4.5 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                            {{ licenseKey.key }}
                          </td>
                          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                            {{ licenseKeyTemplates.find(t => t.id === licenseKey.templateId)?.name || 'Unknown' }}
                          </td>
                          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                            {{ licenseKey.customerName }}
                            <div class="text-xs text-gray-400 dark:text-gray-500">{{ licenseKey.customerEmail }}</div>
                          </td>
                          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                            {{ licenseKey.productName }}
                          </td>
                          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                            {{ licenseKey.orderId }}
                          </td>
                          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                            {{ formatDate(licenseKey.dateCreated) }}
                          </td>
                          <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                            {{ formatDate(licenseKey.expiryDate) }}
                          </td>
                          <td class="whitespace-nowrap px-4 py-4.5 text-sm">
                            <span
                              class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                              :class="{
                                'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300': licenseKey.status === 'Active',
                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300': licenseKey.status === 'Inactive',
                                'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300': licenseKey.status === 'Revoked',
                                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300': licenseKey.status === 'Unassigned'
                              }"
                            >
                              {{ licenseKey.status }}
                            </span>
                          </td>
                          <td class="relative whitespace-nowrap py-4.5 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <button type="button" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 px-3 py-1.5 rounded-md border border-transparent hover:border-blue-200 dark:hover:border-blue-800" @click="viewLicenseKey(licenseKey)">View</button>
                            <button type="button" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 px-3 py-1.5 rounded-md border border-transparent hover:border-blue-200 dark:hover:border-blue-800 ml-2">Edit</button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            <!-- License Key Templates Section -->
            <div class="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div class="pb-5 sm:flex sm:items-center sm:justify-between">
                <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">License Key Templates</h3>
                <div class="mt-3 sm:mt-0 sm:ml-4">
                  <button
                    @click="toggleAddLicenseTemplateModal"
                    type="button"
                    class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    <div class="i-hugeicons-plus-sign h-5 w-5 mr-2" />
                    Add License Template
                  </button>
                </div>
              </div>

              <!-- License Key Templates Table -->
              <div class="mt-6 flow-root">
                <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                  <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                    <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                      <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                        <thead class="bg-gray-50 dark:bg-blue-gray-700">
                          <tr>
                            <th scope="col" class="py-4 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Name</th>
                            <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Format</th>
                            <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Prefix</th>
                            <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Segments</th>
                            <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Character Set</th>
                            <th scope="col" class="px-4 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                            <th scope="col" class="relative py-4 pl-3 pr-4 sm:pr-6">
                              <span class="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                          <tr v-for="template in licenseKeyTemplates" :key="template.id">
                            <td class="whitespace-nowrap py-4.5 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                              {{ template.name }}
                            </td>
                            <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                              {{ template.format }}
                            </td>
                            <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                              {{ template.prefix || 'None' }}
                            </td>
                            <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                              {{ template.segmentCount }} × {{ template.segmentLength }}
                            </td>
                            <td class="whitespace-nowrap px-4 py-4.5 text-sm text-gray-500 dark:text-gray-300">
                              {{ template.charSet.length }} chars
                            </td>
                            <td class="whitespace-nowrap px-4 py-4.5 text-sm">
                              <span
                                class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
                                :class="{
                                  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300': template.active,
                                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300': !template.active
                                }"
                              >
                                {{ template.active ? 'Active' : 'Inactive' }}
                              </span>
                            </td>
                            <td class="relative whitespace-nowrap py-4.5 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
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

          <!-- Pagination for License Keys -->
          <div v-if="activeTab === 'license'" class="mt-5 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6">
            <div class="flex flex-1 justify-between sm:hidden">
              <a href="#" class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-gray-200 dark:hover:bg-blue-gray-700">Previous</a>
              <a href="#" class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-gray-200 dark:hover:bg-blue-gray-700">Next</a>
            </div>
            <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p class="text-sm text-gray-700 dark:text-gray-300">
                  Showing <span class="font-medium">1</span> to <span class="font-medium">{{ filteredLicenseKeys.length }}</span> of <span class="font-medium">{{ filteredLicenseKeys.length }}</span> results
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

          <!-- Routes search and filter -->
          <div v-if="activeTab === 'routes'" class="mt-4">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div class="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <!-- Search -->
                <div class="relative rounded-md shadow-sm">
                  <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <div class="i-hugeicons-search-01 h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    v-model="routesSearchQuery"
                    type="text"
                    class="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:placeholder:text-gray-500"
                    placeholder="Search delivery routes..."
                  />
                </div>

                <!-- Status filter -->
                <div class="relative">
                  <select
                    v-model="selectedRouteStatus"
                    class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
                  >
                    <option v-for="status in ['All', 'Active', 'Inactive']" :key="status" :value="status">
                      {{ status }} Status
                    </option>
                  </select>
                </div>
              </div>

              <!-- Add Route button -->
              <div class="mt-4 sm:mt-0">
                <button
                  @click="toggleAddZoneModal"
                  type="button"
                  class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <div class="i-hugeicons-plus-sign h-5 w-5 mr-1" />
                  Add Route
                </button>
              </div>
            </div>

            <!-- Routes Table -->
            <div class="mt-8 flow-root">
              <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                  <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                    <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                      <thead class="bg-gray-50 dark:bg-blue-gray-700">
                        <tr>
                          <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">Name</th>
                          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Driver</th>
                          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Vehicle</th>
                          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Start Location</th>
                          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Stops</th>
                          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Average Delivery Time</th>
                          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Total Distance</th>
                          <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Last Active</th>
                          <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                            <span class="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                        <tr v-for="route in filteredRoutes" :key="route.id">
                          <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                            {{ route.name }}
                          </td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                            {{ route.driver }}
                          </td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                            {{ route.vehicle }}
                          </td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm">
                            <span
                              class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                              :class="{
                                'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300': route.status === 'Active',
                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300': route.status === 'Inactive'
                              }"
                            >
                              {{ route.status }}
                            </span>
                          </td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                            {{ route.startLocation }}
                          </td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                            {{ route.stops }}
                          </td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                            {{ route.avgDeliveryTime }} hours
                          </td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                            {{ route.totalDistance }} km
                          </td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                            {{ formatDate(route.lastActive) }}
                          </td>
                          <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <button type="button" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 px-3 py-1.5 rounded-md border border-transparent hover:border-blue-200 dark:hover:border-blue-800 mr-2" @click="viewRouteOnMap(route)">
                              View Map
                            </button>
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

          <!-- Pagination for Routes -->
          <div v-if="activeTab === 'routes'" class="mt-5 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6">
            <div class="flex flex-1 justify-between sm:hidden">
              <a href="#" class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-gray-200 dark:hover:bg-blue-gray-700">Previous</a>
              <a href="#" class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-gray-200 dark:hover:bg-blue-gray-700">Next</a>
            </div>
            <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p class="text-sm text-gray-700 dark:text-gray-300">
                  Showing <span class="font-medium">1</span> to <span class="font-medium">{{ filteredRoutes.length }}</span> of <span class="font-medium">{{ filteredRoutes.length }}</span> results
                </p>
              </div>
              <div>
                <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <a href="#" class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-gray-700 dark:hover:bg-blue-gray-700">
                    <span class="sr-only">Previous</span>
                    <div class="i-hugeicons-chevron-left h-5 w-5" />
                  </a>
                  <a href="#" aria-current="page" class="relative z-10 inline-flex items-center bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">1</a>
                  <a href="#" class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-gray-700 dark:hover:bg-blue-gray-700">
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

  <!-- Modal for adding digital delivery method -->
  <div v-if="showAddDigitalMethodModal" class="fixed inset-0 z-10 overflow-y-auto">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <div class="relative transform overflow-hidden rounded-lg bg-white dark:bg-blue-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
        <div>
          <div class="mt-3 text-center sm:mt-5">
            <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">Add Digital Delivery Method</h3>
            <div class="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div class="sm:col-span-6">
                <label for="digital-method-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                <div class="mt-1">
                  <input type="text" id="digital-method-name" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white" placeholder="Method name" />
                </div>
              </div>

              <div class="sm:col-span-6">
                <label for="digital-method-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                <div class="mt-1">
                  <textarea id="digital-method-description" rows="3" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white" placeholder="Describe this delivery method"></textarea>
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="digital-method-download-limit" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Download Limit</label>
                <div class="mt-1">
                  <input type="number" id="digital-method-download-limit" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white" placeholder="Leave blank for unlimited" />
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="digital-method-expiry-days" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Expiry Days</label>
                <div class="mt-1">
                  <input type="number" id="digital-method-expiry-days" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white" placeholder="Leave blank for no expiry" />
                </div>
              </div>

              <div class="sm:col-span-3">
                <div class="flex items-center">
                  <input id="requires-login" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700" />
                  <label for="requires-login" class="ml-2 block text-sm text-gray-700 dark:text-gray-300">Requires Login</label>
                </div>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Customer must be logged in to access digital products</p>
              </div>

              <div class="sm:col-span-3">
                <div class="flex items-center">
                  <input id="automatic-delivery" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700" checked />
                  <label for="automatic-delivery" class="ml-2 block text-sm text-gray-700 dark:text-gray-300">Automatic Delivery</label>
                </div>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Products are delivered automatically when order is completed</p>
              </div>

              <div class="sm:col-span-3">
                <label for="digital-method-status" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <div class="mt-1">
                  <select id="digital-method-status" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
          <button type="button" class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2" @click="toggleAddDigitalMethodModal">Save</button>
          <button type="button" class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 dark:bg-blue-gray-700 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-blue-gray-600" @click="toggleAddDigitalMethodModal">Cancel</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal for adding license key template -->
  <div v-if="showAddLicenseTemplateModal" class="fixed inset-0 z-10 overflow-y-auto">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <div class="relative transform overflow-hidden rounded-lg bg-white dark:bg-blue-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
        <div>
          <div class="mt-3 text-center sm:mt-5">
            <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">Add License Key Template</h3>
            <div class="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div class="sm:col-span-6">
                <label for="license-template-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                <div class="mt-1">
                  <input type="text" id="license-template-name" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white" placeholder="Template name" />
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="license-template-prefix" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Prefix</label>
                <div class="mt-1">
                  <input type="text" id="license-template-prefix" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white" placeholder="Optional prefix" />
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="license-template-suffix" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Suffix</label>
                <div class="mt-1">
                  <input type="text" id="license-template-suffix" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white" placeholder="Optional suffix" />
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="license-template-segments" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Segment Count</label>
                <div class="mt-1">
                  <input type="number" id="license-template-segments" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white" min="1" max="10" value="4" />
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="license-template-length" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Segment Length</label>
                <div class="mt-1">
                  <input type="number" id="license-template-length" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white" min="2" max="12" value="4" />
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="license-template-separator" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Separator</label>
                <div class="mt-1">
                  <select id="license-template-separator" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white">
                    <option value="-">Hyphen (-)</option>
                    <option value="_">Underscore (_)</option>
                    <option value=".">Period (.)</option>
                    <option value=" ">Space</option>
                    <option value="">None</option>
                  </select>
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="license-template-charset" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Character Set</label>
                <div class="mt-1">
                  <select id="license-template-charset" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white">
                    <option value="alphanumeric">Alphanumeric (A-Z, 0-9)</option>
                    <option value="uppercase">Uppercase Letters (A-Z)</option>
                    <option value="numeric">Numbers Only (0-9)</option>
                    <option value="hexadecimal">Hexadecimal (0-9, A-F)</option>
                  </select>
                </div>
              </div>

              <div class="sm:col-span-6">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Preview</label>
                <div class="mt-1 p-2 border rounded bg-gray-50 dark:bg-blue-gray-900 dark:border-gray-600">
                  <code class="text-sm text-gray-900 dark:text-gray-100 font-mono">XXXX-XXXX-XXXX-XXXX</code>
                </div>
              </div>

              <div class="sm:col-span-3">
                <div class="flex items-center">
                  <input id="active-template" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700" checked />
                  <label for="active-template" class="ml-2 block text-sm text-gray-700 dark:text-gray-300">Active</label>
                </div>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Enable this template for use</p>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
          <button type="button" class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2" @click="toggleAddLicenseTemplateModal">Save</button>
          <button type="button" class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 dark:bg-blue-gray-700 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-blue-gray-600" @click="toggleAddLicenseTemplateModal">Cancel</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal for viewing license key -->
  <div v-if="showViewLicenseKeyModal && selectedLicenseKey" class="fixed inset-0 z-10 overflow-y-auto">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <div class="relative transform overflow-hidden rounded-lg bg-white dark:bg-blue-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
        <div>
          <div class="mt-3 text-center sm:mt-5">
            <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">License Key Details</h3>
            <div class="mt-6 grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-6">
              <div class="sm:col-span-6">
                <label for="license-key" class="block text-sm font-medium text-gray-700 dark:text-gray-300">License Key</label>
                <div class="mt-1.5">
                  <input type="text" id="license-key" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white py-2.5" :value="selectedLicenseKey.key" readonly />
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="license-template" class="block text-sm font-medium text-gray-700 dark:text-gray-300">License Template</label>
                <div class="mt-1.5">
                  <input type="text" id="license-template" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white py-2.5" :value="licenseKeyTemplates.find(t => t.id === selectedLicenseKey?.templateId)?.name || 'Unknown'" readonly />
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="customer-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Customer Name</label>
                <div class="mt-1.5">
                  <input type="text" id="customer-name" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white py-2.5" :value="selectedLicenseKey.customerName" readonly />
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="customer-email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Customer Email</label>
                <div class="mt-1.5">
                  <input type="text" id="customer-email" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white py-2.5" :value="selectedLicenseKey.customerEmail" readonly />
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="product-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Product Name</label>
                <div class="mt-1.5">
                  <input type="text" id="product-name" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white py-2.5" :value="selectedLicenseKey.productName" readonly />
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="expiry-date" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Expiry Date</label>
                <div class="mt-1.5">
                  <input type="text" id="expiry-date" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white py-2.5" :value="formatDate(selectedLicenseKey.expiryDate)" readonly />
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="status" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <div class="mt-1.5">
                  <input type="text" id="status" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white py-2.5" :value="selectedLicenseKey.status" readonly />
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="notes" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
                <div class="mt-1.5">
                  <textarea id="notes" rows="3" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white py-2.5" :value="selectedLicenseKey.notes" readonly></textarea>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-6 sm:mt-8 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
          <button type="button" class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2" @click="closeLicenseKeyModal">Close</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal for adding license key -->
  <div v-if="showAddLicenseKeyModal" class="fixed inset-0 z-10 overflow-y-auto">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <div class="relative transform overflow-hidden rounded-lg bg-white dark:bg-blue-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
        <div>
          <div class="mt-3 text-center sm:mt-5">
            <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">Add New License Key</h3>
            <div class="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div class="sm:col-span-3">
                <label for="new-license-template" class="block text-sm font-medium text-gray-700 dark:text-gray-300">License Template</label>
                <div class="mt-1">
                  <select id="new-license-template" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white">
                    <option v-for="template in licenseKeyTemplates.filter(t => t.active)" :key="template.id" :value="template.id">
                      {{ template.name }}
                    </option>
                  </select>
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="new-license-key" class="block text-sm font-medium text-gray-700 dark:text-gray-300">License Key</label>
                <div class="mt-1">
                  <input type="text" id="new-license-key" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white" placeholder="Leave blank to generate automatically" />
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="new-customer-id" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Customer ID</label>
                <div class="mt-1">
                  <input type="text" id="new-customer-id" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white" placeholder="Optional" />
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="new-customer-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Customer Name</label>
                <div class="mt-1">
                  <input type="text" id="new-customer-name" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white" placeholder="Optional" />
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="new-customer-email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Customer Email</label>
                <div class="mt-1">
                  <input type="email" id="new-customer-email" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white" placeholder="Optional" />
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="new-product-id" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Product ID</label>
                <div class="mt-1">
                  <input type="text" id="new-product-id" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white" placeholder="Required" />
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="new-product-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Product Name</label>
                <div class="mt-1">
                  <input type="text" id="new-product-name" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white" placeholder="Required" />
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="new-order-id" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Order ID</label>
                <div class="mt-1">
                  <input type="text" id="new-order-id" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white" placeholder="Optional" />
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="new-expiry-date" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Expiry Date</label>
                <div class="mt-1">
                  <input type="date" id="new-expiry-date" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
              </div>

              <div class="sm:col-span-3">
                <label for="new-status" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <div class="mt-1">
                  <select id="new-status" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Unassigned">Unassigned</option>
                    <option value="Revoked">Revoked</option>
                  </select>
                </div>
              </div>

              <div class="sm:col-span-6">
                <label for="new-notes" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
                <div class="mt-1">
                  <textarea id="new-notes" rows="3" class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white" placeholder="Optional notes about this license key"></textarea>
                </div>
              </div>

              <div class="sm:col-span-6">
                <div class="mt-1 flex items-center">
                  <input id="auto-generate" type="checkbox" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-blue-gray-700" checked />
                  <label for="auto-generate" class="ml-2 block text-sm text-gray-700 dark:text-gray-300">Auto-generate license key based on template</label>
                </div>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Uncheck if you want to manually enter a specific license key</p>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
          <button type="button" class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2" @click="toggleAddLicenseKeyModal">Generate License Key</button>
          <button type="button" class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 dark:bg-blue-gray-700 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-blue-gray-600" @click="toggleAddLicenseKeyModal">Cancel</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal for viewing route on map -->
  <div v-if="showRouteMapModal" class="fixed inset-0 z-10 overflow-y-auto">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <div class="relative transform overflow-hidden rounded-lg bg-white dark:bg-blue-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:p-6">
        <div>
          <div class="mt-3 text-center sm:mt-5">
            <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">{{ selectedRoute?.name }} - Route Map</h3>
            <div class="mt-6">
              <div class="aspect-w-16 aspect-h-9 w-full">
                <iframe
                  :src="getGoogleMapsEmbedUrl"
                  class="w-full h-96 border-0"
                  allowfullscreen="true"
                  loading="lazy"
                  referrerpolicy="no-referrer-when-downgrade"
                ></iframe>
              </div>
              <div class="mt-4 grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-6">
                <div>
                  <h4 class="text-sm font-medium text-gray-900 dark:text-white">Route Details</h4>
                  <dl class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    <div class="mt-1 flex justify-between">
                      <dt>Driver:</dt>
                      <dd class="text-gray-900 dark:text-white">{{ selectedRoute?.driver }}</dd>
                    </div>
                    <div class="mt-1 flex justify-between">
                      <dt>Vehicle:</dt>
                      <dd class="text-gray-900 dark:text-white">{{ selectedRoute?.vehicle }}</dd>
                    </div>
                    <div class="mt-1 flex justify-between">
                      <dt>Start Location:</dt>
                      <dd class="text-gray-900 dark:text-white">{{ selectedRoute?.startLocation }}</dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <h4 class="text-sm font-medium text-gray-900 dark:text-white">Delivery Metrics</h4>
                  <dl class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    <div class="mt-1 flex justify-between">
                      <dt>Total Stops:</dt>
                      <dd class="text-gray-900 dark:text-white">{{ selectedRoute?.stops }}</dd>
                    </div>
                    <div class="mt-1 flex justify-between">
                      <dt>Average Delivery Time:</dt>
                      <dd class="text-gray-900 dark:text-white">{{ selectedRoute?.avgDeliveryTime }} hours</dd>
                    </div>
                    <div class="mt-1 flex justify-between">
                      <dt>Total Distance:</dt>
                      <dd class="text-gray-900 dark:text-white">{{ selectedRoute?.totalDistance }} km</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="mt-6 sm:mt-8 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
          <button type="button" class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2" @click="closeRouteMapModal">Close</button>
        </div>
      </div>
    </div>
  </div>
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
