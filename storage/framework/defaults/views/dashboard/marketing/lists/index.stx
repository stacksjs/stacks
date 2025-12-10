<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'
import { useLocalStorage } from '@vueuse/core'

useHead({
  title: 'Dashboard - Marketing Lists',
})

// Define list type
interface List {
  id: number
  name: string
  description: string
  type: 'email' | 'sms' | 'both'
  tags: string[]
  subscriberCount: number
  openRate?: number
  clickRate?: number
  unsubscribeRate?: number
  lastSent: string | null
  dateCreated: string
  status: 'Active' | 'Draft' | 'Archived'
  isDefault: boolean
}

// Define subscriber type
interface Subscriber {
  id: number
  email: string
  phone: string | null
  firstName: string | null
  lastName: string | null
  dateSubscribed: string
  status: 'Subscribed' | 'Unsubscribed' | 'Bounced'
  source: string
  listIds: number[]
}

// Sample lists data
const lists = ref<List[]>([
  {
    id: 1,
    name: 'Newsletter Subscribers',
    description: 'Main newsletter list for weekly updates',
    type: 'email',
    tags: ['newsletter', 'main'],
    subscriberCount: 1245,
    openRate: 24.5,
    clickRate: 3.2,
    unsubscribeRate: 0.5,
    lastSent: '2023-12-15',
    dateCreated: '2023-01-10',
    status: 'Active',
    isDefault: true
  },
  {
    id: 2,
    name: 'Product Announcements',
    description: 'Customers interested in new product releases',
    type: 'email',
    tags: ['products', 'announcements'],
    subscriberCount: 876,
    openRate: 32.1,
    clickRate: 5.7,
    unsubscribeRate: 0.3,
    lastSent: '2023-12-01',
    dateCreated: '2023-02-15',
    status: 'Active',
    isDefault: false
  },
  {
    id: 3,
    name: 'SMS Promotions',
    description: 'Customers who opted in for SMS promotional messages',
    type: 'sms',
    tags: ['sms', 'promotions'],
    subscriberCount: 542,
    openRate: undefined,
    clickRate: 8.3,
    unsubscribeRate: 1.2,
    lastSent: '2023-11-25',
    dateCreated: '2023-03-20',
    status: 'Active',
    isDefault: false
  },
  {
    id: 4,
    name: 'Abandoned Cart Reminders',
    description: 'Customers who abandoned their shopping carts',
    type: 'both',
    tags: ['cart', 'recovery'],
    subscriberCount: 328,
    openRate: 41.2,
    clickRate: 12.5,
    unsubscribeRate: 0.8,
    lastSent: '2023-12-10',
    dateCreated: '2023-04-05',
    status: 'Active',
    isDefault: false
  },
  {
    id: 5,
    name: 'VIP Customers',
    description: 'High-value customers for exclusive offers',
    type: 'both',
    tags: ['vip', 'exclusive'],
    subscriberCount: 156,
    openRate: 58.7,
    clickRate: 24.3,
    unsubscribeRate: 0.1,
    lastSent: '2023-12-05',
    dateCreated: '2023-05-12',
    status: 'Active',
    isDefault: false
  },
  {
    id: 6,
    name: 'Re-engagement Campaign',
    description: 'Inactive customers we want to win back',
    type: 'email',
    tags: ['inactive', 'win-back'],
    subscriberCount: 723,
    openRate: 12.8,
    clickRate: 1.9,
    unsubscribeRate: 3.2,
    lastSent: '2023-11-15',
    dateCreated: '2023-06-20',
    status: 'Active',
    isDefault: false
  },
  {
    id: 7,
    name: 'Event Attendees',
    description: 'Customers who registered for upcoming events',
    type: 'both',
    tags: ['events', 'webinars'],
    subscriberCount: 412,
    openRate: 38.5,
    clickRate: 9.7,
    unsubscribeRate: 0.4,
    lastSent: '2023-12-08',
    dateCreated: '2023-07-15',
    status: 'Active',
    isDefault: false
  },
  {
    id: 8,
    name: 'Beta Testers',
    description: 'Customers interested in testing new features',
    type: 'email',
    tags: ['beta', 'testing'],
    subscriberCount: 189,
    openRate: 45.2,
    clickRate: 18.6,
    unsubscribeRate: 0.2,
    lastSent: '2023-11-30',
    dateCreated: '2023-08-10',
    status: 'Active',
    isDefault: false
  }
])

