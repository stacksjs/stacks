<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useHead } from '@vueuse/head'
import { useLocalStorage } from '@vueuse/core'
import Chart from 'chart.js/auto'

useHead({
  title: 'Dashboard - Marketing Waitlist',
})

// Define waitlist entry type
interface WaitlistEntry {
  id: number
  name: string
  email: string
  phone: string | null
  product: string
  source: string
  status: string
  dateAdded: string
  notes: string | null
  notified: boolean
  priority: number
}

// Define product type for dropdown
interface Product {
  id: number
  name: string
  slug: string
  count: number
}

// Available statuses
const statuses = ['all', 'Pending', 'Notified', 'Converted', 'Expired']

// Available sources
const sources = ['all', 'Website', 'Mobile App', 'In-Store', 'Social Media', 'Email Campaign', 'Referral']

// Sample waitlist data
const waitlistEntries = ref<WaitlistEntry[]>([
  {
    id: 1,
    name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '+1 (555) 123-4567',
    product: 'Truffle Mushroom Pasta',
    source: 'Website',
    status: 'Pending',
    dateAdded: '2024-01-10',
    notes: 'Interested in being notified as soon as the product is available',
    notified: false,
    priority: 2
  },
  {
    id: 2,
    name: 'Emily Johnson',
    email: 'emily.j@example.com',
    phone: '+1 (555) 987-6543',
    product: 'Matcha Green Tea Latte',
    source: 'Mobile App',
    status: 'Pending',
    dateAdded: '2024-01-12',
    notes: null,
    notified: false,
    priority: 1
  },
  {
    id: 3,
    name: 'Michael Brown',
    email: 'michael.b@example.com',
    phone: null,
    product: 'Truffle Mushroom Pasta',
    source: 'In-Store',
    status: 'Notified',
    dateAdded: '2024-01-15',
    notes: 'VIP customer, notify immediately when available',
    notified: true,
    priority: 3
  },
  {
    id: 4,
    name: 'Sarah Wilson',
    email: 'sarah.w@example.com',
    phone: '+1 (555) 456-7890',
    product: 'Avocado Toast',
    source: 'Website',
    status: 'Pending',
    dateAdded: '2024-01-18',
    notes: 'Wants to be notified when back in stock',
    notified: false,
    priority: 2
  },
  {
    id: 5,
    name: 'David Lee',
    email: 'david.l@example.com',
    phone: '+1 (555) 234-5678',
    product: 'Truffle Mushroom Pasta',
    source: 'Social Media',
    status: 'Notified',
    dateAdded: '2024-01-20',
    notes: 'Requested notification via SMS',
    notified: true,
    priority: 2
  },
  {
    id: 6,
    name: 'Jennifer Martinez',
    email: 'jennifer.m@example.com',
    phone: null,
    product: 'Matcha Green Tea Latte',
    source: 'Email Campaign',
    status: 'Pending',
    dateAdded: '2024-01-22',
    notes: null,
    notified: false,
    priority: 1
  },
  {
    id: 7,
    name: 'Robert Taylor',
    email: 'robert.t@example.com',
    phone: '+1 (555) 876-5432',
    product: 'Truffle Mushroom Pasta',
    source: 'Website',
    status: 'Pending',
    dateAdded: '2024-01-25',
    notes: 'Wants to purchase multiple units when available',
    notified: false,
    priority: 3
  },
  {
    id: 8,
    name: 'Lisa Anderson',
    email: 'lisa.a@example.com',
    phone: '+1 (555) 345-6789',
    product: 'Matcha Green Tea Latte',
    source: 'Mobile App',
    status: 'Notified',
    dateAdded: '2024-01-28',
    notes: null,
    notified: true,
    priority: 2
  }
])

// Products derived from waitlist entries
const products = computed<Product[]>(() => {
  const productMap = new Map<string, number>()

  waitlistEntries.value.forEach(entry => {
    const count = productMap.get(entry.product) || 0
    productMap.set(entry.product, count + 1)
  })

  return Array.from(productMap.entries()).map(([name, count], index) => ({
    id: index + 1,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    count
  }))
})

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('dateAdded')
const sortOrder = ref('desc')
const productFilter = ref('all')
const statusFilter = ref('all')
const sourceFilter = ref('all')
const viewMode = useLocalStorage('waitlist-view-mode', 'list') // Default to list view and save in localStorage

