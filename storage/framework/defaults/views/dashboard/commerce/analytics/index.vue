<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import { Line, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
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
  Title,
  Tooltip,
  Legend,
  Filler,
)

useHead({
  title: 'Dashboard - Commerce Analytics',
})

// Define types
interface SalesData {
  date: string
  revenue: number
  orders: number
  averageOrderValue: number
}

interface ProductPerformance {
  id: number
  name: string
  imageUrl: string
  category: string
  sales: number
  revenue: number
  conversion: number
  trend: 'up' | 'down' | 'stable'
  percentChange: number
}

interface CategoryPerformance {
  name: string
  sales: number
  revenue: number
  percentOfTotal: number
}

interface CustomerMetric {
  name: string
  value: number
  change: number
  trend: 'up' | 'down' | 'stable'
}

// Date range selection
const dateRanges = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'Year to date', 'Custom']
const selectedDateRange = ref('Last 30 days')
const customStartDate = ref('')
const customEndDate = ref('')

// Comparison toggle
const showComparison = ref(false)
const comparisonType = ref('previous_period')
const comparisonTypes = ['previous_period', 'previous_year', 'custom']

// Chart type selection
const chartType = ref('revenue')
const chartTypes = ['revenue', 'orders', 'average_order_value']

// Sample sales data (daily data for the last 30 days)
const salesData = ref<SalesData[]>([])

// Generate sample data
onMounted(() => {
  generateSalesData()
})

function generateSalesData() {
  const data: SalesData[] = []
  const now = new Date()

  // Generate 90 days of data for different date range options
  for (let i = 90; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)

    // Create some realistic patterns with weekends having higher sales
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    // Base values with some randomness
    const baseOrders = isWeekend ? 35 : 20
    const randomFactor = 0.3 // 30% randomness

    const orders = Math.round(baseOrders * (1 + (Math.random() * 2 - 1) * randomFactor))
    const averageOrderValue = 50 + Math.round(Math.random() * 30)
    const revenue = orders * averageOrderValue

    const dateStr = date.toISOString().split('T')[0]
    if (dateStr) {
      data.push({
        date: dateStr,
        revenue,
        orders,
        averageOrderValue
      })
    }
  }

  salesData.value = data
}

// Sample top-performing products
const topProducts = ref<ProductPerformance[]>([
  {
    id: 1,
    name: 'Classic Cheeseburger',
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    category: 'Burgers',
    sales: 243,
    revenue: 3156.57,
    conversion: 8.2,
    trend: 'up',
    percentChange: 12.5
  },
  {
    id: 4,
    name: 'Spicy Ramen Bowl',
    imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    category: 'Asian',
    sales: 201,
    revenue: 3213.99,
    conversion: 7.8,
    trend: 'up',
    percentChange: 18.3
  },
  {
    id: 9,
    name: 'Chicken Wings (12 pc)',
    imageUrl: 'https://images.unsplash.com/photo-1608039755401-742074f0548d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    category: 'Appetizers',
    sales: 215,
    revenue: 3224.85,
    conversion: 7.5,
    trend: 'up',
    percentChange: 5.2
  },
  {
    id: 2,
    name: 'Margherita Pizza',
    imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    category: 'Pizza',
    sales: 189,
    revenue: 2456.11,
    conversion: 6.9,
    trend: 'down',
    percentChange: 3.1
  },
  {
    id: 7,
    name: 'Chocolate Brownie Sundae',
    imageUrl: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    category: 'Desserts',
    sales: 178,
    revenue: 1600.22,
    conversion: 6.2,
    trend: 'stable',
    percentChange: 0.8
  }
])

