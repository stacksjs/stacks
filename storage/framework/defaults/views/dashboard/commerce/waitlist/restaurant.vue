<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useHead } from '@vueuse/head'
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
  partySize: number
  estimatedWaitMinutes: number
  quotedWaitMinutes: number
  queuePosition: number
  notificationPreference: 'sms' | 'email' | 'both'
  notes: string | null
  status: string
  dateAdded: string
  notified: boolean
  priority: number
  lastNotified: string | null
  tablePreference: string | null
  specialRequests: string | null
  checkInTime: string
  estimatedSeatingTime: string | null
  actualSeatingTime: string | null
}

// Define product type for dropdown
interface Product {
  id: number
  name: string
  slug: string
  count: number
}

// Available statuses
const statuses = ['all', 'Waiting', 'Seated', 'Cancelled', 'No Show']

// Available sources
const sources = ['all', 'Website', 'Mobile App', 'In-Store', 'Social Media', 'Email Campaign', 'Referral']

// Notification preferences
const notificationPreferences = ['sms', 'email', 'both']

// Table preferences
const tablePreferences = ['No Preference', 'Indoor', 'Outdoor', 'Bar', 'Booth', 'Private']

// Calculate estimated wait time based on party size and current queue
function calculateEstimatedWait(partySize: number): number {
  const baseWait = 15 // Base wait time in minutes
  const queueFactor = waitlistEntries.value.filter(e => e.status === 'Waiting').length * 5
  const partySizeFactor = Math.ceil(partySize / 2) * 5
  return baseWait + queueFactor + partySizeFactor
}

// Update queue positions
function updateQueuePositions(): void {
  const waitingEntries = waitlistEntries.value
    .filter(e => e.status === 'Waiting')
    .sort((a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime())

  waitingEntries.forEach((entry, index) => {
    entry.queuePosition = index + 1
    entry.estimatedWaitMinutes = calculateEstimatedWait(entry.partySize)
    entry.estimatedSeatingTime = new Date(
      new Date(entry.checkInTime).getTime() + entry.estimatedWaitMinutes * 60000
    ).toISOString()
  })
}

// Send SMS notification
async function sendSMSNotification(entry: WaitlistEntry, message: string): Promise<void> {
  // In a real app, this would integrate with Twilio or similar service
  console.log(`Sending SMS to ${entry.phone}: ${message}`)
}

// Send notification based on preference
async function notifyCustomer(entry: WaitlistEntry, message: string): Promise<void> {
  if (entry.notificationPreference === 'sms' || entry.notificationPreference === 'both') {
    await sendSMSNotification(entry, message)
  }
  if (entry.notificationPreference === 'email' || entry.notificationPreference === 'both') {
    // Send email notification
    console.log(`Sending email to ${entry.email}: ${message}`)
  }
  entry.lastNotified = new Date().toISOString()
  entry.notified = true
}

// Calculate wait time statistics
const waitTimeStats = computed(() => {
  const completedEntries = waitlistEntries.value.filter(e => e.status === 'Seated' && e.actualSeatingTime)
  if (completedEntries.length === 0) return null

  const waitTimes = completedEntries.map(entry => {
    const checkIn = new Date(entry.checkInTime).getTime()
    const seating = new Date(entry.actualSeatingTime!).getTime()
    return (seating - checkIn) / 60000 // Convert to minutes
  })

  return {
    averageWait: Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length),
    maxWait: Math.round(Math.max(...waitTimes)),
    minWait: Math.round(Math.min(...waitTimes))
  }
})

