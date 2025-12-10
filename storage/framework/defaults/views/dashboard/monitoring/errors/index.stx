<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import { useErrors } from '../../../../functions/monitoring/errors'
import type { GroupedError } from '../../../../functions/monitoring/errors'
import DashboardLayout from '../../../../components/Dashboard/DashboardLayout.vue'
import { StatsCard, Card, Button, Input, Select, Badge, Table, Pagination, Modal } from '../../../../components/Dashboard/UI'

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
const statusFilter = ref<string | null>(null)
const typeFilter = ref<string | null>(null)
const sortBy = ref('last_seen')
const sortOrder = ref<'asc' | 'desc'>('desc')
const currentPage = ref(1)
const itemsPerPage = ref(10)

// Modal state
const selectedError = ref<GroupedError | null>(null)
const isDetailModalOpen = ref(false)
const showDeleteModal = ref(false)
const errorToDelete = ref<GroupedError | null>(null)

// Get unique error types for filter
const typeOptions = computed(() => {
  const types = new Set(groupedErrors.value.map(e => e.type))
  return [
    { value: '', label: 'All Types' },
    ...Array.from(types).map(type => ({ value: type, label: type }))
  ]
})

// Status options
const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'unresolved', label: 'Unresolved' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'ignored', label: 'Ignored' },
]

// Table columns
const columns = [
  { key: 'type', label: 'Type', sortable: true },
  { key: 'message', label: 'Message', sortable: false },
  { key: 'count', label: 'Events', sortable: true, align: 'center' as const },
  { key: 'status', label: 'Status', sortable: false, align: 'center' as const },
  { key: 'last_seen', label: 'Last Seen', sortable: true, align: 'right' as const },
]

