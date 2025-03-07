<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'

useHead({
  title: 'Dashboard - Commerce Orders',
})

// Sample orders data
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

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('date')
const sortOrder = ref('desc')
const statusFilter = ref('all')

// Available statuses
const statuses = ['all', 'Completed', 'Processing', 'Shipped', 'Cancelled', 'Refunded']

// Computed filtered and sorted orders
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

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(5)
const totalPages = computed(() => Math.ceil(filteredOrders.value.length / itemsPerPage.value))

const paginatedOrders = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredOrders.value.slice(start, end)
})

function changePage(page: number): void {
  currentPage.value = page
}

function previousPage(): void {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

function nextPage(): void {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
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

// Get status badge class
function getStatusClass(status: string): string {
  switch (status) {
    case 'Completed':
      return 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400'
    case 'Processing':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400'
    case 'Shipped':
      return 'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-400'
    case 'Cancelled':
      return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400'
    case 'Refunded':
      return 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20 dark:bg-purple-900/30 dark:text-purple-400'
    default:
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
  }
}
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Orders</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              A list of all customer orders
            </p>
          </div>
          <div class="mt-4 sm:mt-0">
            <button type="button" class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
              <div class="i-hugeicons-download-04 h-5 w-5 mr-1"></div>
              Export orders
            </button>
          </div>
        </div>

        <!-- Filters -->
        <div class="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="relative max-w-sm">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <div class="i-hugeicons-search-01 h-5 w-5 text-gray-400"></div>
            </div>
            <input
              v-model="searchQuery"
              type="text"
              class="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:placeholder:text-gray-500"
              placeholder="Search orders..."
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

        <!-- Orders table -->
        <div class="mt-6 flow-root">
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-blue-gray-700">
                    <tr>
                      <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-gray-200">
                        Order ID
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
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('total')" class="group inline-flex items-center">
                          Total
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'total'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Status</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Items</th>
                      <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span class="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-blue-gray-800">
                    <tr v-for="order in paginatedOrders" :key="order.id">
                      <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 dark:text-white">
                        #{{ order.id }}
                      </td>
                      <td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        <div>{{ order.customer }}</div>
                        <div class="text-xs text-gray-400">{{ order.email }}</div>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ order.date }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        ${{ order.total.toFixed(2) }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm">
                        <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium" :class="getStatusClass(order.status)">
                          {{ order.status }}
                        </span>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ order.items }}
                      </td>
                      <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div class="flex items-center justify-end space-x-2">
                          <button type="button" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                            <div class="i-hugeicons-view h-5 w-5"></div>
                          </button>
                          <button type="button" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                            <div class="i-hugeicons-edit-01 h-5 w-5"></div>
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="paginatedOrders.length === 0">
                      <td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        No orders found matching your criteria
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div class="mt-6 flex items-center justify-between">
          <div class="text-sm text-gray-700 dark:text-gray-300">
            Showing <span class="font-medium">{{ (currentPage - 1) * itemsPerPage + 1 }}</span> to
            <span class="font-medium">{{ Math.min(currentPage * itemsPerPage, filteredOrders.length) }}</span> of
            <span class="font-medium">{{ filteredOrders.length }}</span> results
          </div>
          <div class="flex space-x-2">
            <button
              @click="previousPage"
              :disabled="currentPage === 1"
              :class="[
                'relative inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold ring-1 ring-inset',
                currentPage === 1
                  ? 'text-gray-400 ring-gray-300 dark:text-gray-500 dark:ring-gray-700'
                  : 'text-gray-900 ring-gray-300 hover:bg-gray-50 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700'
              ]"
            >
              <div class="i-hugeicons-arrow-left-01 h-5 w-5"></div>
            </button>
            <button
              v-for="page in totalPages"
              :key="page"
              @click="changePage(page)"
              :class="[
                'relative inline-flex items-center px-4 py-2 text-sm font-semibold ring-1 ring-inset',
                page === currentPage
                  ? 'z-10 bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                  : 'text-gray-900 ring-gray-300 hover:bg-gray-50 focus:z-20 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700'
              ]"
            >
              {{ page }}
            </button>
            <button
              @click="nextPage"
              :disabled="currentPage === totalPages"
              :class="[
                'relative inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold ring-1 ring-inset',
                currentPage === totalPages
                  ? 'text-gray-400 ring-gray-300 dark:text-gray-500 dark:ring-gray-700'
                  : 'text-gray-900 ring-gray-300 hover:bg-gray-50 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700'
              ]"
            >
              <div class="i-hugeicons-arrow-right-01 h-5 w-5"></div>
            </button>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