// Sample waitlist data
const waitlistEntries = ref<WaitlistEntry[]>([
  {
    id: 1,
    name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '+1 (555) 123-4567',
    partySize: 4,
    estimatedWaitMinutes: 25,
    quotedWaitMinutes: 30,
    queuePosition: 1,
    notificationPreference: 'sms',
    notes: 'Birthday celebration',
    status: 'Waiting',
    dateAdded: '2024-01-10',
    notified: false,
    priority: 2,
    lastNotified: null,
    tablePreference: 'Booth',
    specialRequests: 'High chair needed',
    checkInTime: new Date().toISOString(),
    estimatedSeatingTime: null,
    actualSeatingTime: null
  },
  {
    id: 2,
    name: 'Emily Johnson',
    email: 'emily.j@example.com',
    phone: '+1 (555) 987-6543',
    partySize: 2,
    estimatedWaitMinutes: 15,
    quotedWaitMinutes: 18,
    queuePosition: 2,
    notificationPreference: 'email',
    notes: null,
    status: 'Waiting',
    dateAdded: '2024-01-12',
    notified: false,
    priority: 1,
    lastNotified: null,
    tablePreference: null,
    specialRequests: null,
    checkInTime: new Date().toISOString(),
    estimatedSeatingTime: null,
    actualSeatingTime: null
  },
  {
    id: 3,
    name: 'Michael Brown',
    email: 'michael.b@example.com',
    phone: null,
    partySize: 3,
    estimatedWaitMinutes: 20,
    quotedWaitMinutes: 24,
    queuePosition: 3,
    notificationPreference: 'both',
    notes: 'VIP customer, notify immediately when available',
    status: 'Seated',
    dateAdded: '2024-01-15',
    notified: true,
    priority: 3,
    lastNotified: '2024-01-15T12:30:00',
    tablePreference: 'Indoor',
    specialRequests: null,
    checkInTime: '2024-01-15T12:00:00',
    estimatedSeatingTime: '2024-01-15T12:30:00',
    actualSeatingTime: '2024-01-15T12:30:00'
  },
  {
    id: 4,
    name: 'Sarah Wilson',
    email: 'sarah.w@example.com',
    phone: '+1 (555) 456-7890',
    partySize: 2,
    estimatedWaitMinutes: 10,
    quotedWaitMinutes: 12,
    queuePosition: 4,
    notificationPreference: 'sms',
    notes: 'Wants to be notified when back in stock',
    status: 'Waiting',
    dateAdded: '2024-01-18',
    notified: false,
    priority: 2,
    lastNotified: null,
    tablePreference: null,
    specialRequests: null,
    checkInTime: new Date().toISOString(),
    estimatedSeatingTime: null,
    actualSeatingTime: null
  },
  {
    id: 5,
    name: 'David Lee',
    email: 'david.l@example.com',
    phone: '+1 (555) 234-5678',
    partySize: 3,
    estimatedWaitMinutes: 18,
    quotedWaitMinutes: 21,
    queuePosition: 5,
    notificationPreference: 'email',
    notes: 'Requested notification via SMS',
    status: 'Seated',
    dateAdded: '2024-01-20',
    notified: true,
    priority: 2,
    lastNotified: '2024-01-20T12:30:00',
    tablePreference: 'Bar',
    specialRequests: 'No onions please',
    checkInTime: '2024-01-20T12:00:00',
    estimatedSeatingTime: '2024-01-20T12:30:00',
    actualSeatingTime: '2024-01-20T12:30:00'
  },
  {
    id: 6,
    name: 'Jennifer Martinez',
    email: 'jennifer.m@example.com',
    phone: null,
    partySize: 2,
    estimatedWaitMinutes: 12,
    quotedWaitMinutes: 14,
    queuePosition: 6,
    notificationPreference: 'both',
    notes: null,
    status: 'Waiting',
    dateAdded: '2024-01-22',
    notified: false,
    priority: 1,
    lastNotified: null,
    tablePreference: null,
    specialRequests: null,
    checkInTime: new Date().toISOString(),
    estimatedSeatingTime: null,
    actualSeatingTime: null
  },
  {
    id: 7,
    name: 'Robert Taylor',
    email: 'robert.t@example.com',
    phone: '+1 (555) 876-5432',
    partySize: 4,
    estimatedWaitMinutes: 25,
    quotedWaitMinutes: 30,
    queuePosition: 7,
    notificationPreference: 'sms',
    notes: 'Wants to purchase multiple units when available',
    status: 'Waiting',
    dateAdded: '2024-01-25',
    notified: false,
    priority: 3,
    lastNotified: null,
    tablePreference: 'Booth',
    specialRequests: null,
    checkInTime: new Date().toISOString(),
    estimatedSeatingTime: null,
    actualSeatingTime: null
  },
  {
    id: 8,
    name: 'Lisa Anderson',
    email: 'lisa.a@example.com',
    phone: '+1 (555) 345-6789',
    partySize: 2,
    estimatedWaitMinutes: 10,
    quotedWaitMinutes: 12,
    queuePosition: 8,
    notificationPreference: 'email',
    notes: null,
    status: 'Seated',
    dateAdded: '2024-01-28',
    notified: true,
    priority: 2,
    lastNotified: '2024-01-28T12:30:00',
    tablePreference: 'Indoor',
    specialRequests: null,
    checkInTime: '2024-01-28T12:00:00',
    estimatedSeatingTime: '2024-01-28T12:30:00',
    actualSeatingTime: '2024-01-28T12:30:00'
  }
])