// Filtered and sorted entries
const filteredEntries = computed(() => {
  return waitlistEntries.value
    .filter(entry => {
      // Apply search filter
      const matchesSearch =
        entry.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        entry.email.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        (entry.notes && entry.notes.toLowerCase().includes(searchQuery.value.toLowerCase()))

      // Apply product filter
      const matchesProduct = productFilter.value === 'all' || entry.product === productFilter.value

      // Apply status filter
      const matchesStatus = statusFilter.value === 'all' || entry.status === statusFilter.value

      // Apply source filter
      const matchesSource = sourceFilter.value === 'all' || entry.source === sourceFilter.value

      return matchesSearch && matchesProduct && matchesStatus && matchesSource
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'dateAdded') {
        comparison = new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime()
      } else if (sortBy.value === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy.value === 'priority') {
        comparison = b.priority - a.priority
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
})

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(10)
const totalPages = computed(() => Math.ceil(filteredEntries.value.length / itemsPerPage.value))

const paginatedEntries = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredEntries.value.slice(start, end)
})

function changePage(page: number): void {
  currentPage.value = page
}

function previousPage(): void {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

function nextPage(): void {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

// Toggle sort order
function toggleSort(column: string): void {
  if (sortBy.value === column) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = column
    sortOrder.value = 'desc'
  }
}

// Get status badge class
function getStatusClass(status: string): string {
  switch (status) {
    case 'Pending':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400'
    case 'Notified':
      return 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400'
    case 'Converted':
      return 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20 dark:bg-purple-900/30 dark:text-purple-400'
    case 'Expired':
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
    default:
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

// Get priority class
function getPriorityClass(priority: number): string {
  switch (priority) {
    case 3:
      return 'text-red-600 dark:text-red-400 font-semibold'
    case 2:
      return 'text-yellow-600 dark:text-yellow-400'
    case 1:
      return 'text-blue-600 dark:text-blue-400'
    default:
      return 'text-gray-600 dark:text-gray-400'
  }
}

// Modal state for adding/editing waitlist entry
const showEntryModal = ref(false)
const isEditMode = ref(false)
const currentEntry = ref<WaitlistEntry | null>(null)

// Calculate statistics
const totalEntries = computed(() => waitlistEntries.value.length)
const pendingEntries = computed(() => waitlistEntries.value.filter(e => e.status === 'Pending').length)
const notifiedEntries = computed(() => waitlistEntries.value.filter(e => e.status === 'Notified').length)
const convertedEntries = computed(() => waitlistEntries.value.filter(e => e.status === 'Converted').length)

// Form state for entry fields
const entryName = ref('')
const entryEmail = ref('')
const entryPhone = ref<string | null>('')
const entryProduct = ref('')
const entrySource = ref('Website')
const entryStatus = ref('Pending')
const entryNotes = ref<string | null>('')
const entryPriority = ref(1)

// Initialize form fields when opening modal
function openAddEntryModal(): void {
  isEditMode.value = false

  // Reset form fields
  entryName.value = ''
  entryEmail.value = ''
  entryPhone.value = ''
  entryProduct.value = ''
  entrySource.value = 'Website'
  entryStatus.value = 'Pending'
  entryNotes.value = ''
  entryPriority.value = 1

  showEntryModal.value = true
}

function openEditEntryModal(entry: WaitlistEntry): void {
  isEditMode.value = true
  currentEntry.value = { ...entry }

  // Set form fields from entry
  entryName.value = entry.name
  entryEmail.value = entry.email
  entryPhone.value = entry.phone
  entryProduct.value = entry.product
  entrySource.value = entry.source
  entryStatus.value = entry.status
  entryNotes.value = entry.notes
  entryPriority.value = entry.priority

  showEntryModal.value = true
}

function saveEntry(): void {
  // Create entry object from form fields
  const entry: WaitlistEntry = {
    id: isEditMode.value && currentEntry.value ? currentEntry.value.id : Math.max(0, ...waitlistEntries.value.map(e => e.id)) + 1,
    name: entryName.value,
    email: entryEmail.value,
    phone: entryPhone.value,
    product: entryProduct.value,
    source: entrySource.value,
    status: entryStatus.value,
    dateAdded: isEditMode.value && currentEntry.value ? currentEntry.value.dateAdded : new Date().toISOString().split('T')[0] || '',
    notes: entryNotes.value,
    notified: isEditMode.value && currentEntry.value ? currentEntry.value.notified : false,
    priority: entryPriority.value
  }

  if (isEditMode.value && currentEntry.value) {
    // Update existing entry
    const index = waitlistEntries.value.findIndex(e => e.id === currentEntry.value!.id)
    if (index !== -1) {
      waitlistEntries.value[index] = entry
    }
  } else {
    // Add new entry
    waitlistEntries.value.push(entry)
  }

  showEntryModal.value = false
}

// Function to delete an entry
function deleteEntry(entryId: number): void {
  if (confirm('Are you sure you want to delete this waitlist entry?')) {
    const index = waitlistEntries.value.findIndex(e => e.id === entryId)
    if (index !== -1) {
      waitlistEntries.value.splice(index, 1)
    }
  }
}

// Function to mark an entry as notified
function markAsNotified(id: number): void {
  const entry = waitlistEntries.value.find(e => e.id === id)
  if (entry) {
    entry.notified = true
    // In a real app, this would trigger an email or notification to the customer
  }
}

// Function to mark an entry as converted
function markAsConverted(entryId: number): void {
  const entry = waitlistEntries.value.find(e => e.id === entryId)
  if (entry) {
    entry.status = 'Converted'
  }
}

// Notification system
const showNotificationModal = ref(false)
const notificationSubject = ref('')
const notificationMessage = ref('')
const selectedEntries = ref<number[]>([])
const selectAll = ref(false)

// Toggle select all entries
function toggleSelectAll(): void {
  selectAll.value = !selectAll.value
  if (selectAll.value) {
    selectedEntries.value = paginatedEntries.value.map(entry => entry.id)
  } else {
    selectedEntries.value = []
  }
}

// Toggle selection of a single entry
function toggleEntrySelection(entryId: number): void {
  const index = selectedEntries.value.indexOf(entryId)
  if (index === -1) {
    selectedEntries.value.push(entryId)
  } else {
    selectedEntries.value.splice(index, 1)
  }

  // Update selectAll based on whether all entries are selected
  selectAll.value = paginatedEntries.value.length > 0 &&
    paginatedEntries.value.every(entry => selectedEntries.value.includes(entry.id))
}

// Open notification modal
function openNotificationModal(): void {
  if (selectedEntries.value.length === 0) {
    alert('Please select at least one waitlist entry to notify')
    return
  }

  notificationSubject.value = 'Product Now Available'
  notificationMessage.value = 'Good news! The product you were waiting for is now available for purchase.'
  showNotificationModal.value = true
}

// Send notifications to selected entries
function sendNotifications(): void {
  // In a real app, this would send actual emails or notifications
  waitlistEntries.value.forEach(entry => {
    if (selectedEntries.value.includes(entry.id)) {
      entry.notified = true
      entry.status = 'Notified'
    }
  })

  // Reset selection and close modal
  selectedEntries.value = []
  selectAll.value = false
  showNotificationModal.value = false

  // Show success message (in a real app, this would be a toast notification)
  alert(`Notifications sent to ${selectedEntries.value.length} customers`)
}

// Export waitlist data
function exportWaitlist(): void {
  // In a real app, this would generate a CSV or Excel file
  alert('Waitlist data exported successfully')
}

// Bulk actions
function bulkChangeStatus(status: string): void {
  if (selectedEntries.value.length === 0) {
    alert('Please select at least one waitlist entry')
    return
  }

  waitlistEntries.value.forEach(entry => {
    if (selectedEntries.value.includes(entry.id)) {
      entry.status = status
      if (status === 'Notified') {
        entry.notified = true
      }
    }
  })

  // Reset selection
  selectedEntries.value = []
  selectAll.value = false
}

// Bulk delete
function bulkDelete(): void {
  if (selectedEntries.value.length === 0) {
    alert('Please select at least one waitlist entry')
    return
  }

  if (confirm(`Are you sure you want to delete ${selectedEntries.value.length} waitlist entries?`)) {
    waitlistEntries.value = waitlistEntries.value.filter(entry => !selectedEntries.value.includes(entry.id))

    // Reset selection
    selectedEntries.value = []
    selectAll.value = false
  }
}

// Chart references
const productChartRef = ref<HTMLCanvasElement | null>(null)
const sourceChartRef = ref<HTMLCanvasElement | null>(null)
const statusChartRef = ref<HTMLCanvasElement | null>(null)
const trendChartRef = ref<HTMLCanvasElement | null>(null)

// Chart instances
let productChart: Chart | null = null
let sourceChart: Chart | null = null
let statusChart: Chart | null = null
let trendChart: Chart | null = null

// Generate random trend data for the past 30 days
const generateTrendData = () => {
  const data = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    data.push({
      date: date.toISOString().split('T')[0],
      count: Math.floor(Math.random() * 5) // Random number of entries per day (0-4)
    })
  }
  return data
}

const trendData = ref(generateTrendData())

// Chart colors
const chartColors = {
  blue: 'rgba(59, 130, 246, 0.8)',
  green: 'rgba(16, 185, 129, 0.8)',
  purple: 'rgba(139, 92, 246, 0.8)',
  gray: 'rgba(156, 163, 175, 0.8)',
  yellow: 'rgba(245, 158, 11, 0.8)',
  red: 'rgba(239, 68, 68, 0.8)',
  borderBlue: 'rgba(59, 130, 246, 1)',
  borderGreen: 'rgba(16, 185, 129, 1)',
  borderPurple: 'rgba(139, 92, 246, 1)',
  borderGray: 'rgba(156, 163, 175, 1)',
  borderYellow: 'rgba(245, 158, 11, 1)',
  borderRed: 'rgba(239, 68, 68, 1)'
}

// Initialize charts
onMounted(() => {
  initProductChart()
  initSourceChart()
  initStatusChart()
  initTrendChart()
})

// Initialize product interest chart
function initProductChart() {
  if (!productChartRef.value) return

  const ctx = productChartRef.value.getContext('2d')
  if (!ctx) return

  const productData = products.value.map(p => p.count)
  const productLabels = products.value.map(p => p.name)
  const productColors = [
    chartColors.blue,
    chartColors.green,
    chartColors.purple,
    chartColors.yellow,
    chartColors.red,
    chartColors.gray
  ]

  productChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: productLabels,
      datasets: [{
        label: 'Number of Waitlist Entries',
        data: productData,
        backgroundColor: productColors,
        borderColor: productColors.map(color => color.replace('0.8', '1')),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: true,
          text: 'Product Interest'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  })
}

// Initialize source breakdown chart
function initSourceChart() {
  if (!sourceChartRef.value) return

  const ctx = sourceChartRef.value.getContext('2d')
  if (!ctx) return

  const sourceLabels = sources.slice(1)
  const sourceData = sourceLabels.map((source: string) =>
    waitlistEntries.value.filter(entry => entry.source === source).length
  )
  const sourceColors = [
    chartColors.blue,
    chartColors.green,
    chartColors.purple,
    chartColors.yellow,
    chartColors.red,
    chartColors.gray
  ]

  sourceChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sourceLabels,
      datasets: [{
        data: sourceData,
        backgroundColor: sourceColors,
        borderColor: sourceColors.map(color => color.replace('0.8', '1')),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right'
        },
        title: {
          display: true,
          text: 'Source Breakdown'
        }
      }
    }
  })
}

