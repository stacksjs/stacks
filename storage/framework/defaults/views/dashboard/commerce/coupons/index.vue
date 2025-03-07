<script lang="ts" setup>
import { ref, computed } from 'vue'
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
  title: 'Dashboard - Commerce Coupons',
})

// Chart options
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        display: true,
        color: 'rgba(0, 0, 0, 0.05)',
      },
    },
    x: {
      grid: {
        display: false,
      },
    },
  },
}

// Generate monthly data for charts
const monthlyChartData = computed(() => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  // Sample data - in a real app, this would be calculated from actual usage data
  const redemptionsData = [120, 145, 132, 160, 185, 170, 210, 230, 245, 220, 260, 280]
  const discountData = [2500, 3200, 2800, 3600, 4100, 3800, 4500, 5200, 5800, 5400, 6200, 6800]

  // Coupon usage chart data
  const couponUsageData = {
    labels: months,
    datasets: [
      {
        label: 'Coupon Redemptions',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(59, 130, 246, 1)',
        fill: true,
        tension: 0.4,
        data: redemptionsData,
      },
    ],
  }

  // Discount amount chart data
  const discountAmountData = {
    labels: months,
    datasets: [
      {
        label: 'Discount Amount',
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 1,
        borderRadius: 4,
        data: discountData,
      },
    ],
  }

  return {
    couponUsageData,
    discountAmountData
  }
})

// Time range selector
const timeRange = ref('Last 30 days')
const timeRanges = ['Today', 'Last 7 days', 'Last 30 days', 'Last 90 days', 'Last year', 'All time']

// Sample coupons data
const coupons = ref<Coupon[]>([
  {
    id: 1,
    code: 'WELCOME20',
    type: 'Percentage',
    value: 20,
    minPurchase: 50,
    maxUses: 1000,
    usedCount: 345,
    startDate: '2023-10-01',
    endDate: '2023-12-31',
    status: 'Active'
  },
  {
    id: 2,
    code: 'SUMMER10',
    type: 'Percentage',
    value: 10,
    minPurchase: 0,
    maxUses: 500,
    usedCount: 210,
    startDate: '2023-06-01',
    endDate: '2023-08-31',
    status: 'Expired'
  },
  {
    id: 3,
    code: 'FREESHIP',
    type: 'Fixed',
    value: 15,
    minPurchase: 75,
    maxUses: 2000,
    usedCount: 876,
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    status: 'Active'
  },
  {
    id: 4,
    code: 'HOLIDAY25',
    type: 'Percentage',
    value: 25,
    minPurchase: 100,
    maxUses: 1500,
    usedCount: 0,
    startDate: '2023-12-15',
    endDate: '2023-12-25',
    status: 'Scheduled'
  },
  {
    id: 5,
    code: 'FLASH50',
    type: 'Percentage',
    value: 50,
    minPurchase: 200,
    maxUses: 100,
    usedCount: 100,
    startDate: '2023-11-24',
    endDate: '2023-11-27',
    status: 'Expired'
  }
])

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('code')
const sortOrder = ref('asc')
const statusFilter = ref('all')

// Available statuses
const statuses = ['all', 'Active', 'Expired', 'Scheduled']

// Computed coupon statistics
const couponStats = computed(() => {
  const activeCoupons = coupons.value.filter(c => c.status === 'Active').length
  const totalRedemptions = coupons.value.reduce((sum, c) => sum + c.usedCount, 0)

  // Calculate total discount amount (simplified calculation)
  const totalDiscountAmount = coupons.value.reduce((sum, c) => {
    const avgOrderValue = 100 // Assuming $100 average order value
    let discountPerUse = 0

    if (c.type === 'Percentage') {
      discountPerUse = avgOrderValue * (c.value / 100)
    } else {
      discountPerUse = c.value
    }

    return sum + (discountPerUse * c.usedCount)
  }, 0)

  const avgDiscountPerOrder = totalRedemptions > 0
    ? (totalDiscountAmount / totalRedemptions).toFixed(2)
    : '0.00'

  return {
    activeCoupons,
    totalRedemptions,
    totalDiscountAmount: totalDiscountAmount.toFixed(0),
    avgDiscountPerOrder
  }
})