// Products derived from waitlist entries
const products = computed<Product[]>(() => {
  const productMap = new Map<string, number>()

  waitlistEntries.value.forEach(entry => {
    const count = productMap.get(entry.name) || 0
    productMap.set(entry.name, count + 1)
  })

  return Array.from(productMap.entries()).map(([name, count], index) => ({
    id: index + 1,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    count
  }))
})

// Search and filter refs
const searchQuery = ref('')
const statusFilter = ref('all')
const partySizeFilter = ref('all')
const tablePreferenceFilter = ref('all')

// Filter functions
const filteredEntries = computed(() => {
  return waitlistEntries.value.filter(entry => {
    // Apply search filter
    const matchesSearch = searchQuery.value === '' ||
      entry.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (entry.phone && entry.phone.includes(searchQuery.value)) ||
      entry.email.toLowerCase().includes(searchQuery.value.toLowerCase())

    // Apply party size filter
    let matchesPartySize = true
    if (partySizeFilter.value !== 'all') {
      const [minStr, maxStr] = partySizeFilter.value.split('-')
      if (!minStr) return false
      const min = parseInt(minStr)
      if (maxStr) {
        const max = parseInt(maxStr)
        matchesPartySize = entry.partySize >= min && entry.partySize <= max
      } else {
        // For "7+" case
        matchesPartySize = entry.partySize >= min
      }
    }

    // Apply status filter
    const matchesStatus = statusFilter.value === 'all' || entry.status === statusFilter.value

    // Apply table preference filter
    const matchesTablePreference = tablePreferenceFilter.value === 'all' ||
      (entry.tablePreference && entry.tablePreference === tablePreferenceFilter.value)

    return matchesSearch && matchesPartySize && matchesStatus && matchesTablePreference
  })
})

// Sort refs and functions
const sortBy = ref<'name' | 'checkInTime' | 'estimatedWaitMinutes'>('checkInTime')
const sortOrder = ref<'asc' | 'desc'>('asc')

function toggleSort(field: 'name' | 'checkInTime' | 'estimatedWaitMinutes') {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortOrder.value = 'asc'
  }
}

// Sort entries
const sortedEntries = computed(() => {
  return [...filteredEntries.value].sort((a, b) => {
    if (sortBy.value === 'name') {
      return sortOrder.value === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name)
    }
    if (sortBy.value === 'checkInTime') {
      return sortOrder.value === 'asc'
        ? new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
        : new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime()
    }
    if (sortBy.value === 'estimatedWaitMinutes') {
      return sortOrder.value === 'asc'
        ? a.estimatedWaitMinutes - b.estimatedWaitMinutes
        : b.estimatedWaitMinutes - a.estimatedWaitMinutes
    }
    return 0
  })
})

// Pagination
const itemsPerPage = 10
const currentPage = ref(1)

const paginatedEntries = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return sortedEntries.value.slice(start, end)
})

const totalPages = computed(() => Math.ceil(sortedEntries.value.length / itemsPerPage))

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

