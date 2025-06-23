<script lang="ts" setup>
import { ref, computed } from 'vue'
import { useHead } from '@vueuse/head'
import { useLocalStorage } from '@vueuse/core'
import ProductTables from '../../../../components/Dashboard/Commerce/ProductTables.vue'
import Pagination from '../../../../components/Dashboard/Commerce/Delivery/Pagination.vue'
import SearchFilter from '../../../../components/Dashboard/Commerce/Delivery/SearchFilter.vue'
import type { Products, ProductCategories } from '../../../../functions/types'

useHead({
  title: 'Dashboard - Commerce Products',
})

// Sample products data (DoorDash-like food products)
const products = ref<Products[]>([
  {
    id: 1,
    name: 'Classic Cheeseburger',
    description: 'Juicy beef patty with melted cheese, lettuce, tomato, and special sauce on a brioche bun',
    price: 12.99,
    salePrice: null,
    category: 'Burgers',
    manufacturer: 'Burger Joint',
    tags: ['beef', 'cheese', 'popular'],
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 100,
    status: 'Active',
    featured: true,
    rating: 4.8,
    reviewCount: 243,
    dateAdded: '2023-10-15'
  },
  {
    id: 2,
    name: 'Margherita Pizza',
    description: 'Classic pizza with tomato sauce, fresh mozzarella, basil, and olive oil on a thin crust',
    price: 14.99,
    salePrice: 12.99,
    category: 'Pizza',
    manufacturer: 'Pizza Palace',
    tags: ['vegetarian', 'italian', 'popular'],
    imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 80,
    status: 'Active',
    featured: true,
    rating: 4.7,
    reviewCount: 189,
    dateAdded: '2023-10-20'
  },
  {
    id: 3,
    name: 'Chicken Caesar Salad',
    description: 'Crisp romaine lettuce with grilled chicken, parmesan cheese, croutons, and Caesar dressing',
    price: 11.99,
    salePrice: null,
    category: 'Salads',
    manufacturer: 'Fresh Greens',
    tags: ['chicken', 'healthy'],
    imageUrl: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 50,
    status: 'Active',
    featured: false,
    rating: 4.5,
    reviewCount: 124,
    dateAdded: '2023-11-05'
  },
  {
    id: 4,
    name: 'Spicy Ramen Bowl',
    description: 'Authentic Japanese ramen with spicy broth, sliced pork, soft-boiled egg, and fresh vegetables',
    price: 15.99,
    salePrice: null,
    category: 'Asian',
    manufacturer: 'Noodle House',
    tags: ['spicy', 'japanese', 'popular'],
    imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 60,
    status: 'Active',
    featured: true,
    rating: 4.9,
    reviewCount: 201,
    dateAdded: '2023-11-10'
  },
  {
    id: 5,
    name: 'Veggie Wrap',
    description: 'Fresh vegetables, hummus, and feta cheese wrapped in a spinach tortilla',
    price: 9.99,
    salePrice: 8.49,
    category: 'Wraps',
    manufacturer: 'Wrap Masters',
    tags: ['vegetarian', 'healthy'],
    imageUrl: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 40,
    status: 'Active',
    featured: false,
    rating: 4.4,
    reviewCount: 98,
    dateAdded: '2023-11-15'
  },
  {
    id: 6,
    name: 'BBQ Pulled Pork Sandwich',
    description: 'Slow-cooked pulled pork with BBQ sauce, coleslaw, and pickles on a brioche bun',
    price: 13.99,
    salePrice: null,
    category: 'Sandwiches',
    manufacturer: 'Smokey BBQ',
    tags: ['pork', 'bbq'],
    imageUrl: 'https://images.unsplash.com/photo-1513185041617-8ab03f83d6c5?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 35,
    status: 'Active',
    featured: false,
    rating: 4.6,
    reviewCount: 156,
    dateAdded: '2023-11-20'
  },
  {
    id: 7,
    name: 'Chocolate Brownie Sundae',
    description: 'Warm chocolate brownie topped with vanilla ice cream, chocolate sauce, and whipped cream',
    price: 8.99,
    salePrice: null,
    category: 'Desserts',
    manufacturer: 'Sweet Treats',
    tags: ['chocolate', 'sweet', 'popular'],
    imageUrl: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 45,
    status: 'Active',
    featured: true,
    rating: 4.9,
    reviewCount: 178,
    dateAdded: '2023-11-25'
  },
  {
    id: 8,
    name: 'Iced Caramel Macchiato',
    description: 'Espresso with vanilla syrup, milk, and caramel drizzle over ice',
    price: 5.99,
    salePrice: null,
    category: 'Beverages',
    manufacturer: 'Coffee Co.',
    tags: ['coffee', 'cold'],
    imageUrl: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 120,
    status: 'Active',
    featured: false,
    rating: 4.7,
    reviewCount: 143,
    dateAdded: '2023-12-01'
  },
  {
    id: 9,
    name: 'Chicken Wings (12 pc)',
    description: 'Crispy chicken wings with your choice of sauce: Buffalo, BBQ, or Honey Garlic',
    price: 16.99,
    salePrice: 14.99,
    category: 'Appetizers',
    manufacturer: 'Wing World',
    tags: ['chicken', 'spicy', 'popular'],
    imageUrl: 'https://images.unsplash.com/photo-1608039755401-742074f0548d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 70,
    status: 'Active',
    featured: true,
    rating: 4.8,
    reviewCount: 215,
    dateAdded: '2023-12-05'
  },
  {
    id: 10,
    name: 'Vegetable Stir Fry',
    description: 'Fresh vegetables stir-fried with tofu in a savory sauce, served with steamed rice',
    price: 13.49,
    salePrice: null,
    category: 'Asian',
    manufacturer: 'Wok & Roll',
    tags: ['vegetarian', 'healthy'],
    imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 30,
    status: 'Active',
    featured: false,
    rating: 4.5,
    reviewCount: 87,
    dateAdded: '2023-12-10'
  },
  {
    id: 11,
    name: 'Beef Tacos (3 pc)',
    description: 'Soft corn tortillas filled with seasoned beef, lettuce, cheese, and pico de gallo',
    price: 10.99,
    salePrice: null,
    category: 'Mexican',
    manufacturer: 'Taco Time',
    tags: ['beef', 'spicy'],
    imageUrl: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 55,
    status: 'Active',
    featured: false,
    rating: 4.6,
    reviewCount: 132,
    dateAdded: '2023-12-15'
  },
  {
    id: 12,
    name: 'Strawberry Cheesecake',
    description: 'Creamy New York-style cheesecake topped with fresh strawberry sauce',
    price: 7.99,
    salePrice: null,
    category: 'Desserts',
    manufacturer: 'Sweet Treats',
    tags: ['sweet', 'popular'],
    imageUrl: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 25,
    status: 'Low Stock',
    featured: true,
    rating: 4.9,
    reviewCount: 167,
    dateAdded: '2023-12-20'
  },
  {
    id: 13,
    name: 'Truffle Mushroom Pasta',
    description: 'Handmade fettuccine with wild mushrooms, truffle oil, and parmesan cream sauce',
    price: 18.99,
    salePrice: null,
    category: 'Pasta',
    manufacturer: 'Pasta Paradise',
    tags: ['vegetarian', 'premium', 'new'],
    imageUrl: 'https://images.unsplash.com/photo-1555072956-7758afb20e8f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 0,
    status: 'Coming Soon',
    featured: true,
    rating: 0,
    reviewCount: 0,
    dateAdded: '2024-01-15'
  },
  {
    id: 14,
    name: 'Matcha Green Tea Latte',
    description: 'Premium Japanese matcha powder whisked with steamed milk and a touch of honey',
    price: 6.49,
    salePrice: null,
    category: 'Beverages',
    manufacturer: 'Tea Time',
    tags: ['tea', 'japanese', 'new'],
    imageUrl: 'https://images.unsplash.com/photo-1536013455962-2668f3b24cdd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=500&h=500&q=80',
    inventory: 0,
    status: 'Coming Soon',
    featured: false,
    rating: 0,
    reviewCount: 0,
    dateAdded: '2024-01-20'
  }
])

