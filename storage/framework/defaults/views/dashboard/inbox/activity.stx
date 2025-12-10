<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import { useRouter } from 'vue-router'
import { Line, Bar, Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
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
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

import EmailSidebar from '../../../components/Dashboard/Email/EmailSidebar.vue'

useHead({
  title: 'Mail - Activity Dashboard',
})

const router = useRouter()

// Time range state
const timeRange = ref<'day' | 'week' | 'month' | 'year'>('week')
const activeFolder = ref('inbox')
const isLoading = ref(false)

// Folder structure
const folders = [
  { id: 'inbox', name: 'Inbox', icon: 'inbox' },
  { id: 'starred', name: 'Starred', icon: 'star' },
  { id: 'sent', name: 'Sent', icon: 'mail-send-01' },
  { id: 'drafts', name: 'Drafts', icon: 'license-draft' },
  { id: 'archive', name: 'Archive', icon: 'archive' },
  { id: 'spam', name: 'Spam', icon: 'spam' },
  { id: 'trash', name: 'Trash', icon: 'waste' },
]

// Mock unread counts
const unreadCounts = computed(() => {
  return {
    inbox: 2,
    starred: 1,
    sent: 0,
    drafts: 0,
    archive: 0,
    spam: 1,
    trash: 0,
  }
})

// Chart options
const lineChartOptions = {
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
}

const barChartOptions = {
  ...lineChartOptions,
  plugins: {
    ...lineChartOptions.plugins,
    legend: {
      ...lineChartOptions.plugins.legend,
      display: false,
    },
  },
}

const doughnutChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'right' as const,
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
}

// Generate mock email activity data
const getEmailActivityData = () => {
  let labels: string[] = []
  let dataPoints: number = 0

  if (timeRange.value === 'day') {
    labels = Array.from({ length: 24 }, (_, i) => `${i}:00`)
    dataPoints = 24
  } else if (timeRange.value === 'week') {
    labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    dataPoints = 7
  } else if (timeRange.value === 'month') {
    labels = Array.from({ length: 30 }, (_, i) => `${i + 1}`)
    dataPoints = 30
  } else {
    labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    dataPoints = 12
  }

  return {
    labels,
    datasets: [
      {
        label: 'Received',
        data: Array.from({ length: dataPoints }, () => Math.floor(Math.random() * 50) + 20),
        borderColor: 'rgb(59, 130, 246)', // Blue
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
      },
      {
        label: 'Sent',
        data: Array.from({ length: dataPoints }, () => Math.floor(Math.random() * 30) + 10),
        borderColor: 'rgb(16, 185, 129)', // Green
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
      },
      {
        label: 'Spam',
        data: Array.from({ length: dataPoints }, () => Math.floor(Math.random() * 10)),
        borderColor: 'rgb(239, 68, 68)', // Red
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
      },
    ],
  }
}

// Generate mock response time data
const getResponseTimeData = () => {
  let labels: string[] = []
  let dataPoints: number = 0

  if (timeRange.value === 'day') {
    labels = Array.from({ length: 24 }, (_, i) => `${i}:00`)
    dataPoints = 24
  } else if (timeRange.value === 'week') {
    labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    dataPoints = 7
  } else if (timeRange.value === 'month') {
    labels = Array.from({ length: 30 }, (_, i) => `${i + 1}`)
    dataPoints = 30
  } else {
    labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    dataPoints = 12
  }

  return {
    labels,
    datasets: [
      {
        label: 'Response Time (minutes)',
        data: Array.from({ length: dataPoints }, () => Math.floor(Math.random() * 60) + 5),
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
      },
    ],
  }
}

// Generate mock email category data
const getEmailCategoryData = () => {
  return {
    labels: ['Work', 'Personal', 'Promotions', 'Updates', 'Forums'],
    datasets: [
      {
        data: [45, 25, 15, 10, 5],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)', // Blue
          'rgba(16, 185, 129, 0.8)', // Green
          'rgba(245, 158, 11, 0.8)', // Yellow
          'rgba(99, 102, 241, 0.8)', // Indigo
          'rgba(239, 68, 68, 0.8)', // Red
        ],
        borderWidth: 0,
      },
    ],
  }
}

