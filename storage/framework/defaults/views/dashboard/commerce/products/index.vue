<route lang="yaml">
  meta:
    requiresAuth: true
</route>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import { useLocalStorage } from '@vueuse/core'
import { useProducts } from '../../../../functions/commerce/products'
import { useCategories } from '../../../../functions/commerce/products/categories'
import { useManufacturers } from '../../../../functions/commerce/products/manufacturers'
import ProductsTable from '../../../../components/Dashboard/Commerce/ProductsTable.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'
import type { Products } from '../../../../types/defaults'

useHead({
  title: 'Dashboard - Commerce Products',
})

// Get products data and functions from the composable
const { products, createProduct, fetchProducts } = useProducts()

// Get categories and manufacturers for dropdowns
const { categories, fetchCategories } = useCategories()
const { manufacturers, fetchManufacturers } = useManufacturers()

// Fetch all data on component mount
onMounted(async () => {
  await Promise.all([
    fetchProducts(),
    fetchCategories(),
    fetchManufacturers()
  ])
})

// View mode for grid/list toggle
const viewMode = useLocalStorage('products-view-mode', 'list')

// Filter and sort options
const categoryFilter = ref('all')
const sortBy = ref('name')
const sortOrder = ref('asc')

// Search and filtering
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = ref(5)

// Computed filtered products
const filteredProducts = computed(() => {
  return products.value
    .filter(product => {
      // Apply search filter
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        (product.category?.name || '').toLowerCase().includes(searchQuery.value.toLowerCase())

      // Apply category filter
      const matchesCategory = categoryFilter.value === 'all' || (product.category?.name || '') === categoryFilter.value

      return matchesSearch && matchesCategory
    })
    .sort((a, b) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy.value === 'price') {
        comparison = (a.price || 0) - (b.price || 0)
      } else if (sortBy.value === 'inventory') {
        comparison = (a.inventory_count || 0) - (b.inventory_count || 0)
      } else if (sortBy.value === 'dateAdded') {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
        comparison = dateA - dateB
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
})

const paginatedProducts = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredProducts.value.slice(start, end)
})

