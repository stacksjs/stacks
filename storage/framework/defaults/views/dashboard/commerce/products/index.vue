<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useHead } from '@vueuse/head'
import { useLocalStorage } from '@vueuse/core'
import { useProducts } from '../../../../functions/commerce/products/products'
import ProductTables from '../../../../components/Dashboard/Commerce/ProductTables.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'
import type { Products } from '../../../../functions/types'

useHead({
  title: 'Dashboard - Commerce Products',
})

// Get products store
const productsStore = useProducts()

// Fetch products on component mount
onMounted(async () => {
  await productsStore.fetchProducts()
})

// View mode for grid/list toggle
const viewMode = useLocalStorage('products-view-mode', 'list')

// Available statuses
const statuses = ['all', 'Active', 'Coming Soon', 'Low Stock', 'Out of Stock', 'Discontinued'] as const

// Event handlers
const handleSearch = (query: string) => {
  productsStore.setSearchQuery(query)
}

const handlePrevPage = () => {
  productsStore.previousPage()
}

const handleNextPage = () => {
  productsStore.nextPage()
}

const handlePageChange = (page: number) => {
  productsStore.setCurrentPage(page)
}

// Toggle sort order
function toggleSort(column: string): void {
  productsStore.setSortBy(column)
}

// Product actions
function viewProduct(product: Products): void {
  productsStore.viewProduct(product)
}

function editProduct(product: Products): void {
  productsStore.editProduct(product)
}

// Define new product type
interface NewProduct {
  name: string
  description: string
  price: number
  salePrice: number | null
  category: string
  manufacturer: string
  tags: string[]
  imageUrl: string
  inventory: number
  status: string
  featured: boolean
  rating: number
  reviewCount: number
  dateAdded: string
}

// Modal state
const showProductModal = ref(false)
const newProduct = ref<NewProduct>({
  name: '',
  description: '',
  price: 0,
  salePrice: null,
  category: '',
  manufacturer: '',
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
    category: '',
    manufacturer: '',
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
  const productData = {
    name: newProduct.value.name,
    description: newProduct.value.description,
    price: newProduct.value.price,
    salePrice: newProduct.value.salePrice,
    category: newProduct.value.category,
    manufacturer: newProduct.value.manufacturer,
    tags: newProduct.value.tags,
    imageUrl: newProduct.value.imageUrl,
    inventory: newProduct.value.inventory,
    status: newProduct.value.status,
    featured: newProduct.value.featured,
    rating: newProduct.value.rating,
    reviewCount: newProduct.value.reviewCount,
    dateAdded: newProduct.value.dateAdded
  }

  try {
    await productsStore.createProduct(productData)
    closeProductModal()
  } catch (error) {
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
                :model-value="productsStore.getCategoryFilter"
                @update:model-value="productsStore.setCategoryFilter"
                class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
              >
                <option value="all">All Categories</option>
                <option v-for="category in productsStore.getCategories" :key="category.id" :value="category.name">
                  {{ category.name }} ({{ category.count }})
                </option>
              </select>

              <!-- Status filter -->
              <select
                :model-value="productsStore.getStatusFilter"
                @update:model-value="productsStore.setStatusFilter"
                class="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-blue-gray-800 dark:text-white dark:ring-gray-700"
              >
                <option value="all">All Statuses</option>
                <option v-for="status in statuses.slice(1)" :key="status" :value="status">
                  {{ status }}
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
                :model-value="productsStore.getItemsPerPage"
                @update:model-value="productsStore.setItemsPerPage"
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
        <ProductTables
          :products="productsStore.paginatedProducts"
          :search-query="productsStore.getSearchQuery"
          :status-filter="productsStore.getStatusFilter"
          :category-filter="productsStore.getCategoryFilter"
          :sort-by="productsStore.getSortBy"
          :sort-order="productsStore.getSortOrder"
          :current-page="productsStore.getCurrentPage"
          :items-per-page="productsStore.getItemsPerPage"
          :statuses="statuses"
          :categories="productsStore.getCategories.map((c: any) => c.name)"
          @toggle-sort="toggleSort"
          @change-page="handlePageChange"
          @previous-page="handlePrevPage"
          @next-page="handleNextPage"
          @view-product="viewProduct"
          @edit-product="editProduct"
        />

        <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <Pagination
            :current-page="productsStore.getCurrentPage"
            :total-items="productsStore.filteredProducts.length"
            :items-per-page="productsStore.getItemsPerPage"
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
                      <input
                        type="text"
                        id="product-category"
                        v-model="newProduct.category"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label for="product-manufacturer" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Manufacturer</label>
                      <input
                        type="text"
                        id="product-manufacturer"
                        v-model="newProduct.manufacturer"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                        required
                      />
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
