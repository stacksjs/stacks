<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'
// @ts-ignore
import { Dialog, DialogPanel } from '@stacksjs/dialog'
import { toast } from '@stacksjs/notification'

useHead({
  title: 'Dashboard - Products',
})

// Define product interface
interface Product {
  id: number
  name: string
  price: number
  category: string
  stock: number
  status: string
  images: string[]
  videos: string[]
  manufacturer: string
  variants: string[]
  unit: string
  taxRate: number
  similarProducts?: number[]
}

// Sample product data
const products = ref<Product[]>([
  {
    id: 1,
    name: 'Margherita Pizza',
    price: 12.99,
    category: 'Pizza',
    stock: 78,
    status: 'Active',
    images: [
      'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&q=80',
      'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&q=80'
    ],
    videos: [
      'https://example.com/videos/margherita-pizza.mp4'
    ],
    manufacturer: 'Pizza Palace',
    variants: ['Size', 'Crust Type'],
    unit: 'Whole',
    taxRate: 7,
    similarProducts: [2, 5]
  },
  {
    id: 2,
    name: 'Classic Cheeseburger',
    price: 9.99,
    category: 'Burgers',
    stock: 124,
    status: 'Active',
    images: [
      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&q=80',
      'https://images.unsplash.com/photo-1550317138-10000687a72b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&q=80'
    ],
    videos: [],
    manufacturer: 'Burger Bistro',
    variants: ['Size', 'Protein', 'Toppings'],
    unit: 'Piece',
    taxRate: 7
  },
  {
    id: 3,
    name: 'California Roll',
    price: 14.99,
    category: 'Sushi',
    stock: 45,
    status: 'Active',
    images: [
      'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&q=80',
      'https://images.unsplash.com/photo-1617196034183-421b4917c92d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&q=80'
    ],
    videos: [
      'https://example.com/videos/california-roll.mp4'
    ],
    manufacturer: 'Sushi Supreme',
    variants: ['Size'],
    unit: 'Piece',
    taxRate: 7
  },
  {
    id: 4,
    name: 'Street Tacos',
    price: 8.99,
    category: 'Mexican',
    stock: 92,
    status: 'Active',
    images: [
      'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&q=80'
    ],
    videos: [],
    manufacturer: 'Taco Tiempo',
    variants: ['Protein', 'Spice Level', 'Toppings'],
    unit: 'Piece',
    taxRate: 7
  },
  {
    id: 5,
    name: 'Fettuccine Alfredo',
    price: 13.99,
    category: 'Pasta',
    stock: 210,
    status: 'Active',
    images: [
      'https://images.unsplash.com/photo-1645112411341-6c4fd023882c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&q=80'
    ],
    videos: [],
    manufacturer: 'Pasta Paradise',
    variants: ['Size', 'Protein'],
    unit: 'Serving',
    taxRate: 7
  },
  {
    id: 6,
    name: 'Quinoa Bowl',
    price: 11.99,
    category: 'Healthy',
    stock: 35,
    status: 'Active',
    images: [
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&q=80'
    ],
    videos: [],
    manufacturer: 'Healthy Harvest',
    variants: ['Size', 'Protein', 'Dietary'],
    unit: 'Serving',
    taxRate: 7
  },
  {
    id: 7,
    name: 'Chocolate Lava Cake',
    price: 7.99,
    category: 'Desserts',
    stock: 68,
    status: 'Active',
    images: [
      'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&q=80'
    ],
    videos: [],
    manufacturer: 'Sweet Sensations',
    variants: ['Size', 'Sweetness'],
    unit: 'Piece',
    taxRate: 7
  },
  {
    id: 8,
    name: 'Iced Caramel Latte',
    price: 4.99,
    category: 'Beverages',
    stock: 112,
    status: 'Active',
    images: [
      'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&q=80'
    ],
    videos: [],
    manufacturer: 'Beverage Boutique',
    variants: ['Size', 'Sweetness'],
    unit: 'Milliliter',
    taxRate: 7
  },
  {
    id: 9,
    name: 'Veggie Spring Rolls',
    price: 6.99,
    category: 'Appetizers',
    stock: 54,
    status: 'Low Stock',
    images: [
      'https://images.unsplash.com/photo-1606333259737-6a88c0a0b8a3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&q=80',
      'https://images.unsplash.com/photo-1625938145744-e380515399b7?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&q=80'
    ],
    videos: [
      'https://example.com/videos/spring-rolls.mp4'
    ],
    manufacturer: 'Healthy Harvest',
    variants: ['Size', 'Sauce', 'Dietary'],
    unit: 'Piece',
    taxRate: 7
  },
  {
    id: 10,
    name: 'Buffalo Wings',
    price: 10.99,
    category: 'Appetizers',
    stock: 0,
    status: 'Out of Stock',
    images: [
      'https://images.unsplash.com/photo-1608039755401-742074f0548d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=100&q=80'
    ],
    videos: [],
    manufacturer: 'Burger Bistro',
    variants: ['Size', 'Spice Level', 'Sauce'],
    unit: 'Piece',
    taxRate: 7
  }
])

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('name')
const sortOrder = ref('asc')
const categoryFilter = ref('All')