// Sample subscribers data (not displayed directly but used for import/export functionality)
const subscribers = ref<Subscriber[]>([
  {
    id: 1,
    email: 'john.doe@example.com',
    phone: '+15551234567',
    firstName: 'John',
    lastName: 'Doe',
    dateSubscribed: '2023-01-15',
    status: 'Subscribed',
    source: 'Website Signup',
    listIds: [1, 2, 4]
  },
  {
    id: 2,
    email: 'jane.smith@example.com',
    phone: '+15559876543',
    firstName: 'Jane',
    lastName: 'Smith',
    dateSubscribed: '2023-02-20',
    status: 'Subscribed',
    source: 'Product Purchase',
    listIds: [1, 3, 5]
  },
  {
    id: 3,
    email: 'robert.johnson@example.com',
    phone: null,
    firstName: 'Robert',
    lastName: 'Johnson',
    dateSubscribed: '2023-03-10',
    status: 'Subscribed',
    source: 'Lead Magnet',
    listIds: [1, 2]
  }
])

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('dateCreated')
const sortOrder = ref('desc')
const typeFilter = ref('all')
const statusFilter = ref('all')
const viewMode = useLocalStorage('lists-view-mode', 'list') // Default to list view and save in localStorage

// Available list types and statuses
const listTypes = ['all', 'email', 'sms', 'both']
const statuses = ['all', 'Active', 'Draft', 'Archived']

