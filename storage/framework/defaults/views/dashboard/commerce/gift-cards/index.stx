<route lang="yaml">
  meta:
    requiresAuth: true
</route>

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
import { useGiftCards } from '../../../../functions/commerce/gift-cards'

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
  title: 'Dashboard - Commerce Gift Cards',
})

// Get gift cards data and functions from the composable
const { giftCards, createGiftCard, fetchGiftCards } = useGiftCards()

// Fetch gift cards on component mount
onMounted(async () => {
  await fetchGiftCards()
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
  const salesData = [2, 3, 5, 4, 6, 8, 7, 10, 12, 15, 18, 20]
  const revenueData = [100, 150, 250, 200, 300, 400, 350, 500, 600, 750, 900, 1000]

  // Gift card sales chart data
  const giftCardSalesData = {
    labels: months,
    datasets: [
      {
        label: 'Gift Card Sales',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgba(59, 130, 246, 1)',
        fill: true,
        tension: 0.4,
        data: salesData,
      },
    ],
  }

  // Gift card revenue chart data
  const giftCardRevenueData = {
    labels: months,
    datasets: [
      {
        label: 'Gift Card Revenue',
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderColor: 'rgba(16, 185, 129, 1)',
        borderWidth: 1,
        borderRadius: 4,
        data: revenueData,
      },
    ],
  }

  return {
    giftCardSalesData,
    giftCardRevenueData
  }
})

// Time range selector
const timeRange = ref('Last 30 days')
const timeRanges = ['Today', 'Last 7 days', 'Last 30 days', 'Last 90 days', 'Last year', 'All time']

// Define new gift card type
interface NewGiftCard {
  code: string
  initialValue: number
  recipient: string
  email: string
  expiryDate: string
}

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('purchaseDate')
const sortOrder = ref('desc')
const statusFilter = ref('all')

// Available statuses
const statuses = ['all', 'Active', 'Used', 'Expired']

// Computed gift card statistics
const giftCardStats = computed(() => {
  const activeGiftCards = giftCards.value.filter(c => c.status === 'Active').length
  const totalGiftCards = giftCards.value.length

  // Calculate total initial value and current balance
  const totalInitialValue = giftCards.value.reduce((sum, card) => sum + card.initial_balance, 0)
  const totalCurrentBalance = giftCards.value.reduce((sum, card) => sum + card.current_balance, 0)

  // Calculate amount redeemed
  const totalRedeemed = totalInitialValue - totalCurrentBalance

  // Calculate redemption rate
  const redemptionRate = totalInitialValue > 0
    ? ((totalRedeemed / totalInitialValue) * 100).toFixed(1)
    : '0.0'

  return {
    activeGiftCards,
    totalGiftCards,
    totalInitialValue: totalInitialValue.toFixed(2),
    totalCurrentBalance: totalCurrentBalance.toFixed(2),
    totalRedeemed: totalRedeemed.toFixed(2),
    redemptionRate
  }
})