// Edit dialog state
const showEditDialog = ref(false)
const editingProduct = ref<Product | null>(null)

// Similar products dialog state
const showSimilarProductsDialog = ref(false)

// Available categories
const categories = ['All', 'Electronics', 'Wearables', 'Audio', 'Accessories', 'Storage', 'Pizza', 'Burgers', 'Sushi', 'Mexican', 'Pasta', 'Healthy', 'Desserts', 'Beverages', 'Appetizers']

// Statuses for dropdown
const statuses = ['Active', 'Low Stock', 'Out of Stock']

// Function to open edit dialog
function openEditDialog(product: Product): void {
  editingProduct.value = JSON.parse(JSON.stringify(product)) as Product
  showEditDialog.value = true
}

// Function to save edited product
function saveProduct(): void {
  if (!editingProduct.value) return

  // Find the product index
  const index = products.value.findIndex(p => p.id === editingProduct.value.id)

  if (index !== -1) {
    // Update the product
    products.value[index] = editingProduct.value

    // Show success message
    toast({
      message: 'Product updated successfully',
      type: 'success',
    })

    // Close the dialog
    showEditDialog.value = false
  }
}

// Function to open similar products dialog
function openSimilarProductsDialog(product: Product): void {
  editingProduct.value = JSON.parse(JSON.stringify(product)) as Product
  showSimilarProductsDialog.value = true
}

// Function to save similar products
function saveSimilarProducts(): void {
  if (!editingProduct.value) return

  // Find the product index
  const index = products.value.findIndex(p => p.id === editingProduct.value.id)

  if (index !== -1 && editingProduct.value) {
    // Update only the similarProducts field
    products.value[index].similarProducts = editingProduct.value.similarProducts || []

    // Show success message
    toast({
      message: 'Similar products updated successfully',
      type: 'success',
    })

    // Close the dialog
    showSimilarProductsDialog.value = false
  }
}