// Sample category performance
const categoryPerformance = ref<CategoryPerformance[]>([
  { name: 'Burgers', sales: 523, revenue: 6789.47, percentOfTotal: 28 },
  { name: 'Asian', sales: 412, revenue: 6578.88, percentOfTotal: 22 },
  { name: 'Pizza', sales: 389, revenue: 5834.11, percentOfTotal: 19 },
  { name: 'Appetizers', sales: 315, revenue: 5346.85, percentOfTotal: 17 },
  { name: 'Desserts', sales: 267, revenue: 2403.33, percentOfTotal: 8 },
  { name: 'Beverages', sales: 143, revenue: 856.57, percentOfTotal: 3 },
  { name: 'Other', sales: 98, revenue: 686.00, percentOfTotal: 3 }
])

// Customer metrics
const customerMetrics = ref<CustomerMetric[]>([
  { name: 'New Customers', value: 156, change: 12.4, trend: 'up' },
  { name: 'Returning Customers', value: 432, change: 8.7, trend: 'up' },
  { name: 'Average Items Per Order', value: 3.2, change: 0.5, trend: 'up' },
  { name: 'Cart Abandonment Rate', value: 23.5, change: 2.1, trend: 'down' }
])

// Summary metrics
const totalRevenue = computed(() => {
  return filteredSalesData.value.reduce((sum, day) => sum + day.revenue, 0)
})

const totalOrders = computed(() => {
  return filteredSalesData.value.reduce((sum, day) => sum + day.orders, 0)
})

const averageOrderValue = computed(() => {
  if (totalOrders.value === 0) return 0
  return totalRevenue.value / totalOrders.value
})

// Filter sales data based on selected date range
const filteredSalesData = computed(() => {
  const now = new Date()
  let startDate: Date = new Date(now)
  startDate.setDate(startDate.getDate() - 30) // Default to 30 days

  switch (selectedDateRange.value) {
    case 'Last 7 days':
      startDate = new Date(now)
      startDate.setDate(startDate.getDate() - 7)
      break
    case 'Last 30 days':
      startDate = new Date(now)
      startDate.setDate(startDate.getDate() - 30)
      break
    case 'Last 90 days':
      startDate = new Date(now)
      startDate.setDate(startDate.getDate() - 90)
      break
    case 'Year to date':
      startDate = new Date(now.getFullYear(), 0, 1) // January 1st of current year
      break
    case 'Custom':
      if (customStartDate.value) {
        startDate = new Date(customStartDate.value)
      }
      break
  }

  let endDate: Date = new Date(now)
  if (selectedDateRange.value === 'Custom' && customEndDate.value) {
    endDate = new Date(customEndDate.value)
  }

  // Convert to string format for comparison
  const startDateStr = startDate.toISOString().split('T')[0] || ''
  const endDateStr = endDate.toISOString().split('T')[0] || ''

  return salesData.value.filter(day => {
    return day.date >= startDateStr && day.date <= endDateStr
  })
})

// Get comparison data for the previous period
const comparisonData = computed(() => {
  if (!showComparison.value || filteredSalesData.value.length === 0) return null

  const currentPeriodDays = filteredSalesData.value.length
  let startDate: Date | null = null
  let endDate: Date | null = null

  if (comparisonType.value === 'previous_period' && filteredSalesData.value[0]?.date) {
    // Previous period of same length
    endDate = new Date(filteredSalesData.value[0].date)
    endDate.setDate(endDate.getDate() - 1)

    startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - currentPeriodDays + 1)
  } else if (comparisonType.value === 'previous_year' &&
             filteredSalesData.value[0]?.date) {
    // Same period last year
    startDate = new Date(filteredSalesData.value[0].date)
    startDate.setFullYear(startDate.getFullYear() - 1)

    // Safely access the last element
    const lastItem = filteredSalesData.value[filteredSalesData.value.length - 1]
    if (lastItem?.date) {
      endDate = new Date(lastItem.date)
      endDate.setFullYear(endDate.getFullYear() - 1)
    } else {
      // If we can't get the last date, use the first date plus the period length
      endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + currentPeriodDays - 1)
    }
  } else {
    // Custom comparison not implemented in this example or missing data
    return null
  }

  // If we couldn't determine dates, return null
  if (!startDate || !endDate) return null

  // Convert to string format for comparison and ensure they're not undefined
  const startDateStr = startDate.toISOString().split('T')[0] || ''
  const endDateStr = endDate.toISOString().split('T')[0] || ''

  // Only proceed if we have valid date strings
  if (!startDateStr || !endDateStr) return null

  return salesData.value.filter(day => {
    return day.date >= startDateStr && day.date <= endDateStr
  })
})