// Computed filtered and sorted lists
const filteredLists = computed(() => {
  return lists.value
    .filter(list => {
      // Apply search filter
      const matchesSearch =
        list.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        list.description.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        list.tags.some(tag => tag.toLowerCase().includes(searchQuery.value.toLowerCase()))

      // Apply type filter
      const matchesType = typeFilter.value === 'all' || list.type === typeFilter.value

      // Apply status filter
      const matchesStatus = statusFilter.value === 'all' || list.status === statusFilter.value

      return matchesSearch && matchesType && matchesStatus
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'dateCreated') {
        comparison = new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
      } else if (sortBy.value === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy.value === 'subscriberCount') {
        comparison = a.subscriberCount - b.subscriberCount
      } else if (sortBy.value === 'openRate') {
        const aRate = a.openRate ?? 0
        const bRate = b.openRate ?? 0
        comparison = aRate - bRate
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
})

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(8)
const totalPages = computed(() => Math.ceil(filteredLists.value.length / itemsPerPage.value))

const paginatedLists = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredLists.value.slice(start, end)
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
    case 'Active':
      return 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400'
    case 'Draft':
      return 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'Archived':
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
    default:
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

// Get type badge class
function getTypeClass(type: string): string {
  switch (type) {
    case 'email':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400'
    case 'sms':
      return 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20 dark:bg-purple-900/30 dark:text-purple-400'
    case 'both':
      return 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20 dark:bg-indigo-900/30 dark:text-indigo-400'
    default:
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

// Modal state for adding/editing list
const showListModal = ref(false)
const isEditMode = ref(false)
const currentList = ref<List | null>(null)

// Computed properties for form fields to handle null currentList
const listName = computed({
  get: () => currentList.value?.name || '',
  set: (value) => { if (currentList.value) currentList.value.name = value }
})

const listDescription = computed({
  get: () => currentList.value?.description || '',
  set: (value) => { if (currentList.value) currentList.value.description = value }
})

const listType = computed({
  get: () => currentList.value?.type || 'email',
  set: (value: 'email' | 'sms' | 'both') => { if (currentList.value) currentList.value.type = value }
})

const listTags = computed({
  get: () => currentList.value?.tags.join(', ') || '',
  set: (value) => {
    if (currentList.value) {
      currentList.value.tags = value.split(',').map(tag => tag.trim()).filter(tag => tag !== '')
    }
  }
})

const listStatus = computed({
  get: () => currentList.value?.status || 'Draft',
  set: (value: 'Active' | 'Draft' | 'Archived') => { if (currentList.value) currentList.value.status = value }
})

const listIsDefault = computed({
  get: () => currentList.value?.isDefault || false,
  set: (value) => { if (currentList.value) currentList.value.isDefault = value }
})

// Functions for managing lists
function openAddListModal(): void {
  isEditMode.value = false
  currentList.value = {
    id: Math.max(...lists.value.map(l => l.id)) + 1,
    name: '',
    description: '',
    type: 'email',
    tags: [],
    subscriberCount: 0,
    openRate: undefined,
    clickRate: undefined,
    unsubscribeRate: undefined,
    lastSent: null,
    dateCreated: new Date().toISOString().split('T')[0] || '2023-01-01', // Fallback date
    status: 'Draft',
    isDefault: false
  }
  showListModal.value = true
}

function openEditListModal(list: List): void {
  isEditMode.value = true
  currentList.value = { ...list }
  showListModal.value = true
}

function closeListModal(): void {
  showListModal.value = false
}

function saveList(): void {
  if (!currentList.value) return

  // If setting this list as default, unset default on all other lists
  if (currentList.value.isDefault) {
    lists.value.forEach(list => {
      if (list.id !== currentList.value!.id) {
        list.isDefault = false
      }
    })
  }

  if (isEditMode.value) {
    // Update existing list
    const index = lists.value.findIndex(l => l.id === currentList.value!.id)
    if (index !== -1) {
      lists.value[index] = { ...currentList.value }
    }
  } else {
    // Add new list
    lists.value.push({ ...currentList.value })
  }

  closeListModal()
}

// Function to delete a list
function deleteList(listId: number): void {
  if (confirm('Are you sure you want to delete this list? This will not delete the subscribers.')) {
    const index = lists.value.findIndex(l => l.id === listId)
    if (index !== -1) {
      // Check if it's the default list
      if (lists.value[index].isDefault) {
        alert('Cannot delete the default list. Please set another list as default first.')
        return
      }
      lists.value.splice(index, 1)
    }
  }
}

// Function to duplicate a list
function duplicateList(list: List): void {
  const newList: List = {
    ...list,
    id: Math.max(...lists.value.map(l => l.id)) + 1,
    name: `${list.name} (Copy)`,
    subscriberCount: 0,
    lastSent: null,
    dateCreated: new Date().toISOString().split('T')[0] || '2023-01-01', // Fallback date
    isDefault: false
  }
  lists.value.push(newList)
}

// Function to export list subscribers
function exportList(listId: number): void {
  // In a real application, this would generate a CSV file with subscriber data
  const list = lists.value.find(l => l.id === listId)
  if (!list) return

  const listSubscribers = subscribers.value.filter(s => s.listIds.includes(listId))

  alert(`Exporting ${listSubscribers.length} subscribers from "${list.name}" list.`)

  // This would normally trigger a download
  console.log('Exporting subscribers:', listSubscribers)
}

// Function to import subscribers to a list
function importSubscribers(listId: number): void {
  // In a real application, this would open a file upload dialog
  alert('This would open a file upload dialog to import subscribers.')
}

// Calculate statistics
const totalLists = computed(() => lists.value.length)
const totalEmailLists = computed(() => lists.value.filter(l => l.type === 'email' || l.type === 'both').length)
const totalSmsLists = computed(() => lists.value.filter(l => l.type === 'sms' || l.type === 'both').length)
const totalSubscribers = computed(() => {
  // In a real application, this would count unique subscribers
  return lists.value.reduce((sum, list) => sum + list.subscriberCount, 0)
})

// Show import modal
const showImportModal = ref(false)
const importListId = ref<number | null>(null)

function openImportModal(listId: number): void {
  importListId.value = listId
  showImportModal.value = true
}

function closeImportModal(): void {
  showImportModal.value = false
  importListId.value = null
}

// Bulk operations
const selectedLists = ref<number[]>([])
const selectAll = ref(false)

function toggleSelectAll(): void {
  if (selectAll.value) {
    selectedLists.value = paginatedLists.value.map(list => list.id)
  } else {
    selectedLists.value = []
  }
}

function toggleListSelection(listId: number): void {
  const index = selectedLists.value.indexOf(listId)
  if (index === -1) {
    selectedLists.value.push(listId)
  } else {
    selectedLists.value.splice(index, 1)
  }

  // Update selectAll based on whether all visible lists are selected
  selectAll.value = paginatedLists.value.every(list => selectedLists.value.includes(list.id))
}

function bulkDelete(): void {
  if (selectedLists.value.length === 0) return

  if (confirm(`Are you sure you want to delete ${selectedLists.value.length} lists?`)) {
    // Check if any selected list is a default list
    const hasDefault = lists.value.some(list => list.isDefault && selectedLists.value.includes(list.id))

    if (hasDefault) {
      alert('Cannot delete the default list. Please set another list as default first.')
      return
    }

    lists.value = lists.value.filter(list => !selectedLists.value.includes(list.id))
    selectedLists.value = []
    selectAll.value = false
  }
}

function bulkChangeStatus(status: 'Active' | 'Draft' | 'Archived'): void {
  if (selectedLists.value.length === 0) return

  lists.value.forEach(list => {
    if (selectedLists.value.includes(list.id)) {
      list.status = status
    }
  })
}
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <!-- Header section -->
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Marketing Lists</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Manage your email and SMS subscriber lists
            </p>
          </div>
          <div class="mt-4 sm:mt-0">
            <button
              type="button"
              @click="openAddListModal"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-1"></div>
              Create list
            </button>
          </div>
        </div>

        <!-- Summary cards -->
        <div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <!-- Total lists card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-blue-100 p-2 dark:bg-blue-900">
                    <div class="i-hugeicons-list-check h-6 w-6 text-blue-600 dark:text-blue-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Lists</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ totalLists }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Email lists card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-indigo-100 p-2 dark:bg-indigo-900">
                    <div class="i-hugeicons-mail h-6 w-6 text-indigo-600 dark:text-indigo-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Email Lists</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ totalEmailLists }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- SMS lists card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-purple-100 p-2 dark:bg-purple-900">
                    <div class="i-hugeicons-message-square-01 h-6 w-6 text-purple-600 dark:text-purple-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">SMS Lists</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ totalSmsLists }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Total subscribers card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-green-100 p-2 dark:bg-green-900">
                    <div class="i-hugeicons-users-01 h-6 w-6 text-green-600 dark:text-green-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Subscribers</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ totalSubscribers }}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bulk actions toolbar (visible when items are selected) -->
        <div v-if="selectedLists.length > 0" class="mt-6 bg-white p-4 shadow rounded-lg dark:bg-blue-gray-800">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ selectedLists.length }} lists selected</span>
            </div>
            <div class="flex space-x-2">
              <div class="relative inline-block text-left">
                <button
                  type="button"
                  class="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
                >
                  Change status
                  <div class="i-hugeicons-chevron-down h-5 w-5 ml-1"></div>
                </button>
                <div class="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-blue-gray-700 dark:ring-gray-600" role="menu" aria-orientation="vertical" aria-labelledby="menu-button" tabindex="-1" style="display: none;">
                  <div class="py-1" role="none">
                    <button @click="bulkChangeStatus('Active')" class="text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100 dark:text-white dark:hover:bg-blue-gray-600" role="menuitem">Mark as Active</button>
                    <button @click="bulkChangeStatus('Draft')" class="text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100 dark:text-white dark:hover:bg-blue-gray-600" role="menuitem">Mark as Draft</button>
                    <button @click="bulkChangeStatus('Archived')" class="text-gray-700 block px-4 py-2 text-sm hover:bg-gray-100 dark:text-white dark:hover:bg-blue-gray-600" role="menuitem">Archive</button>
                  </div>
                </div>
              </div>
              <button
                @click="bulkDelete"
                class="inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              >
                <div class="i-hugeicons-waste h-5 w-5 mr-1"></div>
                Delete selected
              </button>
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
              placeholder="Search lists..."
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-4">
            <!-- Type filter -->
            <select
              v-model="typeFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Types</option>
              <option value="email">Email Only</option>
              <option value="sms">SMS Only</option>
              <option value="both">Email & SMS</option>
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

            <!-- View mode toggle -->
            <div class="flex rounded-md shadow-sm">
              <button
                type="button"
                @click="viewMode = 'grid'"
                :class="[
                  'relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-semibold ring-1 ring-inset focus:z-10',
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white ring-blue-600'
                    : 'bg-white text-gray-900 ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700'
                ]"
              >
                <div class="i-hugeicons-grid h-5 w-5"></div>
              </button>
              <button
                type="button"
                @click="viewMode = 'list'"
                :class="[
                  'relative -ml-px inline-flex items-center rounded-r-md px-3 py-2 text-sm font-semibold ring-1 ring-inset focus:z-10',
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white ring-blue-600'
                    : 'bg-white text-gray-900 ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700'
                ]"
              >
                <div class="i-hugeicons-right-to-left-list-number h-5 w-5"></div>
              </button>
            </div>
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
            @click="toggleSort('subscriberCount')"
            class="mr-3 flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'subscriberCount' }"
          >
            Subscribers
            <span v-if="sortBy === 'subscriberCount'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-02 h-4 w-4"></div>
            </span>
          </button>
          <button
            @click="toggleSort('openRate')"
            class="mr-3 flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'openRate' }"
          >
            Open Rate
            <span v-if="sortBy === 'openRate'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-02 h-4 w-4"></div>
            </span>
          </button>
          <button
            @click="toggleSort('dateCreated')"
            class="flex items-center hover:text-gray-700 dark:hover:text-gray-300"
            :class="{ 'font-semibold text-blue-600 dark:text-blue-400': sortBy === 'dateCreated' }"
          >
            Date Created
            <span v-if="sortBy === 'dateCreated'" class="ml-1">
              <div v-if="sortOrder === 'asc'" class="i-hugeicons-arrow-up-01 h-4 w-4"></div>
              <div v-else class="i-hugeicons-arrow-down-02 h-4 w-4"></div>
            </span>
          </button>
        </div>

        <!-- List view -->
        <div v-if="viewMode === 'list'" class="mt-6 overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-blue-gray-700">
              <tr>
                <th scope="col" class="relative px-7 sm:w-12 sm:px-6">
                  <input
                    type="checkbox"
                    class="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600"
                    :checked="selectAll"
                    @change="toggleSelectAll"
                  />
                </th>
                <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">List Name</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Type</th>
                <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-white">Subscribers</th>
                <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-white">Open Rate</th>
                <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-white">Last Sent</th>
                <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-blue-gray-800">
              <tr v-if="paginatedLists.length === 0">
                <td colspan="8" class="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No lists found. Try adjusting your search or filter.
                </td>
              </tr>
              <tr v-for="list in paginatedLists" :key="list.id" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700">
                <td class="relative px-7 sm:w-12 sm:px-6">
                  <div class="absolute left-4 top-1/2 -mt-2">
                    <input
                      type="checkbox"
                      class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600"
                      :checked="selectedLists.includes(list.id)"
                      @change="toggleListSelection(list.id)"
                    />
                  </div>
                </td>
                <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                  <div class="flex items-center">
                    <div class="h-10 w-10 flex-shrink-0 bg-gray-100 rounded-md flex items-center justify-center dark:bg-gray-700">
                      <div v-if="list.type === 'email'" class="i-hugeicons-mail h-6 w-6 text-blue-600 dark:text-blue-400"></div>
                      <div v-else-if="list.type === 'sms'" class="i-hugeicons-message-square-01 h-6 w-6 text-purple-600 dark:text-purple-400"></div>
                      <div v-else class="i-hugeicons-mail-message-square h-6 w-6 text-indigo-600 dark:text-indigo-400"></div>
                    </div>
                    <div class="ml-4">
                      <div class="font-medium text-gray-900 dark:text-white flex items-center">
                        {{ list.name }}
                        <span v-if="list.isDefault" class="ml-2 inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400">
                          Default
                        </span>
                      </div>
                      <div class="text-gray-500 dark:text-gray-400 line-clamp-1">{{ list.description }}</div>
                    </div>
                  </div>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm">
                  <span :class="[getTypeClass(list.type), 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium']">
                    {{ list.type === 'email' ? 'Email' : list.type === 'sms' ? 'SMS' : 'Email & SMS' }}
                  </span>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm">
                  <span :class="[getStatusClass(list.status), 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium']">
                    {{ list.status }}
                  </span>
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-right">
                  {{ list.subscriberCount }}
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-right">
                  {{ list.openRate !== undefined ? `${list.openRate}%` : 'N/A' }}
                </td>
                <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-right">
                  {{ list.lastSent || 'Never' }}
                </td>
                <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <div class="flex justify-end space-x-2">
                    <button
                      @click="openImportModal(list.id)"
                      class="text-gray-400 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                      title="Import subscribers"
                    >
                      <div class="i-hugeicons-upload-01 h-5 w-5"></div>
                      <span class="sr-only">Import subscribers to {{ list.name }}</span>
                    </button>
                    <button
                      @click="exportList(list.id)"
                      class="text-gray-400 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                      title="Export subscribers"
                    >
                      <div class="i-hugeicons-download-01 h-5 w-5"></div>
                      <span class="sr-only">Export subscribers from {{ list.name }}</span>
                    </button>
                    <button
                      @click="duplicateList(list)"
                      class="text-gray-400 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                      title="Duplicate list"
                    >
                      <div class="i-hugeicons-copy-01 h-5 w-5"></div>
                      <span class="sr-only">Duplicate {{ list.name }}</span>
                    </button>
                    <button
                      @click="openEditListModal(list)"
                      class="text-gray-400 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                      title="Edit list"
                    >
                      <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                      <span class="sr-only">Edit {{ list.name }}</span>
                    </button>
                    <button
                      @click="deleteList(list.id)"
                      class="text-gray-400 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                      title="Delete list"
                    >
                      <div class="i-hugeicons-waste h-5 w-5"></div>
                      <span class="sr-only">Delete {{ list.name }}</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Grid view -->
        <div v-if="viewMode === 'grid'" class="mt-6">
          <div v-if="paginatedLists.length === 0" class="py-12 text-center">
            <div class="i-hugeicons-list-check mx-auto h-12 w-12 text-gray-400"></div>
            <h3 class="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No lists found</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Try adjusting your search or filter to find what you're looking for.</p>
          </div>

          <div v-else class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <!-- List card -->
            <div
              v-for="list in paginatedLists"
              :key="list.id"
              class="group relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-blue-gray-800"
            >
              <!-- List header with type icon -->
              <div class="relative p-4 border-b border-gray-200 dark:border-gray-700">
                <div class="flex items-center justify-between">
                  <div class="flex items-center">
                    <div class="h-10 w-10 flex-shrink-0 bg-gray-100 rounded-md flex items-center justify-center dark:bg-gray-700">
                      <div v-if="list.type === 'email'" class="i-hugeicons-mail h-6 w-6 text-blue-600 dark:text-blue-400"></div>
                      <div v-else-if="list.type === 'sms'" class="i-hugeicons-message-square-01 h-6 w-6 text-purple-600 dark:text-purple-400"></div>
                      <div v-else class="i-hugeicons-mail-message-square h-6 w-6 text-indigo-600 dark:text-indigo-400"></div>
                    </div>
                    <div class="ml-3">
                      <h3 class="text-sm font-medium text-gray-900 dark:text-white flex items-center">
                        {{ list.name }}
                        <span v-if="list.isDefault" class="ml-2 inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400">
                          Default
                        </span>
                      </h3>
                      <span :class="[getTypeClass(list.type), 'mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium']">
                        {{ list.type === 'email' ? 'Email' : list.type === 'sms' ? 'SMS' : 'Email & SMS' }}
                      </span>
                    </div>
                  </div>
                  <span :class="[getStatusClass(list.status), 'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium']">
                    {{ list.status }}
                  </span>
                </div>
              </div>

              <!-- List info -->
              <div class="p-4">
                <p class="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{{ list.description }}</p>

                <div class="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div class="text-gray-500 dark:text-gray-400">Subscribers</div>
                    <div class="font-medium text-gray-900 dark:text-white">{{ list.subscriberCount }}</div>
                  </div>
                  <div>
                    <div class="text-gray-500 dark:text-gray-400">Open Rate</div>
                    <div class="font-medium text-gray-900 dark:text-white">{{ list.openRate !== undefined ? `${list.openRate}%` : 'N/A' }}</div>
                  </div>
                  <div>
                    <div class="text-gray-500 dark:text-gray-400">Last Sent</div>
                    <div class="font-medium text-gray-900 dark:text-white">{{ list.lastSent || 'Never' }}</div>
                  </div>
                  <div>
                    <div class="text-gray-500 dark:text-gray-400">Created</div>
                    <div class="font-medium text-gray-900 dark:text-white">{{ list.dateCreated }}</div>
                  </div>
                </div>

                <div class="mt-4 flex items-center justify-between">
                  <div class="flex items-center">
                    <input
                      type="checkbox"
                      class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600 dark:border-gray-600"
                      :checked="selectedLists.includes(list.id)"
                      @change="toggleListSelection(list.id)"
                    />
                    <span class="ml-2 text-xs text-gray-500 dark:text-gray-400">Select</span>
                  </div>
                  <div class="flex space-x-2">
                    <button
                      @click="openEditListModal(list)"
                      class="text-gray-400 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    >
                      <div class="i-hugeicons-edit-01 h-4 w-4"></div>
                      <span class="sr-only">Edit</span>
                    </button>
                    <button
                      @click="deleteList(list.id)"
                      class="text-gray-400 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                    >
                      <div class="i-hugeicons-waste h-4 w-4"></div>
                      <span class="sr-only">Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="mt-6 flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-gray-700 sm:px-6">
          <div class="flex flex-1 justify-between sm:hidden">
            <button
              @click="previousPage"
              :disabled="currentPage === 1"
              :class="[
                'relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-white',
                currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-blue-gray-700'
              ]"
            >
              Previous
            </button>
            <button
              @click="nextPage"
              :disabled="currentPage === totalPages"
              :class="[
                'relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-white',
                currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-blue-gray-700'
              ]"
            >
              Next
            </button>
          </div>
          <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p class="text-sm text-gray-700 dark:text-gray-300">
                Showing <span class="font-medium">{{ (currentPage - 1) * itemsPerPage + 1 }}</span> to
                <span class="font-medium">{{ Math.min(currentPage * itemsPerPage, filteredLists.length) }}</span> of
                <span class="font-medium">{{ filteredLists.length }}</span> results
              </p>
            </div>
            <div>
              <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  @click="previousPage"
                  :disabled="currentPage === 1"
                  class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-gray-600 dark:hover:bg-blue-gray-700 dark:text-gray-500"
                  :class="{ 'opacity-50 cursor-not-allowed': currentPage === 1 }"
                >
                  <span class="sr-only">Previous</span>
                  <div class="i-hugeicons-arrow-left-01 h-5 w-5"></div>
                </button>
                <button
                  v-for="page in totalPages"
                  :key="page"
                  @click="changePage(page)"
                  :class="[
                    'relative inline-flex items-center px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-gray-300 focus:z-20 focus:outline-offset-0 dark:ring-gray-600',
                    page === currentPage
                      ? 'bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-blue-700'
                      : 'text-gray-900 hover:bg-gray-50 dark:text-white dark:hover:bg-blue-gray-700'
                  ]"
                >
                  {{ page }}
                </button>
                <button
                  @click="nextPage"
                  :disabled="currentPage === totalPages"
                  class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-gray-600 dark:hover:bg-blue-gray-700 dark:text-gray-500"
                  :class="{ 'opacity-50 cursor-not-allowed': currentPage === totalPages }"
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

    <!-- Add/Edit List Modal -->
    <div v-if="showListModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-75"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div class="absolute right-0 top-0 pr-4 pt-4">
            <button
              type="button"
              @click="closeListModal"
              class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-gray-800 dark:text-gray-500 dark:hover:text-gray-400"
            >
              <span class="sr-only">Close</span>
              <div class="i-hugeicons-can h-6 w-6"></div>
            </button>
          </div>
          <div class="sm:flex sm:items-start">
            <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                {{ isEditMode ? 'Edit List' : 'Create New List' }}
              </h3>
              <div class="mt-4">
                <form @submit.prevent="saveList" class="space-y-4">
                  <!-- List name -->
                  <div>
                    <label for="list-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                    <input
                      type="text"
                      id="list-name"
                      v-model="listName"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                      required
                    />
                  </div>

                  <!-- List description -->
                  <div>
                    <label for="list-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                    <textarea
                      id="list-description"
                      v-model="listDescription"
                      rows="3"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                    ></textarea>
                  </div>

                  <!-- List type -->
                  <div>
                    <label for="list-type" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
                    <select
                      id="list-type"
                      v-model="listType"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="email">Email Only</option>
                      <option value="sms">SMS Only</option>
                      <option value="both">Email & SMS</option>
                    </select>
                  </div>

                  <!-- List tags -->
                  <div>
                    <label for="list-tags" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Tags (comma separated)</label>
                    <input
                      type="text"
                      id="list-tags"
                      v-model="listTags"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="newsletter, promo, vip"
                    />
                  </div>

                  <!-- List status -->
                  <div>
                    <label for="list-status" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                    <select
                      id="list-status"
                      v-model="listStatus"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="Active">Active</option>
                      <option value="Draft">Draft</option>
                      <option value="Archived">Archived</option>
                    </select>
                  </div>

                  <!-- Default list checkbox -->
                  <div class="mt-4">
                    <div class="flex items-center">
                      <input
                        id="list-default"
                        type="checkbox"
                        v-model="listIsDefault"
                        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                      />
                      <label for="list-default" class="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Set as default list</label>
                    </div>
                    <p v-if="listIsDefault" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      This will unset any other default list. New subscribers will be added to this list by default.
                    </p>
                  </div>

                  <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto"
                    >
                      {{ isEditMode ? 'Save Changes' : 'Create List' }}
                    </button>
                    <button
                      type="button"
                      @click="closeListModal"
                      class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Import Subscribers Modal -->
    <div v-if="showImportModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-75"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div class="absolute right-0 top-0 pr-4 pt-4">
            <button
              type="button"
              @click="closeImportModal"
              class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-gray-800 dark:text-gray-500 dark:hover:text-gray-400"
            >
              <span class="sr-only">Close</span>
              <div class="i-hugeicons-can h-6 w-6"></div>
            </button>
          </div>
          <div class="sm:flex sm:items-start">
            <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10 dark:bg-blue-900">
              <div class="i-hugeicons-upload-01 h-6 w-6 text-blue-600 dark:text-blue-300"></div>
            </div>
            <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Import Subscribers</h3>
              <div class="mt-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Upload a CSV file with subscriber data to import into this list.
                </p>
              </div>
              <div class="mt-4">
                <div class="flex items-center justify-center w-full">
                  <label for="dropzone-file" class="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-blue-gray-700 dark:bg-blue-gray-700 hover:bg-gray-100 dark:border-gray-600">
                    <div class="flex flex-col items-center justify-center pt-5 pb-6">
                      <div class="i-hugeicons-upload-01 mb-3 h-10 w-10 text-gray-400 dark:text-gray-500"></div>
                      <p class="mb-2 text-sm text-gray-500 dark:text-gray-400"><span class="font-semibold">Click to upload</span> or drag and drop</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">CSV file (MAX. 10MB)</p>
                    </div>
                    <input id="dropzone-file" type="file" class="hidden" accept=".csv" />
                  </label>
                </div>
                <div class="mt-4">
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    Your CSV should include the following columns: email, phone (optional), first_name (optional), last_name (optional)
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto"
              @click="importSubscribers(importListId || 0)"
            >
              Import
            </button>
            <button
              type="button"
              @click="closeImportModal"
              class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