// Computed filtered and sorted products
const filteredProducts = computed(() => {
  return products.value
    .filter(product => {
      // Apply search filter
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.value.toLowerCase())

      // Apply category filter
      const matchesCategory = categoryFilter.value === 'All' || product.category === categoryFilter.value

      return matchesSearch && matchesCategory
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy.value === 'price') {
        comparison = a.price - b.price
      } else if (sortBy.value === 'stock') {
        comparison = a.stock - b.stock
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
})

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(5)
const totalPages = computed(() => Math.ceil(filteredProducts.value.length / itemsPerPage.value))

const paginatedProducts = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredProducts.value.slice(start, end)
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
</script>

<template>
  <main>
    <div class="px-6 py-6 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl">
        <div class="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Products</h1>
            <p class="mt-2 text-sm text-gray-700 dark:text-gray-300">
              A list of all the products in your store
            </p>
          </div>
          <div class="mt-4 sm:mt-0">
            <button type="button" class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-1"></div>
              Add product
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
              placeholder="Search products..."
            />
          </div>

          <div class="flex flex-col sm:flex-row gap-4">
            <select
              v-model="categoryFilter"
              class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
            >
              <option v-for="category in categories" :key="category" :value="category">
                {{ category }}
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

        <!-- Products table -->
        <div class="mt-6 flow-root">
          <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table class="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-blue-gray-700">
                    <tr>
                      <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('name')" class="group inline-flex items-center">
                          Product
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'name'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('price')" class="group inline-flex items-center">
                          Price
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'price'" :class="[
                              sortOrder === 'asc' ? 'i-hugeicons-arrow-up-02' : 'i-hugeicons-arrow-down-02',
                              'h-4 w-4'
                            ]"></div>
                            <div v-else class="i-hugeicons-arrows-up-down h-4 w-4"></div>
                          </span>
                        </button>
                      </th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">Category</th>
                      <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                        <button @click="toggleSort('stock')" class="group inline-flex items-center">
                          Stock
                          <span class="ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible">
                            <div v-if="sortBy === 'stock'" :class="[
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
                    <tr v-for="product in paginatedProducts" :key="product.id">
                      <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 dark:text-white">
                        <div class="flex items-center">
                          <img :src="product.images[0]" alt="" class="h-10 w-10 flex-shrink-0 rounded-md object-cover">
                          <div class="ml-4">
                            <router-link :to="`/dashboard/commerce/products/detail/${product.id}`" class="hover:text-primary">
                              <div>{{ product.name }}</div>
                              <div class="text-gray-500 dark:text-gray-400 text-xs">#{{ product.id }}</div>
                            </router-link>
                          </div>
                        </div>
                      </td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">${{ product.price.toFixed(2) }}</td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ product.category }}</td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-300">{{ product.stock }}</td>
                      <td class="whitespace-nowrap px-3 py-4 text-sm">
                        <span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
                              :class="{
                                'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400': product.status === 'Active',
                                'bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-400': product.status === 'Low Stock',
                                'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400': product.status === 'Out of Stock'
                              }">
                          {{ product.status }}
                        </span>
                      </td>
                      <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div class="flex items-center justify-end space-x-2">
                          <router-link :to="`/dashboard/commerce/products/detail/${product.id}`" class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">
                            <div class="i-hugeicons-eye h-5 w-5"></div>
                          </router-link>
                          <button
                            type="button"
                            class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            @click="openEditDialog(product)"
                          >
                            <div class="i-hugeicons-license-draft h-5 w-5"></div>
                          </button>
                          <button type="button" class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">
                            <div class="i-hugeicons-waste h-5 w-5"></div>
                          </button>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="paginatedProducts.length === 0">
                      <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        No products found matching your criteria
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
            <span class="font-medium">{{ Math.min(currentPage * itemsPerPage, filteredProducts.length) }}</span> of
            <span class="font-medium">{{ filteredProducts.length }}</span> results
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

  <!-- Edit Product Dialog -->
  <transition name="fade" appear>
    <Dialog v-if="showEditDialog" @close="showEditDialog = false" class="relative z-50">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="mx-auto max-w-2xl w-full rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Edit Product</h3>
            <button
              class="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full p-1 dark:text-gray-300 dark:hover:text-gray-100"
              @click="showEditDialog = false"
            >
              <div class="i-hugeicons-x-mark h-5 w-5"></div>
            </button>
          </div>

          <div v-if="editingProduct" class="space-y-4">
            <!-- Basic Information -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="product-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                <input
                  id="product-name"
                  v-model="editingProduct.name"
                  type="text"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <label for="product-price" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Price</label>
                <input
                  id="product-price"
                  v-model.number="editingProduct.price"
                  type="number"
                  step="0.01"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <label for="product-category" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                <select
                  id="product-category"
                  v-model="editingProduct.category"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option v-for="category in categories.filter(c => c !== 'All')" :key="category" :value="category">
                    {{ category }}
                  </option>
                </select>
              </div>
              <div>
                <label for="product-stock" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Stock</label>
                <input
                  id="product-stock"
                  v-model.number="editingProduct.stock"
                  type="number"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <label for="product-status" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                <select
                  id="product-status"
                  v-model="editingProduct.status"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option v-for="status in statuses" :key="status" :value="status">
                    {{ status }}
                  </option>
                </select>
              </div>
              <div>
                <label for="product-manufacturer" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Manufacturer</label>
                <input
                  id="product-manufacturer"
                  v-model="editingProduct.manufacturer"
                  type="text"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
            </div>

            <!-- Similar Products Button -->
            <div>
              <button
                @click="openSimilarProductsDialog(editingProduct)"
                class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600"
              >
                <div class="i-hugeicons-link-02 h-5 w-5 mr-2"></div>
                Manage Similar Products
              </button>
            </div>

            <div class="flex justify-end space-x-3 mt-6">
              <button
                @click="showEditDialog = false"
                class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                @click="saveProduct"
                class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Save Changes
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  </transition>

  <!-- Similar Products Dialog -->
  <transition name="fade" appear>
    <Dialog v-if="showSimilarProductsDialog" @close="showSimilarProductsDialog = false" class="relative z-50">
      <div class="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div class="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel class="mx-auto max-w-2xl w-full rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Manage Similar Products</h3>
            <button
              class="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full p-1 dark:text-gray-300 dark:hover:text-gray-100"
              @click="showSimilarProductsDialog = false"
            >
              <div class="i-hugeicons-x-mark h-5 w-5"></div>
            </button>
          </div>

          <div v-if="editingProduct" class="space-y-4">
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Select products that are similar to <strong>{{ editingProduct.name }}</strong>. These will be shown as recommendations.
            </p>

            <div class="max-h-96 overflow-y-auto border border-gray-200 rounded-md dark:border-gray-700">
              <ul class="divide-y divide-gray-200 dark:divide-gray-700">
                <li
                  v-for="product in products.filter(p => p.id !== editingProduct.id)"
                  :key="product.id"
                  class="flex items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <input
                    :id="`similar-product-${product.id}`"
                    type="checkbox"
                    :value="product.id"
                    v-model="editingProduct.similarProducts"
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded dark:border-gray-600"
                  />
                  <label :for="`similar-product-${product.id}`" class="ml-3 flex items-center cursor-pointer">
                    <img :src="product.images[0]" alt="" class="h-10 w-10 flex-shrink-0 rounded-md object-cover">
                    <div class="ml-3">
                      <p class="text-sm font-medium text-gray-900 dark:text-white">{{ product.name }}</p>
                      <p class="text-sm text-gray-500 dark:text-gray-400">{{ product.category }} - ${{ product.price.toFixed(2) }}</p>
                    </div>
                  </label>
                </li>
              </ul>
            </div>

            <div class="flex justify-end space-x-3 mt-6">
              <button
                @click="showSimilarProductsDialog = false"
                class="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                @click="saveSimilarProducts"
                class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Save Changes
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  </transition>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