// Initialize status breakdown chart
function initStatusChart() {
  if (!statusChartRef.value) return

  const ctx = statusChartRef.value.getContext('2d')
  if (!ctx) return

  const statusLabels = statuses.slice(1)
  const statusData = statusLabels.map((status: string) =>
    waitlistEntries.value.filter(entry => entry.status === status).length
  )
  const statusColors = [
    chartColors.blue,
    chartColors.green,
    chartColors.purple,
    chartColors.gray
  ]

  statusChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: statusLabels,
      datasets: [{
        data: statusData,
        backgroundColor: statusColors,
        borderColor: statusColors.map(color => color.replace('0.8', '1')),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right'
        },
        title: {
          display: true,
          text: 'Status Breakdown'
        }
      }
    }
  })
}

// Initialize trend chart
function initTrendChart() {
  if (!trendChartRef.value) return

  const ctx = trendChartRef.value.getContext('2d')
  if (!ctx) return

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trendData.value.map(d => d.date),
      datasets: [{
        label: 'New Waitlist Entries',
        data: trendData.value.map(d => d.count),
        backgroundColor: chartColors.blue,
        borderColor: chartColors.borderBlue,
        borderWidth: 2,
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: true,
          text: '30-Day Trend'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  })
}

// Update charts when data changes
function updateCharts(): void {
  if (productChart && productChart.data) {
    const chart = productChart as Chart<'bar'>
    chart.data.labels = products.value.map(p => p.name)
    if (chart.data.datasets && chart.data.datasets.length > 0) {
      chart.data.datasets[0].data = products.value.map(p => p.count)
    }
    chart.update()
  }

  if (sourceChart && sourceChart.data) {
    const chart = sourceChart as Chart<'doughnut'>
    const sourceLabels = sources.slice(1)
    chart.data.labels = sourceLabels
    if (chart.data.datasets && chart.data.datasets.length > 0) {
      chart.data.datasets[0].data = sourceLabels.map((source: string) =>
        waitlistEntries.value.filter(entry => entry.source === source).length
      )
    }
    chart.update()
  }

  if (statusChart && statusChart.data) {
    const chart = statusChart as Chart<'pie'>
    const statusLabels = statuses.slice(1)
    chart.data.labels = statusLabels
    if (chart.data.datasets && chart.data.datasets.length > 0) {
      chart.data.datasets[0].data = statusLabels.map((status: string) =>
        waitlistEntries.value.filter(entry => entry.status === status).length
      )
    }
    chart.update()
  }
}

