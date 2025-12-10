<script lang="ts" setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useHead } from '@vueuse/head'
import { Chart, registerables, ChartTypeRegistry } from 'chart.js'

// Register Chart.js components
Chart.register(...registerables)

useHead({
  title: 'Dashboard - Browser Analytics',
})

// Types
interface DateRange {
  id: string
  name: string
}

interface BrowserData {
  name: string
  visitors: number
  percentage: number
  version?: string
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

// Browser data
const browserData = ref<BrowserData[]>([
  { name: 'Chrome', visitors: 1300, percentage: 58 },
  { name: 'Safari', visitors: 579, percentage: 26 },
  { name: 'Edge', visitors: 129, percentage: 6 },
  { name: 'Firefox', visitors: 92, percentage: 4 },
  { name: 'Mozilla', visitors: 24, percentage: 1 },
  { name: 'Opera', visitors: 18, percentage: 0.8 },
  { name: 'Samsung Internet', visitors: 15, percentage: 0.7 },
  { name: 'UC Browser', visitors: 12, percentage: 0.5 },
  { name: 'Internet Explorer', visitors: 8, percentage: 0.4 },
  { name: 'Brave', visitors: 7, percentage: 0.3 }
])

// Detailed browser data with versions
const detailedBrowserData = ref<BrowserData[]>([
  { name: 'Chrome', version: '120.0.6099', os: 'Windows', visitors: 450, percentage: 20 },
  { name: 'Chrome', version: '120.0.6099', os: 'macOS', visitors: 380, percentage: 17 },
  { name: 'Chrome', version: '120.0.6099', os: 'Linux', visitors: 220, percentage: 10 },
  { name: 'Chrome', version: '119.0.6045', os: 'Windows', visitors: 150, percentage: 7 },
  { name: 'Chrome', version: '119.0.6045', os: 'macOS', visitors: 100, percentage: 4 },
  { name: 'Safari', version: '17.2', os: 'macOS', visitors: 320, percentage: 14 },
  { name: 'Safari', version: '17.1', os: 'macOS', visitors: 180, percentage: 8 },
  { name: 'Safari', version: '16.5', os: 'iOS', visitors: 79, percentage: 4 },
  { name: 'Edge', version: '120.0.2210', os: 'Windows', visitors: 89, percentage: 4 },
  { name: 'Edge', version: '120.0.2210', os: 'macOS', visitors: 40, percentage: 2 },
  { name: 'Firefox', version: '121.0', os: 'Windows', visitors: 52, percentage: 2 },
  { name: 'Firefox', version: '121.0', os: 'macOS', visitors: 40, percentage: 2 }
])

// Chart.js configuration for browser distribution
const chartConfig = reactive({
  type: 'pie' as keyof ChartTypeRegistry,
  data: {
    labels: browserData.value.slice(0, 5).map(item => item.name),
    datasets: [
      {
        data: browserData.value.slice(0, 5).map(item => item.visitors),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)'
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

// Browser trend data for line chart
const browserTrendData = ref([
  { date: '2023-09', Chrome: 800, Safari: 400, Edge: 80, Firefox: 60, Other: 30 },
  { date: '2023-10', Chrome: 850, Safari: 420, Edge: 85, Firefox: 65, Other: 32 },
  { date: '2023-11', Chrome: 900, Safari: 450, Edge: 90, Firefox: 70, Other: 35 },
  { date: '2023-12', Chrome: 950, Safari: 480, Edge: 95, Firefox: 75, Other: 38 },
  { date: '2024-01', Chrome: 1000, Safari: 500, Edge: 100, Firefox: 80, Other: 40 },
  { date: '2024-02', Chrome: 1100, Safari: 520, Edge: 110, Firefox: 85, Other: 42 },
  { date: '2024-03', Chrome: 1200, Safari: 550, Edge: 120, Firefox: 90, Other: 45 },
  { date: '2024-04', Chrome: 1250, Safari: 560, Edge: 125, Firefox: 92, Other: 47 },
  { date: '2024-05', Chrome: 1300, Safari: 579, Edge: 129, Firefox: 92, Other: 50 }
])

// Chart.js configuration for browser trends
const trendChartConfig = reactive({
  type: 'line' as keyof ChartTypeRegistry,
  data: {
    labels: browserTrendData.value.map(item => item.date),
    datasets: [
      {
        label: 'Chrome',
        data: browserTrendData.value.map(item => item.Chrome),
        borderColor: 'rgba(59, 130, 246, 0.8)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: false
      },
      {
        label: 'Safari',
        data: browserTrendData.value.map(item => item.Safari),
        borderColor: 'rgba(16, 185, 129, 0.8)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: false
      },
      {
        label: 'Edge',
        data: browserTrendData.value.map(item => item.Edge),
        borderColor: 'rgba(245, 158, 11, 0.8)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.4,
        fill: false
      },
      {
        label: 'Firefox',
        data: browserTrendData.value.map(item => item.Firefox),
        borderColor: 'rgba(239, 68, 68, 0.8)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
        fill: false
      },
      {
        label: 'Other',
        data: browserTrendData.value.map(item => item.Other),
        borderColor: 'rgba(139, 92, 246, 0.8)',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
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
let browserDistributionChart: Chart | null = null
let browserTrendChart: Chart | null = null

onMounted(() => {
  const distributionCtx = document.getElementById('browserDistributionChart') as HTMLCanvasElement
  if (distributionCtx) {
    browserDistributionChart = new Chart(distributionCtx, chartConfig)
  }

  const trendCtx = document.getElementById('browserTrendChart') as HTMLCanvasElement
  if (trendCtx) {
    browserTrendChart = new Chart(trendCtx, trendChartConfig)
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
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Browser Analytics</h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Detailed breakdown of browser usage across your website
          </p>
        </div>

        <!-- Browser Distribution Chart -->
        <div class="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div class="bg-white dark:bg-blue-gray-800 rounded-lg p-4 shadow">
            <div class="mb-4">
              <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">Browser Distribution</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Percentage of visitors by browser
              </p>
            </div>

            <div class="h-80 w-full">
              <canvas id="browserDistributionChart"></canvas>
            </div>
          </div>

          <!-- Browser Trend Chart -->
          <div class="bg-white dark:bg-blue-gray-800 rounded-lg p-4 shadow">
            <div class="mb-4">
              <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">Browser Trends</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Browser usage trends over time
              </p>
            </div>

            <div class="h-80 w-full">
              <canvas id="browserTrendChart"></canvas>
            </div>
          </div>
        </div>

        <!-- Browser Data Table -->
        <div class="mb-8">
          <div class="mb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Browser Overview</h3>
          </div>

          <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                <tr>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Browser
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
                <tr v-for="(browser, index) in browserData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50 relative">
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <div class="absolute inset-0 bg-amber-100/50 dark:bg-amber-900/50" :style="{ width: browser.percentage + '%' }"></div>
                    <span class="relative z-10">{{ browser.name }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ browser.visitors }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ browser.percentage }}%</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Detailed Browser Data Table -->
        <div>
          <div class="mb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Detailed Browser Data</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Browser usage by version and operating system
            </p>
          </div>

          <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                <tr>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Browser
                  </th>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Version
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
                <tr v-for="(browser, index) in detailedBrowserData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50 relative">
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <div class="absolute inset-0 bg-amber-100/50 dark:bg-amber-900/50" :style="{ width: browser.percentage + '%' }"></div>
                    <span class="relative z-10">{{ browser.name }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white relative">
                    <span class="relative z-10">{{ browser.version }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white relative">
                    <span class="relative z-10">{{ browser.os }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ browser.visitors }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ browser.percentage }}%</span>
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
