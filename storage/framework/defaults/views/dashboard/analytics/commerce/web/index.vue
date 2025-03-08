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

        <!-- Overview Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-8 bg-black dark:bg-blue-gray-900 rounded-lg p-4">
          <!-- Realtime -->
          <div class="flex flex-col items-center justify-center">
            <div class="text-4xl font-bold text-white">{{ analyticsOverview.realtime }}</div>
            <div class="text-sm text-gray-400">Realtime</div>
          </div>

          <!-- People -->
          <div class="flex flex-col items-center justify-center">
            <div class="text-4xl font-bold text-white">12.3k</div>
            <div class="text-sm text-gray-400">People</div>
          </div>

          <!-- Views -->
          <div class="flex flex-col items-center justify-center">
            <div class="text-4xl font-bold text-white">45.7k</div>
            <div class="text-sm text-gray-400">Views</div>
          </div>

          <!-- Avg time on site -->
          <div class="flex flex-col items-center justify-center">
            <div class="text-4xl font-bold text-white">{{ analyticsOverview.avgTimeOnSite }}</div>
            <div class="text-sm text-gray-400">Avg time on site</div>
          </div>

          <!-- Bounce rate -->
          <div class="flex flex-col items-center justify-center">
            <div class="text-4xl font-bold text-white">{{ analyticsOverview.bounceRate }}</div>
            <div class="text-sm text-gray-400">Bounce rate</div>
          </div>

          <!-- Conversion rate -->
          <div class="flex flex-col items-center justify-center">
            <div class="text-4xl font-bold text-white">{{ analyticsOverview.conversionRate }}</div>
            <div class="text-sm text-gray-400">Conversion rate</div>
          </div>
        </div>

        <!-- Traffic Chart -->
        <div class="mb-8 bg-white dark:bg-blue-gray-800 rounded-lg p-4 shadow">
          <!-- Chart header -->
          <div class="mb-4">
            <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">Traffic Overview</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Daily page views and unique visitors
            </p>
          </div>

          <!-- Chart.js canvas -->
          <div class="h-80 w-full">
            <canvas id="trafficChart"></canvas>
          </div>
        </div>

        <!-- Data Tables -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- Pages and Entries Table -->
          <div>
            <div class="mb-4">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Pages</h3>
            </div>

            <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                  <tr>
                    <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Pages
                    </th>
                    <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Entries
                    </th>
                    <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Visitors
                    </th>
                    <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Views
                    </th>
                    <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      %
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                  <tr v-for="(page, index) in pagesData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50 relative">
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <div class="absolute inset-0 bg-blue-100/50 dark:bg-blue-900/50" :style="{ width: page.percentage + '%' }"></div>
                      <span class="relative z-10">{{ page.path }}</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ page.entries }}</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ page.visitors }}</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ page.views }}</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ page.percentage }}%</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="mt-2 flex justify-end">
              <a href="/analytics/pages" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                View all pages
              </a>
            </div>
          </div>

          <!-- Referrers Table -->
          <div>
            <div class="mb-4">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Referrers</h3>
            </div>

            <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                  <tr>
                    <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Sources
                    </th>
                    <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Visitors
                    </th>
                    <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Views
                    </th>
                    <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      %
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                  <tr v-for="(referrer, index) in referrersData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50 relative">
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <div class="absolute inset-0 bg-green-100/50 dark:bg-green-900/50" :style="{ width: referrer.percentage + '%' }"></div>
                      <span class="relative z-10">{{ referrer.name }}</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ referrer.visitors }}</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ referrer.views }}</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ referrer.percentage }}%</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="mt-2 flex justify-end">
              <a href="/analytics/referrers" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                View all referrers
              </a>
            </div>
          </div>
        </div>

        <!-- Device Types, Browsers, and Countries -->
        <div class="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Device Types -->
          <div>
            <div class="mb-4">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Device Types</h3>
            </div>

            <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                  <tr>
                    <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Device Types
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

            <div class="mt-2 flex justify-end">
              <a href="/analytics/devices" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                View all devices
              </a>
            </div>
          </div>

          <!-- Browsers -->
          <div>
            <div class="mb-4">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Browsers</h3>
            </div>

            <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                  <tr>
                    <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Browsers
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

            <div class="mt-2 flex justify-end">
              <a href="/analytics/browsers" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                View all browsers
              </a>
            </div>
          </div>

          <!-- Countries -->
          <div>
            <div class="mb-4">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Countries</h3>
            </div>

            <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                  <tr>
                    <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Countries
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
                  <tr v-for="(country, index) in countriesData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50 relative">
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <div class="absolute inset-0 bg-rose-100/50 dark:bg-rose-900/50" :style="{ width: country.percentage + '%' }"></div>
                      <span class="relative z-10"><span class="mr-2">{{ country.flag }}</span>{{ country.name }}</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ formatNumber(country.visitors) }}</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ country.percentage }}%</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="mt-2 flex justify-end">
              <a href="/analytics/countries" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                View all countries
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { useHead } from '@vueuse/head'
import { Chart, registerables, ChartTypeRegistry } from 'chart.js'
import PageHeader from '../../../../components/Dashboard/PageHeader.vue'
import MetricCard from '../../../../components/Dashboard/Cards/MetricCard.vue'
import ChartCard from '../../../../components/Dashboard/Cards/ChartCard.vue'
import TableCard from '../../../../components/Dashboard/Cards/TableCard.vue'

