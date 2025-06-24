<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'
import OrdersTable from '../../../../components/Dashboard/Commerce/OrdersTable.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'

useHead({
  title: 'Dashboard - Commerce Orders',
})

// Sample orders data (in a real app, this would come from a composable)
const orders = ref([
  {
    id: 'ORD-5432',
    customer: 'John Smith',
    email: 'john.smith@example.com',
    date: '2023-12-01',
    total: 349.97,
    status: 'Completed',
    paymentMethod: 'Credit Card',
    items: 3
  },
  {
    id: 'ORD-5431',
    customer: 'Sarah Johnson',
    email: 'sarah.j@example.com',
    date: '2023-12-01',
    total: 129.99,
    status: 'Processing',
    paymentMethod: 'PayPal',
    items: 1
  },
  {
    id: 'ORD-5430',
    customer: 'Michael Brown',
    email: 'mbrown@example.com',
    date: '2023-11-30',
    total: 459.98,
    status: 'Completed',
    paymentMethod: 'Credit Card',
    items: 4
  },
  {
    id: 'ORD-5429',
    customer: 'Emily Davis',
    email: 'emily.davis@example.com',
    date: '2023-11-30',
    total: 89.99,
    status: 'Shipped',
    paymentMethod: 'Credit Card',
    items: 1
  },
  {
    id: 'ORD-5428',
    customer: 'David Wilson',
    email: 'dwilson@example.com',
    date: '2023-11-29',
    total: 199.99,
    status: 'Completed',
    paymentMethod: 'PayPal',
    items: 2
  },
  {
    id: 'ORD-5427',
    customer: 'Jessica Taylor',
    email: 'jtaylor@example.com',
    date: '2023-11-29',
    total: 79.99,
    status: 'Cancelled',
    paymentMethod: 'Credit Card',
    items: 1
  },
  {
    id: 'ORD-5426',
    customer: 'Robert Martinez',
    email: 'rmartinez@example.com',
    date: '2023-11-28',
    total: 299.97,
    status: 'Completed',
    paymentMethod: 'Credit Card',
    items: 3
  },
  {
    id: 'ORD-5425',
    customer: 'Jennifer Anderson',
    email: 'janderson@example.com',
    date: '2023-11-28',
    total: 149.99,
    status: 'Refunded',
    paymentMethod: 'PayPal',
    items: 1
  },
  {
    id: 'ORD-5424',
    customer: 'Christopher Lee',
    email: 'clee@example.com',
    date: '2023-11-27',
    total: 249.98,
    status: 'Completed',
    paymentMethod: 'Credit Card',
    items: 2
  },
  {
    id: 'ORD-5423',
    customer: 'Amanda White',
    email: 'awhite@example.com',
    date: '2023-11-27',
    total: 59.99,
    status: 'Processing',
    paymentMethod: 'Credit Card',
    items: 1
  }
])

// Available statuses
const statuses = ['all', 'Completed', 'Processing', 'Shipped', 'Cancelled', 'Refunded'] as const
const statusFilter = ref('all')
const sortBy = ref('date')
const sortOrder = ref('desc')

// Search and filtering
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(5)

// Computed filtered orders
const filteredOrders = computed(() => {
  return orders.value
    .filter(order => {
      // Apply search filter
      const matchesSearch =
        order.id.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        order.customer.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        order.email.toLowerCase().includes(searchQuery.value.toLowerCase())

      // Apply status filter
      const matchesStatus = statusFilter.value === 'all' || order.status === statusFilter.value

      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime()
      } else if (sortBy.value === 'total') {
        comparison = a.total - b.total
      } else if (sortBy.value === 'customer') {
        comparison = a.customer.localeCompare(b.customer)
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
})

const paginatedOrders = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredOrders.value.slice(start, end)
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
  const totalPages = Math.ceil(filteredOrders.value.length / itemsPerPage.value)
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
    sortOrder.value = 'desc'
  }
}

// Order actions
function viewOrder(order: any): void {
  console.log('View order:', order)
  // Implement view order logic
}

function editOrder(order: any): void {
  console.log('Edit order:', order)
  // Implement edit order logic
}

function removeOrder(order: any): void {
  orderToDelete.value = order
  showDeleteModal.value = true
}

// Define new order type
interface NewOrder {
  customer: string
  email: string
  total: number
  status: string
  items: number
}

