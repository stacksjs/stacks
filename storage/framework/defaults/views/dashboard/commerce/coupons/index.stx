<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import { Line, Bar } from 'vue-chartjs'
import type { Coupons, NewCoupon } from '../../../../types/defaults'
import { useCoupons } from '../../../../functions/commerce/coupons'
import CouponsTable from '../../../../components/Dashboard/Commerce/CouponsTable.vue'
import CouponsForm from '../../../../components/Dashboard/Commerce/Forms/CouponsForm.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'
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

// Get coupons data and functions from the composable
const { coupons, createCoupon, fetchCoupons, deleteCoupon, updateCoupon } = useCoupons()

// Fetch coupons on component mount
onMounted(async () => {
  await fetchCoupons()
})

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('code')
const sortOrder = ref('asc')
const statusFilter = ref('all')

// Available statuses
const statuses = ['all', 'Active', 'Expired', 'Scheduled'] as const

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(10)

// Computed coupon statistics
const couponStats = computed(() => {
  const activeCoupons = coupons.value.filter(c => c.status === 'Active').length
  const totalRedemptions = coupons.value.reduce((sum, c) => sum + c.usage_count, 0)

  // Calculate total discount amount (simplified calculation)
  const totalDiscountAmount = coupons.value.reduce((sum, c) => {
    const avgOrderValue = 100 // Assuming $100 average order value
    let discountPerUse = 0

    if (c.discount_type === 'Percentage') {
      discountPerUse = avgOrderValue * (c.discount_value / 100)
    } else {
      discountPerUse = c.discount_value
    }

    return sum + (discountPerUse * c.usage_count)
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
      const matchesSearch = coupon.code?.toLowerCase().includes(searchQuery.value.toLowerCase()) || false

      // Apply status filter
      const matchesStatus = statusFilter.value === 'all' || coupon.status === statusFilter.value

      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'code') {
        comparison = a.code.localeCompare(b.code)
    } else if (sortBy.value === 'discount_value') {
        comparison = a.discount_value - b.discount_value
      } else if (sortBy.value === 'usage_count') {
        comparison = a.usage_count - b.usage_count
      } else if (sortBy.value === 'end_date') {
        comparison = new Date(a.end_date).getTime() - new Date(b.end_date).getTime()
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
})

const paginatedCoupons = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredCoupons.value.slice(start, end)
})

// Event handlers
const handleSearch = (query: string) => {
  searchQuery.value = query
  currentPage.value = 1
}

const handlePrevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

const handleNextPage = () => {
  const totalPages = Math.ceil(filteredCoupons.value.length / itemsPerPage.value)
  if (currentPage.value < totalPages) {
    currentPage.value++
  }
}

const handlePageChange = (page: number) => {
  currentPage.value = page
}

// Toggle sort order
function toggleSort(column: string): void {
  if (sortBy.value === column) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = column
    sortOrder.value = 'asc'
  }
}

// Modal state
const showFormModal = ref(false)
const formMode = ref<'add' | 'edit'>('add')
const couponToEdit = ref<any>(null)
const showDeleteModal = ref(false)
const couponToDelete = ref<any>(null)

function openAddModal(): void {
  formMode.value = 'add'
  couponToEdit.value = null
  showFormModal.value = true
}

function closeFormModal(): void {
  showFormModal.value = false
  couponToEdit.value = null
}

function editCoupon(coupon: any): void {
  formMode.value = 'edit'
  couponToEdit.value = { ...coupon }
  showFormModal.value = true
}

// Form submission handlers
async function handleFormSubmit(couponData: NewCoupon): Promise<void> {

  console.log(couponData)
  if (formMode.value === 'add') {
    await addCoupon(couponData)
  } else {
    await doUpdateCoupon(couponData)
  }
}

async function addCoupon(couponData: NewCoupon): Promise<void> {
  // First add to local state for immediate UI update
  const id = Math.max(...coupons.value.map(c => c.id || 0)) + 1
  const newCouponData = {
    id,
    ...couponData,
    usage_count: 0
  } as Coupons
  coupons.value.push(newCouponData)

  // Then send to server
  try {
    await createCoupon(couponData as any)
    closeFormModal()
  } catch (error) {
    // If server request fails, remove from local state
    coupons.value = coupons.value.filter(c => c.id !== id)
    console.error('Failed to create coupon:', error)
  }
}

