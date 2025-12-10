<script lang="ts" setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useHead } from '@vueuse/head'
import { Chart, registerables, ChartTypeRegistry } from 'chart.js'

// Register Chart.js components
Chart.register(...registerables)

useHead({
  title: 'Dashboard - Page Analytics',
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
  avgTimeOnPage?: string
  bounceRate?: string
}

interface PagePerformanceData {
  path: string
  loadTime: number
  fcp: number
  lcp: number
  cls: number
  score: string
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

// Pages data
const pagesData = ref<PageData[]>([
  { path: '/', entries: 1800, visitors: 1800, views: 2100, percentage: 25, avgTimeOnPage: '02:15', bounceRate: '65%' },
  { path: '/blog', entries: 613, visitors: 613, views: 739, percentage: 15, avgTimeOnPage: '03:45', bounceRate: '45%' },
  { path: '/about', entries: 451, visitors: 451, views: 577, percentage: 12, avgTimeOnPage: '01:30', bounceRate: '70%' },
  { path: '/contact', entries: 342, visitors: 342, views: 451, percentage: 9, avgTimeOnPage: '01:15', bounceRate: '75%' },
  { path: '/products', entries: 337, visitors: 337, views: 460, percentage: 9, avgTimeOnPage: '04:20', bounceRate: '40%' },
  { path: '/guide/get-started.html', entries: 221, visitors: 229, views: 345, percentage: 7, avgTimeOnPage: '05:45', bounceRate: '30%' },
  { path: '/docs', entries: 216, visitors: 217, views: 302, percentage: 6, avgTimeOnPage: '06:30', bounceRate: '25%' },
  { path: '/guide/intro.html', entries: 212, visitors: 217, views: 322, percentage: 6, avgTimeOnPage: '04:15', bounceRate: '35%' },
  { path: '/guide/get-started', entries: 209, visitors: 212, views: 313, percentage: 6, avgTimeOnPage: '05:30', bounceRate: '32%' },
  { path: '/team', entries: 109, visitors: 110, views: 215, percentage: 5, avgTimeOnPage: '02:45', bounceRate: '60%' }
])

// Page performance data
const pagePerformanceData = ref<PagePerformanceData[]>([
  { path: '/', loadTime: 0.8, fcp: 0.9, lcp: 1.2, cls: 0.05, score: 'Good' },
  { path: '/blog', loadTime: 1.2, fcp: 1.3, lcp: 2.1, cls: 0.08, score: 'Good' },
  { path: '/about', loadTime: 0.7, fcp: 0.8, lcp: 1.0, cls: 0.03, score: 'Good' },
  { path: '/contact', loadTime: 0.9, fcp: 1.0, lcp: 1.5, cls: 0.04, score: 'Good' },
  { path: '/products', loadTime: 1.5, fcp: 1.7, lcp: 2.5, cls: 0.1, score: 'Needs Improvement' },
  { path: '/guide/get-started.html', loadTime: 1.8, fcp: 2.0, lcp: 2.8, cls: 0.12, score: 'Needs Improvement' },
  { path: '/docs', loadTime: 2.2, fcp: 2.5, lcp: 3.5, cls: 0.15, score: 'Poor' },
  { path: '/guide/intro.html', loadTime: 1.6, fcp: 1.8, lcp: 2.6, cls: 0.11, score: 'Needs Improvement' },
  { path: '/guide/get-started', loadTime: 1.7, fcp: 1.9, lcp: 2.7, cls: 0.11, score: 'Needs Improvement' },
  { path: '/team', loadTime: 0.8, fcp: 0.9, lcp: 1.3, cls: 0.06, score: 'Good' }
])

// Page views trend data for line chart
const pageViewsTrendData = ref([
  { date: '2023-09-01', views: 800, visitors: 600 },
  { date: '2023-10-01', views: 850, visitors: 650 },
  { date: '2023-11-01', views: 900, visitors: 700 },
  { date: '2023-12-01', views: 1200, visitors: 900 },
  { date: '2024-01-01', views: 1000, visitors: 800 },
  { date: '2024-02-01', views: 1100, visitors: 850 },
  { date: '2024-03-01', views: 1300, visitors: 950 },
  { date: '2024-04-01', views: 1400, visitors: 1050 },
  { date: '2024-05-01', views: 1500, visitors: 1150 },
  { date: '2024-06-01', views: 1600, visitors: 1250 },
  { date: '2024-07-01', views: 1800, visitors: 1400 }
])

// Chart.js configuration for page views trend
const trendChartConfig = reactive({
  type: 'line' as keyof ChartTypeRegistry,
  data: {
    labels: pageViewsTrendData.value.map(item => item.date),
    datasets: [
      {
        label: 'Page Views',
        data: pageViewsTrendData.value.map(item => item.views),
        borderColor: 'rgba(59, 130, 246, 0.8)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true
      },
      {
        label: 'Visitors',
        data: pageViewsTrendData.value.map(item => item.visitors),
        borderColor: 'rgba(16, 185, 129, 0.8)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
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

// Top pages chart configuration
const topPagesChartConfig = reactive({
  type: 'bar' as keyof ChartTypeRegistry,
  data: {
    labels: pagesData.value.slice(0, 5).map(item => item.path),
    datasets: [
      {
        label: 'Page Views',
        data: pagesData.value.slice(0, 5).map(item => item.views),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1
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
        }
      }
    },
    plugins: {
      legend: {
        display: false
      }
    }
  }
})

// Format numbers with commas
function formatNumber(number: number): string {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// Get performance score color class
function getPerformanceColorClass(score: string): string {
  switch (score) {
    case 'Good':
      return 'text-green-600 dark:text-green-400'
    case 'Needs Improvement':
      return 'text-yellow-600 dark:text-yellow-400'
    case 'Poor':
      return 'text-red-600 dark:text-red-400'
    default:
      return 'text-gray-600 dark:text-gray-400'
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
let pageViewsTrendChart: Chart | null = null
let topPagesChart: Chart | null = null

onMounted(() => {
  const trendCtx = document.getElementById('pageViewsTrendChart') as HTMLCanvasElement
  if (trendCtx) {
    pageViewsTrendChart = new Chart(trendCtx, trendChartConfig)
  }

  const topPagesCtx = document.getElementById('topPagesChart') as HTMLCanvasElement
  if (topPagesCtx) {
    topPagesChart = new Chart(topPagesCtx, topPagesChartConfig)
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
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Page Analytics</h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Detailed breakdown of page performance and visitor engagement
          </p>
        </div>

        <!-- Page Views Trend Chart -->
        <div class="mb-8 bg-white dark:bg-blue-gray-800 rounded-lg p-4 shadow">
          <div class="mb-4">
            <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">Page Views Trend</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Page views and visitors over time
            </p>
          </div>

          <div class="h-80 w-full">
            <canvas id="pageViewsTrendChart"></canvas>
          </div>
        </div>

        <!-- Top Pages Chart -->
        <div class="mb-8 bg-white dark:bg-blue-gray-800 rounded-lg p-4 shadow">
          <div class="mb-4">
            <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">Top Pages</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Most viewed pages on your website
            </p>
          </div>

          <div class="h-80 w-full">
            <canvas id="topPagesChart"></canvas>
          </div>
        </div>

        <!-- Pages Data Table -->
        <div class="mb-8">
          <div class="mb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">All Pages</h3>
          </div>

          <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                <tr>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Page
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
                    Avg. Time
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Bounce Rate
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
                    <span class="relative z-10">{{ page.avgTimeOnPage }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ page.bounceRate }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ page.percentage }}%</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Page Performance Data Table -->
        <div>
          <div class="mb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Page Performance</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Core Web Vitals and performance metrics
            </p>
          </div>

          <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                <tr>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Page
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Load Time (s)
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    FCP (s)
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    LCP (s)
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    CLS
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                <tr v-for="(page, index) in pagePerformanceData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50">
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {{ page.path }}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">
                    {{ page.loadTime.toFixed(1) }}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">
                    {{ page.fcp.toFixed(1) }}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">
                    {{ page.lcp.toFixed(1) }}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300">
                    {{ page.cls.toFixed(2) }}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-medium" :class="getPerformanceColorClass(page.score)">
                    {{ page.score }}
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