// Categories derived from products
const categories = computed<ProductCategories[]>(() => {
  const categoryMap = new Map<string, number>()

  products.value.forEach((product: Products) => {
    const count = categoryMap.get(product.category) || 0
    categoryMap.set(product.category, count + 1)
  })

  return Array.from(categoryMap.entries()).map(([name, count], index) => ({
    id: index + 1,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    count
  }))
})

// Filter and sort options
const searchQuery = ref('')
const sortBy = ref('dateAdded')
const sortOrder = ref('desc')
const categoryFilter = ref('all')
const statusFilter = ref('all')
const viewMode = useLocalStorage('products-view-mode', 'list') // Default to list view and save in localStorage

// Available statuses
const statuses = ['all', 'Active', 'Coming Soon', 'Low Stock', 'Out of Stock', 'Discontinued'] as const

// Computed filtered and sorted products
const filteredProducts = computed(() => {
  return products.value
    .filter((product: Products) => {
      // Apply search filter
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        product.description.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        product.tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.value.toLowerCase()))

      // Apply category filter
      const matchesCategory = categoryFilter.value === 'all' || product.category === categoryFilter.value

      // Apply status filter
      const matchesStatus = statusFilter.value === 'all' || product.status === statusFilter.value

      return matchesSearch && matchesCategory && matchesStatus
    })
    .sort((a: Products, b: Products) => {
      // Apply sorting
      let comparison = 0
      if (sortBy.value === 'dateAdded') {
        comparison = new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime()
      } else if (sortBy.value === 'price') {
        const aPrice = a.salePrice !== null ? a.salePrice : a.price
        const bPrice = b.salePrice !== null ? b.salePrice : b.price
        comparison = aPrice - bPrice
      } else if (sortBy.value === 'name') {
        comparison = a.name.localeCompare(b.name)
      } else if (sortBy.value === 'rating') {
        comparison = a.rating - b.rating
      }

      return sortOrder.value === 'asc' ? comparison : -comparison
    })
})

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(8)