// Calculate comparison metrics
const revenueChange = computed(() => {
  if (!comparisonData.value) return { value: 0, percent: 0 }

  const currentRevenue = filteredSalesData.value.reduce((sum, day) => sum + day.revenue, 0)
  const previousRevenue = comparisonData.value.reduce((sum, day) => sum + day.revenue, 0)

  const change = currentRevenue - previousRevenue
  const percent = previousRevenue === 0 ? 0 : (change / previousRevenue) * 100

  return { value: change, percent }
})

const ordersChange = computed(() => {
  if (!comparisonData.value) return { value: 0, percent: 0 }

  const currentOrders = filteredSalesData.value.reduce((sum, day) => sum + day.orders, 0)
  const previousOrders = comparisonData.value.reduce((sum, day) => sum + day.orders, 0)

  const change = currentOrders - previousOrders
  const percent = previousOrders === 0 ? 0 : (change / previousOrders) * 100

  return { value: change, percent }
})

const aovChange = computed(() => {
  if (!comparisonData.value) return { value: 0, percent: 0 }

  const currentRevenue = filteredSalesData.value.reduce((sum, day) => sum + day.revenue, 0)
  const currentOrders = filteredSalesData.value.reduce((sum, day) => sum + day.orders, 0)
  const currentAOV = currentOrders === 0 ? 0 : currentRevenue / currentOrders

  const previousRevenue = comparisonData.value.reduce((sum, day) => sum + day.revenue, 0)
  const previousOrders = comparisonData.value.reduce((sum, day) => sum + day.orders, 0)
  const previousAOV = previousOrders === 0 ? 0 : previousRevenue / previousOrders

  const change = currentAOV - previousAOV
  const percent = previousAOV === 0 ? 0 : (change / previousAOV) * 100

  return { value: change, percent }
})

// Helper functions
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value)
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value / 100)
}

function getTrendClass(trend: 'up' | 'down' | 'stable', inverse: boolean = false): string {
  if (trend === 'stable') return 'text-gray-500 dark:text-gray-400'

  if (inverse) {
    // For metrics where down is good (like cart abandonment)
    return trend === 'down'
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400'
  }

  // For normal metrics where up is good
  return trend === 'up'
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400'
}

function getTrendIcon(trend: 'up' | 'down' | 'stable'): string {
  if (trend === 'up') return 'i-hugeicons-arrow-up-01'
  if (trend === 'down') return 'i-hugeicons-arrow-down-02-01'
  return 'i-hugeicons-minus'
}

// Update date range
function updateDateRange(range: string): void {
  selectedDateRange.value = range
}

// Toggle comparison view
function toggleComparison(): void {
  showComparison.value = !showComparison.value
}

// Update chart type
function updateChartType(type: string): void {
  chartType.value = type
}