// Get unique categories for filter
const categoriesForFilter = computed(() => {
  const categoryCounts = products.value.reduce((acc, product) => {
    const categoryName = product.category?.name || 'Unknown'
    acc[categoryName] = (acc[categoryName] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return Object.entries(categoryCounts).map(([name, count]) => ({ name, count }))
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
  const totalPages = Math.ceil(filteredProducts.value.length / itemsPerPage.value)
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

// Product actions
function viewProduct(product: Products): void {
  console.log('View product:', product)
  // Implement view product logic
}

function editProduct(product: Products): void {
  console.log('Edit product:', product)
  // Implement edit product logic
}

// Define new product type
interface NewProduct {
  name: string
  description: string
  price: number
  salePrice: number | null
  category_id: number
  manufacturer_id: number
  tags: string[]
  imageUrl: string
  inventory: number
  status: string
  featured: boolean
  rating: number
  reviewCount: number
  dateAdded: string
}

// Status options for the dropdown
const statuses = computed(() => ['Active', 'Inactive', 'Draft', 'Archived'])

// Modal state
const showProductModal = ref(false)
const newProduct = ref<NewProduct>({
  name: '',
  description: '',
  price: 0,
  salePrice: null,
  category_id: 0,
  manufacturer_id: 0,
  tags: [],
  imageUrl: '',
  inventory: 0,
  status: 'Active',
  featured: false,
  rating: 0,
  reviewCount: 0,
  dateAdded: new Date().toISOString().split('T')[0] || ''
})

function openAddProductModal(): void {
  newProduct.value = {
    name: '',
    description: '',
    price: 0,
    salePrice: null,
    category_id: 0,
    manufacturer_id: 0,
    tags: [],
    imageUrl: '',
    inventory: 0,
    status: 'Active',
    featured: false,
    rating: 0,
    reviewCount: 0,
    dateAdded: new Date().toISOString().split('T')[0] || ''
  }
  showProductModal.value = true
}

function closeProductModal(): void {
  showProductModal.value = false
}

async function addProduct(): Promise<void> {
  // First add to local state for immediate UI update
  const id = Math.max(...products.value.map(p => p.id || 0)) + 1
  
  // Find the selected category and manufacturer
  const selectedCategory = categories.value.find(c => c.id === newProduct.value.category_id)
  const selectedManufacturer = manufacturers.value.find(m => m.id === newProduct.value.manufacturer_id)
  
  const newProductData = {
    id,
    uuid: `product-${id}`,
    name: newProduct.value.name,
    description: newProduct.value.description,
    price: newProduct.value.price,
    image_url: newProduct.value.imageUrl,
    is_available: newProduct.value.status === 'Active' ? 1 : 0,
    inventory_count: newProduct.value.inventory,
    preparation_time: 0,
    allergens: '',
    nutritional_info: '',
    category_id: newProduct.value.category_id,
    manufacturer_id: newProduct.value.manufacturer_id,
    created_at: new Date().toISOString(),
    manufacturer: selectedManufacturer,
    category: selectedCategory
  }
  products.value.push(newProductData)

  // Then send to server
  const productData = {
    name: newProduct.value.name,
    description: newProduct.value.description,
    price: newProduct.value.price,
    image_url: newProduct.value.imageUrl,
    is_available: newProduct.value.status === 'Active' ? 1 : 0,
    inventory_count: newProduct.value.inventory,
    preparation_time: 0,
    allergens: '',
    nutritional_info: '',
    category_id: newProduct.value.category_id,
    manufacturer_id: newProduct.value.manufacturer_id,
  }

  try {
    await createProduct(productData)
    closeProductModal()
  } catch (error) {
    // If server request fails, remove from local state
    products.value = products.value.filter(p => p.id !== id)
    console.error('Failed to create product:', error)
  }
}
</script>

<template>
  <div class="py-6">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
      <div class="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div class="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-medium text-gray-900 dark:text-white">Products</h2>
            <button
              @click="openAddProductModal"
              type="button"
              class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div class="i-hugeicons-plus-sign h-5 w-5 mr-2" />
              Add Product
            </button>
          </div>
          <div class="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <SearchFilter
              placeholder="Search products..."
              @search="handleSearch"
              class="w-full md:w-96"
            />
            <div class="flex flex-col sm:flex-row gap-4">
              <!-- Category filter -->
              <select
                v-model="categoryFilter"
                class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
              >
                <option value="all">All Categories</option>
                <option v-for="category in categoriesForFilter" :key="category.name" :value="category.name">
                  {{ category.name }} ({{ category.count }})
                </option>
              </select>

              <!-- View mode toggle -->
              <div class="flex rounded-md shadow-sm">
                <button
                  type="button"
                  @click="viewMode = 'grid'"
                  :class="[
                    'relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-semibold ring-1 ring-inset focus:z-10',
                    viewMode === 'grid'
                      ? 'bg-blue-600 text-white ring-blue-600'
                      : 'bg-white text-gray-900 ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700'
                  ]"
                >
                  <div class="i-hugeicons-grid h-5 w-5"></div>
                </button>
                <button
                  type="button"
                  @click="viewMode = 'list'"
                  :class="[
                    'relative -ml-px inline-flex items-center rounded-r-md px-3 py-2 text-sm font-semibold ring-1 ring-inset focus:z-10',
                    viewMode === 'list'
                      ? 'bg-blue-600 text-white ring-blue-600'
                      : 'bg-white text-gray-900 ring-gray-300 hover:bg-gray-50 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700 dark:hover:bg-blue-gray-700'
                  ]"
                >
                  <div class="i-hugeicons-right-to-left-list-number h-5 w-5"></div>
                </button>
              </div>

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

        <!-- Product Tables Component -->
        <ProductsTable
          :products="paginatedProducts"
          :search-query="searchQuery"
          :category-filter="categoryFilter"
          :sort-by="sortBy"
          :sort-order="sortOrder"
          :current-page="currentPage"
          :items-per-page="itemsPerPage"
          :categories="categoriesForFilter.map(c => c.name)"
          @toggle-sort="toggleSort"
          @change-page="handlePageChange"
          @previous-page="handlePrevPage"
          @next-page="handleNextPage"
          @view-product="viewProduct"
          @edit-product="editProduct"
        />

        <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <Pagination
            :current-page="currentPage"
            :total-items="filteredProducts.length"
            :items-per-page="itemsPerPage"
            @prev="handlePrevPage"
            @next="handleNextPage"
            @page="handlePageChange"
          />
        </div>
      </div>
    </div>

    <!-- Add/Edit Product Modal -->
    <div v-if="showProductModal" class="fixed inset-0 z-10 overflow-y-auto">
      <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-75"></div>

        <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 dark:bg-blue-gray-800">
          <div class="absolute right-0 top-0 pr-4 pt-4">
            <button
              type="button"
              @click="closeProductModal"
              class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-gray-800 dark:text-gray-500 dark:hover:text-gray-400"
            >
              <span class="sr-only">Close</span>
              <div class="i-hugeicons-can h-6 w-6"></div>
            </button>
          </div>
          <div class="sm:flex sm:items-start">
            <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                Add New Product
              </h3>
              <div class="mt-4">
                <form @submit.prevent="addProduct" class="space-y-4">
                  <!-- Product name -->
                  <div>
                    <label for="product-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                    <input
                      type="text"
                      id="product-name"
                      v-model="newProduct.name"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                      required
                    />
                  </div>

                  <!-- Product description -->
                  <div>
                    <label for="product-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                    <textarea
                      id="product-description"
                      v-model="newProduct.description"
                      rows="3"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                    ></textarea>
                  </div>

                  <!-- Price and sale price -->
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="product-price" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Price ($)</label>
                      <input
                        type="number"
                        id="product-price"
                        v-model="newProduct.price"
                        min="0"
                        step="0.01"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label for="product-sale-price" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Sale Price ($)</label>
                      <input
                        type="number"
                        id="product-sale-price"
                        v-model="newProduct.salePrice"
                        min="0"
                        step="0.01"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </div>
                  </div>

                  <!-- Category and manufacturer -->
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="product-category" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                      <select
                        id="product-category"
                        v-model="newProduct.category_id"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                        required
                      >
                        <option value="">Select a category</option>
                        <option v-for="category in categories" :key="category.id" :value="category.id">{{ category.name }}</option>
                      </select>
                    </div>
                    <div>
                      <label for="product-manufacturer" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Manufacturer</label>
                      <select
                        id="product-manufacturer"
                        v-model="newProduct.manufacturer_id"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                        required
                      >
                        <option value="">Select a manufacturer</option>
                        <option v-for="manufacturer in manufacturers" :key="manufacturer.id" :value="manufacturer.id">{{ manufacturer.name }}</option>
                      </select>
                    </div>
                  </div>

                  <!-- Inventory and status -->
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <label for="product-inventory" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Inventory</label>
                      <input
                        type="number"
                        id="product-inventory"
                        v-model="newProduct.inventory"
                        min="0"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label for="product-status" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                      <select
                        id="product-status"
                        v-model="newProduct.status"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                      >
                        <option v-for="status in statuses.slice(1)" :key="status" :value="status">{{ status }}</option>
                      </select>
                    </div>
                  </div>

                  <!-- Featured checkbox -->
                  <div class="mt-4">
                    <div class="flex items-center">
                      <input
                        id="product-featured"
                        type="checkbox"
                        v-model="newProduct.featured"
                        class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                      />
                      <label for="product-featured" class="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Featured product</label>
                    </div>
                  </div>

                  <!-- Image URL -->
                  <div>
                    <label for="product-image" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Image URL</label>
                    <input
                      type="text"
                      id="product-image"
                      v-model="newProduct.imageUrl"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>

                  <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto"
                    >
                      Add Product
                    </button>
                    <button
                      type="button"
                      @click="closeProductModal"
                      class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto dark:bg-blue-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-blue-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