// Computed filtered errors
const filteredErrors = computed(() => {
  return groupedErrors.value
    .filter(error => {
      const matchesSearch = !searchQuery.value ||
        error.type.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        error.message.toLowerCase().includes(searchQuery.value.toLowerCase())

      const matchesStatus = !statusFilter.value || error.status === statusFilter.value
      const matchesType = !typeFilter.value || error.type === typeFilter.value

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

const totalPages = computed(() => Math.ceil(filteredErrors.value.length / itemsPerPage.value))

// Event handlers
function handleSort(column: string, direction: 'asc' | 'desc') {
  sortBy.value = column
  sortOrder.value = direction
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
  if (isDetailModalOpen.value && selectedError.value) {
    selectedError.value = { ...selectedError.value, status: 'resolved' }
  }
}

async function handleIgnoreError(error: GroupedError) {
  await ignoreErrorGroup(error.type, error.message)
  await fetchErrorStats()
  if (isDetailModalOpen.value && selectedError.value) {
    selectedError.value = { ...selectedError.value, status: 'ignored' }
  }
}

async function handleUnresolveError(error: GroupedError) {
  await unresolveErrorGroup(error.type, error.message)
  await fetchErrorStats()
  if (isDetailModalOpen.value && selectedError.value) {
    selectedError.value = { ...selectedError.value, status: 'unresolved' }
  }
}

function openDeleteModal(error: GroupedError) {
  errorToDelete.value = error
  showDeleteModal.value = true
  if (isDetailModalOpen.value) {
    isDetailModalOpen.value = false
  }
}

async function confirmDelete() {
  if (!errorToDelete.value) return
  await deleteErrorGroup(errorToDelete.value.type, errorToDelete.value.message)
  await fetchErrorStats()
  showDeleteModal.value = false
  errorToDelete.value = null
}

function getStatusVariant(status: string): 'danger' | 'success' | 'warning' | 'default' {
  const variants: Record<string, 'danger' | 'success' | 'warning' | 'default'> = {
    unresolved: 'danger',
    resolved: 'success',
    ignored: 'warning',
  }
  return variants[status] || 'default'
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString()
}

function formatRelativeTime(date: string): string {
  const now = new Date()
  const errorDate = new Date(date)
  const diffMs = now.getTime() - errorDate.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return errorDate.toLocaleDateString()
}
</script>

<template>
  <DashboardLayout>
    <!-- Page Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-semibold text-neutral-900 dark:text-white">Error Tracking</h1>
      <p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Monitor and manage application errors. Similar errors are grouped together.
      </p>
    </div>

    <!-- Stats Cards -->
    <div v-if="errorStats" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      <StatsCard
        title="Total Errors"
        :value="errorStats.total"
        icon="i-hugeicons-bug-01"
        icon-bg="primary"
      />
      <StatsCard
        title="Unresolved"
        :value="errorStats.unresolved"
        icon="i-hugeicons-alert-02"
        icon-bg="danger"
      />
      <StatsCard
        title="Last 24 Hours"
        :value="errorStats.last_24h"
        :trend="errorStats.trend"
        trend-label="vs previous period"
        icon="i-hugeicons-time-02"
        icon-bg="warning"
      />
      <StatsCard
        title="Resolved"
        :value="errorStats.resolved"
        icon="i-hugeicons-checkmark-circle-02"
        icon-bg="success"
      />
    </div>

    <!-- Main Content -->
    <Card>
      <template #header>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 class="text-lg font-semibold text-neutral-900 dark:text-white">Issues</h2>
          <div class="flex flex-col sm:flex-row gap-3">
            <Input
              v-model="searchQuery"
              placeholder="Search errors..."
              size="sm"
              class="w-full sm:w-64"
            >
              <template #iconLeft>
                <div class="i-hugeicons-search-01 w-4 h-4" />
              </template>
            </Input>
            <Select
              v-model="statusFilter"
              :options="statusOptions"
              placeholder="Status"
              size="sm"
              class="w-full sm:w-40"
            />
            <Select
              v-model="typeFilter"
              :options="typeOptions"
              placeholder="Type"
              size="sm"
              class="w-full sm:w-40"
            />
          </div>
        </div>
      </template>

      <!-- Errors Table -->
      <Table
        :columns="columns"
        :data="paginatedErrors"
        row-key="id"
        hoverable
        :empty-title="searchQuery || statusFilter || typeFilter ? 'No matching errors' : 'No errors found'"
        :empty-description="searchQuery || statusFilter || typeFilter ? 'Try adjusting your filters' : 'Your application is running smoothly!'"
        @sort="handleSort"
        @row-click="viewError"
      >
        <template #cell-type="{ value }">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200">
            {{ value }}
          </span>
        </template>

        <template #cell-message="{ value }">
          <span class="text-neutral-700 dark:text-neutral-200 line-clamp-1">
            {{ value }}
          </span>
        </template>

        <template #cell-count="{ value }">
          <span class="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200">
            {{ value }}
          </span>
        </template>

        <template #cell-status="{ value }">
          <Badge :variant="getStatusVariant(value)" size="sm">
            {{ value }}
          </Badge>
        </template>

        <template #cell-last_seen="{ value }">
          <span class="text-sm text-neutral-500 dark:text-neutral-400">
            {{ formatRelativeTime(value) }}
          </span>
        </template>

        <template #actions="{ row }">
          <div class="flex items-center gap-1">
            <Button
              v-if="row.status === 'unresolved'"
              variant="ghost"
              size="sm"
              title="Resolve"
              @click.stop="handleResolveError(row)"
            >
              <div class="i-hugeicons-checkmark-circle-02 w-4 h-4 text-green-600" />
            </Button>
            <Button
              v-if="row.status === 'unresolved'"
              variant="ghost"
              size="sm"
              title="Ignore"
              @click.stop="handleIgnoreError(row)"
            >
              <div class="i-hugeicons-eye-off w-4 h-4 text-amber-600" />
            </Button>
            <Button
              v-if="row.status !== 'unresolved'"
              variant="ghost"
              size="sm"
              title="Unresolve"
              @click.stop="handleUnresolveError(row)"
            >
              <div class="i-hugeicons-refresh w-4 h-4 text-blue-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="Delete"
              @click.stop="openDeleteModal(row)"
            >
              <div class="i-hugeicons-delete-02 w-4 h-4 text-red-600" />
            </Button>
          </div>
        </template>
      </Table>

      <!-- Pagination -->
      <template #footer>
        <Pagination
          v-model:current-page="currentPage"
          :total-pages="totalPages"
          :total-items="filteredErrors.length"
          :items-per-page="itemsPerPage"
          show-total-items
        />
      </template>
    </Card>

    <!-- Error Detail Modal -->
    <Modal
      v-model="isDetailModalOpen"
      :title="selectedError?.type || 'Error Details'"
      size="lg"
    >
      <div v-if="selectedError" class="space-y-6">
        <!-- Error Message -->
        <div>
          <h4 class="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">Message</h4>
          <p class="text-neutral-900 dark:text-white bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3">
            {{ selectedError.message }}
          </p>
        </div>

        <!-- Stats Row -->
        <div class="grid grid-cols-3 gap-4">
          <div class="text-center p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
            <div class="text-2xl font-semibold text-neutral-900 dark:text-white">{{ selectedError.count }}</div>
            <div class="text-sm text-neutral-500 dark:text-neutral-400">Occurrences</div>
          </div>
          <div class="text-center p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
            <div class="text-sm font-medium text-neutral-900 dark:text-white">{{ formatDate(selectedError.first_seen) }}</div>
            <div class="text-sm text-neutral-500 dark:text-neutral-400">First Seen</div>
          </div>
          <div class="text-center p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
            <div class="text-sm font-medium text-neutral-900 dark:text-white">{{ formatDate(selectedError.last_seen) }}</div>
            <div class="text-sm text-neutral-500 dark:text-neutral-400">Last Seen</div>
          </div>
        </div>

        <!-- Stack Trace (if available) -->
        <div v-if="selectedError.stack_trace">
          <h4 class="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">Stack Trace</h4>
          <pre class="text-xs text-neutral-700 dark:text-neutral-300 bg-neutral-900 dark:bg-black rounded-lg p-4 overflow-x-auto max-h-64">{{ selectedError.stack_trace }}</pre>
        </div>

        <!-- Status -->
        <div class="flex items-center gap-2">
          <span class="text-sm text-neutral-500 dark:text-neutral-400">Status:</span>
          <Badge :variant="getStatusVariant(selectedError.status)">
            {{ selectedError.status }}
          </Badge>
        </div>
      </div>

      <template #footer="{ close }">
        <div class="flex items-center justify-between w-full">
          <div class="flex items-center gap-2">
            <Button
              v-if="selectedError?.status === 'unresolved'"
              variant="primary"
              size="sm"
              @click="handleResolveError(selectedError!)"
            >
              <template #iconLeft>
                <div class="i-hugeicons-checkmark-circle-02 w-4 h-4" />
              </template>
              Resolve
            </Button>
            <Button
              v-if="selectedError?.status === 'unresolved'"
              variant="outline"
              size="sm"
              @click="handleIgnoreError(selectedError!)"
            >
              <template #iconLeft>
                <div class="i-hugeicons-eye-off w-4 h-4" />
              </template>
              Ignore
            </Button>
            <Button
              v-if="selectedError?.status !== 'unresolved'"
              variant="outline"
              size="sm"
              @click="handleUnresolveError(selectedError!)"
            >
              <template #iconLeft>
                <div class="i-hugeicons-refresh w-4 h-4" />
              </template>
              Unresolve
            </Button>
          </div>
          <div class="flex items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              @click="openDeleteModal(selectedError!)"
            >
              <template #iconLeft>
                <div class="i-hugeicons-delete-02 w-4 h-4" />
              </template>
              Delete
            </Button>
            <Button variant="ghost" size="sm" @click="close">
              Close
            </Button>
          </div>
        </div>
      </template>
    </Modal>

    <!-- Delete Confirmation Modal -->
    <Modal
      v-model="showDeleteModal"
      title="Delete Error Group"
      size="sm"
    >
      <div class="text-center">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
          <div class="i-hugeicons-alert-02 h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <p class="text-sm text-neutral-600 dark:text-neutral-300">
          Are you sure you want to delete all <strong>{{ errorToDelete?.count }}</strong> occurrences of this error? This action cannot be undone.
        </p>
        <p class="mt-2 text-sm font-medium text-neutral-900 dark:text-white">
          {{ errorToDelete?.message }}
        </p>
      </div>

      <template #footer>
        <div class="flex items-center justify-end gap-3 w-full">
          <Button variant="ghost" @click="showDeleteModal = false">
            Cancel
          </Button>
          <Button variant="danger" @click="confirmDelete">
            Delete All
          </Button>
        </div>
      </template>
    </Modal>
  </DashboardLayout>
</template>
