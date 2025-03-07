<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

useHead({
  title: 'Dashboard - Notifications',
})

interface NotificationStats {
  total_sent: number
  delivery_rate: number
  avg_delivery_time: number
}

interface NotificationEntry {
  id: string
  type: 'email' | 'sms' | 'push' | 'discord' | 'slack'
  recipient: string
  subject: string
  status: 'sent' | 'delivered' | 'failed' | 'pending'
  sent_at: string
  delivered_at?: string
  error?: string
}

interface ChannelStats {
  sent: number
  delivered: number
  failed: number
  pending: number
}

// Mock data for demonstration
const notificationStats = ref<NotificationStats>({
  total_sent: 45_678,
  delivery_rate: 98.5,
  avg_delivery_time: 1.2,
})

const channelStats = ref<Record<string, ChannelStats>>({
  email: {
    sent: 25_000,
    delivered: 24_800,
    failed: 150,
    pending: 50,
  },
  sms: {
    sent: 12_000,
    delivered: 11_900,
    failed: 80,
    pending: 20,
  },
  push: {
    sent: 5_000,
    delivered: 4_950,
    failed: 30,
    pending: 20,
  },
  discord: {
    sent: 2_000,
    delivered: 1_990,
    failed: 5,
    pending: 5,
  },
  slack: {
    sent: 1678,
    delivered: 1670,
    failed: 5,
    pending: 3,
  },
})

const recentNotifications = ref<NotificationEntry[]>([
  {
    id: '1',
    type: 'email',
    recipient: 'user@example.com',
    subject: 'Welcome to Our Platform',
    status: 'delivered',
    sent_at: '2024-03-14 10:15:23',
    delivered_at: '2024-03-14 10:15:25',
  },
  {
    id: '2',
    type: 'sms',
    recipient: '+1 (234) 567-890',
    subject: 'Your verification code: 123456',
    status: 'failed',
    sent_at: '2024-03-14 10:14:00',
    error: 'Invalid phone number',
  },
  {
    id: '3',
    type: 'push',
    recipient: 'device-token-123',
    subject: 'New message received',
    status: 'delivered',
    sent_at: '2024-03-14 10:16:00',
    delivered_at: '2024-03-14 10:16:02',
  },
  {
    id: '4',
    type: 'discord',
    recipient: 'Channel #announcements',
    subject: 'System update completed',
    status: 'delivered',
    sent_at: '2024-03-14 10:17:00',
    delivered_at: '2024-03-14 10:17:01',
  },
  {
    id: '5',
    type: 'slack',
    recipient: '#general',
    subject: 'Deployment successful',
    status: 'pending',
    sent_at: '2024-03-14 10:18:00',
  },
])

const timeRange = ref<'hour' | 'day' | 'week'>('hour')
const selectedChannel = ref<string>('all')
const isLoading = ref(false)

// Chart options
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(200, 200, 200, 0.1)',
      },
      ticks: {
        color: 'rgb(156, 163, 175)',
        font: {
          family: "'JetBrains Mono', monospace",
        },
      },
    },
    x: {
      grid: {
        display: false,
      },
      ticks: {
        color: 'rgb(156, 163, 175)',
        font: {
          family: "'JetBrains Mono', monospace",
        },
      },
    },
  },
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      align: 'end' as const,
      labels: {
        color: 'rgb(156, 163, 175)',
        font: {
          family: "'JetBrains Mono', monospace",
        },
        boxWidth: 12,
        padding: 15,
      },
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
    },
  },
  interaction: {
    mode: 'index' as const,
    intersect: false,
  },
}

// Generate mock volume data
const getVolumeData = () => {
  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`)
  return {
    labels,
    datasets: [
      {
        label: 'Email',
        data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 100) + 50),
        borderColor: 'rgb(59, 130, 246)', // Blue
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
      },
      {
        label: 'SMS',
        data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 50) + 20),
        borderColor: 'rgb(16, 185, 129)', // Green
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
      },
      {
        label: 'Push',
        data: Array.from({ length: 24 }, () => Math.floor(Math.random() * 30) + 10),
        borderColor: 'rgb(245, 158, 11)', // Yellow
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
      },
    ],
  }
}

// Generate mock delivery time data
const getDeliveryTimeData = () => {
  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`)
  return {
    labels,
    datasets: [{
      label: 'Average Delivery Time (seconds)',
      data: Array.from({ length: 24 }, () => Math.random() * 2 + 0.5),
      borderColor: 'rgb(139, 92, 246)', // Purple
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      fill: true,
    }],
  }
}

