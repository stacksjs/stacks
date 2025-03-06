<script lang="ts" setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useHead } from '@vueuse/head'
import { Chart, registerables, ChartTypeRegistry } from 'chart.js'

// Register Chart.js components
Chart.register(...registerables)

useHead({
  title: 'Dashboard - Commerce Sales Analytics',
})

// Types
interface DateRange {
  id: string
  name: string
}

interface ProductData {
  name: string
  sku: string
  sales: number
  revenue: number
  percentage: number
}

interface CategoryData {
  name: string
  sales: number
  revenue: number
  percentage: number
}

interface CustomerData {
  name: string
  orders: number
  spent: number
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

// Sales overview data
const salesOverview = ref({
  totalRevenue: 1245678.90,
  totalOrders: 34567,
  averageOrderValue: 36.04,
  conversionRate: '2.4%',
  returnRate: '5.2%',
  repeatCustomerRate: '28%'
})

// Sales data for chart
const salesData = ref([
  { date: '2023-11-01', revenue: 25000, orders: 980 },
  { date: '2023-12-01', revenue: 35000, orders: 1220 },
  { date: '2024-01-01', revenue: 42000, orders: 1440 },
  { date: '2024-02-01', revenue: 68000, orders: 2100 },
  { date: '2024-03-01', revenue: 85000, orders: 2700 },
  { date: '2024-04-01', revenue: 65000, orders: 1900 },
  { date: '2024-05-01', revenue: 45000, orders: 1200 },
  { date: '2024-06-01', revenue: 30000, orders: 800 },
  { date: '2024-07-01', revenue: 45000, orders: 1200 },
  { date: '2024-08-01', revenue: 30000, orders: 800 },
  { date: '2024-09-01', revenue: 30000, orders: 800 },
  { date: '2024-10-01', revenue: 45000, orders: 1200 },
  { date: '2024-11-01', revenue: 24000, orders: 600 },
  { date: '2024-12-01', revenue: 90000, orders: 2300 },
  { date: '2025-01-01', revenue: 30000, orders: 800 },
  { date: '2025-02-01', revenue: 18000, orders: 400 }
])

// Chart.js configuration
const chartConfig = reactive({
  type: 'line' as keyof ChartTypeRegistry,
  data: {
    labels: salesData.value.map(item => item.date),
    datasets: [
      {
        label: 'Revenue ($)',
        data: salesData.value.map(item => item.revenue),
        backgroundColor: 'rgba(16, 185, 129, 0.3)',
        borderColor: 'rgba(16, 185, 129, 0.8)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        yAxisID: 'y'
      },
      {
        label: 'Orders',
        data: salesData.value.map(item => item.orders),
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderColor: 'rgba(245, 158, 11, 0.8)',
        borderWidth: 2,
        tension: 0.4,
        fill: false,
        yAxisID: 'y1'
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
            return index % Math.floor(salesData.value.length / 4) === 0 ? labels[Math.floor(index / (salesData.value.length / 4))] || '' : ''
          }
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        beginAtZero: true,
        grid: {
          borderDash: [2, 4],
          color: 'rgba(160, 174, 192, 0.2)'
        },
        ticks: {
          maxTicksLimit: 6,
          callback: function(value: any) {
            return '$' + value.toLocaleString()
          }
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        beginAtZero: true,
        grid: {
          display: false
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
        intersect: false,
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.dataset.yAxisID === 'y') {
              label += '$' + context.parsed.y.toLocaleString();
            } else {
              label += context.parsed.y;
            }
            return label;
          }
        }
      }
    }
  }
})

