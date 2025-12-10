<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import NotificationStatusBadge from '../../../components/Dashboard/NotificationStatusBadge.vue'
import NotificationErrorModal from '../../../components/Dashboard/NotificationErrorModal.vue'

useHead({
  title: 'Dashboard - Notification History',
})

interface NotificationEntry {
  id: string
  type: 'email' | 'sms' | 'push' | 'discord' | 'slack'
  recipient: string
  subject: string
  content: string
  status: 'sent' | 'delivered' | 'failed' | 'pending'
  sent_at: string
  delivered_at?: string
  error?: string
  metadata?: Record<string, any>
}

// Pagination and filtering state
const notifications = ref<NotificationEntry[]>([])
const currentPage = ref(1)
const perPage = ref(10)
const totalNotifications = ref(0)
const isLoading = ref(true)
const searchQuery = ref('')
const selectedType = ref<string>('all')
const selectedStatus = ref<string>('all')
const dateRange = ref<[string, string] | null>(null)
const showFilters = ref(false)
const sortField = ref<'sent_at' | 'delivered_at' | null>(null)
const sortDirection = ref<'asc' | 'desc'>('desc')

// Filter options
const notificationTypes = ['all', 'email', 'sms', 'push', 'discord', 'slack']
const statusTypes = ['all', 'sent', 'delivered', 'failed', 'pending']

// Status colors
const notificationStatusColors: Record<string, string> = {
  delivered: 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/50 ring-green-600/20',
  sent: 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/50 ring-blue-600/20',
  pending: 'text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/50 ring-yellow-600/20',
  failed: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/50 ring-red-600/20',
}

const getStatusColor = (status: string): string => {
  return notificationStatusColors[status] || 'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 ring-gray-600/20'
}

const getChannelIcon = (type: string): string => {
  switch (type) {
    case 'email':
      return 'i-hugeicons-mail-01'
    case 'sms':
      return 'i-hugeicons-smart-phone-01'
    case 'push':
      return 'i-hugeicons-notification-01'
    case 'discord':
      return 'i-hugeicons-discord'
    case 'slack':
      return 'i-hugeicons-slack'
    default:
      return 'i-hugeicons-notification-03'
  }
}

// Generate mock data
const generateMockNotifications = () => {
  const types = ['email', 'sms', 'push', 'discord', 'slack'] as const
  const statuses = ['sent', 'delivered', 'failed', 'pending'] as const
  const subjects = [
    'Welcome to our platform',
    'Your account has been updated',
    'Security alert',
    'Password reset request',
    'New login detected',
    'Subscription renewed',
    'Payment processed',
    'Order confirmation',
  ]

  return Array.from({ length: 100 }, (_, i) => {
    const typeIndex = Math.floor(Math.random() * types.length)
    const statusIndex = Math.floor(Math.random() * statuses.length)
    const subjectIndex = Math.min(Math.floor(Math.random() * subjects.length), subjects.length - 1)

    const type = types[typeIndex] as NotificationEntry['type']
    const status = statuses[statusIndex] as NotificationEntry['status']
    const subject = subjects[subjectIndex] || 'System Notification'
    const sent_at = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
    const delivered_at = status === 'delivered' ? new Date(new Date(sent_at).getTime() + Math.random() * 60000).toISOString() : undefined

    const notification: NotificationEntry = {
      id: `${i + 1}`,
      type,
      recipient: type === 'email' ? 'user@example.com' :
                type === 'sms' ? '+1234567890' :
                type === 'push' ? 'device-token-123' :
                type === 'discord' ? 'Channel #announcements' : '#general',
      subject,
      content: 'Notification content goes here...',
      status,
      sent_at,
      delivered_at,
      error: status === 'failed' ? 'Failed to deliver notification' : undefined,
      metadata: {
        device: type === 'push' ? 'iOS' : undefined,
        browser: type === 'push' ? 'Safari' : undefined,
      },
    }

    return notification
  })
}