// Computed filtered and sorted gift cards
const filteredGiftCards = computed(() => {
  return giftCards.value
    .filter(card => {
      // Apply search filter
      const matchesSearch =
        card.code.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        card.recipient_name?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        card.recipient_email?.toLowerCase().includes(searchQuery.value.toLowerCase())

      // Apply status filter
      const matchesStatus = statusFilter.value === 'all' || card.status === statusFilter.value

      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'pur') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      } else if (sortBy.value === 'expiry_date') {
        comparison = new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
      } else if (sortBy.value === 'initial_balance') {
        comparison = a.initial_balance - b.initial_balance
      } else if (sortBy.value === 'current_balance') {
        comparison = a.current_balance - b.current_balance
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
    case 'Active':
      return 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400'
    case 'Used':
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
    case 'Expired':
      return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400'
    default:
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

// Define global date variables
// const currentDate = new Date().toISOString().split('T')[0] as string
const oneYearFromNow = new Date()
oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)
const futureDate = oneYearFromNow.toISOString().split('T')[0] as string

// Modal state
const showAddModal = ref(false)
const newGiftCard = ref<NewGiftCard>({
  code: '',
  initialValue: 50,
  recipient: '',
  email: '',
  expiryDate: futureDate
})

function openAddModal(): void {
  newGiftCard.value = {
    code: generateGiftCardCode(),
    initialValue: 50,
    recipient: '',
    email: '',
    expiryDate: futureDate
  }
  showAddModal.value = true
}

function closeAddModal(): void {
  showAddModal.value = false
}

function generateGiftCardCode(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let code = 'GFT-'

  // Generate 4 characters
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  code += '-'

  // Generate 4 more characters
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  code += '-'

  // Generate 4 more characters
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  return code
}

async function addGiftCard(): Promise<void> {
  const newGiftCardData = {
    code: newGiftCard.value.code,
    initial_balance: newGiftCard.value.initialValue,
    current_balance: newGiftCard.value.initialValue,
    customer_id: 1, // TODO: Get from auth
    status: 'Active',
    recipient_email: newGiftCard.value.email,
    recipient_name: newGiftCard.value.recipient,
    expiry_date: new Date(newGiftCard.value.expiryDate).getTime(),
    is_active: true,
    is_digital: true
  }

  try {
    await createGiftCard(newGiftCardData)
    closeAddModal()
  } catch (error) {
    console.error('Failed to create gift card:', error)
  }
}
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Gift Cards</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Manage gift cards for your store
            </p>
          </div>
          <div class="mt-4 sm:mt-0">
            <button
              type="button"
              @click="openAddModal"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-1"></div>
              Create gift card
            </button>
          </div>
        </div>

        <!-- Time range selector -->
        <div class="mt-4 flex items-center justify-between">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Overview of your gift card performance
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
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Active Gift Cards</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ giftCardStats.activeGiftCards }}</dd>
            <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
              <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
              <span>{{ Math.round(giftCardStats.activeGiftCards / giftCardStats.totalGiftCards * 100) }}% of total</span>
            </dd>
          </div>

          <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Total Value</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">${{ parseFloat(giftCardStats.totalInitialValue).toLocaleString() }}</dd>
            <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
              <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
              <span>10.5% increase</span>
            </dd>
          </div>

          <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Current Balance</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">${{ parseFloat(giftCardStats.totalCurrentBalance).toLocaleString() }}</dd>
            <dd class="mt-2 flex items-center text-sm text-blue-600 dark:text-blue-400">
              <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
              <span>${{ parseFloat(giftCardStats.totalRedeemed).toLocaleString() }} redeemed</span>
            </dd>
          </div>

          <div class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-blue-gray-800">
            <dt class="truncate text-sm font-medium text-gray-500 dark:text-gray-300">Redemption Rate</dt>
            <dd class="mt-1 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">{{ giftCardStats.redemptionRate }}%</dd>
            <dd class="mt-2 flex items-center text-sm text-green-600 dark:text-green-400">
              <div class="i-hugeicons-analytics-up h-4 w-4 mr-1"></div>
              <span>5.2% increase</span>
            </dd>
          </div>
        </dl>

        <!-- Charts -->
        <div class="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-6">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Gift Card Sales</h3>
              <div class="mt-2 h-80">
                <Line :data="monthlyChartData.giftCardSalesData" :options="chartOptions" />
              </div>
            </div>
          </div>

          <div class="overflow-hidden rounded-lg bg-white shadow dark:bg-blue-gray-800">
            <div class="p-6">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Gift Card Revenue</h3>
              <div class="mt-2 h-80">
                <Bar :data="monthlyChartData.giftCardRevenueData" :options="chartOptions" />
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
              placeholder="Search gift cards..."
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

        <!-- Gift Cards table -->
        <div class="mt-6 flow-root">
          <div class="sm:flex sm:items-center sm:justify-between mb-4">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">All Gift Cards</h3>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              A list of all the gift cards in your store including their value, balance, and status.
            </p>
          </div>
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-blue-gray-700">
                    <tr>
                      <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-gray-200">
                        Code
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Recipient</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('initialValue')" class="group inline-flex items-center">
                          Initial Value
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'initialValue'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('currentBalance')" class="group inline-flex items-center">
                          Balance
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'currentBalance'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('purchaseDate')" class="group inline-flex items-center">
                          Purchase Date
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'purchaseDate'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('expiryDate')" class="group inline-flex items-center">
                          Expiry Date
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'expiryDate'" :class="[
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
                    <tr v-for="card in filteredGiftCards" :key="card.id">
                      <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 dark:text-white">
                        {{ card.code }}
                      </td>
                      <td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        <div>{{ card.recipient_name }}</div>
                        <div class="text-xs text-gray-400">{{ card.recipient_email }}</div>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        ${{ card.initial_balance.toFixed(2) }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        ${{ card.current_balance.toFixed(2) }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ card.created_at }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ card.expiry_date }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm">
                        <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium" :class="getStatusClass(card.status)">
                          {{ card.status }}
                        </span>
                      </td>
                      <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div class="flex items-center justify-end space-x-2">
                          <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                            <div class="i-hugeicons-view h-5 w-5"></div>
                          </button>
                          <button type="button" class="text-gray-400 transition-colors duration-150 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                            <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="filteredGiftCards.length === 0">
                      <td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        No gift cards found matching your criteria
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

    <!-- Add Gift Card Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeAddModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Create New Gift Card</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="gift-card-code" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Gift Card Code</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="gift-card-code"
                        v-model="newGiftCard.code"
                        readonly
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 bg-gray-50 dark:bg-blue-gray-900"
                      />
                      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400 text-left">Auto-generated code</p>
                    </div>
                  </div>

                  <div>
                    <label for="gift-card-value" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Value</label>
                    <div class="mt-2">
                      <div class="relative rounded-md shadow-sm">
                        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                          <span class="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          id="gift-card-value"
                          v-model="newGiftCard.initialValue"
                          class="block w-full rounded-md border-0 py-1.5 pl-7 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label for="recipient-name" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Recipient Name</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="recipient-name"
                        v-model="newGiftCard.recipient"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter recipient name"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="recipient-email" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Recipient Email</label>
                    <div class="mt-2">
                      <input
                        type="email"
                        id="recipient-email"
                        v-model="newGiftCard.email"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter recipient email"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="expiry-date" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Expiry Date</label>
                    <div class="mt-2">
                      <input
                        type="date"
                        id="expiry-date"
                        v-model="newGiftCard.expiryDate"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="addGiftCard"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            >
              Create
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
