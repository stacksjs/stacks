<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import { useCustomers } from '../../../../functions/commerce/customers'

useHead({
  title: 'Dashboard - Commerce Customers',
})

// Get customers data and functions from the composable
const { customers, createCustomer, fetchCustomers } = useCustomers()

// Fetch customers on component mount
onMounted(async () => {
  await fetchCustomers()
})

// Available statuses
const statuses = ['all', 'Active', 'Inactive'] as const
const statusFilter = ref('all')
const sortBy = ref('name')
const sortOrder = ref('asc')

// Filter and sort options
const searchQuery = ref('')

// Computed filtered and sorted customers
const filteredCustomers = computed(() => {
  return customers.value
    .filter(customer => {
      // Apply search filter
      const matchesSearch =
        customer.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        customer.phone.toLowerCase().includes(searchQuery.value.toLowerCase())

      // Apply status filter
      const matchesStatus = statusFilter.value === 'all' || customer.status === statusFilter.value

      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy.value === 'total_spent') {
        comparison = (a.total_spent || 0) - (b.total_spent || 0)
      } else if (sortBy.value === 'last_order') {
        const dateA = a.last_order ? new Date(a.last_order).getTime() : 0
        const dateB = b.last_order ? new Date(b.last_order).getTime() : 0
        comparison = dateA - dateB
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
})

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(5)
const totalPages = computed(() => Math.ceil(filteredCustomers.value.length / itemsPerPage.value))

const paginatedCustomers = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredCustomers.value.slice(start, end)
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
    sortOrder.value = 'asc'
  }
}

// Get status badge class
function getStatusClass(status: string | string[]): string {
  const statusStr = Array.isArray(status) ? status[0] : status
  switch (statusStr) {
    case 'Active':
      return 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400'
    case 'Inactive':
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
    default:
      return 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20 dark:bg-gray-900/30 dark:text-gray-400'
  }
}

// Define new customer type
interface NewCustomer {
  name: string
  email: string
  phone: string
  status: string
}

// Modal state
const showAddModal = ref(false)
const newCustomer = ref<NewCustomer>({
  name: '',
  email: '',
  phone: '',
  status: 'Active'
})

function openAddModal(): void {
  newCustomer.value = {
    name: '',
    email: '',
    phone: '',
    status: 'Active'
  }
  showAddModal.value = true
}

function closeAddModal(): void {
  showAddModal.value = false
}

async function addCustomer(): Promise<void> {
  // First add to local state for immediate UI update
  const id = Math.max(...customers.value.map(c => c.id || 0)) + 1
  const newCustomerData = {
    id,
    name: newCustomer.value.name,
    email: newCustomer.value.email,
    phone: newCustomer.value.phone,
    total_spent: 0,
    last_order: new Date().toISOString().split('T')[0] || '',
    status: newCustomer.value.status,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
  }
  customers.value.push(newCustomerData)

  // Then send to server
  const customerData = {
    name: newCustomer.value.name,
    email: newCustomer.value.email,
    phone: newCustomer.value.phone,
    total_spent: 0,
    last_order: new Date().toISOString().split('T')[0] || '',
    status: newCustomer.value.status,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
  }

  try {
    await createCustomer(customerData)
    closeAddModal()
  } catch (error) {
    // If server request fails, remove from local state
    customers.value = customers.value.filter(c => c.id !== id)
    console.error('Failed to create customer:', error)
  }
}
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Customers</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              A list of all customers in your store
            </p>
          </div>
          <div class="mt-4 sm:mt-0">
            <button
              type="button"
              @click="openAddModal"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-1"></div>
              Add customer
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
              placeholder="Search customers..."
            />
          </div>

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

        <!-- Customers table -->
        <div class="mt-6 flow-root">
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-blue-gray-700">
                    <tr>
                      <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 dark:text-gray-200">
                        <button @click="toggleSort('name')" class="group inline-flex items-center">
                          Customer
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'name'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Contact</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('total_spent')" class="group inline-flex items-center">
                          Total Spent
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'total_spent'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('last_order')" class="group inline-flex items-center">
                          Last Order
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'last_order'" :class="[
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
                    <tr v-for="customer in paginatedCustomers" :key="customer.id">
                      <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 dark:text-white">
                        <div class="flex items-center">
                          <img :src="customer.avatar" alt="" class="h-10 w-10 flex-shrink-0 rounded-full">
                          <div class="ml-4">
                            <div>{{ customer.name }}</div>
                            <div class="text-gray-500 dark:text-gray-400 text-xs">ID: {{ customer.id }}</div>
                          </div>
                        </div>
                      </td>
                      <td class="px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        <div>{{ customer.email }}</div>
                        <div>{{ customer.phone }}</div>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        ${{ (customer.total_spent ?? 0).toFixed(2) }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">
                        {{ customer.last_order || 'Never' }}
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm">
                        <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium" :class="getStatusClass(customer.status)">
                          {{ customer.status }}
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
                    <tr v-if="paginatedCustomers.length === 0">
                      <td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        No customers found matching your criteria
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
            <span class="font-medium">{{ Math.min(currentPage * itemsPerPage, filteredCustomers.length) }}</span> of
            <span class="font-medium">{{ filteredCustomers.length }}</span> results
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

    <!-- Add Customer Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeAddModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Add New Customer</h3>
              <div class="mt-4">
                <div class="space-y-4">
                  <div>
                    <label for="customer-name" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Full Name</label>
                    <div class="mt-2">
                      <input
                        type="text"
                        id="customer-name"
                        v-model="newCustomer.name"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter customer name"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="customer-email" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Email Address</label>
                    <div class="mt-2">
                      <input
                        type="email"
                        id="customer-email"
                        v-model="newCustomer.email"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter email address"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="customer-phone" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Phone Number</label>
                    <div class="mt-2">
                      <input
                        type="tel"
                        id="customer-phone"
                        v-model="newCustomer.phone"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                        placeholder="Enter phone number"
                      />
                    </div>
                  </div>

                  <div>
                    <label for="customer-status" class="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 text-left">Status</label>
                    <div class="mt-2">
                      <select
                        id="customer-status"
                        v-model="newCustomer.status"
                        class="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600"
                      >
                        <option v-for="status in statuses" :value="status">{{ status }}</option>
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
              @click="addCustomer"
              class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 sm:col-start-2"
            >
              Add Customer
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
