<script lang="ts" setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useHead } from '@vueuse/head'
import { Chart, registerables, ChartTypeRegistry } from 'chart.js'

// Register Chart.js components
Chart.register(...registerables)

useHead({
  title: 'Dashboard - Device Analytics',
})

// Types
interface DateRange {
  id: string
  name: string
}

interface DeviceData {
  name: string
  visitors: number
  percentage: number
  model?: string
  os?: string
}

// Date range options
const dateRanges: DateRange[] = [
  { id: 'last7days', name: 'Last 7 Days' },
  { id: 'last30days', name: 'Last 30 Days' },
  { id: 'thisMonth', name: 'This Month' },
  { id: 'lastMonth', name: 'Last Month' },
  { id: 'thisYear', name: 'This Year' },
  { id: 'custom', name: 'Custom Range' }
]

// Selected date range
const selectedDateRange = ref('all-time')
const dateRangeDisplay = ref('All Time: Sep 7, 2023 to Mar 6, 2025')
const comparisonType = ref('no-comparison')
const customStartDate = ref('')
const customEndDate = ref('')
const showCustomDateRange = computed(() => selectedDateRange.value === 'custom')

// Device data
const deviceData = ref<DeviceData[]>([
  { name: 'Desktop', visitors: 1300, percentage: 60 },
  { name: 'Phone', visitors: 874, percentage: 38 },
  { name: 'Tablet', visitors: 5, percentage: 2 }
])

// Detailed device data
const detailedDeviceData = ref<DeviceData[]>([
  { name: 'Desktop', model: 'Windows PC', os: 'Windows 11', visitors: 450, percentage: 20 },
  { name: 'Desktop', model: 'Windows PC', os: 'Windows 10', visitors: 380, percentage: 17 },
  { name: 'Desktop', model: 'Mac', os: 'macOS 14', visitors: 250, percentage: 11 },
  { name: 'Desktop', model: 'Mac', os: 'macOS 13', visitors: 150, percentage: 7 },
  { name: 'Desktop', model: 'Linux PC', os: 'Ubuntu', visitors: 70, percentage: 3 },
  { name: 'Phone', model: 'iPhone', os: 'iOS 17', visitors: 320, percentage: 14 },
  { name: 'Phone', model: 'iPhone', os: 'iOS 16', visitors: 180, percentage: 8 },
  { name: 'Phone', model: 'Samsung Galaxy', os: 'Android 14', visitors: 150, percentage: 7 },
  { name: 'Phone', model: 'Google Pixel', os: 'Android 14', visitors: 89, percentage: 4 },
  { name: 'Phone', model: 'Xiaomi', os: 'Android 13', visitors: 135, percentage: 6 },
  { name: 'Tablet', model: 'iPad', os: 'iPadOS 17', visitors: 3, percentage: 0.1 },
  { name: 'Tablet', model: 'Samsung Tab', os: 'Android 14', visitors: 2, percentage: 0.1 }
])

// Chart.js configuration for device distribution
const chartConfig = reactive({
  type: 'doughnut' as keyof ChartTypeRegistry,
  data: {
    labels: deviceData.value.map(item => item.name),
    datasets: [
      {
        data: deviceData.value.map(item => item.visitors),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)'
        ],
        borderColor: 'rgba(255, 255, 255, 0.8)',
        borderWidth: 1
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          padding: 20,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            return `${label}: ${value} visitors (${percentage}%)`;
          }
        }
      }
    }
  }
})

// Device trend data for line chart
const deviceTrendData = ref([
  { date: '2023-09', Desktop: 800, Phone: 400, Tablet: 10 },
  { date: '2023-10', Desktop: 850, Phone: 420, Tablet: 9 },
  { date: '2023-11', Desktop: 900, Phone: 450, Tablet: 8 },
  { date: '2023-12', Desktop: 950, Phone: 480, Tablet: 7 },
  { date: '2024-01', Desktop: 1000, Phone: 500, Tablet: 6 },
  { date: '2024-02', Desktop: 1100, Phone: 600, Tablet: 5 },
  { date: '2024-03', Desktop: 1200, Phone: 700, Tablet: 5 },
  { date: '2024-04', Desktop: 1250, Phone: 750, Tablet: 5 },
  { date: '2024-05', Desktop: 1300, Phone: 874, Tablet: 5 }
])

// Chart.js configuration for device trends
const trendChartConfig = reactive({
  type: 'line' as keyof ChartTypeRegistry,
  data: {
    labels: deviceTrendData.value.map(item => item.date),
    datasets: [
      {
        label: 'Desktop',
        data: deviceTrendData.value.map(item => item.Desktop),
        borderColor: 'rgba(59, 130, 246, 0.8)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: false
      },
      {
        label: 'Phone',
        data: deviceTrendData.value.map(item => item.Phone),
        borderColor: 'rgba(16, 185, 129, 0.8)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: false
      },
      {
        label: 'Tablet',
        data: deviceTrendData.value.map(item => item.Tablet),
        borderColor: 'rgba(245, 158, 11, 0.8)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.4,
        fill: false
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          borderDash: [2, 4],
          color: 'rgba(160, 174, 192, 0.2)'
        },
        ticks: {
          maxTicksLimit: 6
        }
      }
    },
    plugins: {
      legend: {
        position: 'top' as const
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false
      }
    }
  }
})