// Computed properties for filtering
const filteredNotifications = computed(() => {
  return notifications.value.filter(notification => {
    if (selectedType.value !== 'all' && notification.type !== selectedType.value) return false
    if (selectedStatus.value !== 'all' && notification.status !== selectedStatus.value) return false
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      return notification.subject.toLowerCase().includes(query) ||
             notification.recipient.toLowerCase().includes(query) ||
             notification.content.toLowerCase().includes(query)
    }
    return true
  })
})

// Add sorting functionality
const sortedNotifications = computed(() => {
  if (!sortField.value) return filteredNotifications.value

  return [...filteredNotifications.value].sort((a, b) => {
    const aValue = a[sortField.value!]
    const bValue = b[sortField.value!]

    if (!aValue && !bValue) return 0
    if (!aValue) return 1
    if (!bValue) return -1

    const comparison = new Date(aValue).getTime() - new Date(bValue).getTime()
    return sortDirection.value === 'asc' ? comparison : -comparison
  })
})

const paginatedNotifications = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  const end = start + perPage.value
  return sortedNotifications.value.slice(start, end)
})

const totalPages = computed(() => Math.ceil(filteredNotifications.value.length / perPage.value))

// Methods
const handleRetry = async (notificationId: string) => {
  // Implement retry logic
  console.log('Retrying notification:', notificationId)
}

const resetFilters = () => {
  selectedType.value = 'all'
  selectedStatus.value = 'all'
  searchQuery.value = ''
  dateRange.value = null
}

const formatDate = (date: string) => {
  return new Date(date).toLocaleString()
}

const toggleSort = (field: 'sent_at' | 'delivered_at') => {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDirection.value = 'desc'
  }
}

// Add state for error modal
const isErrorModalOpen = ref(false)
const selectedNotification = ref<NotificationEntry | null>(null)

// Function to open error modal
const openErrorModal = (notification: NotificationEntry) => {
  selectedNotification.value = notification
  isErrorModalOpen.value = true
}

// Function to close error modal
const closeErrorModal = () => {
  isErrorModalOpen.value = false
}

