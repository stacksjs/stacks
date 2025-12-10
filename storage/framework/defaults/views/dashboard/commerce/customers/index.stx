<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import { useCustomers } from '../../../../functions/commerce/customers'
import CustomersTable from '../../../../components/Dashboard/Commerce/CustomersTable.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'

useHead({
  title: 'Dashboard - Commerce Customers',
})

// Get customers data and functions from the composable
const { customers, createCustomer, fetchCustomers, deleteCustomer } = useCustomers()

// Fetch customers on component mount
onMounted(async () => {
  await fetchCustomers()
})

// Available statuses
const statuses = ['all', 'Active', 'Inactive'] as const
const statusFilter = ref('all')
const sortBy = ref('name')
const sortOrder = ref('asc')

// Search and filtering
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(5)

// Computed filtered customers
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

const paginatedCustomers = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredCustomers.value.slice(start, end)
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
  const totalPages = Math.ceil(filteredCustomers.value.length / itemsPerPage.value)
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

// Customer actions
function viewCustomer(customer: any): void {
  console.log('View customer:', customer)
  // Implement view customer logic
}

function editCustomer(customer: any): void {
  console.log('Edit customer:', customer)
  // Implement edit customer logic
}

function removeCustomer(customer: any): void {
  customerToDelete.value = customer
  showDeleteModal.value = true
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
const showDeleteModal = ref(false)
const customerToDelete = ref<any>(null)
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

function closeDeleteModal(): void {
  showDeleteModal.value = false
  customerToDelete.value = null
}

async function confirmDelete(): Promise<void> {
  if (!customerToDelete.value) return

  const customerId = customerToDelete.value.id
  
  // Remove from local state for immediate UI update
  customers.value = customers.value.filter(c => c.id !== customerId)
  
  try {
    // TODO: Implement actual API call to delete customer
    await deleteCustomer(customerId)
    closeDeleteModal()
  } catch (error) {
    // If server request fails, restore to local state
    customers.value.push(customerToDelete.value)
    console.error('Failed to delete customer:', error)
  }
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
    const response = await createCustomer(customerData)
    console.log(response)
  } catch (error) {
    // If server request fails, remove from local state
    customers.value = customers.value.filter(c => c.id !== id)
    console.error('Failed to create customer:', error)
  }

  
}
</script>

<template>
  <div class="py-6">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
      <div class="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div class="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-medium text-gray-900 dark:text-white">Customers</h2>
            <button
              @click="openAddModal"
              type="button"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-2" />
              Add Customer
            </button>
          </div>
          <div class="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <SearchFilter
              placeholder="Search customers..."
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

        <!-- Customer Tables Component -->
        <CustomersTable
          :customers="paginatedCustomers"
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
          @view-customer="viewCustomer"
          @edit-customer="editCustomer"
          @delete-customer="removeCustomer"
        />

        <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <Pagination
            :current-page="currentPage"
            :total-items="filteredCustomers.length"
            :items-per-page="itemsPerPage"
            @prev="handlePrevPage"
            @next="handleNextPage"
            @page="handlePageChange"
          />
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

    <!-- Delete Customer Confirmation Modal -->
    <div v-if="showDeleteModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="closeDeleteModal"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div>
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
              <div class="i-hugeicons-alert-triangle h-6 w-6 text-red-600 dark:text-red-400"></div>
            </div>
            <div class="mt-3 text-center sm:mt-5">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">Delete Customer</h3>
              <div class="mt-2">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Are you sure you want to delete <strong>{{ customerToDelete?.name }}</strong>? This action cannot be undone.
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
              Delete Customer
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