// Computed filtered and sorted coupons
const filteredCoupons = computed(() => {
  return coupons.value
    .filter(coupon => {
      // Apply search filter
      const matchesSearch = coupon.code.toLowerCase().includes(searchQuery.value.toLowerCase())

      // Apply status filter
      const matchesStatus = statusFilter.value === 'all' || coupon.status === statusFilter.value

      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'code') {
        comparison = a.code.localeCompare(b.code)
      } else if (sortBy.value === 'value') {
        comparison = a.value - b.value
      } else if (sortBy.value === 'usedCount') {
        comparison = a.usedCount - b.usedCount
      } else if (sortBy.value === 'endDate') {
        comparison = new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
})

// Toggle sort order
function toggleSort(column: string): void {
  if (sortBy.value === column) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = column
    sortOrder.value = 'asc'
  }
}

// Get status badge class
function getStatusClass(status: string): string {
  switch (status) {
    case 'Active':
      return 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400'
    case 'Expired':
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
    case 'Scheduled':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400'
    default:
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

// Modal state
const showAddModal = ref(false)
const today = new Date().toISOString().split('T')[0] as string
const nextMonth = new Date()
nextMonth.setMonth(nextMonth.getMonth() + 1)
const nextMonthDate = nextMonth.toISOString().split('T')[0] as string

interface Coupon {
  id: number;
  code: string;
  type: string;
  value: number;
  minPurchase: number;
  maxUses: number;
  usedCount: number;
  startDate: string;
  endDate: string;
  status: string;
}

interface NewCoupon {
  code: string;
  type: string;
  value: number;
  minPurchase: number;
  maxUses: number;
  startDate: string;
  endDate: string;
  status: string;
}

const newCoupon = ref<NewCoupon>({
  code: '',
  type: 'Percentage',
  value: 10,
  minPurchase: 0,
  maxUses: 100,
  startDate: today,
  endDate: nextMonthDate,
  status: 'Active'
})

function openAddModal(): void {
  newCoupon.value = {
    code: '',
    type: 'Percentage',
    value: 10,
    minPurchase: 0,
    maxUses: 100,
    startDate: today,
    endDate: nextMonthDate,
    status: 'Active'
  }
  showAddModal.value = true
}

function closeAddModal(): void {
  showAddModal.value = false
}

function addCoupon(): void {
  // In a real app, this would send data to the server
  const id = Math.max(...coupons.value.map(c => c.id)) + 1
  const newCouponEntry: Coupon = {
    id,
    code: newCoupon.value.code,
    type: newCoupon.value.type,
    value: newCoupon.value.value,
    minPurchase: newCoupon.value.minPurchase,
    maxUses: newCoupon.value.maxUses,
    usedCount: 0,
    startDate: newCoupon.value.startDate,
    endDate: newCoupon.value.endDate,
    status: newCoupon.value.status
  }
  coupons.value.push(newCouponEntry)
  closeAddModal()
}
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Coupons</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Manage discount coupons for your store
            </p>
          </div>
          <div class="mt-4 sm:mt-0">
            <button
              type="button"
              @click="openAddModal"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-1"></div>
              Add coupon
            </button>
          </div>
        </div>

        <!-- Time range selector -->
        <div class="mt-4 flex items-center justify-between">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Overview of your coupon performance
          </p>
          <div class="relative">
            <select v-model="timeRange" class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700">
              <option v-for="range in timeRanges" :key="range" :value="range">{{ range }}</option>
            </select>
          </div>
        </div>

        <!-- Stats -->
        <dl class="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Active Coupons</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ couponStats.activeCoupons }}</dd>
            <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
              <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
              <span>1 more than last month</span>
            </dd>
          </div>

          <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Redemptions</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ couponStats.totalRedemptions.toLocaleString() }}</dd>
            <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
              <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
              <span>12.5% increase</span>
            </dd>
          </div>

          <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Discount Amount</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">${{ couponStats.totalDiscountAmount.toLocaleString() }}</dd>
            <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
              <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
              <span>8.2% increase</span>
            </dd>
          </div>

          <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Avg. Discount per Order</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">${{ couponStats.avgDiscountPerOrder }}</dd>
            <dd class="mt-2 flex items-center text-sm text-red-600 dark:text-red-400">
              <div class="i-hugeicons-analytics-down h-4 w-4 mr-1"></div>
              <span>3.2% decrease</span>
            </dd>
          </div>
        </dl>

        <!-- Charts -->
        <div class="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-6">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Coupon Redemptions</h3>
              <div class="mt-2 h-80">
                <Line :data="monthlyChartData.couponUsageData" :options="chartOptions" />
              </div>
            </div>
          </div>

          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-6">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Discount Amount</h3>
              <div class="mt-2 h-80">
                <Bar :data="monthlyChartData.discountAmountData" :options="chartOptions" />
              </div>
            </div>
          </div>
        </div>

        <!-- Filters -->
        <div class="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="relative max-w-sm">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <div class="i-hugeicons-search-01 h-5 w-5 text-gray-400"></div>
            </div>
            <input
              v-model="searchQuery"
              type="text"
              class="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:placeholder:text-gray-500"
              placeholder="Search coupons..."
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-4">
            <select
              v-model="statusFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Statuses</option>
              <option v-for="status in statuses.slice(1)" :key="status" :value="status">
                {{ status }}
              </option>
            </select>
          </div>
        </div>

        <!-- Coupons table -->
        <div class="mt-6 flow-root">
          <div class="sm:flex sm:items-center sm:justify-between mb-4">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">All Coupons</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              A list of all the coupons in your store including their code, value, and status.
            </p>
          </div>
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-blue-gray-700">
                    <tr>
                      <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-gray-200">
                        <button @click="toggleSort('code')" class="group inline-flex items-center">
                          Coupon Code
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'code'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Type</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('value')" class="group inline-flex items-center">
                          Value
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'value'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Min Purchase</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('usedCount')" class="group inline-flex items-center">
                          Usage
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'usedCount'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('endDate')" class="group inline-flex items-center">
                          Expiry
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'endDate'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Status</th>
                      <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span class="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-blue-gray-800">
                    <tr v-for="coupon in filteredCoupons" :key="coupon.id">
                      <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 dark:text-white">
                        {{ coupon.code }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ coupon.type }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ coupon.type === 'Percentage' ? `${coupon.value}%` : `$${coupon.value.toFixed(2)}` }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ coupon.minPurchase > 0 ? `$${coupon.minPurchase.toFixed(2)}` : 'None' }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ coupon.usedCount }} / {{ coupon.maxUses }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ coupon.endDate }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm">
                        <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium" :class="getStatusClass(coupon.status)">
                          {{ coupon.status }}
                        </span>
                      </td>
                      <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div class="flex items-center justify-end space-x-2">
                          <button type="button" class="text-gray-400 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition-all duration-150">
                            <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                          </button>
                          <button type="button" class="text-gray-400 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-all duration-150">
                            <div class="i-hugeicons-waste h-5 w-5"></div>
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="filteredCoupons.length === 0">
                      <td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        No coupons found matching your criteria
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

    <!-- Add Coupon Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeAddModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Add New Coupon</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="coupon-code" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Coupon Code</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="coupon-code"
                        v-model="newCoupon.code"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="e.g. SUMMER20"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="coupon-type" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Type</label>
                      <div class="mt-2">
                        <select
                          id="coupon-type"
                          v-model="newCoupon.type"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        >
                          <option value="Percentage">Percentage</option>
                          <option value="Fixed">Fixed Amount</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label for="coupon-value" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Value</label>
                      <div class="mt-2">
                        <div class="relative rounded-md shadow-sm">
                          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <span class="text-gray-500 sm:text-sm">{{ newCoupon.type === 'Percentage' ? '%' : '$' }}</span>
                          </div>
                          <input
                            type="number"
                            id="coupon-value"
                            v-model="newCoupon.value"
                            class="block w-full rounded-md border-0 py-1.5 pl-7 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="min-purchase" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Min Purchase</label>
                      <div class="mt-2">
                        <div class="relative rounded-md shadow-sm">
                          <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <span class="text-gray-500 sm:text-sm">$</span>
                          </div>
                          <input
                            type="number"
                            id="min-purchase"
                            v-model="newCoupon.minPurchase"
                            class="block w-full rounded-md border-0 py-1.5 pl-7 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label for="max-uses" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Max Uses</label>
                      <div class="mt-2">
                        <input
                          type="number"
                          id="max-uses"
                          v-model="newCoupon.maxUses"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        />
                      </div>
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="start-date" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Start Date</label>
                      <div class="mt-2">
                        <input
                          type="date"
                          id="start-date"
                          v-model="newCoupon.startDate"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label for="end-date" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">End Date</label>
                      <div class="mt-2">
                        <input
                          type="date"
                          id="end-date"
                          v-model="newCoupon.endDate"
                          class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label for="coupon-status" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Status</label>
                    <div class="mt-2">
                      <select
                        id="coupon-status"
                        v-model="newCoupon.status"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option value="Active">Active</option>
                        <option value="Scheduled">Scheduled</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="addCoupon"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            >
              Add
            </button>
            <button
              type="button"
              @click="closeAddModal"
              class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