// Products data
const productsData = ref<ProductData[]>([
  { name: 'Smartphone X Pro', sku: 'SP-X-PRO', sales: 1245, revenue: 623450, percentage: 0 },
  { name: 'Wireless Earbuds', sku: 'WE-200', sales: 3567, revenue: 178350, percentage: 0 },
  { name: 'Smart Watch Series 5', sku: 'SW-S5', sales: 2134, revenue: 149380, percentage: 0 },
  { name: 'Laptop Ultra Slim', sku: 'LT-US-15', sales: 876, revenue: 131400, percentage: 0 },
  { name: 'Bluetooth Speaker', sku: 'BS-100', sales: 1543, revenue: 61720, percentage: 0 },
  { name: 'Fitness Tracker', sku: 'FT-300', sales: 1876, revenue: 56280, percentage: 0 },
  { name: 'Tablet Pro 12', sku: 'TB-P12', sales: 654, revenue: 45780, percentage: 0 },
  { name: 'Gaming Mouse', sku: 'GM-RGB', sales: 1234, revenue: 43190, percentage: 0 },
  { name: 'Mechanical Keyboard', sku: 'KB-MECH', sales: 987, revenue: 39480, percentage: 0 },
  { name: 'External SSD 1TB', sku: 'SSD-1TB', sales: 765, revenue: 38250, percentage: 0 }
])

// Calculate percentages for products based on revenue
const totalProductRevenue = computed(() => productsData.value.reduce((sum, product) => sum + product.revenue, 0))
// Update percentages
productsData.value.forEach(product => {
  product.percentage = Math.round((product.revenue / totalProductRevenue.value) * 100)
})

// Categories data
const categoriesData = ref<CategoryData[]>([
  { name: 'Electronics', sales: 5678, revenue: 850200, percentage: 0 },
  { name: 'Clothing', sales: 4532, revenue: 226600, percentage: 0 },
  { name: 'Home & Kitchen', sales: 3210, revenue: 160500, percentage: 0 },
  { name: 'Beauty & Personal Care', sales: 2876, revenue: 143800, percentage: 0 },
  { name: 'Sports & Outdoors', sales: 1987, revenue: 99350, percentage: 0 },
  { name: 'Books', sales: 1654, revenue: 33080, percentage: 0 },
  { name: 'Toys & Games', sales: 1432, revenue: 57280, percentage: 0 },
  { name: 'Health & Household', sales: 1234, revenue: 61700, percentage: 0 },
  { name: 'Automotive', sales: 876, revenue: 43800, percentage: 0 },
  { name: 'Pet Supplies', sales: 765, revenue: 38250, percentage: 0 }
])

// Calculate percentages for categories based on revenue
const totalCategoryRevenue = computed(() => categoriesData.value.reduce((sum, category) => sum + category.revenue, 0))
// Update percentages
categoriesData.value.forEach(category => {
  category.percentage = Math.round((category.revenue / totalCategoryRevenue.value) * 100)
})

// Top customers data
const customersData = ref<CustomerData[]>([
  { name: 'John Smith', orders: 24, spent: 4800, percentage: 0 },
  { name: 'Sarah Johnson', orders: 18, spent: 3600, percentage: 0 },
  { name: 'Michael Brown', orders: 15, spent: 3000, percentage: 0 },
  { name: 'Emily Davis', orders: 12, spent: 2400, percentage: 0 },
  { name: 'David Wilson', orders: 10, spent: 2000, percentage: 0 }
])

// Calculate percentages for customers based on spent
const totalCustomerSpent = computed(() => customersData.value.reduce((sum, customer) => sum + customer.spent, 0))
// Update percentages
customersData.value.forEach(customer => {
  customer.percentage = Math.round((customer.spent / totalCustomerSpent.value) * 100)
})

