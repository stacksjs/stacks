<route lang="yaml">
  meta:
    requiresAuth: true
</route>

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
  title: 'Dashboard - Commerce Payments',
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

  // Sample data - in a real app, this would be calculated from actual transaction data
  const transactionCountData = [45, 52, 49, 60, 72, 68, 80, 91, 87, 94, 102, 110]
  const revenueData = [5500, 6200, 5900, 7500, 8800, 8200, 9600, 11000, 10500, 11800, 12500, 13800]

  // Transaction count chart data
  const transactionCountChartData = {
    labels: months,
    datasets: [
      {
        label: 'Transaction Count',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(59, 130, 246, 1)',
        fill: true,
        tension: 0.4,
        data: transactionCountData,
      },
    ],
  }

  // Revenue chart data
  const revenueChartData = {
    labels: months,
    datasets: [
      {
        label: 'Revenue',
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 1,
        borderRadius: 4,
        data: revenueData,
      },
    ],
  }

  return {
    transactionCountChartData,
    revenueChartData
  }
})

// Time range selector
const timeRange = ref('Last 30 days')
const timeRanges = ['Today', 'Last 7 days', 'Last 30 days', 'Last 90 days', 'Last year', 'All time']

// Define payment transaction type
interface PaymentTransaction {
  id: number
  orderId: string
  customer: string
  email: string
  amount: number
  method: string
  status: string
  date: string
  cardType?: string
  last4?: string
}

// Sample payment transactions data
const transactions = ref<PaymentTransaction[]>([
  {
    id: 1,
    orderId: 'ORD-12345',
    customer: 'John Smith',
    email: 'john.smith@example.com',
    amount: 129.99,
    method: 'Credit Card',
    status: 'Completed',
    date: '2023-11-15',
    cardType: 'Visa',
    last4: '4242'
  },
  {
    id: 2,
    orderId: 'ORD-12346',
    customer: 'Emily Davis',
    email: 'emily.davis@example.com',
    amount: 79.50,
    method: 'PayPal',
    status: 'Completed',
    date: '2023-11-16'
  },
  {
    id: 3,
    orderId: 'ORD-12347',
    customer: 'Michael Johnson',
    email: 'mjohnson@example.com',
    amount: 249.99,
    method: 'Credit Card',
    status: 'Failed',
    date: '2023-11-17',
    cardType: 'Mastercard',
    last4: '5678'
  },
  {
    id: 4,
    orderId: 'ORD-12348',
    customer: 'Sarah Williams',
    email: 'swilliams@example.com',
    amount: 59.99,
    method: 'Credit Card',
    status: 'Pending',
    date: '2023-11-18',
    cardType: 'Amex',
    last4: '9876'
  },
  {
    id: 5,
    orderId: 'ORD-12349',
    customer: 'David Brown',
    email: 'dbrown@example.com',
    amount: 149.95,
    method: 'Apple Pay',
    status: 'Completed',
    date: '2023-11-19'
  }
])

// Computed payment statistics
const paymentStats = computed(() => {
  // Count transactions by status
  const completedTransactions = transactions.value.filter(t => t.status === 'Completed').length
  const pendingTransactions = transactions.value.filter(t => t.status === 'Pending').length
  const failedTransactions = transactions.value.filter(t => t.status === 'Failed').length

  // Calculate total amount for completed transactions
  const totalAmount = transactions.value.reduce((sum, transaction) => {
    if (transaction.status === 'Completed') {
      return sum + transaction.amount
    }
    return sum
  }, 0)

  // Calculate average transaction value
  const avgTransactionValue = completedTransactions > 0
    ? (totalAmount / completedTransactions).toFixed(2)
    : '0.00'

  // Calculate success rate
  const totalProcessedTransactions = completedTransactions + failedTransactions
  const successRate = totalProcessedTransactions > 0
    ? ((completedTransactions / totalProcessedTransactions) * 100).toFixed(1)
    : '0.0'

  // Count transactions by payment method
  const methodCounts = transactions.value.reduce((counts, transaction) => {
    counts[transaction.method] = (counts[transaction.method] || 0) + 1
    return counts
  }, {} as Record<string, number>)

  // Find most popular payment method
  let mostPopularMethod = 'Credit Card'
  let maxCount = 0

  for (const [method, count] of Object.entries(methodCounts)) {
    if (count > maxCount) {
      maxCount = count
      mostPopularMethod = method
    }
  }

  return {
    totalTransactions: transactions.value.length,
    completedTransactions,
    pendingTransactions,
    failedTransactions,
    totalAmount: totalAmount.toFixed(2),
    avgTransactionValue,
    successRate,
    mostPopularMethod
  }
})

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('date')
const sortOrder = ref('desc')
const statusFilter = ref('all')
const methodFilter = ref('all')

