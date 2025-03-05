<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'
import { useLocalStorage } from '@vueuse/core'

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
    product: 'Matcha Green Tea Latte',
    source: 'Website',
    status: 'Pending',
    dateAdded: '2024-01-18',
    notes: null,
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

// Available statuses
const statuses = ['all', 'Pending', 'Notified', 'Converted', 'Expired']

// Available sources
const sources = ['all', 'Website', 'Mobile App', 'In-Store', 'Social Media', 'Email Campaign', 'Referral']

// Filtered and sorted entries
const filteredEntries = computed<WaitlistEntry[]>(() => {
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

// Computed properties for form fields to handle null currentEntry
const entryName = computed<{
  get: () => string;
  set: (value: string) => void;
}>({
  get: () => currentEntry.value?.name || '',
  set: (value: string) => { if (currentEntry.value) currentEntry.value.name = value }
})

const entryEmail = computed<{
  get: () => string;
  set: (value: string) => void;
}>({
  get: () => currentEntry.value?.email || '',
  set: (value: string) => { if (currentEntry.value) currentEntry.value.email = value }
})

const entryPhone = computed<{
  get: () => string;
  set: (value: string) => void;
}>({
  get: () => currentEntry.value?.phone || '',
  set: (value: string) => { if (currentEntry.value) currentEntry.value.phone = value || null }
})

const entryProduct = computed<{
  get: () => string;
  set: (value: string) => void;
}>({
  get: () => currentEntry.value?.product || '',
  set: (value: string) => { if (currentEntry.value) currentEntry.value.product = value || '' }
})

const entrySource = computed<{
  get: () => string;
  set: (value: string) => void;
}>({
  get: () => currentEntry.value?.source || '',
  set: (value: string) => { if (currentEntry.value) currentEntry.value.source = value || '' }
})

const entryStatus = computed<{
  get: () => string;
  set: (value: string) => void;
}>({
  get: () => currentEntry.value?.status || 'Pending',
  set: (value: string) => { if (currentEntry.value) currentEntry.value.status = value || 'Pending' }
})

const entryNotes = computed<{
  get: () => string;
  set: (value: string) => void;
}>({
  get: () => currentEntry.value?.notes || '',
  set: (value: string) => { if (currentEntry.value) currentEntry.value.notes = value || null }
})

const entryPriority = computed<{
  get: () => number;
  set: (value: number) => void;
}>({
  get: () => currentEntry.value?.priority || 1,
  set: (value: number) => { if (currentEntry.value) currentEntry.value.priority = value }
})

function openAddEntryModal(): void {
  isEditMode.value = false
  currentEntry.value = {
    id: Math.max(...waitlistEntries.value.map(e => e.id)) + 1,
    name: '',
    email: '',
    phone: null,
    product: '',
    source: 'Website',
    status: 'Pending',
    dateAdded: new Date().toISOString().split('T')[0],
    notes: null,
    notified: false,
    priority: 1
  }
  showEntryModal.value = true
}

function openEditEntryModal(entry: WaitlistEntry): void {
  isEditMode.value = true
  currentEntry.value = { ...entry }
  showEntryModal.value = true
}

function closeEntryModal(): void {
  showEntryModal.value = false
}

function saveEntry(): void {
  if (!currentEntry.value) return

  if (isEditMode.value) {
    // Update existing entry
    const index = waitlistEntries.value.findIndex(e => e.id === currentEntry.value!.id)
    if (index !== -1) {
      waitlistEntries.value[index] = { ...currentEntry.value }
    }
  } else {
    // Add new entry
    waitlistEntries.value.push({ ...currentEntry.value })
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
          <div class="mt-4 sm:mt-0">
            <button
              type="button"
              @click="openAddEntryModal"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-1"></div>
              Add to waitlist
            </button>
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

        <!-- Waitlist table -->
        <div class="mt-6 overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-blue-gray-900">
              <tr>
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
                <td colspan="7" class="py-10 text-gray-500 dark:text-gray-400">
                  No waitlist entries found. Add your first entry to get started.
                </td>
              </tr>
              <tr v-for="entry in paginatedEntries" :key="entry.id" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700">
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
                  <button
                    @click="openEditEntryModal(entry)"
                    class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-4"
                  >
                    Edit
                  </button>
                  <button
                    v-if="!entry.notified && entry.status !== 'Converted'"
                    @click="markAsNotified(entry.id)"
                    class="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                  >
                    Notify
                  </button>
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
  </main>
</template>