const paginatedProducts = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredProducts.value.slice(start, end)
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
    sortOrder.value = 'desc'
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

function deleteProduct(productId: number): void {
  if (confirm('Are you sure you want to delete this product?')) {
    const index = products.value.findIndex((p: Products) => p.id === productId)
    if (index !== -1) {
      products.value.splice(index, 1)
    }
  }
}

// Modal state for adding/editing product
const showProductModal = ref(false)
const isEditMode = ref(false)
const currentProduct = ref<Products | null>(null)

// Computed properties for form fields to handle null currentProduct
const productName = computed({
  get: () => currentProduct.value?.name || '',
  set: (value) => { if (currentProduct.value) currentProduct.value.name = value }
})

const productDescription = computed({
  get: () => currentProduct.value?.description || '',
  set: (value) => { if (currentProduct.value) currentProduct.value.description = value }
})

const productPrice = computed({
  get: () => currentProduct.value?.price || 0,
  set: (value) => { if (currentProduct.value) currentProduct.value.price = value }
})

const productSalePrice = computed({
  get: () => currentProduct.value?.salePrice || null,
  set: (value) => { if (currentProduct.value) currentProduct.value.salePrice = value }
})

const productCategory = computed({
  get: () => currentProduct.value?.category || '',
  set: (value) => { if (currentProduct.value) currentProduct.value.category = value }
})

const productManufacturer = computed({
  get: () => currentProduct.value?.manufacturer || '',
  set: (value) => { if (currentProduct.value) currentProduct.value.manufacturer = value }
})

const productInventory = computed({
  get: () => currentProduct.value?.inventory || 0,
  set: (value) => { if (currentProduct.value) currentProduct.value.inventory = value }
})

const productStatus = computed({
  get: () => currentProduct.value?.status || 'Active',
  set: (value) => { if (currentProduct.value) currentProduct.value.status = value }
})

const productFeatured = computed({
  get: () => currentProduct.value?.featured || false,
  set: (value) => { if (currentProduct.value) currentProduct.value.featured = value }
})

const productImageUrl = computed({
  get: () => currentProduct.value?.imageUrl || '',
  set: (value) => { if (currentProduct.value) currentProduct.value.imageUrl = value }
})

function openAddProductModal(): void {
  isEditMode.value = false
  currentProduct.value = {
    id: Math.max(...products.value.map((p: Products) => p.id)) + 1,
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

function saveProduct(): void {
  if (!currentProduct.value) return

  if (isEditMode.value) {
    // Update existing product
    const index = products.value.findIndex((p: Products) => p.id === currentProduct.value!.id)
    if (index !== -1) {
      products.value[index] = { ...currentProduct.value }
    }
  } else {
    // Add new product
    products.value.push({ ...currentProduct.value })
  }

  closeProductModal()
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
                <option v-for="category in categories" :key="category.id" :value="category.name">
                  {{ category.name }} ({{ category.count }})
                </option>
              </select>

              <!-- Status filter -->
              <select
                v-model="statusFilter"
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
        <ProductTables
          :products="paginatedProducts"
          :search-query="searchQuery"
          :status-filter="statusFilter"
          :category-filter="categoryFilter"
          :sort-by="sortBy"
          :sort-order="sortOrder"
          :current-page="currentPage"
          :items-per-page="itemsPerPage"
          :statuses="statuses"
          :categories="categories.map(c => c.name)"
          @toggle-sort="toggleSort"
          @change-page="handlePageChange"
          @previous-page="handlePrevPage"
          @next-page="handleNextPage"
          @view-product="viewProduct"
          @edit-product="editProduct"
          @delete-product="deleteProduct"
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
                {{ isEditMode ? 'Edit Product' : 'Add New Product' }}
              </h3>
              <div class="mt-4">
                <form @submit.prevent="saveProduct" class="space-y-4">
                  <!-- Product name -->
                  <div>
                    <label for="product-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                    <input
                      type="text"
                      id="product-name"
                      v-model="productName"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                      required
                    />
                  </div>

                  <!-- Product description -->
                  <div>
                    <label for="product-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                    <textarea
                      id="product-description"
                      v-model="productDescription"
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
                        v-model="productPrice"
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
                        v-model="productSalePrice"
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
                        v-model="productCategory"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label for="product-manufacturer" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Manufacturer</label>
                      <input
                        type="text"
                        id="product-manufacturer"
                        v-model="productManufacturer"
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
                        v-model="productInventory"
                        min="0"
                        class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label for="product-status" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                      <select
                        id="product-status"
                        v-model="productStatus"
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
                        v-model="productFeatured"
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
                      v-model="productImageUrl"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-blue-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>

                  <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      class="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto"
                    >
                      {{ isEditMode ? 'Save Changes' : 'Add Product' }}
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