async function doUpdateCoupon(couponData: NewCoupon): Promise<void> {
  if (!couponToEdit.value) return

  const couponId = couponToEdit.value.id
  
  // Update local state for immediate UI update
  const index = coupons.value.findIndex(c => c.id === couponId)
  if (index !== -1) {
    coupons.value[index] = { ...coupons.value[index], ...couponData }
  }
  
  try {
    // TODO: Implement actual API call to update coupon
    await updateCoupon(couponId, couponData)
    closeFormModal()
  } catch (error) {
    // If server request fails, restore original values
    console.error('Failed to update coupon:', error)
  }
}

// Coupon actions
function viewCoupon(coupon: any): void {
  console.log('View coupon:', coupon)
  // Implement view coupon logic
}

function removeCoupon(coupon: any): void {
  couponToDelete.value = coupon
  showDeleteModal.value = true
}

function closeDeleteModal(): void {
  showDeleteModal.value = false
  couponToDelete.value = null
}

async function confirmDelete(): Promise<void> {
  if (!couponToDelete.value) return

  const couponId = couponToDelete.value.id
  
  // Remove from local state for immediate UI update
  coupons.value = coupons.value.filter(c => c.id !== couponId)
  
  try {
    await deleteCoupon(couponId)
    closeDeleteModal()
  } catch (error) {
    // If server request fails, restore to local state
    coupons.value.push(couponToDelete.value)
    console.error('Failed to delete coupon:', error)
  }
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
          <SearchFilter
            placeholder="Search coupons..."
            @search="handleSearch"
            class="w-full md:w-96"
          />
          <div class="flex flex-col sm:flex-row gap-4">
            <select
              v-model="statusFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option v-for="status in statuses" :key="status" :value="status">
                {{ status }}
              </option>
            </select>

            <select
              v-model="itemsPerPage"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option :value="5">5 per page</option>
              <option :value="10">10 per page</option>
              <option :value="25">25 per page</option>
              <option :value="50">50 per page</option>
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
                <CouponsTable
                  :coupons="paginatedCoupons"
                  :search-query="searchQuery"
                  :status-filter="statusFilter"
                  :sort-by="sortBy"
                  :sort-order="sortOrder"
                  :current-page="currentPage"
                  :items-per-page="itemsPerPage"
                  :statuses="statuses"
                  @toggle-sort="toggleSort"
                  @change-page="handlePageChange"
                  @previous-page="handlePrevPage"
                  @next-page="handleNextPage"
                  @view-coupon="viewCoupon"
                  @edit-coupon="editCoupon"
                  @delete-coupon="removeCoupon"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <Pagination
            :current-page="currentPage"
            :total-items="filteredCoupons.length"
            :items-per-page="itemsPerPage"
            @prev="handlePrevPage"
            @next="handleNextPage"
            @page="handlePageChange"
          />
        </div>
      </div>
    </div>

    <!-- Coupons Form Modal -->
    <CouponsForm
      :show="showFormModal"
      :mode="formMode"
      :coupon="couponToEdit"
      @close="closeFormModal"
      @submit="handleFormSubmit"
    />

    <!-- Delete Coupon Confirmation Modal -->
    <div v-if="showDeleteModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeDeleteModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
              <div class="i-hugeicons-alert-triangle h-6 w-6 text-red-600 dark:text-red-400"></div>
            </div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Delete Coupon</h3>
              <div class="mt-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Are you sure you want to delete <strong>{{ couponToDelete?.code }}</strong>? This action cannot be undone.
                </p>
              </div>
            </div>
          </div>
          <div class="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
            <button
              type="button"
              @click="confirmDelete"
              class="inline-flex w-full justify-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 sm:col-start-2"
            >
              Delete Coupon
            </button>
            <button
              type="button"
              @click="closeDeleteModal"
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