// Get status badge class
function getStatusClass(status: string): string {
  switch (status) {
    case 'Waiting':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400'
    case 'Seated':
      return 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400'
    case 'Cancelled':
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
    case 'No Show':
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
const waitingEntries = computed(() => waitlistEntries.value.filter(e => e.status === 'Waiting').length)
const seatedEntries = computed(() => waitlistEntries.value.filter(e => e.status === 'Seated').length)
const cancelledEntries = computed(() => waitlistEntries.value.filter(e => e.status === 'Cancelled').length)
const noShowEntries = computed(() => waitlistEntries.value.filter(e => e.status === 'No Show').length)

// Form state for entry fields
const entryName = ref('')
const entryEmail = ref('')
const entryPhone = ref<string | null>('')
const entryPartySize = ref(2)
const entryNotificationPreference = ref<'sms' | 'email' | 'both'>('sms')
const entryTablePreference = ref<string | null>(null)
const entrySpecialRequests = ref<string | null>(null)
const entryNotes = ref<string | null>('')
const entryPriority = ref(1)

// Initialize form fields when opening modal
function openAddEntryModal(): void {
  isEditMode.value = false

  // Reset form fields
  entryName.value = ''
  entryEmail.value = ''
  entryPhone.value = ''
  entryPartySize.value = 2
  entryNotificationPreference.value = 'sms'
  entryTablePreference.value = null
  entrySpecialRequests.value = null
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
  entryPartySize.value = entry.partySize
  entryNotificationPreference.value = entry.notificationPreference
  entryTablePreference.value = entry.tablePreference
  entrySpecialRequests.value = entry.specialRequests
  entryNotes.value = entry.notes
  entryPriority.value = entry.priority

  showEntryModal.value = true
}

function saveEntry(): void {
  const now = new Date()
  const entry: WaitlistEntry = {
    id: isEditMode.value && currentEntry.value ? currentEntry.value.id : Math.max(0, ...waitlistEntries.value.map(e => e.id)) + 1,
    name: entryName.value,
    email: entryEmail.value,
    phone: entryPhone.value,
    partySize: entryPartySize.value,
    estimatedWaitMinutes: calculateEstimatedWait(entryPartySize.value),
    quotedWaitMinutes: Math.ceil(calculateEstimatedWait(entryPartySize.value) * 1.2), // Pad quote by 20%
    queuePosition: waitlistEntries.value.filter(e => e.status === 'Waiting').length + 1,
    notificationPreference: entryNotificationPreference.value,
    notes: entryNotes.value,
    status: 'Waiting',
    dateAdded: now.toISOString().split('T')[0],
    notified: false,
    priority: entryPriority.value,
    lastNotified: null,
    tablePreference: entryTablePreference.value,
    specialRequests: entrySpecialRequests.value,
    checkInTime: now.toISOString(),
    estimatedSeatingTime: null,
    actualSeatingTime: null
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

  // Update queue positions and wait times
  updateQueuePositions()

  // Send initial notification
  notifyCustomer(entry, `Thanks for joining the waitlist! Your estimated wait time is ${entry.quotedWaitMinutes} minutes. We'll notify you when your table is almost ready.`)

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

// Function to mark an entry as seated
function markAsSeated(entryId: number): void {
  const entry = waitlistEntries.value.find(e => e.id === entryId)
  if (entry) {
    entry.status = 'Seated'
    entry.actualSeatingTime = new Date().toISOString()
    updateQueuePositions()
  }
}

// Function to mark an entry as no-show
function markAsNoShow(entryId: number): void {
  const entry = waitlistEntries.value.find(e => e.id === entryId)
  if (entry) {
    entry.status = 'No Show'
    updateQueuePositions()
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
      entry.status = 'Seated'
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
      if (status === 'Seated') {
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

// Chart colors with gradients
const chartColors = {
  blue: {
    fill: 'rgba(59, 130, 246, 0.2)',
    stroke: 'rgba(59, 130, 246, 1)',
    point: 'rgba(59, 130, 246, 1)',
  },
  green: {
    fill: 'rgba(16, 185, 129, 0.2)',
    stroke: 'rgba(16, 185, 129, 1)',
    point: 'rgba(16, 185, 129, 1)',
  },
  purple: {
    fill: 'rgba(139, 92, 246, 0.2)',
    stroke: 'rgba(139, 92, 246, 1)',
    point: 'rgba(139, 92, 246, 1)',
  },
  yellow: {
    fill: 'rgba(245, 158, 11, 0.2)',
    stroke: 'rgba(245, 158, 11, 1)',
    point: 'rgba(245, 158, 11, 1)',
  },
  red: {
    fill: 'rgba(239, 68, 68, 0.2)',
    stroke: 'rgba(239, 68, 68, 1)',
    point: 'rgba(239, 68, 68, 1)',
  },
}

// Base chart options
const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'bottom' as const,
      labels: {
        usePointStyle: true,
        padding: 20,
        font: {
          size: 12
        }
      }
    },
    title: {
      display: true,
      font: {
        size: 16,
        weight: 'bold' as const
      },
      padding: {
        top: 10,
        bottom: 20
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        display: true,
        color: 'rgba(0, 0, 0, 0.05)',
      },
      ticks: {
        precision: 0
      }
    },
    x: {
      grid: {
        display: false
      }
    }
  }
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

  const partySizes = [1, 2, 3, 4, 5, 6, '7+']
  const partySizeCounts = partySizes.map(size => {
    if (size === '7+') {
      return waitlistEntries.value.filter(entry => entry.partySize >= 7).length
    }
    return waitlistEntries.value.filter(entry => entry.partySize === size).length
  })

  const gradient = ctx.createLinearGradient(0, 0, 0, 400)
  gradient.addColorStop(0, chartColors.blue.fill)
  gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)')

  productChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: partySizes.map(size => `${size} ${size === 1 ? 'person' : 'people'}`),
      datasets: [{
        label: 'Number of Parties',
        data: partySizeCounts,
        backgroundColor: gradient,
        borderColor: chartColors.blue.stroke,
        borderWidth: 2,
        borderRadius: 6,
        maxBarThickness: 40,
        barPercentage: 0.5
      }]
    },
    options: {
      ...baseChartOptions,
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: false
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

  const preferenceLabels = tablePreferences.slice(1)
  const preferenceCounts = preferenceLabels.map(preference =>
    waitlistEntries.value.filter(entry =>
      entry.tablePreference ? entry.tablePreference === preference : false
    ).length
  )

  sourceChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: preferenceLabels,
      datasets: [{
        data: preferenceCounts,
        backgroundColor: [
          chartColors.blue.fill,
          chartColors.green.fill,
          chartColors.purple.fill,
          chartColors.yellow.fill,
          chartColors.red.fill
        ],
        borderColor: [
          chartColors.blue.stroke,
          chartColors.green.stroke,
          chartColors.purple.stroke,
          chartColors.yellow.stroke,
          chartColors.red.stroke
        ],
        borderWidth: 2,
        hoverOffset: 4,
        spacing: 2
      }]
    },
    options: {
      ...baseChartOptions,
      cutout: '75%',
      plugins: {
        legend: {
          position: 'right' as const,
          labels: {
            usePointStyle: true,
            padding: 20,
            font: {
              size: 11
            }
          }
        },
        title: {
          display: false
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

  const gradient = ctx.createLinearGradient(0, 0, 0, 400)
  gradient.addColorStop(0, chartColors.blue.fill)
  gradient.addColorStop(1, 'rgba(59, 130, 246, 0)')

  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: trendData.value.map(d => d.date),
      datasets: [{
        label: 'New Waitlist Entries',
        data: trendData.value.map(d => d.count),
        backgroundColor: gradient,
        borderColor: chartColors.blue.stroke,
        borderWidth: 2,
        pointBackgroundColor: chartColors.blue.point,
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: chartColors.blue.stroke,
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      ...baseChartOptions,
      plugins: {
        legend: {
          display: false
        },
        title: {
          display: false
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 7
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
          },
          ticks: {
            precision: 0,
            maxTicksLimit: 5
          }
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
  const statusData = statusLabels.map(status =>
    waitlistEntries.value.filter(entry => entry.status === status).length
  )

  statusChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: statusLabels,
      datasets: [{
        data: statusData,
        backgroundColor: [
          chartColors.blue.fill,
          chartColors.green.fill,
          chartColors.purple.fill,
          chartColors.red.fill
        ],
        borderColor: [
          chartColors.blue.stroke,
          chartColors.green.stroke,
          chartColors.purple.stroke,
          chartColors.red.stroke
        ],
        borderWidth: 2,
        hoverOffset: 4,
        spacing: 2
      }]
    },
    options: {
      ...baseChartOptions,
      plugins: {
        legend: {
          position: 'right' as const,
          labels: {
            usePointStyle: true,
            padding: 20,
            font: {
              size: 11
            }
          }
        },
        title: {
          display: false
        }
      }
    }
  })
}

// Update charts when data changes
function updateCharts(): void {
  if (productChart && productChart.data) {
    const chart = productChart as Chart<'bar'>
    const partySizes = [1, 2, 3, 4, 5, 6, '7+']
    const partySizeCounts = partySizes.map(size => {
      if (size === '7+') {
        return waitlistEntries.value.filter(entry => entry.partySize >= 7).length
      }
      return waitlistEntries.value.filter(entry => entry.partySize === size).length
    })

    chart.data.labels = partySizes.map(size => `${size} ${size === 1 ? 'person' : 'people'}`)
    if (chart.data.datasets && chart.data.datasets.length > 0) {
      chart.data.datasets[0].data = partySizeCounts
    }
    chart.update()
  }

  if (sourceChart && sourceChart.data) {
    const chart = sourceChart as Chart<'doughnut'>
    const preferenceLabels = tablePreferences.slice(1)
    chart.data.labels = preferenceLabels
    if (chart.data.datasets && chart.data.datasets.length > 0) {
      chart.data.datasets[0].data = preferenceLabels.map(preference =>
        waitlistEntries.value.filter(entry =>
          entry.tablePreference ? entry.tablePreference === preference : false
        ).length
      )
    }
    chart.update()
  }

  if (statusChart && statusChart.data) {
    const chart = statusChart as Chart<'pie'>
    const statusLabels = statuses.slice(1)
    chart.data.labels = statusLabels
    if (chart.data.datasets && chart.data.datasets.length > 0) {
      chart.data.datasets[0].data = statusLabels.map(status =>
        waitlistEntries.value.filter(entry => entry.status === status).length
      )
    }
    chart.update()
  }

  if (trendChart && trendChart.data) {
    const chart = trendChart as Chart<'line'>
    const dates = trendData.value.map(d => d.date)
    chart.data.labels = dates
    if (chart.data.datasets && chart.data.datasets.length > 0) {
      chart.data.datasets[0].data = trendData.value.map(d => d.count)
    }
    chart.update()
  }
}

// Watch for changes in waitlist entries to update charts
watch(waitlistEntries, () => {
  updateQueuePositions()
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

        <!-- Stats Cards -->
        <dl class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Current Wait</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
              {{ waitTimeStats?.averageWait || 0 }}min
            </dd>
            <dd class="mt-2 flex items-center text-sm text-blue-600 dark:text-blue-400">
              <div class="i-hugeicons-hourglass h-4 w-4 mr-1"></div>
              <span>{{ waitingEntries }} parties waiting</span>
            </dd>
          </div>

          <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Seated Today</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ seatedEntries }}</dd>
            <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
              <div class="i-hugeicons-checkmark-circle-02 h-4 w-4 mr-1"></div>
              <span>Tables turned</span>
            </dd>
          </div>

          <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">No Shows</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ noShowEntries }}</dd>
            <dd class="mt-2 flex items-center text-sm text-red-600 dark:text-red-400">
              <div class="i-hugeicons-cancel-circle h-4 w-4 mr-1"></div>
              <span>Missed reservations</span>
            </dd>
          </div>

          <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Seating Rate</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
              {{ Math.round((seatedEntries / (totalEntries || 1)) * 100) }}%
            </dd>
            <dd class="mt-2 flex items-center text-sm text-purple-600 dark:text-purple-400">
              <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
              <span>{{ seatedEntries }} parties seated</span>
            </dd>
          </div>
        </dl>

        <!-- Charts -->
        <div class="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <!-- Wait Time Trend Chart -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-6">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Wait Time Trend</h3>
              <div class="mt-2 h-80">
                <canvas ref="trendChartRef"></canvas>
              </div>
            </div>
          </div>

          <!-- Party Size Distribution Chart -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-6">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Party Sizes</h3>
              <div class="mt-2 h-80">
                <canvas ref="productChartRef"></canvas>
              </div>
            </div>
          </div>

          <!-- Table Preference Chart -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-6">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Table Preferences</h3>
              <div class="mt-2 h-80">
                <canvas ref="sourceChartRef"></canvas>
              </div>
            </div>
          </div>

          <!-- Status Distribution Chart -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-6">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Current Status</h3>
              <div class="mt-2 h-80">
                <canvas ref="statusChartRef"></canvas>
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
            <!-- Party Size filter -->
            <select
              v-model="partySizeFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Party Sizes</option>
              <option value="1-2">1-2 People</option>
              <option value="3-4">3-4 People</option>
              <option value="5-6">5-6 People</option>
              <option value="7+">7+ People</option>
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

            <!-- Table Preference filter -->
            <select
              v-model="tablePreferenceFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Table Types</option>
              <option v-for="preference in tablePreferences.slice(1)" :key="preference" :value="preference">
                {{ preference }}
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
              <div v-else class="i-hugeicons-arrow-down-02 h-4 w-4"></div>
            </span>
          </button>
          <button
            @click="toggleSort('checkInTime')"
            class="mr-3 flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'checkInTime' }"
          >
            Check-in Time
            <span v-if="sortBy === 'checkInTime'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-02 h-4 w-4"></div>
            </span>
          </button>
          <button
            @click="toggleSort('estimatedWaitMinutes')"
            class="flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'estimatedWaitMinutes' }"
          >
            Wait Time
            <span v-if="sortBy === 'estimatedWaitMinutes'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-02 h-4 w-4"></div>
            </span>
          </button>
        </div>

        <!-- Bulk actions toolbar -->
        <div v-if="selectedEntries.length > 0" class="mt-4 bg-blue-50 p-4 rounded-md dark:bg-blue-900/30">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <span class="text-sm font-medium text-blue-700 dark:text-blue-300">{{ selectedEntries.length }} parties selected</span>
            </div>
            <div class="flex space-x-3">
              <button
                @click="openNotificationModal"
                class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
              >
                <div class="i-hugeicons-notification-square h-4 w-4 mr-1"></div>
                Send Updates
              </button>
              <button
                @click="bulkChangeStatus('Seated')"
                class="inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500"
              >
                <div class="i-hugeicons-checkmark-circle-02 h-4 w-4 mr-1"></div>
                Mark as Seated
              </button>
              <button
                @click="bulkChangeStatus('No Show')"
                class="inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
              >
                <div class="i-hugeicons-cancel-circle h-4 w-4 mr-1"></div>
                Mark as No Show
              </button>
            </div>
          </div>
        </div>

        <!-- Waitlist table -->
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
                  Party Details
                </th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Wait Time
                </th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Status
                </th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Check-in Time
                </th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Table Preference
                </th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Queue Position
                </th>
                <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-blue-gray-800">
              <tr v-if="paginatedEntries.length === 0" class="text-center">
                <td colspan="8" class="py-10 text-gray-500 dark:text-gray-400">
                  No parties currently on the waitlist.
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
                      <div class="font-medium text-gray-900 dark:text-white">
                        {{ entry.name }} ({{ entry.partySize }} {{ entry.partySize === 1 ? 'person' : 'people' }})
                      </div>
                      <div class="text-gray-500 dark:text-gray-400">
                        {{ entry.phone || entry.email }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm">
                  <div class="font-medium text-gray-900 dark:text-white">
                    {{ entry.estimatedWaitMinutes }} min
                  </div>
                  <div class="text-gray-500 dark:text-gray-400">Quoted: {{ entry.quotedWaitMinutes }} min</div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm">
                  <span :class="getStatusClass(entry.status)" class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
                    {{ entry.status }}
                  </span>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {{ new Date(entry.checkInTime).toLocaleTimeString() }}
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {{ entry.tablePreference || 'No Preference' }}
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm">
                  <span v-if="entry.status === 'Waiting'" class="font-medium text-gray-900 dark:text-white">#{{ entry.queuePosition }}</span>
                  <span v-else class="text-gray-500 dark:text-gray-400">-</span>
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
                      v-if="entry.status === 'Waiting'"
                      @click="markAsSeated(entry.id)"
                      class="text-gray-400 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                    >
                      <div class="i-hugeicons-checkmark-circle-02 h-5 w-5"></div>
                      <span class="sr-only">Seat</span>
                    </button>
                    <button
                      v-if="entry.status === 'Waiting'"
                      @click="markAsNoShow(entry.id)"
                      class="text-gray-400 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                    >
                      <div class="i-hugeicons-cancel-circle h-5 w-5"></div>
                      <span class="sr-only">No Show</span>
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
              @click="prevPage"
              :disabled="currentPage === 1"
              :class="[
                currentPage === 1 ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50 dark:hover:bg-blue-gray-700',
                'relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-white'
              ]"
            >
              Previous
            </button>
            <button
              @click="nextPage"
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
                  @click="goToPage(currentPage - 1)"
                  :disabled="currentPage === 1"
                  :class="[
                    currentPage === 1 ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50 dark:hover:bg-blue-gray-700',
                    'relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-600'
                  ]"
                >
                  <span class="sr-only">Previous</span>
                  <div class="i-hugeicons-arrow-left-01 h-5 w-5"></div>
                </button>
                <button
                  v-for="page in totalPages"
                  :key="page"
                  @click="goToPage(page)"
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
                  @click="goToPage(currentPage + 1)"
                  :disabled="currentPage === totalPages"
                  :class="[
                    currentPage === totalPages ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50 dark:hover:bg-blue-gray-700',
                    'relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 dark:ring-gray-600'
                  ]"
                >
                  <span class="sr-only">Next</span>
                  <div class="i-hugeicons-arrow-right-01 h-5 w-5"></div>
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

                <!-- Party Size field -->
                <div class="sm:col-span-3">
                  <label for="partySize" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Party Size
                  </label>
                  <div class="mt-1">
                    <input
                      id="partySize"
                      v-model="entryPartySize"
                      type="number"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                <!-- Notification Preference field -->
                <div class="sm:col-span-3">
                  <label for="notificationPreference" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Notification Preference
                  </label>
                  <div class="mt-1">
                    <select
                      id="notificationPreference"
                      v-model="entryNotificationPreference"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white"
                    >
                      <option v-for="preference in notificationPreferences" :key="preference" :value="preference">
                        {{ preference }}
                      </option>
                    </select>
                  </div>
                </div>

                <!-- Table Preference field -->
                <div class="sm:col-span-3">
                  <label for="tablePreference" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Table Preference
                  </label>
                  <div class="mt-1">
                    <select
                      id="tablePreference"
                      v-model="entryTablePreference"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white"
                    >
                      <option v-for="preference in tablePreferences" :key="preference" :value="preference">
                        {{ preference }}
                      </option>
                    </select>
                  </div>
                </div>

                <!-- Special Requests field -->
                <div class="sm:col-span-6">
                  <label for="specialRequests" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Special Requests (optional)
                  </label>
                  <div class="mt-1">
                    <textarea
                      id="specialRequests"
                      v-model="entrySpecialRequests"
                      rows="3"
                      class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:border-gray-600 dark:bg-blue-gray-700 dark:text-white"
                    ></textarea>
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