const volumeData = ref(getVolumeData())
const deliveryTimeData = ref(getDeliveryTimeData())

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

// Watch for time range changes
watch([timeRange, selectedChannel], async () => {
  isLoading.value = true
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500))
  volumeData.value = getVolumeData()
  deliveryTimeData.value = getDeliveryTimeData()
  isLoading.value = false
})

// Initial load
onMounted(async () => {
  isLoading.value = true
  await new Promise(resolve => setTimeout(resolve, 500))
  isLoading.value = false
})

// Add this helper function before the template
const formatNumber = (num: number): string => {
  return num.toLocaleString()
}
</script>

<template>
  <div class="min-h-screen py-4 dark:bg-blue-gray-800 lg:py-8">
    <!-- Stats Overview -->
    <div class="mb-8 px-4 lg:px-8 sm:px-6">
      <div>
        <h3 class="text-base text-gray-900 dark:text-gray-100 font-semibold leading-6">
          Notifications Overview
        </h3>

        <dl class="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3 sm:grid-cols-2">
          <div class="relative overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-hugeicons-notification-03 h-6 w-6 text-white" />
              </div>
              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-300 font-medium">
                Total Notifications
              </p>
            </dt>
            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 dark:text-gray-100 font-semibold">
                {{ formatNumber(notificationStats.total_sent) }}
              </p>
              <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
                <div class="i-hugeicons-arrow-up h-5 w-5 flex-shrink-0 self-center text-green-500" />
                <span class="sr-only">Increased by</span>
                122
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-hugeicons-checkmark-circle-02 h-6 w-6 text-white" />
              </div>
              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-300 font-medium">
                Delivery Rate
              </p>
            </dt>
            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 dark:text-gray-100 font-semibold">
                {{ notificationStats.delivery_rate }}%
              </p>
              <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
                <div class="i-hugeicons-arrow-up h-5 w-5 flex-shrink-0 self-center text-green-500" />
                <span class="sr-only">Increased by</span>
                0.5%
              </p>
            </dd>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-white dark:bg-blue-gray-700 px-4 pt-5 shadow sm:px-6 sm:pt-6">
            <dt>
              <div class="absolute rounded-md bg-blue-500 p-3">
                <div class="i-hugeicons-clock-01 h-6 w-6 text-white" />
              </div>
              <p class="ml-16 truncate text-sm text-gray-500 dark:text-gray-300 font-medium">
                Average Delivery Time
              </p>
            </dt>
            <dd class="ml-16 flex items-baseline pb-6 sm:pb-7">
              <p class="text-2xl text-gray-900 dark:text-gray-100 font-semibold">
                {{ notificationStats.avg_delivery_time }}s
              </p>
              <p class="ml-2 flex items-baseline text-sm text-green-600 font-semibold">
                <div class="i-hugeicons-arrow-down-02 h-5 w-5 flex-shrink-0 self-center text-green-500" />
                <span class="sr-only">Decreased by</span>
                0.1s
              </p>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <!-- Recent Notifications -->
    <div class="my-8 px-4 lg:px-8 sm:px-6">
      <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow">
        <div class="px-4 py-5 sm:p-6">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-gray-100">Recent Notifications</h3>
            <router-link
              to="/notifications/history"
              class="inline-flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <span>View All</span>
              <div class="i-hugeicons-arrow-right-01  h-4 w-4" />
            </router-link>
          </div>
          <div class="mt-4 flow-root">
            <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                <table class="min-w-full divide-y divide-gray-300 dark:divide-blue-gray-600">
                  <thead>
                    <tr>
                      <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 sm:pl-0">Type</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Recipient</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Subject</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">Status</th>
                      <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">Sent</th>
                      <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">Delivered</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 dark:divide-blue-gray-600">
                    <tr v-for="notification in recentNotifications" :key="notification.id">
                      <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-gray-100 sm:pl-0">
                        <div class="flex items-center">
                          <div :class="getChannelIcon(notification.type)" class="h-5 w-5 mr-2" />
                          <span class="capitalize">{{ notification.type }}</span>
                        </div>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{{ notification.recipient }}</td>
                      <td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">{{ notification.subject }}</td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm">
                        <span
                          class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset"
                          :class="getStatusColor(notification.status)"
                        >
                          {{ notification.status }}
                        </span>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-right">{{ notification.sent_at }}</td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-right">{{ notification.delivered_at || '-' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Notification Performance -->
    <div class="px-4 lg:px-8 sm:px-6">
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <!-- Volume Chart -->
        <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow">
          <div class="p-6">
            <div class="flex items-center justify-between mb-6">
              <div>
                <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Notification Volume</h3>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Notifications sent by channel</p>
              </div>
              <div class="flex items-center space-x-4">
                <select
                  v-model="timeRange"
                  class="h-9 text-sm border-0 rounded-md bg-gray-50 dark:bg-blue-gray-600 py-1.5 pl-3 pr-8 text-gray-900 dark:text-gray-100 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:ring-2 focus:ring-blue-600"
                >
                  <option value="hour">Last Hour</option>
                  <option value="day">Last 24 Hours</option>
                  <option value="week">Last Week</option>
                </select>
              </div>
            </div>
            <div class="h-[300px] relative">
              <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 dark:bg-blue-gray-700 dark:bg-opacity-75 z-10">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
              <Line :data="volumeData" :options="chartOptions" />
            </div>
          </div>
        </div>

        <!-- Delivery Time Chart -->
        <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow">
          <div class="p-6">
            <div class="flex items-center justify-between mb-6">
              <div>
                <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Delivery Time</h3>
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Average time to deliver notifications</p>
              </div>
            </div>
            <div class="h-[300px] relative">
              <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 dark:bg-blue-gray-700 dark:bg-opacity-75 z-10">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
              <Line :data="deliveryTimeData" :options="chartOptions" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Channel Stats -->
    <div class="mt-8 px-4 lg:px-8 sm:px-6">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto">
          <h3 class="text-base font-medium text-gray-900 dark:text-gray-100">Channel Statistics</h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Detailed breakdown by notification channel</p>
        </div>
      </div>

      <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 sm:grid-cols-2">
        <div v-for="(stats, name) in channelStats" :key="name" class="bg-white dark:bg-blue-gray-700 rounded-lg shadow p-6">
          <div class="flex items-center justify-between mb-6">
            <h4 class="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-blue-gray-600 dark:text-gray-200">
              <div :class="getChannelIcon(name)" class="h-4 w-4" />
              <span class="capitalize">{{ name }}</span>
            </h4>
          </div>

          <div class="space-y-6">
            <!-- Channel Stats -->
            <div class="grid grid-cols-4 gap-4">
              <div v-for="(value, status) in stats" :key="status" class="text-center">
                <div class="text-2xl font-semibold font-mono" :class="{
                  'text-blue-600 dark:text-blue-400': status === 'sent',
                  'text-green-600 dark:text-green-400': status === 'delivered',
                  'text-yellow-600 dark:text-yellow-400': status === 'pending',
                  'text-red-600 dark:text-red-400': status === 'failed'
                }">{{ formatNumber(value) }}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 capitalize">{{ status }}</div>
              </div>
            </div>

            <!-- Delivery Progress -->
            <div class="h-2.5 bg-gray-100 dark:bg-blue-gray-600 rounded-full overflow-hidden">
              <div class="flex h-full">
                <div class="bg-green-500 h-full" :style="{ width: `${(stats.delivered / stats.sent) * 100}%` }" />
                <div class="bg-red-500 h-full" :style="{ width: `${(stats.failed / stats.sent) * 100}%` }" />
              </div>
            </div>
            <div class="flex justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Success Rate: {{ ((stats.delivered / stats.sent) * 100).toFixed(1) }}%</span>
              <span>Failure Rate: {{ ((stats.failed / stats.sent) * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
