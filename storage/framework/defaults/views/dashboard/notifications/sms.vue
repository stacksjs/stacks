<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import NotificationStatusBadge from '../../../components/Dashboard/NotificationStatusBadge.vue'
import NotificationErrorModal from '../../../components/Dashboard/NotificationErrorModal.vue'

useHead({
  title: 'Dashboard - SMS Notifications',
})

interface SMSNotification {
  id: string
  recipient: string
  message: string
  status: 'sent' | 'delivered' | 'failed' | 'pending'
  sent_at: string
  delivered_at?: string
  error?: string
  metadata?: {
    sender: string
    country: string
    provider: string
    segments: number
    cost: number
  }
}

// Pagination and filtering state
const notifications = ref<SMSNotification[]>([])
const currentPage = ref(1)
const perPage = ref(10)
const totalNotifications = ref(0)
const isLoading = ref(true)
const searchQuery = ref('')
const selectedStatus = ref<string>('all')
const dateRange = ref<[string, string] | null>(null)
const showFilters = ref(false)
const sortField = ref<'sent_at' | 'delivered_at' | null>(null)
const sortDirection = ref<'asc' | 'desc'>('desc')

// Filter options
const statusTypes = ['all', 'sent', 'delivered', 'failed', 'pending']

// Add state for error modal
const isErrorModalOpen = ref(false)
const selectedNotification = ref<SMSNotification | null>(null)

// Generate mock data
const generateMockSMSNotifications = () => {
  const statuses = ['sent', 'delivered', 'failed', 'pending'] as const
  const messages = [
    'Your verification code is: 123456',
    'Your appointment is confirmed for tomorrow at 2 PM',
    'Your order has been shipped',
    'Your payment of $99.99 has been processed',
    'Your password has been reset',
    'Your account has been updated',
    'Your subscription will renew in 3 days',
    'Your 2FA code is: 987654',
  ]
  const countries = ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'JP', 'BR']
  const providers = ['Twilio', 'Nexmo', 'MessageBird', 'Plivo', 'Sinch']

  return Array.from({ length: 100 }, (_, i) => {
    const statusIndex = Math.min(Math.floor(Math.random() * statuses.length), statuses.length - 1)
    const messageIndex = Math.floor(Math.random() * messages.length)
    const countryIndex = Math.floor(Math.random() * countries.length)
    const providerIndex = Math.floor(Math.random() * providers.length)

    const status = statuses[statusIndex] as 'sent' | 'delivered' | 'failed' | 'pending'
    const message = messages[messageIndex] || 'SMS notification'
    const country = countries[countryIndex] || 'US'
    const provider = providers[providerIndex] || 'Twilio'
    const sent_at = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
    const delivered_at = status === 'delivered' ? new Date(new Date(sent_at).getTime() + Math.random() * 60000).toISOString() : undefined

    const notification: SMSNotification = {
      id: `${i + 1}`,
      recipient: `+1${Math.floor(Math.random() * 900) + 100}${Math.floor(Math.random() * 900) + 100}${Math.floor(Math.random() * 9000) + 1000}`,
      message,
      status,
      sent_at,
      delivered_at,
      error: status === 'failed' ? 'Failed to deliver SMS' : undefined,
      metadata: {
        sender: `+1${Math.floor(Math.random() * 900) + 100}${Math.floor(Math.random() * 900) + 100}${Math.floor(Math.random() * 9000) + 1000}`,
        country,
        provider,
        segments: Math.floor(Math.random() * 3) + 1,
        cost: parseFloat((Math.random() * 0.05 + 0.01).toFixed(4)),
      },
    }

    return notification
  })
}

// Computed properties for filtering
const filteredNotifications = computed(() => {
  return notifications.value.filter(notification => {
    if (selectedStatus.value !== 'all' && notification.status !== selectedStatus.value) return false
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      return notification.message.toLowerCase().includes(query) ||
             notification.recipient.toLowerCase().includes(query)
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
  console.log('Retrying SMS notification:', notificationId)
}

const resetFilters = () => {
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

// Function to open error modal
const openErrorModal = (notification: SMSNotification) => {
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
    notifications.value = generateMockSMSNotifications()
    totalNotifications.value = notifications.value.length
  } catch (error) {
    console.error('Failed to load SMS notifications:', error)
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
          <h1 class="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">SMS Notifications</h1>
          <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
            Manage and monitor all SMS notifications sent through the system
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
      <div v-if="showFilters" class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <!-- Search -->
        <div class="flex-1 min-w-0">
          <label for="search" class="sr-only">Search SMS notifications</label>
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
              placeholder="Search by phone number or message..."
            >
          </div>
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

      <!-- SMS Notification List -->
      <div class="mt-8 flow-root">
        <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 dark:ring-opacity-20 sm:rounded-lg">
              <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                <thead class="bg-gray-50 dark:bg-blue-gray-600">
                  <tr>
                    <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 sm:pl-6">Recipient</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Message</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Status</th>
                    <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Provider</th>
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
                    <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span class="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-600 bg-white dark:bg-blue-gray-700">
                  <tr v-if="isLoading">
                    <td colspan="6" class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                      <div class="flex justify-center">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                      </div>
                    </td>
                  </tr>
                  <tr v-else-if="paginatedNotifications.length === 0">
                    <td colspan="6" class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                      No SMS notifications found matching your criteria
                    </td>
                  </tr>
                  <tr v-for="notification in paginatedNotifications" :key="notification.id" class="hover:bg-gray-50 dark:hover:bg-blue-gray-600/50">
                    <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-100 sm:pl-6">
                      {{ notification.recipient }}
                    </td>
                    <td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <div class="max-w-xs truncate">{{ notification.message }}</div>
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm">
                      <NotificationStatusBadge :status="notification.status" />
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {{ notification.metadata?.provider }}
                    </td>
                    <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-right">
                      {{ formatDate(notification.sent_at) }}
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
      notification-type="sms"
      :error-message="selectedNotification?.error || 'Unknown error'"
      :sent-at="selectedNotification?.sent_at || ''"
      @close="closeErrorModal"
    />
  </div>
</template>