// Generate mock device usage data
const getDeviceUsageData = () => {
  return {
    labels: ['Desktop', 'Mobile', 'Tablet'],
    datasets: [
      {
        data: [65, 30, 5],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)', // Blue
          'rgba(16, 185, 129, 0.8)', // Green
          'rgba(245, 158, 11, 0.8)', // Yellow
        ],
        borderWidth: 0,
      },
    ],
  }
}

// Initialize chart data
const emailActivityData = ref(getEmailActivityData())
const responseTimeData = ref(getResponseTimeData())
const emailCategoryData = ref(getEmailCategoryData())
const deviceUsageData = ref(getDeviceUsageData())

// Stats data
const stats = ref([
  { name: 'Total Emails', value: '1,284', change: '+12.3%', icon: 'i-hugeicons-mail-02 text-blue-500' },
  { name: 'Average Response Time', value: '28 min', change: '-8.1%', icon: 'i-hugeicons-clock-01 text-green-500' },
  { name: 'Spam Detected', value: '124', change: '+3.2%', icon: 'i-hugeicons-spam text-red-500' },
  { name: 'Attachments', value: '256', change: '+18.7%', icon: 'i-hugeicons-attachment-01 text-purple-500' },
])

// Update data when time range changes
const updateChartData = async () => {
  isLoading.value = true
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500))
  emailActivityData.value = getEmailActivityData()
  responseTimeData.value = getResponseTimeData()
  isLoading.value = false
}

// Watch for time range changes
const changeTimeRange = async (newRange: 'day' | 'week' | 'month' | 'year') => {
  timeRange.value = newRange
  await updateChartData()
}

// Function to handle folder change
const handleFolderChange = (folder: string) => {
  // Update the active folder
  activeFolder.value = folder
  // Navigate to the inbox page with the selected folder
  router.push({
    path: '/inbox',
    query: { folder }
  })
}

// Function to handle compose
const handleCompose = () => {
  router.push('/inbox?compose=true')
}

// Initial load
onMounted(async () => {
  isLoading.value = true
  await new Promise(resolve => setTimeout(resolve, 500))
  isLoading.value = false
})
</script>