// Chart data computed properties
const combinedChartData = computed(() => {
  const labels = filteredSalesData.value.map(day => {
    const date = new Date(day.date)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })

  // Define datasets with proper typing
  const datasets = [
    {
      label: 'Revenue',
      data: filteredSalesData.value.map(day => day.revenue),
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderColor: 'rgb(59, 130, 246)',
      fill: false,
      yAxisID: 'y-revenue',
    },
    {
      label: 'Orders',
      data: filteredSalesData.value.map(day => day.orders),
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderColor: 'rgb(16, 185, 129)',
      fill: false,
      yAxisID: 'y-orders',
    },
    {
      label: 'Average Order Value',
      data: filteredSalesData.value.map(day => day.averageOrderValue),
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      borderColor: 'rgb(139, 92, 246)',
      fill: false,
      yAxisID: 'y-aov',
    }
  ]

  // Add comparison data if available
  if (showComparison.value && comparisonData.value) {
    datasets.push({
      label: 'Revenue (Previous)',
      data: comparisonData.value.map(day => day.revenue),
      backgroundColor: 'rgba(147, 197, 253, 0.1)',
      borderColor: 'rgb(147, 197, 253)',
      fill: false,
      yAxisID: 'y-revenue',
    })

    datasets.push({
      label: 'Orders (Previous)',
      data: comparisonData.value.map(day => day.orders),
      backgroundColor: 'rgba(167, 243, 208, 0.1)',
      borderColor: 'rgb(167, 243, 208)',
      fill: false,
      yAxisID: 'y-orders',
    })

    datasets.push({
      label: 'AOV (Previous)',
      data: comparisonData.value.map(day => day.averageOrderValue),
      backgroundColor: 'rgba(196, 181, 253, 0.1)',
      borderColor: 'rgb(196, 181, 253)',
      fill: false,
      yAxisID: 'y-aov',
    })
  }

  return { labels, datasets }
})

// Simplified chart options to avoid type issues
const combinedChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    'y-revenue': {
      type: 'linear',
      position: 'left',
      title: {
        display: true,
        text: 'Revenue ($)',
        color: 'rgb(59, 130, 246)',
      },
      ticks: {
        color: 'rgb(59, 130, 246)',
      },
    },
    'y-orders': {
      type: 'linear',
      position: 'right',
      title: {
        display: true,
        text: 'Orders',
        color: 'rgb(16, 185, 129)',
      },
      ticks: {
        color: 'rgb(16, 185, 129)',
      },
      grid: {
        drawOnChartArea: false,
      },
    },
    'y-aov': {
      type: 'linear',
      position: 'right',
      title: {
        display: true,
        text: 'AOV ($)',
        color: 'rgb(139, 92, 246)',
      },
      ticks: {
        color: 'rgb(139, 92, 246)',
      },
      grid: {
        drawOnChartArea: false,
      },
    },
    x: {
      grid: {
        display: false,
      },
    },
  },
  plugins: {
    legend: {
      display: true,
      position: 'top',
    },
    tooltip: {
      mode: 'index',
      intersect: false,
    },
  },
} as any // Using type assertion to bypass complex Chart.js typing issues

const categoryChartData = computed(() => {
  return {
    labels: categoryPerformance.value.map(cat => cat.name),
    datasets: [
      {
        label: 'Revenue by Category',
        data: categoryPerformance.value.map(cat => cat.revenue),
        backgroundColor: [
          'rgba(59, 130, 246, 0.7)',
          'rgba(16, 185, 129, 0.7)',
          'rgba(139, 92, 246, 0.7)',
          'rgba(245, 158, 11, 0.7)',
          'rgba(239, 68, 68, 0.7)',
          'rgba(99, 102, 241, 0.7)',
          'rgba(156, 163, 175, 0.7)',
        ],
      }
    ]
  }
})

const categoryChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
  },
} as any
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <!-- Header section -->
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Analytics</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Track your commerce performance metrics
            </p>
          </div>

          <!-- Date range selector -->
          <div class="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
            <div class="relative">
              <div class="flex">
                <div class="relative flex items-stretch flex-grow focus-within:z-10">
                  <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <div class="i-hugeicons-calendar h-5 w-5 text-gray-400"></div>
                  </div>
                  <button
                    type="button"
                    class="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
                  >
                    {{ selectedDateRange }}
                  </button>
                </div>
                <button
                  type="button"
                  class="relative -ml-px inline-flex items-center gap-x-1.5 rounded-r-md px-3 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700"
                >
                  <div class="i-hugeicons-chevron-down h-5 w-5 text-gray-400"></div>
                </button>
              </div>

              <!-- Date range dropdown (simplified for this example) -->
              <div class="hidden absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-blue-gray-800 dark:ring-gray-700">
                <div class="py-1">
                  <button
                    v-for="range in dateRanges"
                    :key="range"
                    @click="updateDateRange(range)"
                    class="block px-4 py-2 text-sm w-full text-left hover:bg-gray-100 dark:hover:bg-blue-gray-700"
                    :class="selectedDateRange === range ? 'bg-gray-100 text-gray-900 dark:bg-blue-gray-700 dark:text-white' : 'text-gray-700 dark:text-gray-300'"
                  >
                    {{ range }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Comparison toggle -->
            <button
              @click="toggleComparison"
              class="inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-inset"
              :class="showComparison ? 'bg-blue-600 text-white ring-blue-600' : 'bg-white text-gray-900 ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700'"
            >
              <div class="i-hugeicons-chart-column-01 h-5 w-5 mr-1"></div>
              {{ showComparison ? 'Hide Comparison' : 'Show Comparison' }}
            </button>
          </div>
        </div>

        <!-- Summary metrics -->
        <div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <!-- Total revenue card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-green-100 p-2 dark:bg-green-900">
                    <div class="i-hugeicons-dollar-circle h-6 w-6 text-green-600 dark:text-green-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Revenue</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ formatCurrency(totalRevenue) }}</div>
                      <div v-if="showComparison" class="mt-1 flex items-center text-sm">
                        <span :class="revenueChange.percent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                          <div v-if="revenueChange.percent >= 0" class="i-hugeicons-arrow-up-01 h-4 w-4 inline-block"></div>
                          <div v-else class="i-hugeicons-arrow-down-02-01 h-4 w-4 inline-block"></div>
                          {{ formatPercent(Math.abs(revenueChange.percent)) }}
                        </span>
                        <span class="ml-1 text-gray-500 dark:text-gray-400">vs previous period</span>
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Total orders card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-blue-100 p-2 dark:bg-blue-900">
                    <div class="i-hugeicons-shopping-bag-01 h-6 w-6 text-blue-600 dark:text-blue-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Total Orders</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ totalOrders }}</div>
                      <div v-if="showComparison" class="mt-1 flex items-center text-sm">
                        <span :class="ordersChange.percent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                          <div v-if="ordersChange.percent >= 0" class="i-hugeicons-arrow-up-01 h-4 w-4 inline-block"></div>
                          <div v-else class="i-hugeicons-arrow-down-02-01 h-4 w-4 inline-block"></div>
                          {{ formatPercent(Math.abs(ordersChange.percent)) }}
                        </span>
                        <span class="ml-1 text-gray-500 dark:text-gray-400">vs previous period</span>
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <!-- Average order value card -->
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-5">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="h-10 w-10 rounded-md bg-purple-100 p-2 dark:bg-purple-900">
                    <div class="i-hugeicons-chart-average h-6 w-6 text-purple-600 dark:text-purple-300"></div>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">Average Order Value</dt>
                    <dd>
                      <div class="text-lg font-medium text-gray-900 dark:text-white">{{ formatCurrency(averageOrderValue) }}</div>
                      <div v-if="showComparison" class="mt-1 flex items-center text-sm">
                        <span :class="aovChange.percent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
                          <div v-if="aovChange.percent >= 0" class="i-hugeicons-arrow-up-01 h-4 w-4 inline-block"></div>
                          <div v-else class="i-hugeicons-arrow-down-02-01 h-4 w-4 inline-block"></div>
                          {{ formatPercent(Math.abs(aovChange.percent)) }}
                        </span>
                        <span class="ml-1 text-gray-500 dark:text-gray-400">vs previous period</span>
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sales chart section -->
        <div class="mt-8">
          <div class="rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-6">
              <div class="sm:flex sm:items-center sm:justify-between">
                <div>
                  <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Sales Performance</h3>
                  <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {{ selectedDateRange }} overview
                  </p>
                </div>
              </div>

              <!-- Chart visualization with Chart.js -->
              <div class="mt-6 h-80">
                <Line
                  v-if="filteredSalesData.length > 0"
                  :data="combinedChartData"
                  :options="combinedChartOptions"
                />
                <div v-else class="h-full w-full rounded-lg bg-gray-100 dark:bg-blue-gray-700 flex items-center justify-center">
                  <div class="text-center">
                    <div class="i-hugeicons-chart-column-01 h-12 w-12 mx-auto text-gray-400 dark:text-gray-500"></div>
                    <p class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No data available</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Try selecting a different date range</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Top products and category performance -->
        <div class="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <!-- Top products -->
          <div class="rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-6">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Top Performing Products</h3>
              <div class="mt-6 flow-root">
                <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                  <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                    <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                      <thead>
                        <tr>
                          <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-0">Product</th>
                          <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-white">Sales</th>
                          <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-white">Revenue</th>
                          <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-white">Conversion</th>
                          <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-white">Change</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                        <tr v-for="product in topProducts" :key="product.id" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700">
                          <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-0">
                            <div class="flex items-center">
                              <div class="h-10 w-10 flex-shrink-0">
                                <img :src="product.imageUrl" :alt="product.name" class="h-10 w-10 rounded-md object-cover" />
                              </div>
                              <div class="ml-4">
                                <div class="font-medium text-gray-900 dark:text-white">{{ product.name }}</div>
                                <div class="text-gray-500 dark:text-gray-400">{{ product.category }}</div>
                              </div>
                            </div>
                          </td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500 dark:text-gray-400">{{ product.sales }}</td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500 dark:text-gray-400">{{ formatCurrency(product.revenue) }}</td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500 dark:text-gray-400">{{ product.conversion }}%</td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-right">
                            <span :class="getTrendClass(product.trend)">
                              <div :class="[getTrendIcon(product.trend), 'h-4 w-4 inline-block mr-1']"></div>
                              {{ formatPercent(product.percentChange) }}
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

          <!-- Category performance -->
          <div class="rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-6">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Category Performance</h3>

              <!-- Add chart above the table -->
              <div class="mt-4 h-60">
                <Bar
                  :data="categoryChartData"
                  :options="categoryChartOptions"
                />
              </div>

              <div class="mt-6 flow-root">
                <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                  <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                    <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                      <thead>
                        <tr>
                          <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-0">Category</th>
                          <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-white">Sales</th>
                          <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-white">Revenue</th>
                          <th scope="col" class="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-white">% of Total</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                        <tr v-for="category in categoryPerformance" :key="category.name" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700">
                          <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-0">{{ category.name }}</td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500 dark:text-gray-400">{{ category.sales }}</td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500 dark:text-gray-400">{{ formatCurrency(category.revenue) }}</td>
                          <td class="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-500 dark:text-gray-400">{{ formatPercent(category.percentOfTotal) }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Customer metrics -->
        <div class="mt-8">
          <div class="rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-6">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Customer Metrics</h3>
              <div class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <div v-for="metric in customerMetrics" :key="metric.name" class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-blue-gray-700">
                  <div class="p-5">
                    <div class="flex items-center">
                      <div class="w-0 flex-1">
                        <dl>
                          <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-400">{{ metric.name }}</dt>
                          <dd>
                            <div class="text-lg font-medium text-gray-900 dark:text-white">
                              {{ metric.name.includes('Rate') ? formatPercent(metric.value) : metric.value }}
                            </div>
                            <div class="mt-1 flex items-center text-sm">
                              <span :class="getTrendClass(metric.trend, metric.name === 'Cart Abandonment Rate')">
                                <div :class="[getTrendIcon(metric.trend), 'h-4 w-4 inline-block mr-1']"></div>
                                {{ formatPercent(Math.abs(metric.change)) }}
                              </span>
                              <span class="ml-1 text-gray-500 dark:text-gray-400">vs previous period</span>
                            </div>
                          </dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