// Available statuses and methods
const statuses = ['all', 'Completed', 'Pending', 'Failed', 'Refunded']
const methods = ['all', 'Credit Card', 'PayPal', 'Apple Pay', 'Google Pay', 'Bank Transfer']

// Computed filtered and sorted transactions
const filteredTransactions = computed(() => {
  return transactions.value
    .filter(transaction => {
      // Apply search filter
      const matchesSearch =
        transaction.orderId.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        transaction.customer.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        transaction.email.toLowerCase().includes(searchQuery.value.toLowerCase())

      // Apply status filter
      const matchesStatus = statusFilter.value === 'all' || transaction.status === statusFilter.value

      // Apply method filter
      const matchesMethod = methodFilter.value === 'all' || transaction.method === methodFilter.value

      return matchesSearch && matchesStatus && matchesMethod
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime()
      } else if (sortBy.value === 'amount') {
        comparison = a.amount - b.amount
      } else if (sortBy.value === 'orderId') {
        comparison = a.orderId.localeCompare(b.orderId)
      } else if (sortBy.value === 'customer') {
        comparison = a.customer.localeCompare(b.customer)
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
    sortOrder.value = 'desc'
  }
}

// Get status badge class
function getStatusClass(status: string): string {
  switch (status) {
    case 'Completed':
      return 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400'
    case 'Pending':
      return 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'Failed':
      return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400'
    case 'Refunded':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400'
    default:
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

// Get payment method icon
function getPaymentMethodIcon(method: string): string {
  switch (method) {
    case 'Credit Card':
      return 'i-hugeicons-credit-card'
    case 'PayPal':
      return 'i-hugeicons-paypal'
    case 'Apple Pay':
      return 'i-hugeicons-apple'
    case 'Google Pay':
      return 'i-hugeicons-google'
    case 'Bank Transfer':
      return 'i-hugeicons-bank'
    default:
      return 'i-hugeicons-credit-card'
  }
}

// Pagination
const currentPage = ref(1)
const itemsPerPage = 10
const totalPages = computed(() => Math.ceil(filteredTransactions.value.length / itemsPerPage))
const paginatedTransactions = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredTransactions.value.slice(start, end)
})

function changePage(page: number): void {
  currentPage.value = page
}

// Calculate total amount
const totalAmount = computed(() => {
  return filteredTransactions.value.reduce((sum, transaction) => {
    if (transaction.status === 'Completed') {
      return sum + transaction.amount
    }
    return sum
  }, 0)
})
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Payments</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Manage payment transactions for your store
            </p>
          </div>
          <div class="mt-4 sm:mt-0">
            <button
              type="button"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-download-04 h-5 w-5 mr-1"></div>
              Export transactions
            </button>
          </div>
        </div>

        <!-- Time range selector -->
        <div class="mt-4 flex items-center justify-between">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Overview of your payment transactions
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
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Transactions</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ paymentStats.totalTransactions }}</dd>
            <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
              <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
              <span>8.2% increase</span>
            </dd>
          </div>

          <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Success Rate</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ paymentStats.successRate }}%</dd>
            <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
              <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
              <span>1.2% increase</span>
            </dd>
          </div>

          <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Revenue</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">${{ parseFloat(paymentStats.totalAmount).toLocaleString() }}</dd>
            <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
              <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
              <span>12.5% increase</span>
            </dd>
          </div>

          <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Avg. Transaction</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">${{ paymentStats.avgTransactionValue }}</dd>
            <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
              <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
              <span>3.7% increase</span>
            </dd>
          </div>
        </dl>

        <!-- Charts -->
        <div class="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-6">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Transaction Count</h3>
              <div class="mt-2 h-80">
                <Line :data="monthlyChartData.transactionCountChartData" :options="chartOptions" />
              </div>
            </div>
          </div>

          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-6">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Revenue</h3>
              <div class="mt-2 h-80">
                <Bar :data="monthlyChartData.revenueChartData" :options="chartOptions" />
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
              placeholder="Search transactions..."
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

            <select
              v-model="methodFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option value="all">All Payment Methods</option>
              <option v-for="method in methods.slice(1)" :key="method" :value="method">
                {{ method }}
              </option>
            </select>
          </div>
        </div>

        <!-- Transactions table -->
        <div class="mt-6 flow-root">
          <div class="sm:flex sm:items-center sm:justify-between mb-4">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">All Transactions</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              A list of all payment transactions including order ID, customer, amount, and status.
            </p>
          </div>
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-blue-gray-700">
                    <tr>
                      <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-gray-200">
                        <button @click="toggleSort('orderId')" class="group inline-flex items-center">
                          Order ID
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'orderId'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('customer')" class="group inline-flex items-center">
                          Customer
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'customer'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('amount')" class="group inline-flex items-center">
                          Amount
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'amount'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Method</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Status</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('date')" class="group inline-flex items-center">
                          Date
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'date'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span class="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-blue-gray-800">
                    <tr v-for="transaction in paginatedTransactions" :key="transaction.id">
                      <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 dark:text-white">
                        {{ transaction.orderId }}
                      </td>
                      <td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        <div>{{ transaction.customer }}</div>
                        <div class="text-xs text-gray-400">{{ transaction.email }}</div>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        ${{ transaction.amount.toFixed(2) }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        <div class="flex items-center">
                          <div :class="[getPaymentMethodIcon(transaction.method), 'h-5 w-5 mr-1.5 text-gray-500 dark:text-gray-400']"></div>
                          <span>{{ transaction.method }}</span>
                          <span v-if="transaction.last4" class="ml-1 text-xs text-gray-400">
                            ({{ transaction.cardType }} •••• {{ transaction.last4 }})
                          </span>
                        </div>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm">
                        <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium" :class="getStatusClass(transaction.status)">
                          {{ transaction.status }}
                        </span>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ transaction.date }}
                      </td>
                      <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div class="flex items-center justify-end space-x-2">
                          <button type="button" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                            <div class="i-hugeicons-view h-5 w-5"></div>
                          </button>
                          <button type="button" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                            <div class="i-hugeicons-receipt-dollar h-5 w-5"></div>
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="paginatedTransactions.length === 0">
                      <td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        No transactions found matching your criteria
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="mt-6 flex items-center justify-between">
          <div class="flex flex-1 justify-between sm:hidden">
            <button
              @click="changePage(Math.max(1, currentPage - 1))"
              :disabled="currentPage === 1"
              :class="[
                currentPage === 1 ? 'cursor-not-allowed opacity-50' : '',
                'relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-gray-200 dark:hover:bg-blue-gray-700'
              ]"
            >
              Previous
            </button>
            <button
              @click="changePage(Math.min(totalPages, currentPage + 1))"
              :disabled="currentPage === totalPages"
              :class="[
                currentPage === totalPages ? 'cursor-not-allowed opacity-50' : '',
                'relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-blue-gray-800 dark:text-gray-200 dark:hover:bg-blue-gray-700'
              ]"
            >
              Next
            </button>
          </div>
          <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p class="text-sm text-gray-700 dark:text-gray-300">
                Showing <span class="font-medium">{{ ((currentPage - 1) * itemsPerPage) + 1 }}</span> to <span class="font-medium">{{ Math.min(currentPage * itemsPerPage, filteredTransactions.length) }}</span> of <span class="font-medium">{{ filteredTransactions.length }}</span> results
              </p>
            </div>
            <div>
              <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  @click="changePage(Math.max(1, currentPage - 1))"
                  :disabled="currentPage === 1"
                  class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-gray-600 dark:hover:bg-blue-gray-700"
                  :class="{ 'cursor-not-allowed opacity-50': currentPage === 1 }"
                >
                  <span class="sr-only">Previous</span>
                  <div class="i-hugeicons-arrow-left-01 h-5 w-5"></div>
                </button>

                <template v-for="page in totalPages" :key="page">
                  <button
                    v-if="page === currentPage ||
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)"
                    @click="changePage(page)"
                    :class="[
                      page === currentPage
                        ? 'relative z-10 inline-flex items-center bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                        : 'relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:text-gray-200 dark:ring-gray-600 dark:hover:bg-blue-gray-700',
                    ]"
                  >
                    {{ page }}
                  </button>
                  <span
                    v-else-if="(page === currentPage - 2 && currentPage > 3) ||
                              (page === currentPage + 2 && currentPage < totalPages - 2)"
                    class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0 dark:text-gray-400 dark:ring-gray-600"
                  >
                    ...
                  </span>
                </template>

                <button
                  @click="changePage(Math.min(totalPages, currentPage + 1))"
                  :disabled="currentPage === totalPages"
                  class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 dark:ring-gray-600 dark:hover:bg-blue-gray-700"
                  :class="{ 'cursor-not-allowed opacity-50': currentPage === totalPages }"
                >
                  <span class="sr-only">Next</span>
                  <div class="i-hugeicons-arrow-right-01 h-5 w-5"></div>
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