<template>
  <div class="min-h-screen dark:bg-blue-gray-800">
    <div class="flex h-screen">
      <!-- Sidebar -->
      <EmailSidebar
        :active-folder="activeFolder"
        :folders="folders"
        :unread-counts="unreadCounts"
        @update:active-folder="(folder) => { activeFolder = folder; handleFolderChange(folder); }"
        @compose="handleCompose"
      />

      <!-- Main Content -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="bg-white dark:bg-blue-gray-700 border-b border-gray-200 dark:border-blue-gray-600 py-4 px-6">
          <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Email Activity</h1>
            <div class="flex space-x-2">
              <button
                @click="changeTimeRange('day')"
                :class="[
                  'px-3 py-1.5 text-sm font-medium rounded-md',
                  timeRange === 'day'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-blue-gray-600'
                ]"
              >
                Day
              </button>
              <button
                @click="changeTimeRange('week')"
                :class="[
                  'px-3 py-1.5 text-sm font-medium rounded-md',
                  timeRange === 'week'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-blue-gray-600'
                ]"
              >
                Week
              </button>
              <button
                @click="changeTimeRange('month')"
                :class="[
                  'px-3 py-1.5 text-sm font-medium rounded-md',
                  timeRange === 'month'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-blue-gray-600'
                ]"
              >
                Month
              </button>
              <button
                @click="changeTimeRange('year')"
                :class="[
                  'px-3 py-1.5 text-sm font-medium rounded-md',
                  timeRange === 'year'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-blue-gray-600'
                ]"
              >
                Year
              </button>
            </div>
          </div>
        </div>

        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6">
          <div v-for="(stat, index) in stats" :key="index" class="bg-white dark:bg-blue-gray-700 rounded-lg shadow p-4">
            <div class="flex items-center">
              <div class="flex-shrink-0 p-3 rounded-md bg-gray-100 dark:bg-blue-gray-600">
                <i :class="stat.icon + ' text-xl'"></i>
              </div>
              <div class="ml-4">
                <p class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ stat.name }}</p>
                <div class="flex items-baseline">
                  <p class="text-2xl font-semibold text-gray-900 dark:text-white">{{ stat.value }}</p>
                  <p :class="[
                    'ml-2 text-sm font-medium',
                    stat.change.startsWith('+') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  ]">
                    {{ stat.change }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Charts -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <!-- Email Activity Chart -->
          <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow p-4">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100">Email Volume</h2>
            </div>
            <div class="h-80 relative">
              <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 dark:bg-blue-gray-700 dark:bg-opacity-75 z-10">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
              <Line :data="emailActivityData" :options="lineChartOptions" />
            </div>
          </div>

          <!-- Response Time Chart -->
          <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow p-4">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100">Average Response Time</h2>
            </div>
            <div class="h-64 relative">
              <div v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 dark:bg-blue-gray-700 dark:bg-opacity-75 z-10">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
              <Bar :data="responseTimeData" :options="barChartOptions" />
            </div>
          </div>

          <!-- Category and Device Charts -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Email Categories -->
            <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow p-4">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100">Email Categories</h2>
              </div>
              <div class="h-64 relative">
                <Doughnut :data="emailCategoryData" :options="doughnutChartOptions" />
              </div>
            </div>

            <!-- Device Usage -->
            <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow p-4">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-medium text-gray-900 dark:text-gray-100">Device Usage</h2>
              </div>
              <div class="h-64 relative">
                <Doughnut :data="deviceUsageData" :options="doughnutChartOptions" />
              </div>
            </div>
          </div>

          <!-- Recent Activity Table -->
          <div class="bg-white dark:bg-blue-gray-700 rounded-lg shadow overflow-hidden">
            <div class="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-blue-gray-600">
              <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">Recent Activity</h3>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-blue-gray-600">
                <thead class="bg-gray-50 dark:bg-blue-gray-600">
                  <tr>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Action
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Email
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Time
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white dark:bg-blue-gray-700 divide-y divide-gray-200 dark:divide-blue-gray-600">
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <div class="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <i class="i-hugeicons-mail-receive-02 text-blue-600"></i>
                        </div>
                        <div class="ml-4">
                          <div class="text-sm font-medium text-gray-900 dark:text-white">Received Email</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm text-gray-900 dark:text-white">New Project Roadmap</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">From: Chris Breuer</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      10 minutes ago
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        Delivered
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <div class="flex-shrink-0 h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                          <i class="i-hugeicons-mail-send-02 text-green-600"></i>
                        </div>
                        <div class="ml-4">
                          <div class="text-sm font-medium text-gray-900 dark:text-white">Sent Email</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm text-gray-900 dark:text-white">Re: Design Review Scheduled</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">To: Blake</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      1 hour ago
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        Sent
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <div class="flex-shrink-0 h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                          <i class="i-hugeicons-spam text-red-600"></i>
                        </div>
                        <div class="ml-4">
                          <div class="text-sm font-medium text-gray-900 dark:text-white">Spam Detected</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm text-gray-900 dark:text-white">Special Offer: Limited Time</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">From: marketing@example.com</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      3 hours ago
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
                        Blocked
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <div class="flex-shrink-0 h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                          <i class="i-hugeicons-star text-yellow-600"></i>
                        </div>
                        <div class="ml-4">
                          <div class="text-sm font-medium text-gray-900 dark:text-white">Starred Email</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="text-sm text-gray-900 dark:text-white">Weekly Team Update</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">From: Sarah Johnson</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      Yesterday
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                        Read
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
