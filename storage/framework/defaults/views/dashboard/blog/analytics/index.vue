<script lang="ts" setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useHead } from '@vueuse/head'
import { Chart, registerables, ChartTypeRegistry } from 'chart.js'

// Register Chart.js components
Chart.register(...registerables)

useHead({
  title: 'Dashboard - Blog Analytics',
})

// Types
interface DateRange {
  id: string
  name: string
}

interface Referrer {
  name: string
  visits: number
  percentage: number
}

interface Country {
  name: string
  visits: number
  percentage: number
  flag: string
}

interface PageData {
  path: string
  entries: number
  visitors: number
  views: number
}

interface ReferrerData {
  name: string
  visitors: number
  views: number
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

// Search functionality
const searchQuery = ref('')
const isSearching = ref(false)

// Analytics overview data
const analyticsOverview = ref({
  realtime: 0,
  people: 2200,
  views: 3000,
  avgTimeOnSite: '03:36',
  bounceRate: '89%',
  eventCompletions: 0
})

// Traffic data for chart
const trafficData = ref([
  { date: '2023-11-01', pageViews: 100, visitors: 80 },
  { date: '2023-11-15', pageViews: 250, visitors: 180 },
  { date: '2023-12-01', pageViews: 150, visitors: 120 },
  { date: '2023-12-15', pageViews: 220, visitors: 170 },
  { date: '2024-01-01', pageViews: 180, visitors: 140 },
  { date: '2024-01-15', pageViews: 320, visitors: 240 },
  { date: '2024-02-01', pageViews: 280, visitors: 210 },
  { date: '2024-02-15', pageViews: 400, visitors: 300 },
  { date: '2024-03-01', pageViews: 350, visitors: 270 },
  { date: '2024-03-15', pageViews: 300, visitors: 230 },
  { date: '2024-04-01', pageViews: 250, visitors: 190 },
  { date: '2024-04-15', pageViews: 200, visitors: 150 },
  { date: '2024-05-01', pageViews: 150, visitors: 120 },
  { date: '2024-05-15', pageViews: 120, visitors: 90 },
  { date: '2024-06-01', pageViews: 100, visitors: 80 },
  { date: '2024-06-15', pageViews: 130, visitors: 100 },
  { date: '2024-07-01', pageViews: 150, visitors: 120 },
  { date: '2024-07-15', pageViews: 120, visitors: 90 },
  { date: '2024-08-01', pageViews: 100, visitors: 80 },
  { date: '2024-08-15', pageViews: 80, visitors: 60 },
  { date: '2024-09-01', pageViews: 100, visitors: 80 },
  { date: '2024-09-15', pageViews: 120, visitors: 90 },
  { date: '2024-10-01', pageViews: 150, visitors: 120 },
  { date: '2024-10-15', pageViews: 100, visitors: 80 },
  { date: '2024-11-01', pageViews: 80, visitors: 60 },
  { date: '2024-11-15', pageViews: 120, visitors: 90 },
  { date: '2024-12-01', pageViews: 300, visitors: 230 },
  { date: '2024-12-15', pageViews: 150, visitors: 120 },
  { date: '2025-01-01', pageViews: 100, visitors: 80 },
  { date: '2025-01-15', pageViews: 80, visitors: 60 },
  { date: '2025-02-01', pageViews: 60, visitors: 40 }
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
  { path: '/', entries: 1800, visitors: 1800, views: 2100 },
  { path: '/', entries: 113, visitors: 113, views: 139 },
  { path: '/', entries: 51, visitors: 51, views: 77 },
  { path: '/', entries: 42, visitors: 42, views: 51 },
  { path: '/', entries: 37, visitors: 37, views: 60 },
  { path: '/guide/get-started.html', entries: 21, visitors: 29, views: 45 },
  { path: '/', entries: 16, visitors: 17, views: 202 },
  { path: '/guide/intro.html', entries: 12, visitors: 17, views: 22 },
  { path: '/guide/get-started', entries: 9, visitors: 12, views: 13 },
  { path: '/team', entries: 9, visitors: 10, views: 15 }
])

// Referrers data
const referrersData = ref<ReferrerData[]>([
  { name: 'Direct / Unknown', visitors: 1400, views: 2100 },
  { name: 'X/Twitter', visitors: 545, views: 580 },
  { name: 'Google', visitors: 46, views: 50 },
  { name: 'stacksjs.org', visitors: 45, views: 63 },
  { name: 'stacksjs.netlify.app', visitors: 38, views: 60 },
  { name: 'github.com', visitors: 34, views: 47 },
  { name: 'DuckDuckGo', visitors: 32, views: 35 },
  { name: 'Bing', visitors: 22, views: 24 },
  { name: 'Baidu', visitors: 8, views: 8 },
  { name: 'npmjs.com', visitors: 7, views: 7 }
])

// Device data
const deviceData = ref<DeviceData[]>([
  { name: 'Desktop', visitors: 1300, percentage: 60 },
  { name: 'Phone', visitors: 874, percentage: 38 },
  { name: 'Tablet', visitors: 5, percentage: 2 }
])

// Browser data
const browserData = ref<BrowserData[]>([
  { name: 'Chrome', visitors: 1300, percentage: 58 },
  { name: 'Safari', visitors: 579, percentage: 26 },
  { name: 'Edge', visitors: 129, percentage: 6 },
  { name: 'Firefox', visitors: 92, percentage: 4 },
  { name: 'Mozilla', visitors: 24, percentage: 1 }
])

// Countries data with flag emojis
const countriesData = ref<CountryData[]>([
  { name: 'United States of America', visitors: 768, flag: '🇺🇸' },
  { name: 'Germany', visitors: 140, flag: '🇩🇪' },
  { name: 'United Kingdom', visitors: 87, flag: '🇬🇧' },
  { name: 'India', visitors: 83, flag: '🇮🇳' },
  { name: 'Indonesia', visitors: 80, flag: '🇮🇩' }
])

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

// Search functionality
function toggleSearch(): void {
  isSearching.value = !isSearching.value
  if (!isSearching.value) {
    searchQuery.value = ''
  }
}

// Filter data based on search query
const filteredPagesData = computed(() => {
  if (!searchQuery.value) return pagesData.value
  const query = searchQuery.value.toLowerCase()
  return pagesData.value.filter(page => page.path.toLowerCase().includes(query))
})

const filteredReferrersData = computed(() => {
  if (!searchQuery.value) return referrersData.value
  const query = searchQuery.value.toLowerCase()
  return referrersData.value.filter(referrer => referrer.name.toLowerCase().includes(query))
})

const filteredDeviceData = computed(() => {
  if (!searchQuery.value) return deviceData.value
  const query = searchQuery.value.toLowerCase()
  return deviceData.value.filter(device => device.name.toLowerCase().includes(query))
})

const filteredBrowserData = computed(() => {
  if (!searchQuery.value) return browserData.value
  const query = searchQuery.value.toLowerCase()
  return browserData.value.filter(browser => browser.name.toLowerCase().includes(query))
})

const filteredCountriesData = computed(() => {
  if (!searchQuery.value) return countriesData.value
  const query = searchQuery.value.toLowerCase()
  return countriesData.value.filter(country => country.name.toLowerCase().includes(query))
})

// Mock function to update data when date range changes
function updateDataForDateRange(): void {
  // In a real app, this would fetch data from the server based on the selected date range
  console.log('Updating data for date range:', selectedDateRange.value)

  if (selectedDateRange.value === 'custom') {
    console.log('Custom date range:', customStartDate.value, 'to', customEndDate.value)
  }
}

// Watch for date range changes
function handleDateRangeChange(): void {
  updateDataForDateRange()
}

// Initialize chart when component is mounted
let trafficChart: Chart | null = null

onMounted(() => {
  const ctx = document.getElementById('trafficChart') as HTMLCanvasElement
  if (ctx) {
    trafficChart = new Chart(ctx, chartConfig)
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

        <!-- Overview Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-8 bg-black dark:bg-blue-gray-900 rounded-lg p-4">
          <!-- Realtime -->
          <div class="flex flex-col items-center justify-center">
            <div class="text-4xl font-bold text-white">{{ analyticsOverview.realtime }}</div>
            <div class="text-sm text-gray-400">Realtime</div>
          </div>

          <!-- People -->
          <div class="flex flex-col items-center justify-center">
            <div class="text-4xl font-bold text-white">2.2k</div>
            <div class="text-sm text-gray-400">People</div>
          </div>

          <!-- Views -->
          <div class="flex flex-col items-center justify-center">
            <div class="text-4xl font-bold text-white">3k</div>
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

          <!-- Event completions -->
          <div class="flex flex-col items-center justify-center">
            <div class="text-4xl font-bold text-white">{{ analyticsOverview.eventCompletions }}</div>
            <div class="text-sm text-gray-400">Event completions</div>
          </div>
        </div>

        <!-- Traffic Chart -->
        <div class="mb-8 bg-white dark:bg-blue-gray-800 rounded-lg p-4 shadow">
          <!-- Global search input (shown when isSearching is true) -->
          <div v-if="isSearching" class="mb-4">
            <div class="relative">
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <div class="i-hugeicons-search-01 h-5 w-5 text-gray-400"></div>
              </div>
              <input
                v-model="searchQuery"
                type="text"
                class="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:placeholder:text-gray-500"
                placeholder="Search across all analytics data..."
                autofocus
              />
              <button
                @click="toggleSearch"
                class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <div class="i-hugeicons-cancel-circle h-5 w-5"></div>
              </button>
            </div>
          </div>

          <!-- Chart header with search toggle -->
          <div v-else class="flex justify-between items-center mb-4">
            <div>
              <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">Traffic Overview</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Daily page views and unique visitors
              </p>
            </div>
            <button
              @click="toggleSearch"
              class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <div class="i-hugeicons-search-01 h-5 w-5"></div>
            </button>
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
            <div class="mb-4 flex items-center justify-between">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Pages</h3>
              <div class="flex space-x-2">
                <button class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                  <div class="i-hugeicons-list h-5 w-5"></div>
                </button>
                <button
                  @click="toggleSearch"
                  class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <div class="i-hugeicons-search-01 h-5 w-5"></div>
                </button>
              </div>
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
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                  <tr v-for="(page, index) in filteredPagesData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50">
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {{ page.path }}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">
                      {{ page.entries }}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">
                      {{ page.visitors }}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">
                      {{ page.views }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="mt-2 flex justify-end">
              <a href="/dashboard/blog/analytics/pages" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                View all pages
              </a>
            </div>
          </div>

          <!-- Referrers Table -->
          <div>
            <div class="mb-4 flex items-center justify-between">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Referrers</h3>
              <div class="flex space-x-2">
                <button class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                  <div class="i-hugeicons-list h-5 w-5"></div>
                </button>
                <button
                  @click="toggleSearch"
                  class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <div class="i-hugeicons-search-01 h-5 w-5"></div>
                </button>
              </div>
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
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                  <tr v-for="(referrer, index) in filteredReferrersData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50">
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {{ referrer.name }}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">
                      {{ referrer.visitors }}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">
                      {{ referrer.views }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="mt-2 flex justify-end">
              <a href="/dashboard/blog/analytics/referrers" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                View all referrers
              </a>
            </div>
          </div>
        </div>

        <!-- Device Types, Browsers, and Countries -->
        <div class="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Device Types -->
          <div>
            <div class="mb-4 flex items-center justify-between">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Device Types</h3>
              <div class="flex space-x-2">
                <button class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                  <div class="i-hugeicons-list h-5 w-5"></div>
                </button>
                <button
                  @click="toggleSearch"
                  class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <div class="i-hugeicons-search-01 h-5 w-5"></div>
                </button>
              </div>
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
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                  <tr v-for="(device, index) in filteredDeviceData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50">
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {{ device.name }}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">
                      {{ device.visitors }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="mt-2 flex justify-end">
              <a href="/dashboard/blog/analytics/devices" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                View all devices
              </a>
            </div>
          </div>

          <!-- Browsers -->
          <div>
            <div class="mb-4 flex items-center justify-between">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Browsers</h3>
              <div class="flex space-x-2">
                <button class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                  <div class="i-hugeicons-list h-5 w-5"></div>
                </button>
                <button
                  @click="toggleSearch"
                  class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <div class="i-hugeicons-search-01 h-5 w-5"></div>
                </button>
              </div>
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
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                  <tr v-for="(browser, index) in filteredBrowserData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50">
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {{ browser.name }}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">
                      {{ browser.visitors }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="mt-2 flex justify-end">
              <a href="/dashboard/blog/analytics/browsers" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                View all browsers
              </a>
            </div>
          </div>

          <!-- Countries -->
          <div>
            <div class="mb-4 flex items-center justify-between">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Countries</h3>
              <div class="flex space-x-2">
                <button class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                  <div class="i-hugeicons-list h-5 w-5"></div>
                </button>
                <button
                  @click="toggleSearch"
                  class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <div class="i-hugeicons-search-01 h-5 w-5"></div>
                </button>
              </div>
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
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                  <tr v-for="(country, index) in filteredCountriesData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50">
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <span class="mr-2">{{ country.flag }}</span>
                      {{ country.name }}
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">
                      {{ country.visitors }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="mt-2 flex justify-end">
              <a href="/dashboard/blog/analytics/countries" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                View all countries
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
