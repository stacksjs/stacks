<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  isOpen: boolean
  notificationId: string
  notificationType: 'email' | 'sms' | 'push' | 'discord' | 'slack'
  errorMessage: string
  sentAt: string
}

const props = defineProps<Props>()
const emit = defineEmits(['close'])

// Mock log data
interface LogEntry {
  timestamp: string
  level: 'info' | 'warning' | 'error'
  message: string
  context?: Record<string, any>
}

const logs = ref<LogEntry[]>([])
const isLoadingLogs = ref(false)

// Generate mock logs based on the notification
const generateMockLogs = (notificationId: string, notificationType: string, errorMessage: string, sentAt: string) => {
  const sentDate = new Date(sentAt)
  const logs: LogEntry[] = []

  // Add initial attempt log
  logs.push({
    timestamp: sentDate.toISOString(),
    level: 'info',
    message: `Attempting to send ${notificationType} notification (ID: ${notificationId})`,
    context: {
      notification_id: notificationId,
      type: notificationType
    }
  })

  // Add processing log
  logs.push({
    timestamp: new Date(sentDate.getTime() + 100).toISOString(),
    level: 'info',
    message: `Processing ${notificationType} notification`,
    context: {
      notification_id: notificationId,
      type: notificationType
    }
  })

  // Add provider connection log
  logs.push({
    timestamp: new Date(sentDate.getTime() + 200).toISOString(),
    level: 'info',
    message: `Connecting to ${notificationType === 'email' ? 'SMTP server' : notificationType === 'sms' ? 'SMS gateway' : 'notification service'}`,
    context: {
      notification_id: notificationId,
      provider: notificationType === 'email' ? 'SendGrid' : notificationType === 'sms' ? 'Twilio' : 'FCM'
    }
  })

  // Add warning log
  logs.push({
    timestamp: new Date(sentDate.getTime() + 300).toISOString(),
    level: 'warning',
    message: `Slow response from ${notificationType === 'email' ? 'SMTP server' : notificationType === 'sms' ? 'SMS gateway' : 'notification service'}`,
    context: {
      notification_id: notificationId,
      response_time: '1.5s'
    }
  })

  // Add error log
  logs.push({
    timestamp: new Date(sentDate.getTime() + 500).toISOString(),
    level: 'error',
    message: `Failed to send ${notificationType} notification: ${errorMessage}`,
    context: {
      notification_id: notificationId,
      error: errorMessage,
      stack_trace: "Error: Failed to send notification\n    at SendService.send (/app/services/notifications/send.js:42:23)\n    at async NotificationController.sendNotification (/app/controllers/NotificationController.js:87:12)"
    }
  })

  // Add retry log
  logs.push({
    timestamp: new Date(sentDate.getTime() + 1000).toISOString(),
    level: 'info',
    message: `Scheduling retry for ${notificationType} notification (ID: ${notificationId})`,
    context: {
      notification_id: notificationId,
      retry_count: 1,
      next_retry: new Date(sentDate.getTime() + 60000).toISOString()
    }
  })

  return logs
}

// Load logs when the modal opens
watch(() => props.isOpen, (isOpen) => {
  if (isOpen && props.notificationId) {
    isLoadingLogs.value = true

    // Simulate API call to fetch logs
    setTimeout(() => {
      logs.value = generateMockLogs(
        props.notificationId,
        props.notificationType,
        props.errorMessage,
        props.sentAt
      )
      isLoadingLogs.value = false
    }, 500)
  }
})

// Format date for display
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString()
}

// Get CSS class for log level
const getLogLevelClass = (level: string) => {
  switch (level) {
    case 'error':
      return 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30'
    case 'warning':
      return 'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30'
    case 'info':
    default:
      return 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
  }
}

// Close the modal
const closeModal = () => {
  emit('close')
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
      <!-- Background overlay -->
      <div class="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" aria-hidden="true" @click="closeModal"></div>

      <!-- Modal panel -->
      <div class="inline-block align-bottom bg-white dark:bg-blue-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
        <div class="bg-white dark:bg-blue-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div class="sm:flex sm:items-start">
            <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 sm:mx-0 sm:h-10 sm:w-10">
              <div class="i-hugeicons-alert-triangle h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
              <h3 class="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100" id="modal-title">
                Notification Error Details
              </h3>

              <!-- Error details section -->
              <div class="mt-4 bg-red-50 dark:bg-red-900/30 p-4 rounded-md">
                <div class="flex">
                  <div class="flex-shrink-0">
                    <div class="i-hugeicons-alert-circle h-5 w-5 text-red-400" />
                  </div>
                  <div class="ml-3">
                    <h3 class="text-sm font-medium text-red-800 dark:text-red-300">Error Message</h3>
                    <div class="mt-2 text-sm text-red-700 dark:text-red-200">
                      <p>{{ errorMessage }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Logs section -->
              <div class="mt-4">
                <h4 class="text-md font-medium text-gray-900 dark:text-gray-100">Notification Logs</h4>
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Detailed logs for {{ notificationType.toUpperCase() }} notification ID: {{ notificationId }}
                </p>

                <!-- Loading state -->
                <div v-if="isLoadingLogs" class="flex justify-center py-8">
                  <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>

                <!-- Logs table -->
                <div v-else class="mt-2 overflow-hidden shadow ring-1 ring-black ring-opacity-5 dark:ring-opacity-20 sm:rounded-lg">
                  <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                    <thead class="bg-gray-50 dark:bg-blue-gray-700">
                      <tr>
                        <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 sm:pl-6">Timestamp</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Level</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Message</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Context</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-gray-600 bg-white dark:bg-blue-gray-800">
                      <tr v-for="(log, index) in logs" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50">
                        <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500 dark:text-gray-400 sm:pl-6">
                          {{ formatDate(log.timestamp) }}
                        </td>
                        <td class="px-3 py-4 text-sm">
                          <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium" :class="getLogLevelClass(log.level)">
                            {{ log.level.toUpperCase() }}
                          </span>
                        </td>
                        <td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {{ log.message }}
                        </td>
                        <td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                          <pre v-if="log.context" class="text-xs overflow-x-auto max-w-xs">{{ JSON.stringify(log.context, null, 2) }}</pre>
                          <span v-else>-</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="bg-gray-50 dark:bg-blue-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
          <button
            type="button"
            class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-blue-gray-600 text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-blue-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            @click="closeModal"
          >
            Close
          </button>
          <button
            type="button"
            class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
            @click="closeModal"
          >
            Download Logs
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