// Modal state
const showAddModal = ref(false)
const showDeleteModal = ref(false)
const orderToDelete = ref<any>(null)
const newOrder = ref<NewOrder>({
  customer: '',
  email: '',
  total: 0,
  status: 'Processing',
  items: 1
})

function openAddModal(): void {
  newOrder.value = {
    customer: '',
    email: '',
    total: 0,
    status: 'Processing',
    items: 1
  }
  showAddModal.value = true
}

function closeAddModal(): void {
  showAddModal.value = false
}

function closeDeleteModal(): void {
  showDeleteModal.value = false
  orderToDelete.value = null
}

async function confirmDelete(): Promise<void> {
  if (!orderToDelete.value) return

  const orderId = orderToDelete.value.id
  
  // Remove from local state for immediate UI update
  orders.value = orders.value.filter(o => o.id !== orderId)
  
  try {
    // TODO: Implement actual API call to delete order
    // await deleteOrderFromServer(orderId)
    console.log('Order deleted:', orderToDelete.value)
    closeDeleteModal()
  } catch (error) {
    // If server request fails, restore to local state
    orders.value.push(orderToDelete.value)
    console.error('Failed to delete order:', error)
  }
}

async function addOrder(): Promise<void> {
  // First add to local state for immediate UI update
  const id = `ORD-${Math.floor(Math.random() * 9000) + 1000}`
  const currentDate = new Date().toISOString().split('T')[0] || ''
  const newOrderData = {
    id,
    customer: newOrder.value.customer,
    email: newOrder.value.email,
    date: currentDate,
    total: newOrder.value.total,
    status: newOrder.value.status,
    paymentMethod: 'Credit Card',
    items: newOrder.value.items
  }
  orders.value.unshift(newOrderData)

  try {
    // TODO: Implement actual API call to create order
    // await createOrder(newOrderData)
    closeAddModal()
  } catch (error) {
    // If server request fails, remove from local state
    orders.value = orders.value.filter(o => o.id !== id)
    console.error('Failed to create order:', error)
  }
}
</script>

<template>
  <div class="py-6">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
      <div class="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div class="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-medium text-gray-900 dark:text-white">Orders</h2>
            <button
              @click="openAddModal"
              type="button"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-2" />
              Add Order
            </button>
          </div>
          <div class="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <SearchFilter
              placeholder="Search orders..."
              @search="handleSearch"
              class="w-full md:w-96"
            />
            <div class="flex flex-col sm:flex-row gap-4">
              <select
                v-model="statusFilter"
                class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
              >
                <option v-for="status in statuses" :value="status">{{ status }}</option>
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
        </div>

        <!-- Orders Table Component -->
        <OrdersTable
          :orders="paginatedOrders"
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
          @view-order="viewOrder"
          @edit-order="editOrder"
          @delete-order="removeOrder"
        />

        <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <Pagination
            :current-page="currentPage"
            :total-items="filteredOrders.length"
            :items-per-page="itemsPerPage"
            @prev="handlePrevPage"
            @next="handleNextPage"
            @page="handlePageChange"
          />
        </div>
      </div>
    </div>

    <!-- Add Order Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeAddModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Add New Order</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="order-customer" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Customer Name</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="order-customer"
                        v-model="newOrder.customer"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter customer name"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="order-email" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Email Address</label>
                    <div class="mt-2">
                      <input
                        type="email"
                        id="order-email"
                        v-model="newOrder.email"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter email address"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="order-total" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Total Amount</label>
                    <div class="mt-2">
                      <input
                        type="number"
                        id="order-total"
                        v-model="newOrder.total"
                        step="0.01"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter total amount"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="order-items" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Number of Items</label>
                    <div class="mt-2">
                      <input
                        type="number"
                        id="order-items"
                        v-model="newOrder.items"
                        min="1"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter number of items"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="order-status" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Status</label>
                    <div class="mt-2">
                      <select
                        id="order-status"
                        v-model="newOrder.status"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option v-for="status in statuses.slice(1)" :value="status">{{ status }}</option>
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
              @click="addOrder"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            >
              Add Order
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

    <!-- Delete Order Confirmation Modal -->
    <div v-if="showDeleteModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeDeleteModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
              <div class="i-hugeicons-alert-triangle h-6 w-6 text-red-600 dark:text-red-400"></div>
            </div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Delete Order</h3>
              <div class="mt-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Are you sure you want to delete order <strong>#{{ orderToDelete?.id }}</strong>? This action cannot be undone.
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
              Delete Order
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
  </div>
</template>