// Format numbers with commas
function formatNumber(number: number): string {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// Format currency
function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Get percentage color class
function getPercentageColorClass(percentage: number): string {
  if (percentage >= 70) return 'text-green-600 dark:text-green-400'
  if (percentage >= 40) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

// Initialize chart when component is mounted
let salesChart: Chart | null = null

onMounted(() => {
  const ctx = document.getElementById('salesChart') as HTMLCanvasElement
  if (ctx) {
    salesChart = new Chart(ctx, chartConfig)
  }
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
          <!-- Total Revenue -->
          <div class="flex flex-col items-center justify-center">
            <div class="text-4xl font-bold text-white">$1.25M</div>
            <div class="text-sm text-gray-400">Total Revenue</div>
          </div>

          <!-- Total Orders -->
          <div class="flex flex-col items-center justify-center">
            <div class="text-4xl font-bold text-white">34.6k</div>
            <div class="text-sm text-gray-400">Total Orders</div>
          </div>

          <!-- Average Order Value -->
          <div class="flex flex-col items-center justify-center">
            <div class="text-4xl font-bold text-white">${{ salesOverview.averageOrderValue }}</div>
            <div class="text-sm text-gray-400">Avg Order Value</div>
          </div>

          <!-- Conversion Rate -->
          <div class="flex flex-col items-center justify-center">
            <div class="text-4xl font-bold text-white">{{ salesOverview.conversionRate }}</div>
            <div class="text-sm text-gray-400">Conversion Rate</div>
          </div>

          <!-- Return Rate -->
          <div class="flex flex-col items-center justify-center">
            <div class="text-4xl font-bold text-white">{{ salesOverview.returnRate }}</div>
            <div class="text-sm text-gray-400">Return Rate</div>
          </div>

          <!-- Repeat Customer Rate -->
          <div class="flex flex-col items-center justify-center">
            <div class="text-4xl font-bold text-white">{{ salesOverview.repeatCustomerRate }}</div>
            <div class="text-sm text-gray-400">Repeat Customers</div>
          </div>
        </div>

        <!-- Sales Chart -->
        <div class="mb-8 bg-white dark:bg-blue-gray-800 rounded-lg p-4 shadow">
          <!-- Chart header -->
          <div class="mb-4">
            <h3 class="text-lg font-medium leading-6 text-gray-900 dark:text-white">Sales Overview</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Revenue and order volume over time
            </p>
          </div>

          <!-- Chart.js canvas -->
          <div class="h-80 w-full">
            <canvas id="salesChart"></canvas>
          </div>
        </div>

        <!-- Data Tables -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- Top Products Table -->
          <div>
            <div class="mb-4">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Top Products</h3>
            </div>

            <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                  <tr>
                    <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Product
                    </th>
                    <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Sales
                    </th>
                    <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Revenue
                    </th>
                    <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      %
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                  <tr v-for="(product, index) in productsData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50 relative">
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <div class="absolute inset-0 bg-green-100/50 dark:bg-green-900/50" :style="{ width: product.percentage + '%' }"></div>
                      <span class="relative z-10">{{ product.name }}</span>
                      <span class="relative z-10 text-xs text-gray-500 dark:text-gray-400 block">{{ product.sku }}</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ formatNumber(product.sales) }}</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ formatCurrency(product.revenue) }}</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ product.percentage }}%</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="mt-2 flex justify-end">
              <a href="/dashboard/commerce/analytics/sales/products" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                View all products
              </a>
            </div>
          </div>

          <!-- Categories Table -->
          <div>
            <div class="mb-4">
              <h3 class="text-lg font-medium text-gray-900 dark:text-white">Categories</h3>
            </div>

            <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                  <tr>
                    <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Category
                    </th>
                    <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Sales
                    </th>
                    <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      Revenue
                    </th>
                    <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                      %
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                  <tr v-for="(category, index) in categoriesData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50 relative">
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <div class="absolute inset-0 bg-blue-100/50 dark:bg-blue-900/50" :style="{ width: category.percentage + '%' }"></div>
                      <span class="relative z-10">{{ category.name }}</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ formatNumber(category.sales) }}</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ formatCurrency(category.revenue) }}</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                      <span class="relative z-10">{{ category.percentage }}%</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="mt-2 flex justify-end">
              <a href="/dashboard/commerce/analytics/sales/categories" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                View all categories
              </a>
            </div>
          </div>
        </div>

        <!-- Top Customers -->
        <div class="mt-8">
          <div class="mb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Top Customers</h3>
          </div>

          <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-blue-gray-700/50">
                <tr>
                  <th scope="col" class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Customer
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Orders
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    Total Spent
                  </th>
                  <th scope="col" class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-300">
                    %
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-blue-gray-800">
                <tr v-for="(customer, index) in customersData" :key="index" class="hover:bg-gray-50 dark:hover:bg-blue-gray-700/50 relative">
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    <div class="absolute inset-0 bg-purple-100/50 dark:bg-purple-900/50" :style="{ width: customer.percentage + '%' }"></div>
                    <span class="relative z-10">{{ customer.name }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ customer.orders }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ formatCurrency(customer.spent) }}</span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-300 relative">
                    <span class="relative z-10">{{ customer.percentage }}%</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="mt-2 flex justify-end">
            <a href="/dashboard/commerce/analytics/sales/customers" class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
              View all customers
            </a>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
