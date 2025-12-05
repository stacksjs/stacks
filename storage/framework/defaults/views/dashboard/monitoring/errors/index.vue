<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import { useErrors } from '../../../../functions/monitoring/errors'
import type { GroupedError } from '../../../../functions/monitoring/errors'
import ErrorsTable from '../../../../components/Dashboard/Monitoring/ErrorsTable.vue'
import ErrorDetailModal from '../../../../components/Dashboard/Monitoring/ErrorDetailModal.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'

useHead({
  title: 'Dashboard - Error Tracking',
})

const {
  groupedErrors,
  errorStats,
  fetchGroupedErrors,
  fetchErrorStats,
  resolveErrorGroup,
  ignoreErrorGroup,
  unresolveErrorGroup,
  deleteErrorGroup,
} = useErrors()

// Fetch data on mount
onMounted(async () => {
  await Promise.all([
    fetchGroupedErrors(),
    fetchErrorStats(),
  ])
})

// Filters
const searchQuery = ref('')
const statusFilter = ref('all')
const typeFilter = ref('all')
const sortBy = ref('last_seen')
const sortOrder = ref('desc')
const currentPage = ref(1)
const itemsPerPage = ref(10)

// Modal state
const selectedError = ref<GroupedError | null>(null)
const isDetailModalOpen = ref(false)
const showDeleteModal = ref(false)
const errorToDelete = ref<GroupedError | null>(null)

// Get unique error types for filter
const uniqueTypes = computed(() => {
  const types = new Set(groupedErrors.value.map(e => e.type))
  return ['all', ...Array.from(types)]
})

// Available statuses
const statuses = ['all', 'unresolved', 'resolved', 'ignored'] as const

// Computed filtered errors
const filteredErrors = computed(() => {
  return groupedErrors.value
    .filter(error => {
      // Apply search filter
      const matchesSearch =
        error.type.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        error.message.toLowerCase().includes(searchQuery.value.toLowerCase())

      // Apply status filter
      const matchesStatus = statusFilter.value === 'all' || error.status === statusFilter.value

      // Apply type filter
      const matchesType = typeFilter.value === 'all' || error.type === typeFilter.value

      return matchesSearch && matchesStatus && matchesType
    })
    .sort((a, b) => {
      let comparison = 0
      if (sortBy.value === 'type') {
        comparison = a.type.localeCompare(b.type)
      } else if (sortBy.value === 'count') {
        comparison = a.count - b.count
      } else if (sortBy.value === 'last_seen') {
        comparison = new Date(a.last_seen).getTime() - new Date(b.last_seen).getTime()
      } else if (sortBy.value === 'first_seen') {
        comparison = new Date(a.first_seen).getTime() - new Date(b.first_seen).getTime()
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
})

const paginatedErrors = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredErrors.value.slice(start, end)
})

// Event handlers
function handleSearch(query: string) {
  searchQuery.value = query
  currentPage.value = 1
}

function handlePrevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

function handleNextPage() {
  const totalPages = Math.ceil(filteredErrors.value.length / itemsPerPage.value)
  if (currentPage.value < totalPages) {
    currentPage.value++
  }
}

function handlePageChange(page: number) {
  currentPage.value = page
}

function toggleSort(column: string) {
  if (sortBy.value === column) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = column
    sortOrder.value = 'desc'
  }
}

function viewError(error: GroupedError) {
  selectedError.value = error
  isDetailModalOpen.value = true
}

function closeDetailModal() {
  isDetailModalOpen.value = false
  selectedError.value = null
}

async function handleResolveError(error: GroupedError) {
  await resolveErrorGroup(error.type, error.message)
  await fetchErrorStats()
  if (isDetailModalOpen.value) {
    selectedError.value = { ...selectedError.value!, status: 'resolved' }
  }
}

async function handleIgnoreError(error: GroupedError) {
  await ignoreErrorGroup(error.type, error.message)
  await fetchErrorStats()
  if (isDetailModalOpen.value) {
    selectedError.value = { ...selectedError.value!, status: 'ignored' }
  }
}

async function handleUnresolveError(error: GroupedError) {
  await unresolveErrorGroup(error.type, error.message)
  await fetchErrorStats()
  if (isDetailModalOpen.value) {
    selectedError.value = { ...selectedError.value!, status: 'unresolved' }
  }
}

function openDeleteModal(error: GroupedError) {
  errorToDelete.value = error
  showDeleteModal.value = true
  // Close detail modal if open
  if (isDetailModalOpen.value) {
    isDetailModalOpen.value = false
  }
}

function closeDeleteModal() {
  showDeleteModal.value = false
  errorToDelete.value = null
}

async function confirmDelete() {
  if (!errorToDelete.value) return

  await deleteErrorGroup(errorToDelete.value.type, errorToDelete.value.message)
  await fetchErrorStats()
  closeDeleteModal()
}

function getTrendIcon(trend: number) {
  if (trend > 0) return 'i-hugeicons-arrow-up-02'
  if (trend < 0) return 'i-hugeicons-arrow-down-02'
  return 'i-hugeicons-minus-sign'
}

function getTrendClass(trend: number) {
  if (trend > 0) return 'text-red-600 dark:text-red-400'
  if (trend < 0) return 'text-green-600 dark:text-green-400'
  return 'text-gray-600 dark:text-gray-400'
}
</script>