// Watch for changes in waitlist entries to update charts
watch(waitlistEntries, () => {
  updateCharts()
}, { deep: true })
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <!-- Header section -->
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Waitlist</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Manage your product waitlist and notify customers when products become available
            </p>
          </div>
          <div class="mt-4 flex space-x-3 sm:mt-0">
            <button
              type="button"
              @click="openAddEntryModal"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-1"></div>
              Add to waitlist
            </button>
            <button
              type="button"
              @click="exportWaitlist"
              class="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-700"
            >
              <div class="i-hugeicons-download-01 h-5 w-5 mr-1"></div>
              Export
            </button>
          </div>
        </div>

        <!-- Analytics section with Chart.js -->
        <div class="mt-8 bg-white p-6 shadow rounded-lg dark:bg-blue-gray-800">
          <h2 class="text-lg font-medium text-gray-900 dark:text-white">Waitlist Analytics</h2>

          <div class="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <!-- Product interest chart -->
            <div class="bg-gray-50 rounded-lg p-4 dark:bg-blue-gray-700">
              <div class="h-64">
                <canvas ref="productChartRef"></canvas>
              </div>
            </div>

            <!-- Source breakdown chart -->
            <div class="bg-gray-50 rounded-lg p-4 dark:bg-blue-gray-700">
              <div class="h-64">
                <canvas ref="sourceChartRef"></canvas>
              </div>
            </div>

            <!-- Status breakdown chart -->
            <div class="bg-gray-50 rounded-lg p-4 dark:bg-blue-gray-700">
              <div class="h-64">
                <canvas ref="statusChartRef"></canvas>
              </div>
            </div>

            <!-- 30-day trend chart -->
            <div class="bg-gray-50 rounded-lg p-4 dark:bg-blue-gray-700">
              <div class="h-64">
                <canvas ref="trendChartRef"></canvas>
              </div>
            </div>
          </div>

          <!-- Conversion rate -->
          <div class="mt-6">
            <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">Conversion Rate</h3>
            <div class="mt-2 flex items-center">
              <div class="flex-1 bg-gray-200 rounded-full h-4 dark:bg-gray-700">
                <div
                  class="bg-green-600 h-4 rounded-full dark:bg-green-500"
                  :style="{ width: `${(convertedEntries / (totalEntries || 1)) * 100}%` }"
                ></div>
              </div>
              <span class="ml-3 text-sm font-medium text-gray-900 dark:text-white">
                {{ Math.round((convertedEntries / (totalEntries || 1)) * 100) }}%
              </span>
            </div>
          </div>
        </div>

        <!-- Summary cards -->
        <div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <!-- Total entries card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-blue-100 p-2 dark:bg-blue-900">
                    <div class="i-hugeicons-user-account h-6 w-6 text-blue-600 dark:text-blue-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Entries</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ totalEntries }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Pending entries card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-blue-100 p-2 dark:bg-blue-900">
                    <div class="i-hugeicons-hourglass h-6 w-6 text-blue-600 dark:text-blue-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Pending</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ pendingEntries }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Notified entries card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-green-100 p-2 dark:bg-green-900">
                    <div class="i-hugeicons-notification-square h-6 w-6 text-green-600 dark:text-green-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Notified</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ notifiedEntries }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Converted entries card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-purple-100 p-2 dark:bg-purple-900">
                    <div class="i-hugeicons-shopping-cart-01 h-6 w-6 text-purple-600 dark:text-purple-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Converted</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ convertedEntries }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Filters and view options -->
        <div class="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="relative max-w-sm">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <div class="i-hugeicons-search-01 h-5 w-5 text-gray-400"></div>
            </div>
            <input
              v-model="searchQuery"
              type="text"
              class="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:placeholder:text-gray-500"
              placeholder="Search waitlist..."
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-4">
            <!-- Product filter -->
            <select
              v-model="productFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Products</option>
              <option v-for="product in products" :key="product.id" :value="product.name">
                {{ product.name }} ({{ product.count }})
              </option>
            </select>

            <!-- Status filter -->
            <select
              v-model="statusFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Statuses</option>
              <option v-for="status in statuses.slice(1)" :key="status" :value="status">
                {{ status }}
              </option>
            </select>

            <!-- Source filter -->
            <select
              v-model="sourceFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Sources</option>
              <option v-for="source in sources.slice(1)" :key="source" :value="source">
                {{ source }}
              </option>
            </select>
          </div>
        </div>

        <!-- Sort options -->
        <div class="mt-4 flex items-center text-sm text-gray-500 dark:text-gray-400">
          <span class="mr-2">Sort by:</span>
          <button
            @click="toggleSort('name')"
            class="mr-3 flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'name' }"
          >
            Name
            <span v-if="sortBy === 'name'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-01 h-4 w-4"></div>
            </span>
          </button>
          <button
            @click="toggleSort('dateAdded')"
            class="mr-3 flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'dateAdded' }"
          >
            Date Added
            <span v-if="sortBy === 'dateAdded'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-01 h-4 w-4"></div>
            </span>
          </button>
          <button
            @click="toggleSort('priority')"
            class="flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'priority' }"
          >
            Priority
            <span v-if="sortBy === 'priority'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-01 h-4 w-4"></div>
            </span>
          </button>
        </div>

        <!-- Bulk actions toolbar -->
        <div v-if="selectedEntries.length > 0" class="mt-4 bg-blue-50 p-4 rounded-md dark:bg-blue-900/30">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <span class="text-sm font-medium text-blue-700 dark:text-blue-300">{{ selectedEntries.length }} entries selected</span>
            </div>
            <div class="flex space-x-3">
              <button
                @click="openNotificationModal"
                class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
              >
                <div class="i-hugeicons-notification-square h-4 w-4 mr-1"></div>
                Notify Selected
              </button>
              <button
                @click="bulkChangeStatus('Converted')"
                class="inline-flex items-center rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-500"
              >
                <div class="i-hugeicons-check-circle h-4 w-4 mr-1"></div>
                Mark as Converted
              </button>
              <button
                @click="bulkDelete"
                class="inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
              >
                <div class="i-hugeicons-waste h-4 w-4 mr-1"></div>
                Delete Selected
              </button>
            </div>
          </div>
        </div>

        <!-- Waitlist table with selection checkboxes -->
        <div class="mt-6 overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-blue-gray-900">
              <tr>
                <th scope="col" class="relative py-3.5 pl-4 pr-3 sm:pl-6">
                  <input
                    type="checkbox"
                    :checked="selectAll"
                    @change="toggleSelectAll"
                    class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600"
                  />
                </th>
                <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">
                  Name
                </th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Product
                </th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Status
                </th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Date Added
                </th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Source
                </th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Priority
                </th>
                <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-blue-gray-800">
              <tr v-if="paginatedEntries.length === 0" class="text-center">
                <td colspan="8" class="py-10 text-gray-500 dark:text-gray-400">
                  No waitlist entries found. Add your first entry to get started.
                </td>
              </tr>
              <tr v-for="entry in paginatedEntries" :key="entry.id" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700">
                <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                  <input
                    type="checkbox"
                    :checked="selectedEntries.includes(entry.id)"
                    @change="toggleEntrySelection(entry.id)"
                    class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600"
                  />
                </td>
                <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                  <div class="flex items-center">
                    <div>
                      <div class="font-medium text-gray-900 dark:text-white">{{ entry.name }}</div>
                      <div class="text-gray-500 dark:text-gray-400">{{ entry.email }}</div>
                    </div>
                  </div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {{ entry.product }}
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm">
                  <span :class="getStatusClass(entry.status)" class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
                    {{ entry.status }}
                  </span>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {{ entry.dateAdded }}
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {{ entry.source }}
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm">
                  <span :class="getPriorityClass(entry.priority)" class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
                    {{ entry.priority === 3 ? 'High' : entry.priority === 2 ? 'Medium' : 'Low' }}
                  </span>
                </td>
                <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <div class="flex justify-end space-x-2">
                    <button
                      @click="openEditEntryModal(entry)"
                      class="text-gray-400 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    >
                      <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                      <span class="sr-only">Edit</span>
                    </button>
                    <button
                      v-if="!entry.notified && entry.status !== 'Converted'"
                      @click="markAsNotified(entry.id)"
                      class="text-gray-400 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                    >
                      <div class="i-hugeicons-notification-square h-5 w-5"></div>
                      <span class="sr-only">Notify</span>
                    </button>
                    <button
                      @click="deleteEntry(entry.id)"
                      class="text-gray-400 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                    >
                      <div class="i-hugeicons-waste h-5 w-5"></div>
                      <span class="sr-only">Delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="mt-5 flex items-center justify-between">
          <div class="flex flex-1 justify-between sm:hidden">
            <button
              @click="changePage(currentPage - 1)"
              :disabled="currentPage === 1"
              :class="[
                currentPage === 1 ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50 dark:hover:bg-blue-gray-700',
                'relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-white'
              ]"
            >
              Previous
            </button>
            <button
              @click="changePage(currentPage + 1)"
              :disabled="currentPage === totalPages"
              :class="[
                currentPage === totalPages ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50 dark:hover:bg-blue-gray-700',
                'relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-white'
              ]"
            >
              Next
            </button>
          </div>
          <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p class="text-sm text-gray-700 dark:text-gray-300">
                Showing <span class="font-medium">{{ (currentPage - 1) * itemsPerPage + 1 }}</span> to
                <span class="font-medium">{{ Math.min(currentPage * itemsPerPage, filteredEntries.length) }}</span> of
                <span class="font-medium">{{ filteredEntries.length }}</span> results
              </p>
            </div>
            <div>
              <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  @click="changePage(currentPage - 1)"
                  :disabled="currentPage === 1"
                  :class="[
                    currentPage === 1 ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50 dark:hover:bg-blue-gray-700',
                    'relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-600'
                  ]"
                >
                  <span class="sr-only">Previous</span>
                  <div class="i-hugeicons-chevron-left h-5 w-5"></div>
                </button>
                <button
                  v-for="page in totalPages"
                  :key="page"
                  @click="changePage(page)"
                  :class="[
                    page === currentPage
                      ? 'relative z-10 inline-flex items-center bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                      : 'relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-700',
                    'focus:z-20'
                  ]"
                >
                  {{ page }}
                </button>
                <button
                  @click="changePage(currentPage + 1)"
                  :disabled="currentPage === totalPages"
                  :class="[
                    currentPage === totalPages ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50 dark:hover:bg-blue-gray-700',
                    'relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-600'
                  ]"
                >
                  <span class="sr-only">Next</span>
                  <div class="i-hugeicons-chevron-right h-5 w-5"></div>
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Entry modal -->
    <div v-if="showEntryModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-lg font-semibold leading-6 text-gray-900 dark:text-white">
                {{ isEditMode ? 'Edit Waitlist Entry' : 'Add to Waitlist' }}
              </h3>
              <div class="mt-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ isEditMode ? 'Update the details for this waitlist entry.' : 'Fill in the details to add a new customer to the waitlist.' }}
                </p>
              </div>
            </div>
          </div>

          <div class="mt-5 sm:mt-6">
            <form @submit.prevent="saveEntry">
              <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <!-- Name field -->
                <div class="sm:col-span-3">
                  <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Name
                  </label>
                  <div class="mt-1">
                    <input
                      id="name"
                      v-model="entryName"
                      type="text"
                      required
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <!-- Email field -->
                <div class="sm:col-span-3">
                  <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email
                  </label>
                  <div class="mt-1">
                    <input
                      id="email"
                      v-model="entryEmail"
                      type="email"
                      required
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <!-- Phone field -->
                <div class="sm:col-span-3">
                  <label for="phone" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Phone (optional)
                  </label>
                  <div class="mt-1">
                    <input
                      id="phone"
                      v-model="entryPhone"
                      type="tel"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <!-- Product field -->
                <div class="sm:col-span-3">
                  <label for="product" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Product
                  </label>
                  <div class="mt-1">
                    <input
                      id="product"
                      v-model="entryProduct"
                      type="text"
                      required
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <!-- Source field -->
                <div class="sm:col-span-3">
                  <label for="source" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Source
                  </label>
                  <div class="mt-1">
                    <select
                      id="source"
                      v-model="entrySource"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white"
                    >
                      <option v-for="source in sources" :key="source" :value="source">
                        {{ source }}
                      </option>
                    </select>
                  </div>
                </div>

                <!-- Status field -->
                <div class="sm:col-span-3">
                  <label for="status" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </label>
                  <div class="mt-1">
                    <select
                      id="status"
                      v-model="entryStatus"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white"
                    >
                      <option v-for="status in statuses" :key="status" :value="status">
                        {{ status }}
                      </option>
                    </select>
                  </div>
                </div>

                <!-- Priority field -->
                <div class="sm:col-span-3">
                  <label for="priority" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Priority
                  </label>
                  <div class="mt-1">
                    <select
                      id="priority"
                      v-model="entryPriority"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white"
                    >
                      <option :value="1">Low</option>
                      <option :value="2">Medium</option>
                      <option :value="3">High</option>
                    </select>
                  </div>
                </div>

                <!-- Notes field -->
                <div class="sm:col-span-6">
                  <label for="notes" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Notes (optional)
                  </label>
                  <div class="mt-1">
                    <textarea
                      id="notes"
                      v-model="entryNotes"
                      rows="3"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white"
                    ></textarea>
                  </div>
                </div>
              </div>

              <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                <button
                  type="submit"
                  class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
                >
                  {{ isEditMode ? 'Save Changes' : 'Add to Waitlist' }}
                </button>
                <button
                  type="button"
                  @click="showEntryModal = false"
                  class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- Notification modal -->
    <div v-if="showNotificationModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-lg font-semibold leading-6 text-gray-900 dark:text-white">
                Send Notification
              </h3>
              <div class="mt-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Subject:
                </p>
                <input
                  v-model="notificationSubject"
                  type="text"
                  class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white"
                />
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Message:
                </p>
                <textarea
                  v-model="notificationMessage"
                  rows="3"
                  class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white"
                ></textarea>
              </div>
            </div>
          </div>

          <div class="mt-5 sm:mt-6">
            <button
              @click="sendNotifications"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Send Notification
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
