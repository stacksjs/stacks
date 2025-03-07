<script lang="ts" setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useHead } from '@vueuse/head'
import { Chart, registerables, ChartTypeRegistry } from 'chart.js'

// Register Chart.js components
Chart.register(...registerables)

useHead({
  title: 'Dashboard - Referrer Analytics',
})

// Types
interface DateRange {
  id: string
  name: string
}

interface ReferrerData {
  name: string
  visitors: number
  views: number
  percentage: number
  type?: string
}

interface ReferrerTypeData {
  name: string
  visitors: number
  percentage: number
}

interface SearchTermData {
  term: string
  visitors: number
  percentage: number
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

// Referrers data
const referrersData = ref<ReferrerData[]>([
  { name: 'Direct / Unknown', visitors: 1400, views: 2100, percentage: 40, type: 'direct' },
  { name: 'X/Twitter', visitors: 545, views: 580, percentage: 15, type: 'social' },
  { name: 'Google', visitors: 346, views: 450, percentage: 10, type: 'search' },
  { name: 'stacksjs.org', visitors: 245, views: 363, percentage: 7, type: 'referral' },
  { name: 'stacksjs.netlify.app', visitors: 138, views: 160, percentage: 4, type: 'referral' },
  { name: 'github.com', visitors: 134, views: 147, percentage: 4, type: 'referral' },
  { name: 'DuckDuckGo', visitors: 132, views: 135, percentage: 4, type: 'search' },
  { name: 'Bing', visitors: 122, views: 124, percentage: 3, type: 'search' },
  { name: 'LinkedIn', visitors: 108, views: 118, percentage: 3, type: 'social' },
  { name: 'Facebook', visitors: 98, views: 108, percentage: 3, type: 'social' },
  { name: 'Baidu', visitors: 58, views: 68, percentage: 2, type: 'search' },
  { name: 'npmjs.com', visitors: 57, views: 67, percentage: 2, type: 'referral' },
  { name: 'Reddit', visitors: 48, views: 58, percentage: 1, type: 'social' },
  { name: 'Hacker News', visitors: 42, views: 52, percentage: 1, type: 'referral' },
  { name: 'dev.to', visitors: 38, views: 48, percentage: 1, type: 'referral' }
])

// Referrer types data
const referrerTypesData = ref<ReferrerTypeData[]>([
  { name: 'Direct', visitors: 1400, percentage: 40 },
  { name: 'Social', visitors: 799, percentage: 22 },
  { name: 'Search', visitors: 658, percentage: 19 },
  { name: 'Referral', visitors: 654, percentage: 19 }
])

// Search terms data
const searchTermsData = ref<SearchTermData[]>([
  { term: 'stacks js', visitors: 120, percentage: 18 },
  { term: 'vue framework', visitors: 85, percentage: 13 },
  { term: 'typescript framework', visitors: 75, percentage: 11 },
  { term: 'stacks framework', visitors: 68, percentage: 10 },
  { term: 'modern vue framework', visitors: 65, percentage: 10 },
  { term: 'vue 3 framework', visitors: 62, percentage: 9 },
  { term: 'typescript vue', visitors: 60, percentage: 9 },
  { term: 'stacks vue', visitors: 58, percentage: 9 },
  { term: 'vue typescript starter', visitors: 55, percentage: 8 },
  { term: 'vue typescript boilerplate', visitors: 20, percentage: 3 }
])

// Chart.js configuration for referrer types
const chartConfig = reactive({
  type: 'pie' as keyof ChartTypeRegistry,
  data: {
    labels: referrerTypesData.value.map(item => item.name),
    datasets: [
      {
        data: referrerTypesData.value.map(item => item.visitors),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)'
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

// Referrer trend data for line chart
const referrerTrendData = ref([
  { date: '2023-09', Direct: 800, Social: 400, Search: 300, Referral: 200 },
  { date: '2023-10', Direct: 850, Social: 420, Search: 320, Referral: 210 },
  { date: '2023-11', Direct: 900, Social: 450, Search: 340, Referral: 220 },
  { date: '2023-12', Direct: 950, Social: 480, Search: 360, Referral: 230 },
  { date: '2024-01', Direct: 1000, Social: 500, Search: 380, Referral: 240 },
  { date: '2024-02', Direct: 1100, Social: 550, Search: 400, Referral: 250 },
  { date: '2024-03', Direct: 1200, Social: 600, Search: 420, Referral: 260 },
  { date: '2024-04', Direct: 1250, Social: 650, Search: 440, Referral: 270 },
  { date: '2024-05', Direct: 1300, Social: 700, Search: 460, Referral: 280 },
  { date: '2024-06', Direct: 1350, Social: 750, Search: 480, Referral: 290 },
  { date: '2024-07', Direct: 1400, Social: 799, Search: 658, Referral: 654 }
])

// Chart.js configuration for referrer trends
const trendChartConfig = reactive({
  type: 'line' as keyof ChartTypeRegistry,
  data: {
    labels: referrerTrendData.value.map(item => item.date),
    datasets: [
      {
        label: 'Direct',
        data: referrerTrendData.value.map(item => item.Direct),
        borderColor: 'rgba(59, 130, 246, 0.8)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: false
      },
      {
        label: 'Social',
        data: referrerTrendData.value.map(item => item.Social),
        borderColor: 'rgba(16, 185, 129, 0.8)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: false
      },
      {
        label: 'Search',
        data: referrerTrendData.value.map(item => item.Search),
        borderColor: 'rgba(245, 158, 11, 0.8)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.4,
        fill: false
      },
      {
        label: 'Referral',
        data: referrerTrendData.value.map(item => item.Referral),
        borderColor: 'rgba(239, 68, 68, 0.8)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
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

// Get referrer type badge class
function getReferrerTypeBadgeClass(type: string): string {
  switch (type) {
    case 'direct':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    case 'social':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'search':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
    case 'referral':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
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
let referrerTypeChart: Chart | null = null
let referrerTrendChart: Chart | null = null

onMounted(() => {
  const typeCtx = document.getElementById('referrerTypeChart') as HTMLCanvasElement
  if (typeCtx) {
    referrerTypeChart = new Chart(typeCtx, chartConfig)
  }

  const trendCtx = document.getElementById('referrerTrendChart') as HTMLCanvasElement
  if (trendCtx) {
    referrerTrendChart = new Chart(trendCtx, trendChartConfig)
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
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Referrer Analytics</h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Detailed breakdown of traffic sources to your website
          </p>
        </div>

        <!-- Referrer Charts -->
        <div class="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- Referrer Type Chart -->
          <div class="bg-white dark:bg-blue-gray-800 rounded-lg p-4 shadow">
            <div class="mb-4">
              <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">Referrer Types</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Distribution of traffic by source type
              </p>
            </div>

            <div class="h-80 w-full">
              <canvas id="referrerTypeChart"></canvas>
            </div>
          </div>

          <!-- Referrer Trend Chart -->
          <div class="bg-white dark:bg-blue-gray-800 rounded-lg p-4 shadow">
            <div class="mb-4">
              <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">Referrer Trends</h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Traffic source trends over time
              </p>
            </div>

            <div class="h-80 w-full">
              <canvas id="referrerTrendChart"></canvas>
            </div>
          </div>
        </div>

        <!-- Referrer Types Summary -->
        <div class="mb-8">
          <div class="mb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Referrer Types</h3>
          </div>

          <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                <tr>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Type
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
                <tr v-for="(type, index) in referrerTypesData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50 relative">
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <div class="absolute inset-0 bg-green-100/50 dark:bg-green-900/50" :style="{ width: type.percentage + '%' }"></div>
                    <span class="relative z-10">{{ type.name }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ type.visitors }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ type.percentage }}%</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Referrers Data Table -->
        <div class="mb-8">
          <div class="mb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Top Referrers</h3>
          </div>

          <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                <tr>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Source
                  </th>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Type
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
                  <td class="px-4 py-3 whitespace-nowrap text-sm relative">
                    <span v-if="referrer.type" class="relative z-10 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" :class="getReferrerTypeBadgeClass(referrer.type)">
                      {{ referrer.type.charAt(0).toUpperCase() + referrer.type.slice(1) }}
                    </span>
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
        </div>

        <!-- Search Terms Data Table -->
        <div>
          <div class="mb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Top Search Terms</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Most common search terms bringing visitors to your site
            </p>
          </div>

          <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                <tr>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Search Term
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
                <tr v-for="(term, index) in searchTermsData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50 relative">
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <div class="absolute inset-0 bg-amber-100/50 dark:bg-amber-900/50" :style="{ width: term.percentage + '%' }"></div>
                    <span class="relative z-10">{{ term.term }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ term.visitors }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ term.percentage }}%</span>
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