// Load initial data
onMounted(async () => {
  isLoading.value = true
  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    notifications.value = generateMockNotifications()
    totalNotifications.value = notifications.value.length
  } catch (error) {
    console.error('Failed to load notifications:', error)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <div class="px-4 lg:px-8 sm:px-6">
      <!-- Header -->
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h1 class="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">Notification History</h1>
          <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
            A complete history of all notifications sent through the system
          </p>
        </div>
        <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            @click="showFilters = !showFilters"
            type="button"
            class="inline-flex items-center rounded-md bg-white dark:bg-blue-gray-600 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-blue-gray-500"
          >
            <div class="i-hugeicons-filter h-5 w-5 mr-2" />
            {{ showFilters ? 'Hide Filters' : 'Show Filters' }}
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div v-if="showFilters" class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <!-- Search -->
        <div class="flex-1 min-w-0">
          <label for="search" class="sr-only">Search notifications</label>
          <div class="relative rounded-md shadow-sm">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <div class="i-hugeicons-search-01 h-5 w-5 text-gray-400" />
            </div>
            <input
              v-model="searchQuery"
              type="search"
              name="search"
              id="search"
              class="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 dark:text-gray-100 dark:bg-blue-gray-600 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
              placeholder="Search notifications..."
            >
          </div>
        </div>

        <!-- Type Filter -->
        <div>
          <select
            v-model="selectedType"
            class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 dark:text-gray-100 dark:bg-blue-gray-600 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
          >
            <option v-for="type in notificationTypes" :key="type" :value="type">
              {{ type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1) }}
            </option>
          </select>
        </div>

        <!-- Status Filter -->
        <div>
          <select
            v-model="selectedStatus"
            class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 dark:text-gray-100 dark:bg-blue-gray-600 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
          >
            <option v-for="status in statusTypes" :key="status" :value="status">
              {{ status === 'all' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1) }}
            </option>
          </select>
        </div>

        <!-- Reset Filters -->
        <div class="flex items-end">
          <button
            @click="resetFilters"
            type="button"
            class="rounded-md bg-white dark:bg-blue-gray-600 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-blue-gray-500"
          >
            Reset Filters
          </button>
        </div>
      </div>

      <!-- Notification List -->
      <div class="mt-8 flow-root">
        <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 dark:ring-opacity-20 sm:rounded-lg">
              <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                <thead class="bg-gray-50 dark:bg-blue-gray-600">
                  <tr>
                    <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 sm:pl-6">Type</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Recipient</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Subject</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Status</th>
                    <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer" @click="toggleSort('sent_at')">
                      <div class="flex items-center justify-end">
                        Sent
                        <div v-if="sortField === 'sent_at'" class="ml-2">
                          <div v-if="sortDirection === 'desc'" class="i-hugeicons-chevron-down h-4 w-4" />
                          <div v-else class="i-hugeicons-chevron-up h-4 w-4" />
                        </div>
                        <div v-else class="ml-2">
                          <div class="i-hugeicons-arrows-up-down h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    </th>
                    <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer" @click="toggleSort('delivered_at')">
                      <div class="flex items-center justify-end">
                        Delivered
                        <div v-if="sortField === 'delivered_at'" class="ml-2">
                          <div v-if="sortDirection === 'desc'" class="i-hugeicons-chevron-down h-4 w-4" />
                          <div v-else class="i-hugeicons-chevron-up h-4 w-4" />
                        </div>
                        <div v-else class="ml-2">
                          <div class="i-hugeicons-arrows-up-down h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    </th>
                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span class="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-600 bg-white dark:bg-blue-gray-700">
                  <tr v-if="isLoading">
                    <td colspan="7" class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                      <div class="flex justify-center">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                      </div>
                    </td>
                  </tr>
                  <tr v-else-if="paginatedNotifications.length === 0">
                    <td colspan="7" class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                      No notifications found matching your criteria
                    </td>
                  </tr>
                  <tr v-for="notification in paginatedNotifications" :key="notification.id" class="hover:bg-gray-50 dark:hover:bg-blue-gray-600/50">
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                      <div class="flex items-center">
                        <div :class="getChannelIcon(notification.type)" class="h-5 w-5 mr-2" />
                        <span class="font-medium text-gray-900 dark:text-gray-100 capitalize">{{ notification.type }}</span>
                      </div>
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{{ notification.recipient }}</td>
                    <td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <div class="max-w-xs truncate">{{ notification.subject }}</div>
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm">
                      <NotificationStatusBadge :status="notification.status" />
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-right">
                      {{ formatDate(notification.sent_at) }}
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-right">
                      {{ notification.delivered_at ? formatDate(notification.delivered_at) : '-' }}
                    </td>
                    <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      <div class="flex justify-end space-x-2">
                        <button
                          v-if="notification.status === 'failed'"
                          @click="handleRetry(notification.id)"
                          type="button"
                          class="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400"
                        >
                          Retry
                        </button>
                        <button
                          @click="openErrorModal(notification)"
                          type="button"
                          class="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          View Logs
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div class="mt-4 flex items-center justify-between">
        <div class="flex items-center">
          <p class="text-sm text-gray-700 dark:text-gray-300">
            Showing
            <span class="font-medium">{{ (currentPage - 1) * perPage + 1 }}</span>
            to
            <span class="font-medium">{{ Math.min(currentPage * perPage, filteredNotifications.length) }}</span>
            of
            <span class="font-medium">{{ filteredNotifications.length }}</span>
            results
          </p>
        </div>
        <div class="flex items-center space-x-2">
          <button
            v-if="currentPage > 1"
            type="button"
            class="relative inline-flex items-center rounded-md bg-white dark:bg-blue-gray-600 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-blue-gray-500 focus:z-10"
            @click="currentPage--"
          >
            Previous
          </button>
          <button
            type="button"
            class="relative inline-flex items-center rounded-md bg-white dark:bg-blue-gray-600 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-blue-gray-500 focus:z-10"
            :disabled="currentPage === totalPages"
            @click="currentPage++"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Add the error modal component at the end of the template -->
    <NotificationErrorModal
      :is-open="isErrorModalOpen"
      :notification-id="selectedNotification?.id || ''"
      :notification-type="selectedNotification?.type || 'email'"
      :error-message="selectedNotification?.error || 'No error information available'"
      :sent-at="selectedNotification?.sent_at || ''"
      @close="closeErrorModal"
    />
  </div>
</template>