<template>
  <div class="py-6">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Error Tracking</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Monitor and manage application errors. Similar errors are grouped together.
        </p>
      </div>

      <!-- Stats Cards -->
      <div v-if="errorStats" class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <!-- Total Errors -->
        <div class="bg-white dark:bg-blue-gray-800 overflow-hidden shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <div class="flex items-center">
              <div class="flex-shrink-0 bg-blue-500 rounded-md p-3">
                <div class="i-hugeicons-bug-01 h-6 w-6 text-white" />
              </div>
              <div class="ml-5 w-0 flex-1">
                <dl>
                  <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Errors</dt>
                  <dd class="flex items-baseline">
                    <div class="text-2xl font-semibold text-gray-900 dark:text-white">{{ errorStats.total }}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <!-- Unresolved -->
        <div class="bg-white dark:bg-blue-gray-800 overflow-hidden shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <div class="flex items-center">
              <div class="flex-shrink-0 bg-red-500 rounded-md p-3">
                <div class="i-hugeicons-alert-02 h-6 w-6 text-white" />
              </div>
              <div class="ml-5 w-0 flex-1">
                <dl>
                  <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Unresolved</dt>
                  <dd class="flex items-baseline">
                    <div class="text-2xl font-semibold text-gray-900 dark:text-white">{{ errorStats.unresolved }}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <!-- Last 24 Hours -->
        <div class="bg-white dark:bg-blue-gray-800 overflow-hidden shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <div class="flex items-center">
              <div class="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                <div class="i-hugeicons-time-02 h-6 w-6 text-white" />
              </div>
              <div class="ml-5 w-0 flex-1">
                <dl>
                  <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Last 24 Hours</dt>
                  <dd class="flex items-baseline">
                    <div class="text-2xl font-semibold text-gray-900 dark:text-white">{{ errorStats.last_24h }}</div>
                    <div v-if="errorStats.trend !== 0" class="ml-2 flex items-baseline text-sm font-semibold" :class="getTrendClass(errorStats.trend)">
                      <div :class="[getTrendIcon(errorStats.trend), 'h-4 w-4 mr-0.5']" />
                      {{ Math.abs(errorStats.trend) }}%
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <!-- Resolved -->
        <div class="bg-white dark:bg-blue-gray-800 overflow-hidden shadow rounded-lg">
          <div class="px-4 py-5 sm:p-6">
            <div class="flex items-center">
              <div class="flex-shrink-0 bg-green-500 rounded-md p-3">
                <div class="i-hugeicons-checkmark-circle-02 h-6 w-6 text-white" />
              </div>
              <div class="ml-5 w-0 flex-1">
                <dl>
                  <dt class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Resolved</dt>
                  <dd class="flex items-baseline">
                    <div class="text-2xl font-semibold text-gray-900 dark:text-white">{{ errorStats.resolved }}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div class="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-medium text-gray-900 dark:text-white">Issues</h2>
          </div>
          <div class="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <SearchFilter
              placeholder="Search errors..."
              class="w-full md:w-96"
              @search="handleSearch"
            />
            <div class="flex flex-col sm:flex-row gap-4">
              <select
                v-model="statusFilter"
                class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
              >
                <option v-for="status in statuses" :key="status" :value="status" class="capitalize">
                  {{ status === 'all' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1) }}
                </option>
              </select>

              <select
                v-model="typeFilter"
                class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
              >
                <option v-for="type in uniqueTypes" :key="type" :value="type">
                  {{ type === 'all' ? 'All Types' : type }}
                </option>
              </select>

              <select
                v-model="itemsPerPage"
                class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
              >
                <option :value="10">10 per page</option>
                <option :value="25">25 per page</option>
                <option :value="50">50 per page</option>
                <option :value="100">100 per page</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Errors Table -->
        <ErrorsTable
          :errors="paginatedErrors"
          :search-query="searchQuery"
          :status-filter="statusFilter"
          :type-filter="typeFilter"
          :sort-by="sortBy"
          :sort-order="sortOrder"
          @toggle-sort="toggleSort"
          @view-error="viewError"
          @resolve-error="handleResolveError"
          @ignore-error="handleIgnoreError"
          @unresolve-error="handleUnresolveError"
          @delete-error="openDeleteModal"
        />

        <!-- Pagination -->
        <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <Pagination
            :current-page="currentPage"
            :total-items="filteredErrors.length"
            :items-per-page="itemsPerPage"
            @prev="handlePrevPage"
            @next="handleNextPage"
            @page="handlePageChange"
          />
        </div>
      </div>
    </div>

    <!-- Error Detail Modal -->
    <ErrorDetailModal
      :error="selectedError"
      :is-open="isDetailModalOpen"
      @close="closeDetailModal"
      @resolve="handleResolveError"
      @ignore="handleIgnoreError"
      @unresolve="handleUnresolveError"
      @delete="openDeleteModal"
    />

    <!-- Delete Confirmation Modal -->
    <div v-if="showDeleteModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeDeleteModal" />

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
              <div class="i-hugeicons-alert-02 h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Delete Error Group</h3>
              <div class="mt-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Are you sure you want to delete all <strong>{{ errorToDelete?.count }}</strong> occurrences of this error? This action cannot be undone.
                </p>
                <p class="mt-2 text-sm text-gray-600 dark:text-gray-300 font-medium">
                  {{ errorToDelete?.message }}
                </p>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              class="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 sm:col-start-2"
              @click="confirmDelete"
            >
              Delete All Occurrences
            </button>
            <button
              type="button"
              class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
              @click="closeDeleteModal"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