// Screen size data
const screenSizeData = ref([
  { size: '1920x1080', visitors: 580, percentage: 26 },
  { size: '1366x768', visitors: 450, percentage: 20 },
  { size: '1440x900', visitors: 320, percentage: 14 },
  { size: '375x812', visitors: 280, percentage: 13 },
  { size: '414x896', visitors: 220, percentage: 10 },
  { size: '360x740', visitors: 180, percentage: 8 },
  { size: '1536x864', visitors: 120, percentage: 5 },
  { size: '768x1024', visitors: 80, percentage: 4 }
])

// Format numbers with commas
function formatNumber(number: number): string {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// Mock function to update data when date range changes
function updateDataForDateRange(): void {
  console.log('Updating data for date range:', selectedDateRange.value)
}

// Watch for date range changes
function handleDateRangeChange(): void {
  updateDataForDateRange()
}

// Initialize charts when component is mounted
let deviceDistributionChart: Chart | null = null
let deviceTrendChart: Chart | null = null

onMounted(() => {
  const distributionCtx = document.getElementById('deviceDistributionChart') as HTMLCanvasElement
  if (distributionCtx) {
    deviceDistributionChart = new Chart(distributionCtx, chartConfig)
  }

  const trendCtx = document.getElementById('deviceTrendChart') as HTMLCanvasElement
  if (trendCtx) {
    deviceTrendChart = new Chart(trendCtx, trendChartConfig)
  }

  updateDataForDateRange()
})
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <!-- Header with date range selector -->
        <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-center space-x-2">
            <div class="i-hugeicons-calendar-03 h-5 w-5 text-gray-500 dark:text-gray-400"></div>
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ dateRangeDisplay }}</span>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-gray-500 dark:text-gray-400">compared to</span>

            <div class="relative">
              <select
                v-model="comparisonType"
                class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
              >
                <option value="no-comparison">No comparison</option>
                <option value="previous-period">Previous period</option>
                <option value="previous-year">Previous year</option>
              </select>
            </div>

            <button
              type="button"
              class="inline-flex items-center rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
            >
              <div class="i-hugeicons-settings-01 h-4 w-4 mr-1"></div>
              Auto
            </button>
          </div>
        </div>

        <!-- Page Header -->
        <div class="mb-8">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Device Analytics</h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Detailed breakdown of device usage across your website
          </p>
        </div>

        <!-- Device Distribution Chart -->
        <div class="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div class="bg-white dark:bg-blue-gray-800 rounded-lg p-4 shadow">
            <div class="mb-4">
              <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">Device Distribution</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Percentage of visitors by device type
              </p>
            </div>

            <div class="h-80 w-full">
              <canvas id="deviceDistributionChart"></canvas>
            </div>
          </div>

          <!-- Device Trend Chart -->
          <div class="bg-white dark:bg-blue-gray-800 rounded-lg p-4 shadow">
            <div class="mb-4">
              <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">Device Trends</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Device usage trends over time
              </p>
            </div>

            <div class="h-80 w-full">
              <canvas id="deviceTrendChart"></canvas>
            </div>
          </div>
        </div>

        <!-- Device Data Table -->
        <div class="mb-8">
          <div class="mb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Device Overview</h3>
          </div>

          <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                <tr>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Device Type
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Visitors
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    %
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                <tr v-for="(device, index) in deviceData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50 relative">
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <div class="absolute inset-0 bg-purple-100/50 dark:bg-purple-900/50" :style="{ width: device.percentage + '%' }"></div>
                    <span class="relative z-10">{{ device.name }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ device.visitors }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ device.percentage }}%</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Detailed Device Data Table -->
        <div class="mb-8">
          <div class="mb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Detailed Device Data</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Device usage by model and operating system
            </p>
          </div>

          <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                <tr>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Device Type
                  </th>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Model
                  </th>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    OS
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Visitors
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    %
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                <tr v-for="(device, index) in detailedDeviceData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50 relative">
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <div class="absolute inset-0 bg-purple-100/50 dark:bg-purple-900/50" :style="{ width: device.percentage + '%' }"></div>
                    <span class="relative z-10">{{ device.name }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white relative">
                    <span class="relative z-10">{{ device.model }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white relative">
                    <span class="relative z-10">{{ device.os }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ device.visitors }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ device.percentage }}%</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Screen Size Data Table -->
        <div>
          <div class="mb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Screen Sizes</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Visitor screen resolution breakdown
            </p>
          </div>

          <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                <tr>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Screen Resolution
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Visitors
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    %
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                <tr v-for="(screen, index) in screenSizeData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50 relative">
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <div class="absolute inset-0 bg-indigo-100/50 dark:bg-indigo-900/50" :style="{ width: screen.percentage + '%' }"></div>
                    <span class="relative z-10">{{ screen.size }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ screen.visitors }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ screen.percentage }}%</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
