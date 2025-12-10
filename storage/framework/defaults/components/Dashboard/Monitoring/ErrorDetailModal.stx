<script lang="ts" setup>
import { ref, watch, onMounted } from 'vue'
import type { GroupedError, ErrorRecord } from '../../../functions/monitoring/errors'
import { useErrors } from '../../../functions/monitoring/errors'

interface Props {
  error: GroupedError | null
  isOpen: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'resolve', error: GroupedError): void
  (e: 'ignore', error: GroupedError): void
  (e: 'unresolve', error: GroupedError): void
  (e: 'delete', error: GroupedError): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { fetchErrorGroup } = useErrors()

const errorInstances = ref<ErrorRecord[]>([])
const isLoading = ref(false)
const activeTab = ref<'details' | 'events'>('details')

watch(() => [props.error, props.isOpen], async ([error, isOpen]) => {
  if (error && isOpen) {
    await loadErrorInstances()
  }
}, { immediate: true })

async function loadErrorInstances() {
  if (!props.error) return

  isLoading.value = true
  try {
    errorInstances.value = await fetchErrorGroup(props.error.type, props.error.message)
  } catch (error) {
    console.error('Failed to load error instances:', error)
  } finally {
    isLoading.value = false
  }
}

function handleClose() {
  emit('close')
}

function handleResolve() {
  if (props.error) {
    emit('resolve', props.error)
  }
}

function handleIgnore() {
  if (props.error) {
    emit('ignore', props.error)
  }
}

function handleUnresolve() {
  if (props.error) {
    emit('unresolve', props.error)
  }
}

function handleDelete() {
  if (props.error) {
    emit('delete', props.error)
  }
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'resolved':
      return 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400'
    case 'ignored':
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
    case 'unresolved':
    default:
      return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400'
  }
}

function getTypeClass(type: string): string {
  const typeLC = type.toLowerCase()
  if (typeLC.includes('error') || typeLC.includes('exception')) {
    return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400'
  }
  if (typeLC.includes('warning')) {
    return 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-400'
  }
  if (typeLC.includes('info')) {
    return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400'
  }
  return 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20 dark:bg-purple-900/30 dark:text-purple-400'
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) return `${diffDays}d ago`
  if (diffHours > 0) return `${diffHours}h ago`
  if (diffMins > 0) return `${diffMins}m ago`
  return 'Just now'
}
</script>

<template>
  <div v-if="isOpen && error" class="fixed inset-0 z-50 overflow-y-auto">
    <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-75" @click="handleClose" />

      <!-- Modal panel -->
      <div class="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl dark:bg-blue-gray-800">
        <!-- Header -->
        <div class="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-3">
                <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium" :class="getTypeClass(error.type)">
                  {{ error.type }}
                </span>
                <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium capitalize" :class="getStatusClass(error.status)">
                  {{ error.status }}
                </span>
              </div>
              <h3 class="mt-2 text-lg font-semibold text-gray-900 dark:text-white break-words">
                {{ error.message }}
              </h3>
              <div class="mt-1 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span class="flex items-center">
                  <div class="i-hugeicons-time-02 h-4 w-4 mr-1" />
                  First seen: {{ formatTimeAgo(error.first_seen) }}
                </span>
                <span class="flex items-center">
                  <div class="i-hugeicons-clock-02 h-4 w-4 mr-1" />
                  Last seen: {{ formatTimeAgo(error.last_seen) }}
                </span>
                <span class="flex items-center">
                  <div class="i-hugeicons-chart-line-data-01 h-4 w-4 mr-1" />
                  {{ error.count }} events
                </span>
              </div>
            </div>
            <button
              type="button"
              class="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
              @click="handleClose"
            >
              <div class="i-hugeicons-cancel-01 h-6 w-6" />
            </button>
          </div>

          <!-- Action buttons -->
          <div class="mt-4 flex gap-2">
            <button
              v-if="error.status !== 'resolved'"
              type="button"
              class="inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500"
              @click="handleResolve"
            >
              <div class="i-hugeicons-checkmark-circle-02 h-4 w-4 mr-1" />
              Resolve
            </button>
            <button
              v-if="error.status === 'resolved'"
              type="button"
              class="inline-flex items-center rounded-md bg-yellow-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yellow-500"
              @click="handleUnresolve"
            >
              <div class="i-hugeicons-refresh h-4 w-4 mr-1" />
              Reopen
            </button>
            <button
              v-if="error.status !== 'ignored'"
              type="button"
              class="inline-flex items-center rounded-md bg-gray-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-500"
              @click="handleIgnore"
            >
              <div class="i-hugeicons-eye-off h-4 w-4 mr-1" />
              Ignore
            </button>
            <button
              type="button"
              class="inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
              @click="handleDelete"
            >
              <div class="i-hugeicons-waste h-4 w-4 mr-1" />
              Delete
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="border-b border-gray-200 dark:border-gray-700">
          <nav class="flex -mb-px">
            <button
              :class="[
                'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              ]"
              @click="activeTab = 'details'"
            >
              Details
            </button>
            <button
              :class="[
                'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'events'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              ]"
              @click="activeTab = 'events'"
            >
              Events ({{ error.count }})
            </button>
          </nav>
        </div>

        <!-- Content -->
        <div class="px-6 py-4 max-h-[60vh] overflow-y-auto">
          <!-- Details Tab -->
          <div v-if="activeTab === 'details'">
            <!-- Stack Trace -->
            <div v-if="error.stack" class="mb-6">
              <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">Stack Trace</h4>
              <pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs leading-relaxed font-mono">{{ error.stack }}</pre>
            </div>

            <!-- Error Info -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">Error Type</h4>
                <p class="text-sm text-gray-600 dark:text-gray-300">{{ error.type }}</p>
              </div>
              <div>
                <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">Total Occurrences</h4>
                <p class="text-sm text-gray-600 dark:text-gray-300">{{ error.count }}</p>
              </div>
              <div>
                <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">First Occurrence</h4>
                <p class="text-sm text-gray-600 dark:text-gray-300">{{ formatDate(error.first_seen) }}</p>
              </div>
              <div>
                <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-2">Last Occurrence</h4>
                <p class="text-sm text-gray-600 dark:text-gray-300">{{ formatDate(error.last_seen) }}</p>
              </div>
            </div>
          </div>

          <!-- Events Tab -->
          <div v-if="activeTab === 'events'">
            <div v-if="isLoading" class="flex items-center justify-center py-8">
              <div class="i-hugeicons-loading-01 h-8 w-8 animate-spin text-blue-500" />
            </div>
            <div v-else-if="errorInstances.length === 0" class="text-center py-8 text-gray-500 dark:text-gray-400">
              No individual events found
            </div>
            <div v-else class="space-y-3">
              <div
                v-for="instance in errorInstances"
                :key="instance.id"
                class="bg-gray-50 dark:bg-blue-gray-700 rounded-lg p-4"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 text-sm">
                      <span class="text-gray-500 dark:text-gray-400">Event #{{ instance.id }}</span>
                      <span class="text-gray-400">|</span>
                      <span class="text-gray-600 dark:text-gray-300">{{ formatDate(instance.created_at) }}</span>
                    </div>
                    <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ instance.message }}</p>
                    <p v-if="instance.additional_info" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {{ instance.additional_info }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <div class="flex justify-end">
            <button
              type="button"
              class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
              @click="handleClose"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