// Register Chart.js components
Chart.register(...registerables)

useHead({
  title: 'Dashboard - Commerce Web Analytics',
})

// Types
interface DateRange {
  id: string
  name: string
}

interface PageData {
  path: string
  entries: number
  visitors: number
  views: number
  percentage: number
}

interface ReferrerData {
  name: string
  visitors: number
  views: number
  percentage: number
}

interface DeviceData {
  name: string
  visitors: number
  percentage: number
}

interface BrowserData {
  name: string
  visitors: number
  percentage: number
}

interface CountryData {
  name: string
  visitors: number
  percentage: number
  flag: string
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

// Analytics overview data
const analyticsOverview = ref({
  realtime: 42,
  people: 12345,
  views: 45678,
  avgTimeOnSite: '02:18',
  bounceRate: '34%',
  conversionRate: '2.4%'
})

// Traffic data for chart
const trafficData = ref([
  { date: '2023-11-01', pageViews: 1200, visitors: 980 },
  { date: '2023-12-01', pageViews: 1500, visitors: 1220 },
  { date: '2024-01-01', pageViews: 1800, visitors: 1440 },
  { date: '2024-02-01', pageViews: 2800, visitors: 2100 },
  { date: '2024-03-01', pageViews: 3500, visitors: 2700 },
  { date: '2024-04-01', pageViews: 2500, visitors: 1900 },
  { date: '2024-05-01', pageViews: 1500, visitors: 1200 },
  { date: '2024-06-01', pageViews: 1000, visitors: 800 },
  { date: '2024-07-01', pageViews: 1500, visitors: 1200 },
  { date: '2024-08-01', pageViews: 1000, visitors: 800 },
  { date: '2024-09-01', pageViews: 1000, visitors: 800 },
  { date: '2024-10-01', pageViews: 1500, visitors: 1200 },
  { date: '2024-11-01', pageViews: 800, visitors: 600 },
  { date: '2024-12-01', pageViews: 3000, visitors: 2300 },
  { date: '2025-01-01', pageViews: 1000, visitors: 800 },
  { date: '2025-02-01', pageViews: 600, visitors: 400 }
])

// Chart.js configuration
const chartConfig = reactive({
  type: 'line' as keyof ChartTypeRegistry,
  data: {
    labels: trafficData.value.map(item => item.date),
    datasets: [
      {
        label: 'Page Views',
        data: trafficData.value.map(item => item.pageViews),
        backgroundColor: 'rgba(147, 197, 253, 0.3)',
        borderColor: 'rgba(59, 130, 246, 0.8)',
        borderWidth: 2,
        tension: 0.4,
        fill: true
      },
      {
        label: 'Visitors',
        data: trafficData.value.map(item => item.visitors),
        backgroundColor: 'rgba(147, 197, 253, 0.1)',
        borderColor: 'rgba(96, 165, 250, 0.8)',
        borderWidth: 2,
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
        },
        ticks: {
          maxTicksLimit: 4,
          callback: function(value: any, index: number) {
            const labels = ['Jan 2024', 'May 2024', 'Sep 2024', 'Jan 2025']
            return index % Math.floor(trafficData.value.length / 4) === 0 ? labels[Math.floor(index / (trafficData.value.length / 4))] || '' : ''
          }
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
        display: true,
        position: 'top' as const
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false
      }
    }
  }
})

// Pages data
const pagesData = ref<PageData[]>([
  { path: '/products', entries: 3800, visitors: 3800, views: 5100, percentage: 0 },
  { path: '/products/category/electronics', entries: 1213, visitors: 1213, views: 1539, percentage: 0 },
  { path: '/products/category/clothing', entries: 951, visitors: 951, views: 1277, percentage: 0 },
  { path: '/cart', entries: 742, visitors: 742, views: 851, percentage: 0 },
  { path: '/checkout', entries: 437, visitors: 437, views: 460, percentage: 0 },
  { path: '/products/featured', entries: 321, visitors: 329, views: 445, percentage: 0 },
  { path: '/account', entries: 216, visitors: 217, views: 302, percentage: 0 },
  { path: '/products/new-arrivals', entries: 212, visitors: 217, views: 322, percentage: 0 },
  { path: '/products/sale', entries: 209, visitors: 212, views: 313, percentage: 0 },
  { path: '/contact', entries: 109, visitors: 110, views: 115, percentage: 0 }
])

// Calculate percentages for pages based on views
const totalPageViews = computed(() => pagesData.value.reduce((sum, page) => sum + page.views, 0))
// Update percentages
pagesData.value.forEach(page => {
  page.percentage = Math.round((page.views / totalPageViews.value) * 100)
})

// Referrers data
const referrersData = ref<ReferrerData[]>([
  { name: 'Direct / Unknown', visitors: 5400, views: 7100, percentage: 0 },
  { name: 'Google', visitors: 3545, views: 4580, percentage: 0 },
  { name: 'Facebook', visitors: 1246, views: 1550, percentage: 0 },
  { name: 'Instagram', visitors: 945, views: 1263, percentage: 0 },
  { name: 'Pinterest', visitors: 738, views: 960, percentage: 0 },
  { name: 'Email Campaigns', visitors: 534, views: 647, percentage: 0 },
  { name: 'X/Twitter', visitors: 432, views: 535, percentage: 0 },
  { name: 'Bing', visitors: 222, views: 324, percentage: 0 },
  { name: 'TikTok', visitors: 208, views: 308, percentage: 0 },
  { name: 'YouTube', visitors: 107, views: 207, percentage: 0 }
])

// Calculate percentages for referrers based on views
const totalReferrerViews = computed(() => referrersData.value.reduce((sum, referrer) => sum + referrer.views, 0))
// Update percentages
referrersData.value.forEach(referrer => {
  referrer.percentage = Math.round((referrer.views / totalReferrerViews.value) * 100)
})

// Device data
const deviceData = ref<DeviceData[]>([
  { name: 'Phone', visitors: 7874, percentage: 58 },
  { name: 'Desktop', visitors: 5300, percentage: 39 },
  { name: 'Tablet', visitors: 405, percentage: 3 }
])

// Browser data
const browserData = ref<BrowserData[]>([
  { name: 'Chrome', visitors: 6300, percentage: 46 },
  { name: 'Safari', visitors: 4579, percentage: 34 },
  { name: 'Edge', visitors: 1129, percentage: 8 },
  { name: 'Firefox', visitors: 992, percentage: 7 },
  { name: 'Samsung Internet', visitors: 524, percentage: 4 },
  { name: 'Opera', visitors: 124, percentage: 1 }
])

// Countries data with flag emojis
const countriesData = ref<CountryData[]>([
  { name: 'United States of America', visitors: 4768, flag: '🇺🇸', percentage: 0 },
  { name: 'United Kingdom', visitors: 1587, flag: '🇬🇧', percentage: 0 },
  { name: 'Germany', visitors: 1240, flag: '🇩🇪', percentage: 0 },
  { name: 'Canada', visitors: 983, flag: '🇨🇦', percentage: 0 },
  { name: 'France', visitors: 876, flag: '🇫🇷', percentage: 0 },
  { name: 'Australia', visitors: 765, flag: '🇦🇺', percentage: 0 },
  { name: 'Japan', visitors: 654, flag: '🇯🇵', percentage: 0 },
  { name: 'India', visitors: 583, flag: '🇮🇳', percentage: 0 },
  { name: 'Brazil', visitors: 432, flag: '🇧🇷', percentage: 0 },
  { name: 'Mexico', visitors: 321, flag: '🇲🇽', percentage: 0 }
])

// Calculate percentages for countries based on visitors
const totalCountryVisitors = computed(() => countriesData.value.reduce((sum, country) => sum + country.visitors, 0))
// Update percentages
countriesData.value.forEach(country => {
  country.percentage = Math.round((country.visitors / totalCountryVisitors.value) * 100)
})

// Format numbers with commas
function formatNumber(number: number): string {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// Get percentage color class
function getPercentageColorClass(percentage: number): string {
  if (percentage >= 70) return 'text-green-600 dark:text-green-400'
  if (percentage >= 40) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

// Initialize chart when component is mounted
let trafficChart: Chart | null = null

onMounted(() => {
  const ctx = document.getElementById('trafficChart') as HTMLCanvasElement
  if (ctx) {
    trafficChart = new Chart(ctx, chartConfig)
  }
})
</script>

<style scoped>
.commerce-web {
  @apply space-y-6;
}
</style>
